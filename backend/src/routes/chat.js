const express = require('express');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const { htmlToText } = require('html-to-text');

const router = express.Router();

function createOAuthClientFromSession(tokens) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'postmessage');
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

function parseHeaders(headerArray = []) {
  return Object.fromEntries(headerArray.map((h) => [h.name, h.value]));
}

function base64UrlDecodeToString(data) {
  if (!data) return '';
  let b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  return Buffer.from(b64, 'base64').toString('utf-8');
}

function extractBody(payload) {
  if (!payload) return { bodyText: '', bodyHtml: '' };
  if (payload.body && payload.body.data) {
    const content = base64UrlDecodeToString(payload.body.data);
    if ((payload.mimeType || '').includes('text/html')) return { bodyHtml: content, bodyText: '' };
    return { bodyText: content, bodyHtml: '' };
  }
  let bodyHtml = '';
  let bodyText = '';
  const stack = [...(payload.parts || [])];
  while (stack.length) {
    const part = stack.shift();
    if (!part) continue;
    if (part.parts && part.parts.length) stack.push(...part.parts);
    if (part.body && part.body.data) {
      const content = base64UrlDecodeToString(part.body.data);
      if (!bodyHtml && (part.mimeType || '').includes('text/html')) bodyHtml = content;
      else if (!bodyText && (part.mimeType || '').includes('text/plain')) bodyText = content;
      if (bodyHtml && bodyText) break;
    }
  }
  return { bodyHtml, bodyText };
}

