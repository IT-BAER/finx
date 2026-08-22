const logger = require('../utils/logger');
const { parseRequestSchema, ocrRequestSchema, speechRequestSchema, chatRequestSchema } = require('../utils/aiSchemas');
const { sanitizeText, sanitizeStringArray } = require('../utils/aiSanitize');
const { callAiProxy } = require('../services/aiProxy');
const { runChatTurn, makeRealDeps } = require('../services/aiChat');

// Function references only — see services/aiChat.js: building this object never touches the
// DB, only calling a function inside it does (first real chat request, not module load).
const chatDeps = makeRealDeps();

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

const parseReceipt = async (req, res) => {
  const parsed = ocrRequestSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message || 'invalid request body',
      code: 'AI_BAD_REQUEST',
    });
  }
  const v = parsed.data;
  const vars = {
    image: v.image,
    mime: v.mime,
    categories: sanitizeStringArray(v.categories),
  };
  try {
    const { parsed: out, model } = await callAiProxy({
      purpose: 'RECEIPT_OCR',
      vars,
      userId: req.user?.id,
    });
    return res.json({ parsed: out, model });
  } catch (err) {
    logger.error('AI OCR failed (user=' + (req.user?.id) + '): ' + err.message);
    const status = err.status || 502;
    return res
      .status(status)
      .json({ message: status === 503 ? 'AI not configured' : 'AI parsing unavailable' });
  }
};

const parseSpeech = async (req, res) => {
  const parsed = speechRequestSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message || 'invalid request body',
      code: 'AI_BAD_REQUEST',
    });
  }
  const v = parsed.data;
  const text = sanitizeText(v.text);
  if (!text) {
    return res.status(400).json({ message: 'text required', code: 'AI_BAD_REQUEST' });
  }
  const vars = {
    text,
    categories: sanitizeStringArray(v.categories),
    goals: sanitizeStringArray(v.goals),
  };
  try {
    const { parsed: out, model } = await callAiProxy({
      purpose: 'SPEECH_PARSE',
      vars,
      userId: req.user?.id,
    });
    return res.json({ parsed: out, model });
  } catch (err) {
    logger.error('AI speech parse failed (user=' + (req.user?.id) + '): ' + err.message);
    const status = err.status || 502;
    return res
      .status(status)
      .json({ message: status === 503 ? 'AI not configured' : 'AI parsing unavailable' });
  }
};

const chat = async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message || 'invalid request body',
      code: 'AI_BAD_REQUEST',
    });
  }
  try {
    const { reply, toolCallsUsed } = await runChatTurn({
      messages: parsed.data.messages,
      userId: req.user?.id,
      deps: chatDeps,
    });
    return res.json({ success: true, reply, toolCallsUsed });
  } catch (err) {
    // Never log message content — metadata only, mirrors the other AI purposes.
    logger.error('AI chat failed (user=' + (req.user?.id) + '): ' + err.message);
    const status = err.status || 502;
    return res
      .status(status)
      .json({ message: status === 503 ? 'AI not configured' : 'AI chat unavailable' });
  }
};

module.exports = { parseNotification, parseReceipt, parseSpeech, chat };
