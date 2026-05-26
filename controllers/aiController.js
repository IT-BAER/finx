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
            reasoning: { exclude: true },
            provider: { data_collection: "deny" },
        }),
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
        throw new Error(`OpenRouter HTTP ${response.status}`);
    }
    const data = await response.json();
    const chosenModel = data?.model ?? model;
    let content = data?.choices?.[0]?.message?.content;
    // Some reasoning models return null content with answer embedded in reasoning text
    if (!content) {
        const reasoning = data?.choices?.[0]?.message?.reasoning ?? "";
        const jsonMatch = reasoning.match(/\{[\s\S]*?\}/);
        if (jsonMatch) content = jsonMatch[0];
    }
    if (!content) throw new Error(`Empty response from model ${chosenModel}`);
    // Extract first JSON object — handles models that prefix/suffix with text or use code fences
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON object in response from model ${chosenModel}`);
    return { parsed: JSON.parse(jsonMatch[0]), chosenModel };
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
    const model = "openrouter/free";
    try {
        const { parsed, chosenModel } = await callOpenRouter(model, prompt, apiKey);
        logger.info(`AI parse success via ${chosenModel}`);
        return res.json({ parsed, model: chosenModel });
    } catch (err) {
        logger.error(`AI parse failed: ${err.message}`);
        return res.status(502).json({ message: "AI parsing unavailable" });
    }
};

module.exports = { parseNotification };
