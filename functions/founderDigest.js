"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");

const DAY = 24 * 60 * 60 * 1000;
const timeMs = (value) => {
  const firestoreMs = value?.toMillis?.();
  return firestoreMs ?? (new Date(value || 0).getTime() || 0);
};
const safe = async (name, work) => {
  try { return { name, value: await work() }; } catch (error) {
    console.error(`founder digest ${name} failed`, error);
    return { name, error: true };
  }
};

async function fieldNumbers(db, auth, since) {
  let pageToken;
  let total = 0, kept = 0, arrivals = 0;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      total++;
      if (user.email) kept++;
      if (new Date(user.metadata.creationTime).getTime() >= since) arrivals++;
    }
    pageToken = page.pageToken;
  } while (pageToken);
  const [encounters, notes, optIns] = await Promise.all([
    db.collectionGroup("userEncounters").get(),
    db.collectionGroup("fieldNotes").get(),
    db.collection("users").where("morningCall", "!=", null).get(),
  ]);
  let completed = 0, noteCount = 0, voice = 0;
  for (const doc of encounters.docs) if (doc.data().status === "completed" && timeMs(doc.data().completedAt) >= since) completed++;
  for (const doc of notes.docs) {
    const data = doc.data();
    if (timeMs(data.createdAt) >= since) {
      noteCount++;
      if (data.captureMode === "audio") voice++;
    }
  }
  return { arrivals, total, kept, completed, noteCount, voice, optIns: optIns.size };
}

async function passageQueue(db) {
  const docs = await db.collection("practitionerContent").get();
  const hasSchema = docs.docs.some((doc) => doc.data().kind === "offering" || Array.isArray(doc.data().passages));
  if (!hasSchema) return { notRunning: true };
  const drafts = docs.docs
    .filter((doc) => Array.isArray(doc.data().passages))
    .map((doc) => ({
      key: doc.data().key,
      count: doc.data().passages.filter((p) => p?.status === "draft").length,
    }))
    .filter((entry) => typeof entry.key === "string" && entry.count > 0);
  return {
    keys: drafts.map((entry) => entry.key).sort(),
    count: drafts.reduce((sum, entry) => sum + entry.count, 0),
  };
}

function truncateWork(value) {
  const work = typeof value === "string" ? value.trim() : "";
  return work.length <= 80 ? work : work.slice(0, 80);
}

async function betaRequests(db, since) {
  const [overnight, pending] = await Promise.all([
    db.collection("betaRequests")
      .where("createdAt", ">=", Timestamp.fromMillis(since))
      .get(),
    db.collection("betaRequests").where("status", "==", "new").count().get(),
  ]);
  return {
    overnight: overnight.docs
      .map((doc) => doc.data())
      .sort((a, b) => timeMs(a.createdAt) - timeMs(b.createdAt))
      .map((request) => ({
        email: request.email,
        work: truncateWork(request.work),
      })),
    pending: pending.data().count,
  };
}

async function transcriptionHealth(db, now) {
  const notes = await db.collectionGroup("fieldNotes").get();
  let stuck = 0, failed = 0, oldest = Infinity;
  for (const doc of notes.docs) {
    const data = doc.data();
    const age = now - timeMs(data.createdAt);
    if (data.transcriptStatus === "pending" && age > 60 * 60 * 1000) {
      stuck++;
      oldest = Math.min(oldest, age);
    }
    if (data.transcriptStatus === "failed") failed++;
  }
  return { stuck, failed, oldest };
}

async function readingsCount(db, since) {
  const readings = await db.collectionGroup("readings").get();
  const actual = readings.docs.filter((doc) => doc.id !== "_generation");
  if (!actual.length) return null;
  return actual.filter((doc) => timeMs(doc.data().createdAt) >= since).length;
}

function unavailable(name) { return `${name}: unavailable`; }
function ageText(ms) {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  return `${hours}h`;
}

function createFounderDigest({ db, auth, founderEmail }) {
  return onSchedule(
    { schedule: "0 12 * * *", timeZone: "UTC", memory: "512MiB", timeoutSeconds: 300 },
    async () => {
      const recipient = founderEmail.value();
      if (!recipient) throw new Error("FOUNDER_DIGEST_EMAIL is not set");

      const now = Date.now();
      const [field, door, queue, health, readings] = await Promise.all([
        safe("field", () => fieldNumbers(db, auth, now - DAY)),
        safe("door", () => betaRequests(db, now - DAY)),
        safe("queue", () => passageQueue(db)),
        safe("health", () => transcriptionHealth(db, now)),
        safe("readings", () => readingsCount(db, now - DAY)),
      ]);
      const lines = [];
      if (field.error) lines.push(unavailable("the field, overnight"));
      else {
        const x = field.value;
        lines.push("the field, overnight", `  ${x.arrivals} new arrivals · ${x.total} fields total (${x.kept} kept, ${x.total - x.kept} unnamed)`, `  ${x.completed} encounters completed · ${x.noteCount} notes (${x.voice} voice, ${x.noteCount - x.voice} typed)`, `  morning call: ${x.optIns} opted in`);
      }
      lines.push("");
      if (door.error) lines.push(unavailable("at the door"));
      else {
        const x = door.value;
        if (x.overnight.length === 0 && x.pending === 0) {
          lines.push("at the door — quiet");
        } else {
          lines.push(
            "at the door",
            `  ${x.overnight.length} requested access overnight · ${x.pending} awaiting invites`
          );
          for (const request of x.overnight) {
            lines.push(
              `  ${request.email} — ${request.work ? `"${request.work}"` : "(no note)"}`
            );
          }
        }
      }
      lines.push("");
      let awaiting = 0, cleanQueue = false;
      if (queue.error) lines.push(unavailable("awaiting you"));
      else if (queue.value.notRunning) lines.push("awaiting you", "  the field queue is not yet running");
      else {
        awaiting = queue.value.count;
        cleanQueue = awaiting === 0;
        lines.push("awaiting you", awaiting ? `  ${awaiting} passages drafted: ${queue.value.keys.join(", ")}` : "  clear");
        if (awaiting) lines.push("  → review in the Firestore console (practitionerContent)");
      }
      lines.push("");
      let healthClean = false;
      if (health.error) lines.push(unavailable("health"));
      else {
        const x = health.value;
        healthClean = x.stuck === 0 && x.failed === 0;
        lines.push("health", healthClean ? "  transcription: clear" : `  transcription: ${x.stuck} stuck${x.stuck ? ` (oldest ${ageText(x.oldest)})` : ""} · ${x.failed} failed`);
      }
      if (!readings.error && readings.value !== null) lines.push("", "readings", `  ${readings.value} generated overnight`);
      else if (readings.error) lines.push("", unavailable("readings"));

      const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(now)).toLowerCase();
      const subject = cleanQueue && healthClean ? `mineral · ${weekday} — a quiet day` : `mineral · ${weekday} — ${awaiting} awaiting you`;
      const digestId = `founder-digest-${new Date(now).toISOString().slice(0, 10)}`;
      try {
        await db.doc(`mail/${digestId}`).create({
          to: recipient,
          message: { subject, text: lines.join("\n") },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        if (error?.code !== 6 && error?.code !== "already-exists") throw error;
        console.info("founder digest already queued", { digestId });
      }
    }
  );
}

module.exports = { betaRequests, createFounderDigest, truncateWork };