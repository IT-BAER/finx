const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { perUserHourly } = require("../middleware/aiRateLimit");

const makeApp = (limiter) => {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: req.header("X-Test-User") || "u1" };
    next();
  });
  app.post("/test", limiter, (req, res) => res.json({ ok: true }));
  return app;
};

test("per-user hourly limiter keys on req.user.id, not IP", async () => {
  const app = makeApp(perUserHourly({ limit: 2, windowMs: 60_000 }));
  // user "a" — two allowed, third blocked
  await request(app).post("/test").set("X-Test-User", "a").expect(200);
  await request(app).post("/test").set("X-Test-User", "a").expect(200);
  await request(app).post("/test").set("X-Test-User", "a").expect(429);
  // user "b" — fresh budget
  await request(app).post("/test").set("X-Test-User", "b").expect(200);
});
