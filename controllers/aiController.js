const logger = require("../utils/logger");

const MANAGED_FREE_MODELS = [
    "meta-llama/llama-3.1-8b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemma-3-4b-it:free",
    "mistralai/mistral-7b-instruct:free",
    "qwen/qwen-2.5-7b-instruct:free",
];

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

const callOpenRouter = async (model, prompt, apiKey) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://myfinx.app",
            "X-Title": "FinX",
        },
        body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 256,
            temperature: 0.1,
        }),
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
        throw new Error(`OpenRouter HTTP ${response.status}`);
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from model");
    return JSON.parse(content.trim());
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
    let lastError;
    for (const model of MANAGED_FREE_MODELS) {
        try {
            const parsed = await callOpenRouter(model, prompt, apiKey);
            logger.info(`AI parse success via ${model}`);
            return res.json({ parsed, model });
        } catch (err) {
            lastError = err;
            logger.warn(`AI parse failed for model ${model}: ${err.message}`);
        }
    }
    logger.error(`AI parse: all models failed. Last error: ${lastError?.message}`);
    return res.status(502).json({ message: "AI parsing unavailable — all models failed" });
};

module.exports = { parseNotification };
