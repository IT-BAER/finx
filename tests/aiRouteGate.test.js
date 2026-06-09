const { test, mock } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

// Stub auth middleware (no JWT in unit tests).
require.cache[require.resolve("../middleware/auth")] = {
  exports: (req, _res, next) => next(),
};

// Stub aiProxy before requiring route under test.
require.cache[require.resolve("../services/aiProxy")] = {
  exports: {
    callAiProxy: mock.fn(async () => ({
      parsed: {
        amount: 5,
        currency: "EUR",
        type: "expense",
        description: "Coffee",
        category: null,
        source: null,
        target: null,
        date: null,
      },
      model: "test-model",
    })),
    PURPOSES: { NOTIFICATION_PARSE: {} },
  },
};

const makeApp = (userAttrs = {}) => {
  delete require.cache[require.resolve("../routes/ai")];
  const aiRoute = require("../routes/ai");
  const app = express();
  app.use(express.json({ limit: "32kb" }));
  // Inject synthetic user (auth is stubbed to pass through).
  app.use((req, _res, next) => {
    req.user = { id: 1, is_admin: false, ...userAttrs };
    next();
  });
  app.use("/api/ai", aiRoute);
  return app;
};

test("admin gate: non-admin blocked by default", async () => {
  delete process.env.AI_ALLOW_NON_ADMIN;
  const app = makeApp({ is_admin: false });
  const r = await request(app)
    .post("/api/ai/parse")
    .send({ text: "Paid 5 EUR" });
  assert.equal(r.status, 403);
});

test("admin gate: admin user passes", async () => {
  delete process.env.AI_ALLOW_NON_ADMIN;
  const app = makeApp({ is_admin: true });
  const r = await request(app)
    .post("/api/ai/parse")
    .send({ text: "Paid 5 EUR" });
  assert.equal(r.status, 200);
});

test("admin gate: AI_ALLOW_NON_ADMIN=true opens to all users", async () => {
  process.env.AI_ALLOW_NON_ADMIN = "true";
  const app = makeApp({ is_admin: false });
  const r = await request(app)
    .post("/api/ai/parse")
    .send({ text: "Paid 5 EUR" });
  assert.equal(r.status, 200);
  delete process.env.AI_ALLOW_NON_ADMIN;
});

test("OCR admin gate: non-admin blocked by default", async () => {
  delete process.env.AI_ALLOW_NON_ADMIN;
  const b64 = Buffer.from("x".repeat(64)).toString("base64");
  const r = await request(makeApp({ is_admin: false }))
    .post("/api/ai/ocr")
    .send({ image: b64, mime: "image/jpeg" });
  assert.equal(r.status, 403);
});

test("OCR admin gate: admin user passes (200)", async () => {
  delete process.env.AI_ALLOW_NON_ADMIN;
  const b64 = Buffer.from("x".repeat(64)).toString("base64");
  const r = await request(makeApp({ is_admin: true }))
    .post("/api/ai/ocr")
    .send({ image: b64, mime: "image/jpeg" });
  assert.equal(r.status, 200);
});