// POST /api/chat/ask  { question: string }
router.post('/ask', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
    const { question = '' } = req.body || {};
    if (!question.trim()) return res.status(400).json({ error: 'Missing question' });

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) return res.status(500).json({ error: 'Server missing GROQ_API_KEY' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Ask LLM for up to 3 Gmail search queries
    const groq = new Groq({ apiKey: groqApiKey });
    const qPrompt = `User question: ${question}
Generate up to 3 Gmail search operators that best find the answer. 
Use operators like from:, to:, subject:, newer_than:, older_than:, after:YYYY/MM/DD, before:YYYY/MM/DD. 
Return JSON ONLY: { queries: string[] }`;

    const queriesText = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Return strict JSON only.' },
        { role: 'user', content: qPrompt },
      ],
      temperature: 0.2,
      max_tokens: 200,
    });
    let queries = [];
    try {
      const j = JSON.parse(queriesText.choices?.[0]?.message?.content || '{}');
      if (Array.isArray(j.queries)) queries = j.queries.slice(0, 3);
    } catch {}
    if (!queries.length) queries = ['in:inbox'];

    // Run each query and collect message headers
    const results = [];
    const participantsSet = new Set();
    let detailedCount = 0;
    for (const q of queries) {
      try {
        const list = await gmail.users.messages.list({ userId: 'me', labelIds: ['INBOX'], q, maxResults: 25 });
        const items = list.data.messages || [];
        for (const m of items) {
          const useFull = detailedCount < 5; // include full bodies for first few
          const { data } = await gmail.users.messages.get({
            userId: 'me',
            id: m.id,
            format: useFull ? 'full' : 'metadata',
            metadataHeaders: ['Subject', 'From', 'To', 'Date'],
          });
          const h = parseHeaders(data.payload?.headers || []);
          const body = useFull ? extractBody(data.payload) : { bodyHtml: '', bodyText: '' };
          if (useFull) detailedCount += 1;
          results.push({
            id: m.id,
            subject: h['Subject'] || '',
            from: h['From'] || '',
            to: h['To'] || '',
            date: h['Date'] || '',
            snippet: data.snippet || '',
            bodyHtml: body.bodyHtml,
            bodyText: body.bodyText,
          });
          if (h['From']) participantsSet.add(h['From']);
          if (h['To']) participantsSet.add(h['To']);
          if (results.length >= 60) break;
        }
        if (results.length >= 60) break;
      } catch (e) {
        // continue other queries
      }
    }

    // Ask LLM to answer using the collected context
    const ctx = JSON.stringify(results, null, 2);
    // Build compact context: cap messages and body length to reduce tokens
    let compact = results.slice(0, 12).map((r) => {
      const body = r.bodyText || htmlToText(r.bodyHtml || '', { wordwrap: false });
      const preview = (body || r.snippet || '').slice(0, 600);
      return {
        id: r.id,
        subject: r.subject,
        from: r.from,
        to: r.to,
        date: r.date,
        preview,
      };
    });
    // If still too large, shrink further
    let approxChars = JSON.stringify(compact).length;
    if (approxChars > 8000) compact = compact.slice(0, 8);
    if (JSON.stringify(compact).length > 8000) compact = compact.slice(0, 5);

    const participants = Array.from(participantsSet).slice(0, 20).join('\n');
    const aPrompt = `You are an email assistant. Given the user's question and a concise list of matching emails, answer precisely.
If the user asks to email someone, infer intent and return an action with fields.

Return JSON ONLY with this shape:
{
  "answer": string,
  "citations": string[],
  "action": "send" | "schedule" | null,
  "send": { "toEmail"?: string, "toName"?: string, "subject"?: string, "body"?: string },
  "schedule": { "when"?: string, "timezone"?: string, "toEmail"?: string, "subject"?: string, "body"?: string }
}

Participants (name and/or email):\n${participants}

Question: ${question}
 Emails: ${JSON.stringify(compact)}`;

    const answerText = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: 'Return strict JSON only.' },
        { role: 'user', content: aPrompt },
      ],
      temperature: 0.2,
      max_tokens: 600,
    });
    let payload = { answer: 'No answer', citations: [], action: null, send: null, schedule: null };
    try {
      payload = JSON.parse(answerText.choices?.[0]?.message?.content || '{}');
    } catch {}

    // Heuristic fallback: if user asked to email but model didn't provide a recipient, infer from results/participants
    function extractEmail(str = '') {
      const m = String(str).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      return m ? m[0] : '';
    }
    function nameFromAddress(headerVal = '') {
      // "Name" <email@x.com> or Name <email@x.com>
      const nameMatch = String(headerVal).match(/"?([^"<]+)"?\s*<.+?>/);
      return nameMatch ? nameMatch[1].trim() : headerVal.split('<')[0].trim();
    }

    const qLower = question.toLowerCase();
    // Detect explicit send intent; avoid misfiring on queries like "when did X mail me"
    const isQuestionAboutMailbox = /(when|what|who|did|has|have|show|find|list|search|look|check)\b[\s\S]{0,40}\b(mail|email|inbox|message|messages)\b/i.test(qLower);
    const explicitSendIntent = /(send|draft|compose|write|reply|forward)\b/i.test(qLower) || /(email|mail)\s+to\b/i.test(qLower);

    if (explicitSendIntent && !isQuestionAboutMailbox && (!payload || payload.action !== 'send' || !payload.send || !payload.send.toEmail)) {
      // Try to infer best recipient from results by matching a name/email that appears in the question
      let candidateEmail = '';
      // 1) If the question contains an email, use it
      candidateEmail = extractEmail(question);
      // 2) Else, fuzzy match a name fragment against participants
      if (!candidateEmail) {
        const parts = Array.from(participantsSet);
        const best = parts.find((p) => qLower.includes(nameFromAddress(p).toLowerCase()));
        if (best) candidateEmail = extractEmail(best) || best;
      }
      // 3) Else, choose the sender of the first result
      if (!candidateEmail && results.length) {
        candidateEmail = extractEmail(results[0].from) || extractEmail(results[0].to);
      }
      if (candidateEmail) {
        const subjBase = (results[0]?.subject || '').replace(/^\s*re:\s*/i, '').slice(0, 80);
        const defaultSubject = subjBase ? `Re: ${subjBase}` : 'Quick note';
        const defaultBody = payload?.answer && payload.answer.length < 800 ? payload.answer : 'Thank you!';
        payload.action = 'send';
        payload.send = {
          toEmail: candidateEmail,
          subject: payload?.send?.subject || defaultSubject,
          body: payload?.send?.body || defaultBody,
        };
      }
    }

    res.json({ ...payload, messages: results, queries });
  } catch (err) {
    console.error('AI chat ask error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to answer' });
  }
});

module.exports = router;


