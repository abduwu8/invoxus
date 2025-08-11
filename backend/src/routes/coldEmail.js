const express = require('express');
const { google } = require('googleapis');
const Groq = require('groq-sdk');

const router = express.Router();

function createOAuthClientFromSession(tokens) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'postmessage');
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

// Generate a cold email draft based on keywords and target info
router.post('/generate', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const { to, keywords = '', role = 'HR', company = '' } = req.body || {};
    if (!to) return res.status(400).json({ error: 'Missing recipient email (to)' });

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) return res.status(500).json({ error: 'Server missing GROQ_API_KEY' });

    const groq = new Groq({ apiKey: groqApiKey });
    const prompt = `You are a cold email copy expert.
Create a concise, personalized cold email to ${role} at ${company || 'the company'}, based on the following keywords:
${String(keywords)}

Return strict JSON with fields: subject (<=70 chars), body (4-7 short sentences in 2-3 paragraphs, plain text, no markdown),
and a one-sentence reason summarizing the value proposition.`;

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: 'Return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 600,
    });

    const text = completion.choices?.[0]?.message?.content || '{}';
    let draft = {};
    try { draft = JSON.parse(text); } catch { draft = { subject: 'Hello', body: text.trim().slice(0, 1500) }; }

    res.json({ to, subject: draft.subject, body: draft.body, reason: draft.reason });
  } catch (err) {
    console.error('Cold email generate error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to generate cold email' });
  }
});

// Send an email using Gmail
router.post('/send', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
    const { to, subject = 'Hello', body = '' } = req.body || {};
    if (!to) return res.status(400).json({ error: 'Missing recipient email (to)' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const headers = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
    ].join('\r\n');
    const raw = `${headers}\r\n\r\n${body}`;
    const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
    res.json({ sent: true });
  } catch (err) {
    console.error('Cold email send error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

module.exports = router;


