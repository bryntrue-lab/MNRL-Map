"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;
const SCHEDULE = "0 7 * * 5";
const TIME_ZONE = "America/Chicago";

function millis(value) {
  const valueMillis = value?.toMillis?.();
  const parsed = valueMillis ?? new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

function reportWindow(scheduleTime) {
  const endMs = millis(scheduleTime);
  if (!Number.isFinite(endMs)) {
    throw new Error("weekly usage report requires a valid scheduleTime");
  }
  return {
    endMs,
    start7Ms: endMs - 7 * DAY_MS,
    start30Ms: endMs - 30 * DAY_MS,
  };
}

function summarizeAuthUsers(users, window) {
  const summary = {
    total: 0,
    anonymous: 0,
    password: 0,
    otherProvider: 0,
    new7: 0,
    new30: 0,
  };
  for (const user of users) {
    summary.total++;
    const providers = Array.isArray(user.providerData) ? user.providerData : [];
    if (providers.length === 0) summary.anonymous++;
    else if (providers.some((provider) => provider?.providerId === "password")) {
      summary.password++;
    } else {
      summary.otherProvider++;
    }

    const createdMs = millis(user.metadata?.creationTime);
    if (createdMs >= window.start30Ms && createdMs < window.endMs) {
      summary.new30++;
      if (createdMs >= window.start7Ms) summary.new7++;
    }
  }
  return summary;
}

async function authNumbers(auth, window) {
  const total = {
    total: 0,
    anonymous: 0,
    password: 0,
    otherProvider: 0,
    new7: 0,
    new30: 0,
  };
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    const pageSummary = summarizeAuthUsers(page.users, window);
    for (const key of Object.keys(total)) total[key] += pageSummary[key];
    pageToken = page.pageToken;
  } while (pageToken);
  return total;
}

function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function summarizeActivity(events, window) {
  const accountDays30 = new Map();
  const accountDays7 = new Map();
  for (const event of events) {
    const atMs = millis(event.at);
    if (!(atMs >= window.start30Ms && atMs < window.endMs)) continue;
    const day = utcDay(atMs);
    if (!accountDays30.has(event.uid)) accountDays30.set(event.uid, new Set());
    accountDays30.get(event.uid).add(day);
    if (atMs >= window.start7Ms) {
      if (!accountDays7.has(event.uid)) accountDays7.set(event.uid, new Set());
      accountDays7.get(event.uid).add(day);
    }
  }
  const summarize = (accountDays) => {
    const activeAccounts = accountDays.size;
    const activeAccountDays = [...accountDays.values()]
      .reduce((sum, days) => sum + days.size, 0);
    const returningAccounts = [...accountDays.values()]
      .filter((days) => days.size >= 2).length;
    return {
      activeAccounts,
      activeAccountDays,
      returningAccounts,
      averageDays: activeAccounts === 0 ? 0 : activeAccountDays / activeAccounts,
    };
  };
  return { days7: summarize(accountDays7), days30: summarize(accountDays30) };
}

function summarizeEventCounts(events, window) {
  let days7 = 0;
  let days30 = 0;
  for (const event of events) {
    const atMs = millis(event.at);
    if (atMs >= window.start30Ms && atMs < window.endMs) {
      days30++;
      if (atMs >= window.start7Ms) days7++;
    }
  }
  return { days7, days30 };
}

function uidFromDocument(doc) {
  const uid = doc.ref?.parent?.parent?.id;
  if (typeof uid !== "string" || uid.length === 0) {
    throw new Error("activity document did not have a user parent");
  }
  return uid;
}

async function timestampEvents(db, collectionGroup, field, window) {
  const events = [];
  let cursor;
  do {
    let query = db.collectionGroup(collectionGroup)
      .select(field)
      .where(field, ">=", Timestamp.fromMillis(window.start30Ms))
      .where(field, "<", Timestamp.fromMillis(window.endMs))
      .orderBy(field)
      .limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const doc of page.docs) {
      events.push({ uid: uidFromDocument(doc), at: doc.get(field) });
    }
    cursor = page.docs.at(-1);
    if (page.size < PAGE_SIZE) break;
  } while (cursor);
  return events;
}

