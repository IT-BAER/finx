const logger = require('../utils/logger');
const { parseRequestSchema } = require('../utils/aiSchemas');
const { sanitizeText, sanitizeStringArray } = require('../utils/aiSanitize');
const { callAiProxy } = require('../services/aiProxy');

const parseNotification = async (req, res) => {
  const parsed = parseRequestSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message || 'invalid request body',
      code: 'AI_BAD_REQUEST',
    });
  }
  const v = parsed.data;
  const title = sanitizeText(v.title || (v.text ? v.text.split('\n')[0] : ''));
  const body = sanitizeText(
    v.body || (v.text ? v.text.split('\n').slice(1).join('\n') : ''),
  );
  if (!title && !body) {
    return res
      .status(400)
      .json({ message: 'title or body required', code: 'AI_BAD_REQUEST' });
  }
  const vars = {
    title,
    body,
    categories: sanitizeStringArray(v.categories),
    sources: sanitizeStringArray(v.sources),
    targets: sanitizeStringArray(v.targets),
  };
  try {
    const { parsed: out, model } = await callAiProxy({
      purpose: 'NOTIFICATION_PARSE',
      vars,
      userId: req.user?.id,
    });
    return res.json({ parsed: out, model });
  } catch (err) {
    logger.error('AI parse failed (user=' + (req.user?.id) + '): ' + err.message);
    const status = err.status || 502;
    return res
      .status(status)
      .json({ message: status === 503 ? 'AI not configured' : 'AI parsing unavailable' });
  }
};

module.exports = { parseNotification };
