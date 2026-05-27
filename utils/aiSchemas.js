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
  amount: z.number().positive().nullable(),
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

module.exports = { parseRequestSchema, parseResponseSchema };
