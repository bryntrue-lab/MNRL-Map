"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");

const ALLOWED_ORIGINS = new Set([
  "https://madebymineral.com",
  "https://www.madebymineral.com",
]);
const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function normalizeRequest(body) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const work = typeof body?.work === "string" ? body.work.trim() : "";
  const website = typeof body?.website === "string" ? body.website.trim() : "";
  return { email, work, website };
}

function isValidRequest({ email, work }) {
  return (
    email.length > 0 &&
    email.length <= 200 &&
    EMAIL_PATTERN.test(email) &&
    work.length <= 500
  );
}

async function storeBetaRequest(db, { email, work }) {
  const ref = db.collection("betaRequests").doc(email);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    const request = {
      email,
      work,
      lastSeenAt: FieldValue.serverTimestamp(),
      source: "landing",
    };
    if (!existing.exists) {
      request.createdAt = FieldValue.serverTimestamp();
      request.status = "new";
    }
    transaction.set(ref, request, { merge: true });
  });
}

function createBetaRequest({ db }) {
  return onRequest(
    { memory: "256MiB", timeoutSeconds: 30, maxInstances: 10 },
    async (request, response) => {
      const origin = request.get("origin");
      if (origin && !ALLOWED_ORIGINS.has(origin)) {
        response.status(403).json({ ok: false });
        return;
      }
      if (origin) {
        response.set("Access-Control-Allow-Origin", origin);
        response.set("Vary", "Origin");
      }
      if (request.method === "OPTIONS") {
        response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.set("Access-Control-Allow-Headers", "Content-Type");
        response.set("Access-Control-Max-Age", "3600");
        response.status(204).send("");
        return;
      }
      if (request.method !== "POST") {
        response.set("Allow", "POST, OPTIONS");
        response.status(405).json({ ok: false });
        return;
      }

      const betaRequest = normalizeRequest(request.body);
      if (betaRequest.website) {
        response.status(200).json({ ok: true });
        return;
      }
      if (!isValidRequest(betaRequest)) {
        response.status(400).json({ ok: false });
        return;
      }

      await storeBetaRequest(db, betaRequest);
      response.status(200).json({ ok: true });
    }
  );
}

module.exports = {
  createBetaRequest,
  isValidRequest,
  normalizeRequest,
  storeBetaRequest,
};