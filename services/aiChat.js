const logger = require("../utils/logger");
const { postOpenRouter } = require("./aiProxy");
const { parseSourceIds, buildSourceFilterClause } = require("../utils/sourceFilter");
const { buildBalancesQuery, rowToBalance, sumTotal } = require("../utils/accountBalance");

const MAX_TOOL_ITERATIONS = 4;
const CHAT_MAX_TOKENS = 500;
const CHAT_TEMPERATURE = 0.3;
// Schema still allows up to 20 client messages; only the last N feed the model context, to
// bound per-turn token cost regardless of how long the client-side thread has grown.
const HISTORY_TRIM_TO = 8;
const QUERY_TRANSACTIONS_MAX_LIMIT = 30;

// Self-hosted default: 0 = disabled, since this deployment brings its own OpenRouter key.
// The managed hosting (finx-server repo) defaults this to 0.50. Overridable via
// CHAT_MONTHLY_COST_CAP_USD.
const CHAT_MONTHLY_CAP_DEFAULT_USD = 0;
const DEFAULT_COST_IN_PER_M = 0.27;
const DEFAULT_COST_OUT_PER_M = 1.1;

const chatModelName = () => process.env.CHAT_MODEL || "deepseek/deepseek-chat";

const costInPerM = () => {
  const raw = Number(process.env.CHAT_COST_IN_PER_M);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_COST_IN_PER_M;
};
const costOutPerM = () => {
  const raw = Number(process.env.CHAT_COST_OUT_PER_M);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_COST_OUT_PER_M;
};

/** USD cost of one turn's token usage, at the configured (or default) per-million rates. */
const computeCostUsd = (inputTokens, outputTokens) =>
  ((Number(inputTokens) || 0) * costInPerM()) / 1e6 + ((Number(outputTokens) || 0) * costOutPerM()) / 1e6;

/** UTC calendar month key, e.g. "2026-08" — matches the ai_chat_usage.month column. */
const currentMonthKey = (date = new Date()) => date.toISOString().slice(0, 7);

const monthlyCapUsd = () => {
  const raw = process.env.CHAT_MONTHLY_COST_CAP_USD;
  if (raw === undefined || raw === "") return CHAT_MONTHLY_CAP_DEFAULT_USD;
  const n = Number(raw);
  return Number.isFinite(n) ? n : CHAT_MONTHLY_CAP_DEFAULT_USD;
};

/** A cap of 0 (or negative) disables the check entirely — never blocks. */
const isOverMonthlyCap = (currentCostUsd) => {
  const cap = monthlyCapUsd();
  if (cap <= 0) return false;
  return (Number(currentCostUsd) || 0) >= cap;
};

/**
 * System prompt for the finance-assistant persona. Keep the injected `today` so relative
 * dates ("this month") resolve without a tool round-trip.
 */
const buildChatSystemPrompt = ({ today, language }) => [
  "You are FinX's finance assistant. You answer questions about the user's OWN financial data",
  "(transactions, spending, income, account balances) using the tools provided.",
  "Always call a tool to fetch real data before stating a number — never guess or invent amounts.",
  "Politely refuse questions unrelated to personal finance and steer the conversation back.",
  `Answer in the user's language when it is detectable from their message; default to ${language || "English"} otherwise.`,
  "Use the informal register (German: du, not Sie; French: tu; Spanish/Portuguese/Italian: tú/tu; Dutch: je; Polish: ty; Russian: ты) — the app speaks to the user as a friend.",
  "Category names are NOT ids: when the user names a category (e.g. \"Auto\"), call list_categories first to resolve the id, or filter with the free-text `q` parameter. If a filtered query returns 0 rows, retry once with `q` before telling the user there is no data.",
  "State amounts with the currency symbol exactly as stored — never convert currencies.",
  `Today's date is ${today}.`,
  "Be concise and factual.",
].join("\n");

