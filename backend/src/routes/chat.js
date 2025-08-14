const express = require('express');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const { htmlToText } = require('html-to-text');
const ChatMemory = require('../models/ChatMemory');

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

// Date helpers to interpret natural language time windows
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function fmtYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}/${m}/${da}`;
}
function parseDateRangeFromQuestion(text) {
  const t = String(text || '').toLowerCase();
  const now = new Date();
  // yesterday / a day ago
  if (/\b(yesterday|a day ago)\b/.test(t)) {
    const s = startOfDay(addDays(now, -1));
    const e = endOfDay(addDays(now, -1));
    return { after: s, before: e, desc: 'yesterday' };
  }
  if (/\btoday\b/.test(t)) {
    const s = startOfDay(now);
    const e = endOfDay(now);
    return { after: s, before: e, desc: 'today' };
  }
  const nDays = t.match(/last\s+(\d{1,2})\s*days?/);
  if (nDays) {
    const n = Math.max(1, Math.min(30, parseInt(nDays[1])));
    const s = startOfDay(addDays(now, -n));
    const e = endOfDay(now);
    return { after: s, before: e, desc: `last ${n} day(s)` };
  }
  if (/last\s+week/.test(t)) {
    const s = startOfDay(addDays(now, -7));
    const e = endOfDay(now);
    return { after: s, before: e, desc: 'last week' };
  }
  if (/last\s+month/.test(t)) {
    const s = startOfDay(addDays(now, -30));
    const e = endOfDay(now);
    return { after: s, before: e, desc: 'last month' };
  }
  // on YYYY-MM-DD or YYYY/MM/DD
  const m1 = t.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m1) {
    const s = startOfDay(new Date(Number(m1[1]), Number(m1[2])-1, Number(m1[3])));
    const e = endOfDay(s);
    return { after: s, before: e, desc: s.toDateString() };
  }
  return null;
}

function extractLooseKeywords(text) {
  const stop = new Set([
    'the','a','an','and','or','to','of','in','on','at','by','for','from','with','about','regarding','re','fwd','email','mail','message','messages','inbox','sent','latest','last','yesterday','today','summarize','summarise','send','please','kindly','find','show','search','week','weeks','month','months','day','days','ago']
  );
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9@._-]+/)
    .filter(Boolean)
    .filter((w) => !stop.has(w) && w.length >= 2)
    .slice(0, 5);
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
    const user = req.session && req.session.userProfile;

    // Ask LLM for up to 3 Gmail search queries
    const groq = new Groq({ apiKey: groqApiKey });
    const dateRange = parseDateRangeFromQuestion(question);
    const dateQ = dateRange ? ` after:${fmtYmd(dateRange.after)} before:${fmtYmd(dateRange.before)}` : '';

    const qPrompt = `User question: ${question}
