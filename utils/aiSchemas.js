const { z } = require("zod");
const { MAX_FIELD_LEN, MAX_ITEMS } = require("./aiSanitize");

// Per-item limit for request arrays is generous — sanitizeStringArray clips to 64.
// Zod only enforces the array-length cap (MAX_ITEMS) at the schema layer.
const stringArray = z
  .array(z.string().max(MAX_FIELD_LEN))
  .max(MAX_ITEMS)
  .default([]);

const parseRequestSchema = z
  .object({
    text: z.string().min(1).max(MAX_FIELD_LEN).optional(),
    title: z.string().max(MAX_FIELD_LEN).optional(),
    body: z.string().max(MAX_FIELD_LEN).optional(),
    categories: stringArray,
    sources: stringArray,
    targets: stringArray,
  })
  .strip()
  .refine(
    (v) => (v.text && v.text.trim()) || v.title || v.body,
    { message: "text, title, or body required" },
  );

const parseResponseSchema = z.object({
  // Receipt-OCR only: the model's self-report that the image was a readable receipt.
  // false ⇒ blank/dark/non-receipt ⇒ the client must NOT pre-fill (anti-hallucination).
  // Accept boolean or string and pass through unchanged; the client normalizes. Lenient on
  // purpose — a malformed advisory flag must never fail the whole parse.
  is_receipt: z.union([z.boolean(), z.string()]).nullable().optional(),
  // LLMs occasionally return amount as a string ("24.90"). Coerce to number
  // so the response passes schema validation in those cases.
  amount: z.coerce.number().positive().nullable(),
  type: z.enum(["expense", "income"]).nullable(),
  description: z.string().max(80).nullable(),
  category: z.string().max(64).nullable(),
  source: z.string().max(64).nullable(),
  target: z.string().max(64).nullable(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  currency: z.string().max(8).nullable().optional(),
});

// Base64 image cap (~6 MiB) — kept just under the route/server.js 6 MiB body gate so an oversized image fails as a clean 400 (schema) rather than a 413.
const MAX_IMAGE_B64_LEN = 6_200_000;

const ocrRequestSchema = z
  .object({
    image: z.string().min(16).max(MAX_IMAGE_B64_LEN),
    mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
    categories: stringArray,
  })
  .strip();

module.exports = { parseRequestSchema, parseResponseSchema, ocrRequestSchema, MAX_IMAGE_B64_LEN };