// Tool schema (OpenAI function-calling format). Names/fields are FROZEN — the Android
// ChatAgentLoop (feature/chat) mirrors this exactly; keep both in sync on any change.
const CHAT_TOOLS = [
  {
    type: "function",
    function: {
      name: "query_transactions",
      description: "List the user's transactions, optionally filtered, with income/expense totals over the filtered set.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
          end_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
          type: { type: "string", enum: ["income", "expense"] },
          category_id: { type: "integer" },
          source_ids: { type: "array", items: { type: "integer" } },
          q: { type: "string", description: "free-text search over description/category/source/target" },
          limit: { type: "integer", description: "max rows to return, default 20, max 30" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_category_breakdown",
      description: "Expense totals grouped by category for a date range.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
          end_date: { type: "string", description: "YYYY-MM-DD, inclusive" },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_account_balances",
      description: "Current balance of every one of the user's accounts, plus the total.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_categories",
      description: "List the user's categories (id, name). Call this to resolve a category name mentioned by the user into a category_id before filtering query_transactions by category.",
      parameters: { type: "object", properties: {} },
    },
  },
];

/**
 * Real tool executors — reuse the existing filtered-list / dashboard-breakdown / balances query
 * paths (buildSourceFilterClause, buildBalancesQuery), always scoped to the authed userId
 * (+ shared access via getAccessibleUserIds, same as the REST endpoints). Read-only: no
 * INSERT/UPDATE/DELETE anywhere below. `config/db` and `utils/access`/`models/Transaction` are
 * required lazily (inside the function bodies) so importing this module never opens a DB pool —
 * only an actual tool invocation does.
 */
/**
 * Owners whose data the requester can see, restricted to the aggregate-safe subset: the
 * requester themself, plus any sharer whose permission has NO source_filter. GET /transactions
 * (transactionController.js) enforces a source_filter row-by-row after the query runs; this
 * aggregate query has no per-row filtering step, so a sharer scoped to specific accounts is
 * dropped entirely rather than exposing their other accounts. Keeps chat's visibility a strict
 * subset of the REST list view, never wider.
 */
const scopedQueryUserIds = async (userId) => {
  const { getAccessibleUserIds, getSharingPermissionMeta } = require("../utils/access");
  let accessible = await getAccessibleUserIds(userId, "all");
  if (!Array.isArray(accessible) || accessible.length === 0) accessible = [userId];

  const userIds = [userId];
  for (const ownerId of accessible) {
    if (Number(ownerId) === Number(userId)) continue;
    const meta = await getSharingPermissionMeta(ownerId, userId);
    const unrestricted = meta.allowedSourceIdsNum == null && meta.allowedSourceIdsStr == null;
    if (unrestricted) userIds.push(ownerId);
  }
  return userIds;
};

const realQueryTransactions = async ({ userId, start_date, end_date, type, category_id, source_ids, q, limit }) => {
  const db = require("../config/db");

  const userIds = await scopedQueryUserIds(userId);
  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(", ");

  let where = "";
  const filterParams = [];
  let idx = userIds.length + 1;
  if (start_date) {
    where += ` AND t.date >= $${idx}`;
    filterParams.push(start_date);
    idx++;
  }
  if (end_date) {
    where += ` AND t.date <= $${idx}`;
    filterParams.push(end_date);
    idx++;
  }
  if (type === "income" || type === "expense") {
    where += ` AND t.type = $${idx}`;
    filterParams.push(type);
    idx++;
  }
  if (Number.isInteger(category_id) && category_id > 0) {
    where += ` AND t.category_id IN (SELECT id FROM categories WHERE LOWER(TRIM(name)) = (SELECT LOWER(TRIM(name)) FROM categories WHERE id = $${idx}))`;
    filterParams.push(category_id);
    idx++;
  }
  const sourceIds = parseSourceIds(source_ids);
  const srcFilter = buildSourceFilterClause(sourceIds, idx, "t");
  if (srcFilter.clause) {
    where += ` AND ${srcFilter.clause}`;
    filterParams.push(...srcFilter.values);
    idx = srcFilter.nextIndex;
  }
  if (q && String(q).trim()) {
    where += ` AND (
      LOWER(t.description) LIKE LOWER($${idx})
      OR LOWER(c.name) LIKE LOWER($${idx})
      OR LOWER(s.name) LIKE LOWER($${idx})
      OR LOWER(tg.name) LIKE LOWER($${idx})
    )`;
    filterParams.push(`%${String(q).trim()}%`);
    idx++;
  }

  const aggQuery = `
    SELECT
      COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN sources s ON t.source_id = s.id
    LEFT JOIN targets tg ON t.target_id = tg.id
    WHERE t.user_id IN (${placeholders}) ${where}
  `;
  const aggResult = await db.query(aggQuery, [...userIds, ...filterParams]);
  const agg = aggResult.rows[0] || {};

  const lim = Math.min(Math.max(Number.isInteger(limit) ? limit : 20, 1), QUERY_TRANSACTIONS_MAX_LIMIT);
  const listQuery = `
    SELECT t.date, t.amount, t.type, c.name AS category, s.name AS source, tg.name AS target, t.description
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN sources s ON t.source_id = s.id
    LEFT JOIN targets tg ON t.target_id = tg.id
    WHERE t.user_id IN (${placeholders}) ${where}
    ORDER BY t.date DESC, t.id DESC
    LIMIT $${idx}
  `;
  const listResult = await db.query(listQuery, [...userIds, ...filterParams, lim]);

  return {
    transactions: listResult.rows.map((r) => ({
      date: r.date,
      amount: Number(r.amount),
      type: r.type,
      category: r.category,
      source: r.source,
      target: r.target,
      description: r.description,
    })),
    total_income: Number.parseFloat(agg.income) || 0,
    total_expense: Number.parseFloat(agg.expense) || 0,
    count: listResult.rows.length,
  };
};

const realGetBreakdown = async ({ userId, start_date, end_date }) => {
  if (!start_date || !end_date) {
    return { error: "start_date and end_date are required" };
  }
  const { getAccessibleUserIds } = require("../utils/access");
  const Transaction = require("../models/Transaction");

  let userIds = await getAccessibleUserIds(userId, "all");
  if (!Array.isArray(userIds) || userIds.length === 0) userIds = [userId];

  const totals = new Map();
  for (const uid of userIds) {
    // This repo's Transaction.getExpensesByCategory has no sourceIds param (finx-server's does).
    const rows = await Transaction.getExpensesByCategory(uid, start_date, end_date);
    for (const row of rows) {
      const key = row.category_name;
      totals.set(key, Number(totals.get(key) || 0) + Number(row.total || 0));
    }
  }
  const expense_by_category = Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  return { expense_by_category };
};

const realGetBalances = async ({ userId }) => {
  const db = require("../config/db");
  const { getAccessibleUserIds } = require("../utils/access");

  let userIds = await getAccessibleUserIds(userId, "all");
  if (!Array.isArray(userIds) || userIds.length === 0) userIds = [userId];
  // This repo has no SimpleFIN / synced_balance column — see utils/accountBalance.js.
  const { text, values } = buildBalancesQuery(userIds, { withSynced: false });
  const result = await db.query(text, values);
  const rows = result.rows.map(rowToBalance);
  return {
    balances: rows.map((b) => ({ name: b.name, balance: b.balance, is_synced: b.isSynced })),
    total: sumTotal(rows),
  };
};

/**
 * Accumulate one turn's token usage into the per-user monthly ledger (UPSERT, additive).
 * Never blocks the reply on failure at the call site — callers await it directly since a
 * failed write only means the cap is briefly under-counted, not that the turn should fail.
 */
const realRecordUsage = async ({ userId, inputTokens, outputTokens }) => {
  const db = require("../config/db");
  const month = currentMonthKey();
  const costUsd = computeCostUsd(inputTokens, outputTokens);
  const inTok = Math.max(0, Math.round(Number(inputTokens) || 0));
  const outTok = Math.max(0, Math.round(Number(outputTokens) || 0));
  await db.query(
    `INSERT INTO ai_chat_usage (user_id, month, input_tokens, output_tokens, cost_usd)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, month) DO UPDATE SET
       input_tokens = ai_chat_usage.input_tokens + EXCLUDED.input_tokens,
       output_tokens = ai_chat_usage.output_tokens + EXCLUDED.output_tokens,
       cost_usd = ai_chat_usage.cost_usd + EXCLUDED.cost_usd`,
    [userId, month, inTok, outTok, costUsd],
  );
};

/** Current-UTC-month cost so far for a user, or 0 if no row exists yet. */
const realGetMonthlyCostUsd = async (userId) => {
  const db = require("../config/db");
  const month = currentMonthKey();
  const result = await db.query(
    "SELECT cost_usd FROM ai_chat_usage WHERE user_id = $1 AND month = $2",
    [userId, month],
  );
  if (result.rows.length === 0) return 0;
  return Number.parseFloat(result.rows[0].cost_usd) || 0;
};

const realListCategories = async ({ userId }) => {
  const db = require("../config/db");
  const result = await db.query(
    "SELECT id, TRIM(name) AS name, (user_id = $1) AS own FROM categories ORDER BY TRIM(name) ASC, own DESC, id ASC",
    [userId],
  );
  const seen = new Set();
  const deduped = [];
  for (const row of result.rows) {
    const key = String(row.name || "").trim().toLowerCase();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push({ id: Number(row.id), name: row.name });
    }
  }
  return { categories: deduped };
};