async function firestoreNumbers(db, window) {
  const end = Timestamp.fromMillis(window.endMs);
  const [onboarded, notesLifetime, completionsLifetime, ...eventGroups] =
    await Promise.all([
      db.collection("users").where("onboarded", "==", true).count().get(),
      db.collectionGroup("fieldNotes").where("createdAt", "<", end).count().get(),
      db.collectionGroup("userEncounters").where("completedAt", "<", end).count().get(),
      timestampEvents(db, "fieldNotes", "createdAt", window),
      timestampEvents(db, "userEncounters", "startedAt", window),
      timestampEvents(db, "userEncounters", "completedAt", window),
      timestampEvents(db, "userEncounters", "visitedAt", window),
    ]);
  const [notes, starts, completions] = eventGroups
    .slice(0, 3)
    .map((events) => summarizeEventCounts(events, window));
  return {
    onboarded: onboarded.data().count,
    notesLifetime: notesLifetime.data().count,
    completionsLifetime: completionsLifetime.data().count,
    activity: summarizeActivity(eventGroups.flat(), window),
    recent: {
      days7: {
        notes: notes.days7,
        starts: starts.days7,
        completions: completions.days7,
      },
      days30: {
        notes: notes.days30,
        starts: starts.days30,
        completions: completions.days30,
      },
    },
  };
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function frequencyText(value) {
  return value.toFixed(2);
}

function buildReport({ auth, firestore, window }) {
  const lines = [
    "Mineral weekly aggregate usage",
    "",
    `Reporting end (scheduled event): ${iso(window.endMs)}`,
    `Trailing 7 days: [${iso(window.start7Ms)}, ${iso(window.endMs)})`,
    `Trailing 30 days: [${iso(window.start30Ms)}, ${iso(window.endMs)})`,
    "",
    "Accounts",
    `  Current Auth accounts: ${auth.total}`,
    `  Anonymous: ${auth.anonymous}`,
    `  Password: ${auth.password}`,
    `  Other provider: ${auth.otherProvider}`,
    `  New accounts, trailing 7 days: ${auth.new7}`,
    `  New accounts, trailing 30 days: ${auth.new30}`,
    `  Users onboarded: ${firestore.onboarded}`,
    "",
    "Activity",
    `  Trailing 7 days: ${firestore.activity.days7.activeAccounts} active accounts · ${firestore.activity.days7.returningAccounts} returning on 2+ UTC days · ${firestore.activity.days7.activeAccountDays} UTC active account-days · ${frequencyText(firestore.activity.days7.averageDays)} days per active account`,
    `  Events: ${firestore.recent.days7.notes} notes · ${firestore.recent.days7.starts} encounter starts · ${firestore.recent.days7.completions} encounter completions`,
    `  Trailing 30 days: ${firestore.activity.days30.activeAccounts} active accounts · ${firestore.activity.days30.returningAccounts} returning on 2+ UTC days · ${firestore.activity.days30.activeAccountDays} UTC active account-days · ${frequencyText(firestore.activity.days30.averageDays)} days per active account`,
    `  Events: ${firestore.recent.days30.notes} notes · ${firestore.recent.days30.starts} encounter starts · ${firestore.recent.days30.completions} encounter completions`,
    "",
    "Lifetime",
    `  Notes created before reporting end: ${firestore.notesLifetime}`,
    `  Encounters completed before reporting end: ${firestore.completionsLifetime}`,
    "",
    "Definitions and caveats",
    "  Accounts are not people. Anonymous, password, and other-provider counts describe current Firebase Auth accounts.",
    "  Development and production data are shared here; there is no exclusion marker.",
    "  Active means a distinct account with a note createdAt or encounter startedAt, completedAt, or visitedAt in the window.",
    "  Active days are distinct UTC calendar days per active account; frequency is active account-days divided by active accounts.",
    "  Returning means an active account with activity on at least 2 distinct UTC days in that window.",
    "  Event counts use note createdAt, encounter startedAt, and encounter completedAt respectively.",
    "  Mineral does not track session duration. Encounter timestamps are activity signals, not sessions or time spent.",
    "  Windows are half-open intervals: the start is included and the reporting end is excluded.",
  ];
  return {
    subject: `Mineral weekly usage · through ${iso(window.endMs)}`,
    text: lines.join("\n"),
  };
}

function reportId(window) {
  return `weekly-usage-${iso(window.endMs).replace(/[:.]/g, "-")}`;
}

async function createOutboxDocument(db, id, recipient, message) {
  try {
    await db.doc(`mail/${id}`).create({
      to: recipient,
      message,
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    if (error?.code === 6 || error?.code === "already-exists") return false;
    throw error;
  }
}

async function runWeeklyUsageReport({ db, auth, recipient, scheduleTime }) {
  if (!recipient) throw new Error("FOUNDER_DIGEST_EMAIL is not set");
  const window = reportWindow(scheduleTime);
  const [authSummary, firestoreSummary] = await Promise.all([
    authNumbers(auth, window),
    firestoreNumbers(db, window),
  ]);
  const id = reportId(window);
  const created = await createOutboxDocument(
    db,
    id,
    recipient,
    buildReport({ auth: authSummary, firestore: firestoreSummary, window })
  );
  console.info(created ? "weekly usage report queued" : "weekly usage report already queued", {
    reportId: id,
  });
}

function createWeeklyUsageReport({ db, auth, founderEmail }) {
  return onSchedule(
    {
      schedule: SCHEDULE,
      timeZone: TIME_ZONE,
      memory: "512MiB",
      timeoutSeconds: 300,
      retryCount: 3,
    },
    (event) => runWeeklyUsageReport({
      db,
      auth,
      recipient: founderEmail.value(),
      scheduleTime: event.scheduleTime,
    })
  );
}

module.exports = {
  SCHEDULE,
  TIME_ZONE,
  buildReport,
  authNumbers,
  createOutboxDocument,
  createWeeklyUsageReport,
  firestoreNumbers,
  reportId,
  reportWindow,
  runWeeklyUsageReport,
  summarizeActivity,
  summarizeAuthUsers,
  summarizeEventCounts,
};