const getAiKey = (req, res) => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
        return res.status(503).json({ message: "AI key not configured on this server" });
    }
    res.json({ provider: "openrouter", key });
};

module.exports = { getAiKey };