/** Deps object for production use — see the module doc above for the lazy-require rationale. */
const makeRealDeps = () => ({
  queryTransactions: realQueryTransactions,
  getBreakdown: realGetBreakdown,
  getBalances: realGetBalances,
  listCategories: realListCategories,
  recordUsage: realRecordUsage,
});

const TOOL_EXECUTORS = {
  query_transactions: (args, deps, userId) => deps.queryTransactions({ ...args, userId }),
  get_category_breakdown: (args, deps, userId) => deps.getBreakdown({ ...args, userId }),
  get_account_balances: (args, deps, userId) => deps.getBalances({ userId }),
  list_categories: (args, deps, userId) => deps.listCategories({ userId }),
};

/**
 * Execute one model-requested tool call. Always returns a plain object (never throws) so the
 * agent loop can feed the result back to the model regardless of outcome. userId is passed
 * separately from the model-supplied args, so a model-supplied `userId` field is always
 * overridden by the authed one — cross-user scoping cannot be spoofed via tool arguments.
 */
const executeTool = async (call, deps, userId) => {
  const name = call?.function?.name;
  const executor = TOOL_EXECUTORS[name];
  if (!executor) {
    return { error: `unknown tool: ${name}` };
  }
  let args;
  try {
    args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    return { error: "invalid tool arguments JSON" };
  }
  try {
    return await executor(args, deps, userId);
  } catch (e) {
    return { error: e?.message || "tool execution failed" };
  }
};

