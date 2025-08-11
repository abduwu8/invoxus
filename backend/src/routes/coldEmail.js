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
    if (!groqApiKey) return res.status(200).json({ to, subject: 'Hello', body: 'Please set GROQ_API_KEY on the server.', reason: 'Missing GROQ_API_KEY' });

    const groq = new Groq({ apiKey: groqApiKey });
    const prompt = `You are a cold email copy expert.
Create a concise, personalized cold email to ${role} at ${company || 'the company'}, based on the following keywords:
${String(keywords)}

Return strict JSON with fields: subject (<=70 chars), body (4-7 short sentences in 2-3 paragraphs, plain text, no markdown),
and a one-sentence reason summarizing the value proposition.`;

    // Prefer a fast, widely-available Groq model and force JSON output
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let text = '{}';
    try {
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Always return STRICT JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 600,
        response_format: { type: 'json_object' },
        // @ts-ignore Groq SDK forwards this to fetch
        signal: controller.signal,
      });
      text = completion.choices?.[0]?.message?.content || '{}';
    } catch (err) {
      if (err?.name === 'AbortError') {
        console.warn('Groq completion timed out');
      } else {
        console.warn('Groq completion error:', err?.response?.data || err?.message || err);
      }
    } finally {
      clearTimeout(timeout);
    }

    let draft = {};
    try {
      draft = JSON.parse(text);
    } catch {
      // Fallback: synthesize minimal draft if model returned non-JSON or empty
      const fallbackSubject = `Quick intro about ${company || role}`.slice(0, 70);
      const fallbackBody = (
        `Hi ${role},\n\n` +
        `I wanted to reach out regarding ${company || 'your team'}. ` +
        `Keywords: ${String(keywords).slice(0, 200)}.\n\n` +
        `Would love to share how I can help.\n\nBest,\n`
      ).slice(0, 1500);
      draft = { subject: fallbackSubject, body: fallbackBody, reason: 'Fallback draft due to model error' };
    }

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


