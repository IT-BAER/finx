const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");


const buildPrompt = (text, categories, sources, targets) => {
    const catList = categories.length ? categories.join(", ") : "(none provided)";
    const srcList = sources.length ? sources.join(", ") : "(none provided)";
    const tgtList = targets.length ? targets.join(", ") : "(none provided)";
    return [
        "You are a financial transaction parser. Extract transaction data from the notification text below.",
        "Respond with ONLY valid JSON — no markdown, no explanation.",
        "",
        `Available categories: ${catList}`,
        `Available sources (payment methods/accounts): ${srcList}`,
        `Available targets (payees/merchants): ${tgtList}`,
        "",
        "Return this exact JSON structure:",
        JSON.stringify({
            amount: "<positive number>",
            type: "<expense|income>",
            description: "<short description>",
            category: "<best matching category or null>",
            source: "<best matching source or null>",
            target: "<best matching target or null>",
            date: "<YYYY-MM-DD if date detected, else null>",
        }),
        "",
        `Notification text: ${text}`,
    ].join("\n");
};

// Static patterns for models unsuitable for structured JSON output.
const MODEL_BLACKLIST = [
    /^z-ai\//,         // returns null content
    /thinking/,        // thinking variants emit reasoning field, not content
    /-reasoning(:|$)/, // reasoning models unreliable for structured output
    /-vl(:|$|-)/,      // vision-language models bad at text-only structured output
];

// Per-model rate-limit cooldowns: model id → timestamp when it becomes available again.
const modelCooldowns = new Map();
const isOnCooldown = (model) => Date.now() < (modelCooldowns.get(model) ?? 0);
const setCooldown = (model, retryAfterSeconds) => {
    modelCooldowns.set(model, Date.now() + retryAfterSeconds * 1000);
};

// Persistent blacklist: models that returned permanent errors (4xx non-429 or malformed JSON).
// Survives server restarts so 404-only models are never retried after first discovery.
const BLACKLIST_FILE = path.join(__dirname, "../.ai-model-blacklist.json");
const sessionBlacklist = new Set();

try {
    const saved = JSON.parse(fs.readFileSync(BLACKLIST_FILE, "utf8"));
    if (Array.isArray(saved)) saved.forEach((m) => sessionBlacklist.add(m));
    if (saved.length) logger.info(`AI parse: loaded ${saved.length} persisted blacklist entries`);
} catch (_) { /* file doesn't exist on first run */ }

const blacklistModel = (model) => {
    if (sessionBlacklist.has(model)) return;
    sessionBlacklist.add(model);
    try {
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify([...sessionBlacklist]));
    } catch (_) { /* best-effort persistence */ }
};

let freeModelsCache = null;
let freeModelsCacheExpiry = 0;
const FREE_MODELS_TTL_MS = 60 * 60 * 1000; // 1h

const fetchFreeModels = async (apiKey) => {
    const now = Date.now();
    if (freeModelsCache && now < freeModelsCacheExpiry) return freeModelsCache;
    const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
        return freeModelsCache || [];
    }
    const data = await response.json();
    const all = Array.isArray(data?.data) ? data.data : [];
    const free = all
        .filter((m) => typeof m?.id === "string" && m.id.endsWith(":free"))
        .filter((m) => !MODEL_BLACKLIST.some((pat) => pat.test(m.id)))
        .filter((m) => (m.context_length ?? 0) >= 65536) // exclude tiny models (<64k ctx) — too small for reliable structured JSON
        .map((m) => m.id);
    freeModelsCache = free;
    freeModelsCacheExpiry = now + FREE_MODELS_TTL_MS;
    logger.info(`AI parse: refreshed free-models allowlist (${free.length} models)`);
    return free;
};

const callOpenRouterOnce = async (model, prompt, apiKey, allowlist = null) => {
    const body = {
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 256,
        temperature: 0.1,
        provider: { data_collection: "deny" },
    };
    // reasoning.exclude only valid for the auto-router; specific models 400 if they don't support it
    if (model === "openrouter/free") {
        body.reasoning = { exclude: true };
    }
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://myfinx.app",
            "X-Title": "FinX",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
        if (response.status === 429) {
            const data = await response.json().catch(() => null);
            const retryAfter = data?.error?.metadata?.retry_after_seconds ?? 30;
            setCooldown(model, retryAfter);
        } else if (response.status >= 400 && response.status < 500) {
            // Permanent 4xx → persist blacklist
            blacklistModel(model);
        }
        throw new Error(`OpenRouter HTTP ${response.status}`);
    }
    const data = await response.json();
    const chosenModel = data?.model ?? model;
    // When openrouter/free routes to a model, reject if it doesn't pass our quality filters
    if (model === "openrouter/free" && chosenModel !== model) {
        const blocked =
            MODEL_BLACKLIST.some((pat) => pat.test(chosenModel)) ||
            sessionBlacklist.has(chosenModel) ||
            (allowlist && allowlist.length > 0 && !allowlist.includes(chosenModel));
        if (blocked) {
            throw new Error(`openrouter/free routed to filtered model ${chosenModel}`);
        }
    }
    let content = data?.choices?.[0]?.message?.content;
    if (!content) {
        const reasoning = data?.choices?.[0]?.message?.reasoning ?? "";
        const jsonMatch = reasoning.match(/\{[\s\S]*?\}/);
        if (jsonMatch) content = jsonMatch[0];
    }
    if (!content) throw new Error(`Empty response from model ${chosenModel}`);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON object in response from model ${chosenModel}`);
    try {
        return { parsed: JSON.parse(jsonMatch[0]), chosenModel };
    } catch (e) {
        // Malformed JSON → treat as permanent model failure for this session
        blacklistModel(model);
        throw new Error(`Malformed JSON from model ${chosenModel}: ${e.message}`);
    }
};

// Strategy: try openrouter/free auto-router first with allowlist as 5xx-fallback.
// On 200-with-empty-content (e.g. z-ai), retry through the live-filtered allowlist explicitly.
const callOpenRouter = async (prompt, apiKey) => {
    const allowlist = await fetchFreeModels(apiKey).catch(() => []);
    let lastErr;
    try {
        return await callOpenRouterOnce("openrouter/free", prompt, apiKey, allowlist);
    } catch (err) {
        lastErr = err;
        logger.warn(`AI parse: openrouter/free failed (${err.message}), falling back to allowlist`);
    }
    for (let i = 0; i < allowlist.length; i++) {
        const model = allowlist[i];
        if (sessionBlacklist.has(model) || isOnCooldown(model)) continue;
        try {
            return await callOpenRouterOnce(model, prompt, apiKey);
        } catch (err) {
            lastErr = err;
            logger.warn(`AI parse: model ${model} failed (${err.message}), trying next`);
        }
    }
    throw lastErr || new Error("All fallback models failed");
};

const parseNotification = async (req, res) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ message: "AI parsing not configured on this server" });
    }
    const { text, categories = [], sources = [], targets = [] } = req.body;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ message: "text is required" });
    }
    if (text.length > 2000) {
        return res.status(400).json({ message: "text too long (max 2000 chars)" });
    }
    const prompt = buildPrompt(text.trim(), categories, sources, targets);
    try {
        const { parsed, chosenModel } = await callOpenRouter(prompt, apiKey);
        logger.info(`AI parse success via ${chosenModel}`);
        return res.json({ parsed, model: chosenModel });
    } catch (err) {
        logger.error(`AI parse failed: ${err.message}`);
        return res.status(502).json({ message: "AI parsing unavailable" });
    }
};

module.exports = { parseNotification };