Generate up to 3 Gmail search operators that best find the answer. 
Use operators like from:, to:, subject:, newer_than:, older_than:, after:YYYY/MM/DD, before:YYYY/MM/DD. 
Return JSON ONLY: { queries: string[] }`;

    const queriesText = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
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
    // Apply explicit date window if parsed
    if (dateQ) {
      queries = queries.map((q) => `${q} ${dateQ}`);
      queries.push(`in:inbox ${dateQ}`);
    }

    // Lenient keyword-based queries (subject/from/to/body) to avoid over-constrained search
    const loose = extractLooseKeywords(question);
    if (loose.length) {
      const kw = loose.map((t) => `(from:${t} OR to:${t} OR subject:${t} OR ${t})`).join(' ');
      const kwQ = `in:inbox ${kw}${dateQ ? ' ' + dateQ : ''}`.trim();
      const subjQ = `in:inbox ${loose.map((t) => `subject:${t}`).join(' ')}${dateQ ? ' ' + dateQ : ''}`.trim();
      queries.unshift(kwQ);
      queries.push(subjQ);
    }

    // De-duplicate queries and cap
    queries = Array.from(new Set(queries.map((q) => q.replace(/\s+/g,' ').trim()))).slice(0, 6);

    // Try to extract a target name from the question to bias search (e.g., "send email to Irfan Khan")
    function extractTargetNameTokens(text = '') {
      const t = String(text).toLowerCase();
      // Common patterns around "send ... to <name> ..."
      const m = t.match(/(?:send|email|mail|compose|write)\b[\s\S]{0,40}?\bto\b\s+([^,\n]+?)(?:\s+(?:saying|that|about|regarding|with)\b|$)/i);
      const raw = m ? m[1] : '';
      const cleaned = raw
        .replace(/[^a-z\s@._-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const stop = new Set(['an', 'a', 'the', 'mr', 'mrs', 'ms', 'dr']);
      return cleaned
        .split(' ')
        .map((s) => s.trim())
        .filter((s) => s && !stop.has(s));
    }
    const targetNameTokens = extractTargetNameTokens(question);
    // Do NOT bias mailbox search toward the recipient mentioned after "send to ...".
    // The recipient is used later only to infer toEmail for the outgoing message.

    // Run each query and collect message headers
    const results = [];
    const participantsSet = new Set();
    let detailedCount = 0;
    for (const q of queries) {
      try {
        const targetLabels = [['INBOX'], ['SENT']];
        for (const labelIds of targetLabels) {
          const list = await gmail.users.messages.list({ userId: 'me', labelIds, q, maxResults: 50 });
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
          let body = useFull ? extractBody(data.payload) : { bodyHtml: '', bodyText: '' };
          // If full and bodyText is thin, attempt OCR on up to 2 inline/attachment images
          if (useFull && (!body.bodyText || body.bodyText.trim().length < 20)) {
            try {
              const parts = [];
              const stack = [data.payload];
              while (stack.length) { const p = stack.shift(); if (!p) continue; parts.push(p); if (p.parts && p.parts.length) stack.push(...p.parts); }
              const imageParts = parts.filter((p) => p.mimeType && p.mimeType.startsWith('image/') && p.body && (p.body.data || p.body.attachmentId));
              let ocrText = '';
              for (const ip of imageParts.slice(0, 2)) {
                let base64 = '';
                if (ip.body.data) base64 = ip.body.data.replace(/-/g,'+').replace(/_/g,'/');
                else if (ip.body.attachmentId) {
                  const att = await gmail.users.messages.attachments.get({ userId: 'me', messageId: data.id, id: ip.body.attachmentId });
                  base64 = att?.data?.data || '';
                }
                if (base64) {
                  const buf = Buffer.from(base64, 'base64');
                  const { data: o } = await Tesseract.recognize(buf, 'eng');
                  if (o?.text) ocrText += '\n' + o.text;
                }
                if (ocrText.length > 4000) break;
              }
              if (ocrText) body = { ...body, bodyText: (body.bodyText || '') + '\n' + ocrText };
            } catch {}
          }
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
        }
        if (results.length >= 60) break;
      } catch (e) {
        // continue other queries
      }
    }

    // Fallback enrichment: if few results and we have a target person, scan recent inbox+sent and fuzzy match locally
    async function enrichWithRecentIfNeeded() {
      try {
        if (results.length >= 8 || targetNameTokens.length === 0) return;
        const labelSets = [['INBOX'], ['SENT']];
        const recent = [];
        for (const labelIds of labelSets) {
          const page = await gmail.users.messages.list({ userId: 'me', labelIds, maxResults: 100 });
          const items = page.data.messages || [];
          for (const m of items) {
            const { data } = await gmail.users.messages.get({
              userId: 'me',
              id: m.id,
              format: 'metadata',
              metadataHeaders: ['Subject', 'From', 'To', 'Date'],
            });
            const h = parseHeaders(data.payload?.headers || []);
            const candidate = {
              id: m.id,
              subject: h['Subject'] || '',
              from: h['From'] || '',
              to: h['To'] || '',
              date: h['Date'] || '',
              snippet: data.snippet || '',
              bodyHtml: '',
              bodyText: '',
            };
            const fromScore = scoreParticipant(candidate.from, targetNameTokens);
            const toScore = scoreParticipant(candidate.to, targetNameTokens);
            const maxScore = Math.max(fromScore, toScore);
            if (maxScore >= 3) {
              recent.push({ ...candidate, matchScore: maxScore });
            }
            if (recent.length >= 40) break;
          }
        }
        if (recent.length) {
          // Deduplicate by id and merge into results
          const byId = new Map(results.map((r) => [r.id, r]));
          for (const r of recent) {
            if (!byId.has(r.id)) {
              byId.set(r.id, r);
              results.push(r);
            }
            if (r.from) participantsSet.add(r.from);
            if (r.to) participantsSet.add(r.to);
          }
        }
      } catch {
        // best effort
      }
    }

    // If nothing found with date window, broaden within a reasonable default window
    if (!results.length && dateRange) {
      try {
        const broadQ = `in:anywhere ${dateQ}`;
        const list = await gmail.users.messages.list({ userId: 'me', q: broadQ, maxResults: 50 });
        const items = list.data.messages || [];
        for (const m of items) {
          const { data } = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['Subject','From','To','Date'] });
          const h = parseHeaders(data.payload?.headers || []);
          results.push({ id: m.id, subject: h['Subject'] || '', from: h['From'] || '', to: h['To'] || '', date: h['Date'] || '', snippet: data.snippet || '', bodyHtml: '', bodyText: '' });
          if (h['From']) participantsSet.add(h['From']);
          if (h['To']) participantsSet.add(h['To']);
          if (results.length >= 30) break;
        }
      } catch {}
    }

    await enrichWithRecentIfNeeded();

    // Ask LLM to answer using the collected context
    const ctx = JSON.stringify(results, null, 2);
    // Build compact context: cap messages and body length to reduce tokens
    // Sort results by date descending so "last" queries are easier
    function toTs(d = '') {
      const t = new Date(d || 0).getTime();
      return Number.isFinite(t) ? t : 0;
    }
    results.sort((a, b) => toTs(b.date) - toTs(a.date));
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

    // Reliable summary path: if user asks to summarize, fetch the latest matching email fully and produce a concise summary
    const qLower = question.toLowerCase();
    const summaryIntent = /(summari[sz]e|summary|tl;dr|brief|condense)/i.test(qLower);
    let forcedSummary = '';
    let forcedSubject = '';
    if (summaryIntent) {
      try {
        // Build a focused query from tokens in the question (e.g., brand names like hdfc)
        const brandTokens = (question.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
          .map((s) => s.toLowerCase());
        const words = question.split(/\s+/).map((w) => w.replace(/[^a-z0-9@._-]/gi, '')).filter(Boolean);
        const salient = Array.from(new Set(words.filter((w) => w.length >= 3 && !/^(summari[sz]e|summary|send|to|and|the|latest|last|email|mail|from|of|about|please|kindly|bank|message)$/i.test(w)))).slice(0, 4);
        let focusQ = 'in:inbox';
        if (salient.length) focusQ += ' ' + salient.map((t) => `(from:${t} OR subject:${t})`).join(' ');
        // Fetch a small window; Gmail returns recent first
        const list = await gmail.users.messages.list({ userId: 'me', labelIds: ['INBOX'], q: focusQ, maxResults: 10 });
        const items = list.data.messages || [];
        // Pull full payloads and choose latest by Date header
        const fulls = await Promise.all(items.map(async (m) => {
          try {
            const { data } = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' });
            const headers = parseHeaders(data.payload?.headers || []);
            const dateStr = headers['Date'] || '';
            const ts = new Date(dateStr || 0).getTime();
            const { bodyHtml, bodyText } = extractBody(data.payload);
            return { id: m.id, headers, ts: Number.isFinite(ts) ? ts : 0, subject: headers['Subject'] || '', bodyText, bodyHtml };
          } catch { return null; }
        }));
        const candidates = fulls.filter(Boolean).sort((a, b) => b.ts - a.ts);
        if (candidates.length) {
          const top = candidates[0];
          const bodyPlain = (top.bodyText || htmlToText(top.bodyHtml || '', { wordwrap: false })).slice(0, 9000);
          const sPrompt = `Summarize the following email into 4-7 crisp sentences focusing on key facts, amounts, dates, actions, and next steps. Avoid pleasantries.