const callModelOnce = async (chatModel, model, convo, { withTools }) => {
  const body = {
    model,
    messages: convo,
    max_tokens: CHAT_MAX_TOKENS,
    temperature: CHAT_TEMPERATURE,
  };
  if (withTools) body.tools = CHAT_TOOLS;
  const data = await chatModel(body);
  const message = data?.choices?.[0]?.message;
  if (!message) {
    const err = new Error("Empty response from chat model");
    err.status = 502;
    throw err;
  }
  const usage = {
    promptTokens: Number(data?.usage?.prompt_tokens) || 0,
    completionTokens: Number(data?.usage?.completion_tokens) || 0,
  };
  return { message, model: data?.model ?? model, usage };
};

/**
 * Run one chat turn: system prompt + the last HISTORY_TRIM_TO client-sent messages, an agent
 * loop of up to MAX_TOOL_ITERATIONS tool round-trips, then a forced final call without tools if
 * the cap is hit. Stateless — the client resends the whole thread every message (no server
 * history). Accumulates token usage across every model call this turn and UPSERTs it into the
 * per-user monthly ledger before returning (see realRecordUsage).
 * @param {{messages: Array<{role: string, content: string}>, userId: number, deps: object}} args
 *        deps = { queryTransactions, getBreakdown, getBalances, listCategories, chatModel?, recordUsage? } —
 *        chatModel/recordUsage default to the real OpenRouter call / ledger write; tests inject
 *        fakes to avoid network + DB access.
 */
const runChatTurn = async ({ messages, userId, deps }) => {
  const model = chatModelName();
  const today = new Date().toISOString().slice(0, 10);
  const chatModel = deps?.chatModel || ((body) => postOpenRouter(body));
  const recordUsage = deps?.recordUsage || realRecordUsage;

  const trimmedMessages = Array.isArray(messages) ? messages.slice(-HISTORY_TRIM_TO) : messages;
  const convo = [
    { role: "system", content: buildChatSystemPrompt({ today }) },
    ...trimmedMessages,
  ];

  let toolCallsUsed = 0;
  let lastModelName = model;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const { message, model: chosenModel, usage } = await callModelOnce(chatModel, model, convo, { withTools: true });
      lastModelName = chosenModel;
      totalInputTokens += usage.promptTokens;
      totalOutputTokens += usage.completionTokens;
      const toolCalls = message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return { reply: message.content || "", toolCallsUsed, inputTokens: totalInputTokens, outputTokens: totalOutputTokens };
      }
      convo.push({ role: "assistant", content: message.content || null, tool_calls: toolCalls });
      for (const call of toolCalls) {
        toolCallsUsed++;
        const result = await executeTool(call, deps, userId);
        convo.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }

    // Cap reached: one final call with tools withheld so the model must answer from what it has.
    const { message: finalMessage, model: finalModel, usage: finalUsage } = await callModelOnce(chatModel, model, convo, { withTools: false });
    lastModelName = finalModel;
    totalInputTokens += finalUsage.promptTokens;
    totalOutputTokens += finalUsage.completionTokens;
    return { reply: finalMessage.content || "", toolCallsUsed, inputTokens: totalInputTokens, outputTokens: totalOutputTokens };
  } finally {
    // Ledger write must never fail the turn (a DB hiccup here only under-counts the cap, it must
    // not lose the user's answer), and must still capture tokens already spent on a mid-turn
    // model throw — so this runs on every exit path, success or error, not just the happy return.
    try {
      await recordUsage({ userId, inputTokens: totalInputTokens, outputTokens: totalOutputTokens });
    } catch (e) {
      logger.error(`aiChat recordUsage failed for user=${userId ?? "?"}: ${e?.message || e}`);
    }
    logger.info(
      `aiAudit purpose=CHAT user=${userId ?? "?"} model=${lastModelName} toolCalls=${toolCallsUsed} ` +
      `inTok=${totalInputTokens} outTok=${totalOutputTokens}`,
    );
  }
};

module.exports = {
  buildChatSystemPrompt,
  CHAT_TOOLS,
  runChatTurn,
  makeRealDeps,
  computeCostUsd,
  currentMonthKey,
  monthlyCapUsd,
  isOverMonthlyCap,
  getMonthlyCostUsd: realGetMonthlyCostUsd,
};
