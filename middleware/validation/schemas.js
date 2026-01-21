/**
 * Zod Validation Schemas for FinX
 * 
 * Centralized validation schemas for all API requests.
 * These schemas ensure data integrity and provide clear error messages.
 */

const { z } = require('zod');

// ============================================
// Common Schemas
// ============================================

const idSchema = z.number().int().positive();
const stringIdSchema = z.string().regex(/^\d+$/).transform(Number);
const optionalIdSchema = z.union([idSchema, stringIdSchema]).optional();

const dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be in YYYY-MM-DD format'
).or(z.date()).transform(val => {
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return val;
});

// Allow empty string, null, undefined for optional dates - convert empty string to undefined
const optionalDateSchema = z.union([
  dateSchema,
  z.literal('').transform(() => undefined),
  z.null(),
  z.undefined()
]).optional();

const amountSchema = z.number()
  .or(z.string().transform(val => parseFloat(val)))
  .refine(val => !isNaN(val) && val > 0, {
    message: 'Amount must be a positive number'
  });

const transactionTypeSchema = z.enum(['income', 'expense'], {
  errorMap: () => ({ message: 'Type must be either "income" or "expense"' })
});

// ============================================
// Transaction Schemas
// ============================================

const createTransactionSchema = z.object({
  amount: amountSchema,
  type: transactionTypeSchema.or(
    z.literal('Withdrawal').transform(() => 'expense')
  ),
  category: z.string().min(1).max(50).optional().nullable(),
  category_id: optionalIdSchema,
  source: z.string().min(1).max(100).optional().nullable(),
  source_id: optionalIdSchema,
  target: z.string().min(1).max(100).optional().nullable(),
  target_id: optionalIdSchema,
  description: z.string().max(500).optional().nullable(),
  date: optionalDateSchema,
  _tempId: z.union([z.string(), z.number()]).optional(),
  recurring_transaction_id: optionalIdSchema,
  // Recurring transaction fields (used by AddTransaction page, stripped before storage)
  isRecurring: z.boolean().optional(),
  recurrence_type: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  recurrence_interval: z.union([
    z.number().int().positive(),
    z.string().transform(v => v ? parseInt(v, 10) : undefined).refine(v => v === undefined || (v > 0 && Number.isInteger(v)), { message: 'Must be a positive integer' })
  ]).optional(),
  end_date: optionalDateSchema,
  max_occurrences: z.union([
    z.number().int().positive(),
    z.string().transform(v => v ? parseInt(v, 10) : undefined).refine(v => v === undefined || (v > 0 && Number.isInteger(v)), { message: 'Must be a positive integer' }),
    z.literal('').transform(() => undefined)
  ]).optional(),
});

const updateTransactionSchema = createTransactionSchema.partial().refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

const getTransactionsQuerySchema = z.object({
  asUserId: stringIdSchema.optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
  q: z.string().max(100).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  category: z.string().optional(),
  source: z.string().optional(),
  type: transactionTypeSchema.optional(),
});

// ============================================
// Category Schemas
// ============================================

const createCategorySchema = z.object({
  name: z.string().min(1).max(50).trim(),
});

const updateCategorySchema = createCategorySchema;

// ============================================
// Source Schemas
// ============================================

const createSourceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

const updateSourceSchema = createSourceSchema;

// ============================================
// Target Schemas
// ============================================

const createTargetSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

const updateTargetSchema = createTargetSchema;

// ============================================
// Goal Schemas
// ============================================

const createGoalSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  target_amount: amountSchema,
  current_amount: amountSchema.optional().default(0),
  deadline: optionalDateSchema,
  category: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

const updateGoalSchema = createGoalSchema.partial().refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

const contributeToGoalSchema = z.object({
  amount: amountSchema,
  description: z.string().max(500).optional(),
});

// ============================================
// Recurring Transaction Schemas
// ============================================

const recurrenceTypeSchema = z.enum([
  'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'
]);

const createRecurringTransactionSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  amount: amountSchema,
  type: transactionTypeSchema,
  category_id: optionalIdSchema,
  source: z.string().max(255).optional().nullable(),
  target: z.string().max(255).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  recurrence_type: recurrenceTypeSchema,
  recurrence_interval: z.number().int().positive().default(1),
  start_date: dateSchema,
  end_date: optionalDateSchema,
  max_occurrences: z.number().int().positive().optional().nullable(),
});

const updateRecurringTransactionSchema = createRecurringTransactionSchema.partial().refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

// ============================================
// User Schemas
// ============================================

const emailSchema = z.string().email('Invalid email address').max(100);
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters').max(100);

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  first_name: z.string().max(50).optional(),
  last_name: z.string().max(50).optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  first_name: z.string().max(50).optional(),
  last_name: z.string().max(50).optional(),
  email: emailSchema.optional(),
  theme: z.string().max(20).optional(),
  dark_mode: z.boolean().optional().nullable(),
  income_tracking_disabled: z.boolean().optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// ============================================
// Sharing Schemas
// ============================================

const permissionLevelSchema = z.enum(['read', 'read_write']);

const createSharingSchema = z.object({
  shared_with_email: emailSchema,
  permission_level: permissionLevelSchema.default('read'),
  source_filter: z.array(z.number().int().positive()).optional().nullable(),
});

const updateSharingSchema = z.object({
  permission_level: permissionLevelSchema.optional(),
  source_filter: z.array(z.number().int().positive()).optional().nullable(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

// ============================================
// Dashboard & Report Schemas
// ============================================

const dashboardQuerySchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year', 'all', 'custom']).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});

const reportQuerySchema = z.object({
  type: z.enum(['income', 'expense', 'category', 'source', 'target', 'trend']).optional(),
  period: z.enum(['week', 'month', 'quarter', 'year', 'all', 'custom']).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  groupBy: z.enum(['day', 'week', 'month', 'year']).optional(),
});

// ============================================
// Export all schemas
// ============================================

module.exports = {
  // Common
  idSchema,
  stringIdSchema,
  dateSchema,
  amountSchema,
  transactionTypeSchema,
  
  // Transactions
  createTransactionSchema,
  updateTransactionSchema,
  getTransactionsQuerySchema,
  
  // Categories
  createCategorySchema,
  updateCategorySchema,
  
  // Sources
  createSourceSchema,
  updateSourceSchema,
  
  // Targets
  createTargetSchema,
  updateTargetSchema,
  
  // Goals
  createGoalSchema,
  updateGoalSchema,
  contributeToGoalSchema,
  
  // Recurring Transactions
  createRecurringTransactionSchema,
  updateRecurringTransactionSchema,
  
  // User
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  
  // Sharing
  createSharingSchema,
  updateSharingSchema,
  
  // Dashboard & Reports
  dashboardQuerySchema,
  reportQuerySchema,
};