Return JSON ONLY: { "summary": string }

Subject: ${top.subject}
Body:
${bodyPlain}`;
          const sOut = await groq.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            messages: [
              { role: 'system', content: 'Return strict JSON only.' },
              { role: 'user', content: sPrompt },
            ],
            temperature: 0.2,
            max_tokens: 300,
          });
          try { forcedSummary = JSON.parse(sOut.choices?.[0]?.message?.content || '{}')?.summary || ''; } catch { forcedSummary = (sOut.choices?.[0]?.message?.content || '').trim(); }
          forcedSubject = top.subject || '';
        }
      } catch {
        // best-effort
      }
    }
    let memoryNotes = [];
    try {
      if (user) {
        const notes = await ChatMemory.find({ userId: user.id }).sort({ updatedAt: -1 }).limit(12).lean();
        memoryNotes = notes.map((n) => `(${n.type || 'note'}) ${n.key}: ${n.value}`).join('\n');
      }
    } catch {}

    const aPrompt = `You are an email assistant. Given the user's question, prior memory, and a concise list of matching emails, answer precisely.
If the user asks to email someone, infer intent and return an action with fields. If intent is clearly to send an email now (e.g., "send an email to X saying Y"), set action to "send" and provide toEmail/subject/body directly, suitable to send without further confirmation.
If asked things like "last mail from <name>", prefer emails whose From or To display-name or email matches the tokens below.

Return JSON ONLY with this shape:
{
  "answer": string,
  "citations": string[],
  "action": "send" | "schedule" | null,
  "send": { "toEmail"?: string, "toName"?: string, "subject"?: string, "body"?: string },
  "schedule": { "when"?: string, "timezone"?: string, "toEmail"?: string, "subject"?: string, "body"?: string }
}

