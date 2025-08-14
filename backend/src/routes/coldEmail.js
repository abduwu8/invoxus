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

    const { to = '', keywords = '', role = 'HR', company = '' } = req.body || {};

    // Normalize keywords to work well with single or multiple inputs
    const keywordsList = String(keywords)
      .split(/[,\n]/)
      .flatMap((part) => String(part).split(/\s+/))
      .map((s) => s.trim())
      .filter(Boolean);
    const keywordsForPrompt = keywordsList.length ? keywordsList.slice(0, 12).join(', ') : 'intro, fit, value, quick call';

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) return res.status(200).json({ to, subject: 'Hello', body: 'Please set GROQ_API_KEY on the server.', reason: 'Missing GROQ_API_KEY' });

    const groq = new Groq({ apiKey: groqApiKey });
    const prompt = `You are a senior B2B cold email copywriter.
Draft a short, personalized cold email for a ${role} at ${company || 'their company'}.

Context keywords (may be one or many): ${keywordsForPrompt}

Requirements:
- subject: <= 70 characters, no brackets, no emojis, no clickbait
- body: 90–140 words total in 2 short paragraphs plus a one-line CTA
- personalize to the role/company; reference ONE concrete benefit or outcome
- avoid clichés, fluff, and markdown; keep it plain text
- end with a soft CTA (e.g., "open to a quick 10-minute chat?") and a signature placeholder "— [Your Name]"

Return STRICT JSON only with keys:
{ "subject": string, "body": string, "reason": string }
Where "reason" is a concise 6–12 word summary of the angle used.`;

    // Call Groq without unsupported fetch signal; enforce timeout by Promise.race
    const request = groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always return STRICT JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.25,
      max_tokens: 600,
    })
    const withTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))
    let text = '{}'
    try {
      const completion = await Promise.race([request, withTimeout])
      // @ts-ignore
      text = completion?.choices?.[0]?.message?.content || '{}'
    } catch (err) {
      if (String(err?.message || '').includes('timeout')) {
        console.warn('Groq completion timed out')
      } else {
        console.warn('Groq completion error:', err?.response?.data || err?.message || err)
      }
    }

    let draft = {};
    try {
      draft = JSON.parse(text);
    } catch {
      // Fallback: synthesize minimal draft if model returned non-JSON or empty
      const fallbackSubject = `Quick intro — ${company || role}`.slice(0, 70);
      const fallbackBody = (
        `Hi ${role},\n\n` +
        `Reaching out ${company ? `to ${company}` : ''} because I noticed a potential fit around ${keywordsList[0] || 'improving workflows'}. ` +
        `I can help with a fast, low-lift approach that typically shows value in weeks, not months.\n\n` +
        `Open to a quick 10-minute chat?\n\n— [Your Name]`
      ).slice(0, 1500);
      draft = { subject: fallbackSubject, body: fallbackBody, reason: 'Fallback draft due to model output issue' };
    }

    // Ensure minimal shape
    const subjectOut = String(draft.subject || '').trim().slice(0, 120) || `Intro for ${company || role}`.slice(0, 70);
    const bodyOut = String(draft.body || '').trim().slice(0, 2000) || (
      `Hi ${role},\n\n` +
      `Wanted to share a quick idea related to ${keywordsList[0] || 'your priorities'}.\n\n` +
      `Open to a quick 10-minute chat?\n\n— [Your Name]`
    );

    res.json({ to, subject: subjectOut, body: bodyOut, reason: draft.reason });
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