Participants (name and/or email):\n${participants}
User memory (preferences, tone, signature, aliases):\n${memoryNotes || 'none'}
Target tokens (from user): ${targetNameTokens.join(', ') || 'none'}

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

    // If model returned empty or missing answer, synthesize a fallback summary from the top candidate(s)
    if ((!payload || !payload.answer || payload.answer === 'No answer') && results.length) {
      const top = results[0];
      const body = top.bodyText || htmlToText(top.bodyHtml || '', { wordwrap: false });
      const sPrompt = `Summarize the following email into 4-6 sentences focusing on transactions, amounts, dates, balances, and key actions. Avoid pleasantries.\n\nReturn JSON ONLY: { "summary": string }\n\nSubject: ${top.subject}\nBody:\n${String(body).slice(0, 9000)}`;
      try {
        const sOut = await groq.chat.completions.create({
          model: 'openai/gpt-oss-20b',
          messages: [
            { role: 'system', content: 'Return strict JSON only.' },
            { role: 'user', content: sPrompt },
          ],
          temperature: 0.2,
          max_tokens: 300,
        });
        let sText = '';
        try { sText = JSON.parse(sOut.choices?.[0]?.message?.content || '{}')?.summary || ''; } catch { sText = (sOut.choices?.[0]?.message?.content || '').trim(); }
        if (sText) payload.answer = sText;
      } catch {}
    }

    // If still nothing matched, produce a descriptive answer without failing silently
    if ((!results || results.length === 0) && (!payload || !payload.answer || payload.answer === 'No answer')) {
      const when = dateRange ? ` within ${dateRange.desc}` : 'recently';
      payload.answer = `I could not find messages matching your request${dateRange ? ` ${when}` : ''}. I searched Inbox and Sent${dateRange ? ` between ${fmtYmd(dateRange.after)} and ${fmtYmd(dateRange.before)}` : ''}. Try specifying sender or subject keywords, or expand the date range.`;
    }

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
    function normalize(s = '') {
      return String(s).toLowerCase().replace(/[^a-z0-9@._\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function tokenize(s = '') {
      return normalize(s)
        .split(' ')
        .filter(Boolean);
    }
    function scoreParticipant(participantHeader = '', queryTokens = []) {
      const name = nameFromAddress(participantHeader);
      const email = extractEmail(participantHeader);
      const nameTokens = tokenize(name);
      const emailLocal = email.split('@')[0] || '';
      const emailTokens = tokenize(emailLocal.replace(/[._-]/g, ' '));
      let score = 0;
      for (const qt of queryTokens) {
        if (nameTokens.includes(qt)) score += 3;
        if (emailTokens.includes(qt)) score += 2;
        if (normalize(name).includes(qt)) score += 1;
      }
      // Prefer recent senders in results by giving a tiny bias later via order
      return score;
    }

    // Detect explicit send intent; avoid misfiring on queries like "when did X mail me"
    const isQuestionAboutMailbox = /(when|what|who|did|has|have|show|find|list|search|look|check)\b[\s\S]{0,40}\b(mail|email|inbox|message|messages)\b/i.test(qLower);
    const explicitSendIntent = /(send|draft|compose|write|reply|forward)\b/i.test(qLower) || /(email|mail)\s+to\b/i.test(qLower);

    if (explicitSendIntent && !isQuestionAboutMailbox && (!payload || payload.action !== 'send' || !payload.send || !payload.send.toEmail)) {
      // Infer best recipient strictly from the question (not from results to avoid biasing to past threads)
      let candidateEmail = '';
      // 1) If the question contains an email, use it
      candidateEmail = extractEmail(question);
      // 2) Else, fuzzy match a name fragment against participants
      // We avoid scanning historical participants to prevent sending to unrelated threads when user specifies a new recipient.
      // 3) Else, choose the sender of the first result
      if (!candidateEmail && results.length) {
        candidateEmail = extractEmail(results[0].from) || extractEmail(results[0].to);
      }
      if (candidateEmail) {
        const subjBase = (results[0]?.subject || '').replace(/^\s*re:\s*/i, '').slice(0, 80);
        const defaultSubject = forcedSubject ? `Summary: ${forcedSubject}` : (subjBase ? `Re: ${subjBase}` : 'Quick note');
        const defaultBody = forcedSummary || (payload?.answer && payload.answer.length < 800 ? payload.answer : 'Thank you!');
        payload.action = 'send';
        payload.send = {
          toEmail: candidateEmail,
          subject: payload?.send?.subject || defaultSubject,
          body: payload?.send?.body || defaultBody,
        };
      }
    }

    // Memory capture: simple pattern "remember <key>: <value>"
    const memMatch = String(question).match(/\bremember\s+(?:that\s+)?(.+?):\s*(.+)$/i);
    if (user && memMatch) {
      const key = memMatch[1].trim().slice(0, 120).toLowerCase();
      const value = memMatch[2].trim().slice(0, 2000);
      try { await ChatMemory.create({ userId: user.id, type: 'note', key, value }); } catch {}
    }

    res.json({ ...payload, messages: results, queries });
  } catch (err) {
    console.error('AI chat ask error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to answer' });
  }
});

module.exports = router;


