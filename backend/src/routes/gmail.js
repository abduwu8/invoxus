const express = require('express');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const { htmlToText } = require('html-to-text');

const router = express.Router();
const mongoose = require('mongoose');
const Unsubscribe = require('../models/Unsubscribe');

// Simple Category and MailTag models (stored in MongoDB)
const CategorySchema = new mongoose.Schema(
  {
    userId: { type: String, index: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);
const MailTagSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true },
    messageId: { type: String, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
  },
  { timestamps: true }
);
const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const MailTag = mongoose.models.MailTag || mongoose.model('MailTag', MailTagSchema);

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

  // Direct body
  if (payload.body && payload.body.data) {
    const content = base64UrlDecodeToString(payload.body.data);
    if ((payload.mimeType || '').includes('text/html')) {
      return { bodyHtml: content, bodyText: '' };
    }
    return { bodyText: content, bodyHtml: '' };
  }

  // Multipart: search parts
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

// Parse List-Unsubscribe header into actionable links (mailto or http/https)
function parseListUnsubscribeHeader(value = '') {
  if (!value) return [];
  // Header can contain multiple comma-separated entries, often wrapped in <>
  const parts = String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const items = [];
  for (const p of parts) {
    const inner = p.replace(/^<|>$/g, '').trim();
    if (!inner) continue;
    try {
      if (inner.toLowerCase().startsWith('mailto:')) {
        const url = new URL(inner);
        const address = url.pathname;
        const subject = url.searchParams.get('subject') || 'unsubscribe';
        const body = url.searchParams.get('body') || 'unsubscribe';
        items.push({ type: 'mailto', address, subject, body });
      } else if (inner.toLowerCase().startsWith('http://') || inner.toLowerCase().startsWith('https://')) {
        items.push({ type: 'http', url: inner });
      }
    } catch {
      // ignore malformed entries
    }
  }
  return items;
}

// Detect sender email from a From header value
function extractSenderEmail(fromHeader = '') {
  const match = String(fromHeader).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : '';
}

router.get('/messages', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Folder selection: inbox (default) or sent
    const folder = String(req.query.folder || 'inbox').toLowerCase();
    const labelIds = folder === 'sent' ? ['SENT'] : ['INBOX'];

    // Optional Gmail search query
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;

    // Fetch messages with pagination (default ~100, supports limit=all)
    const summarize = String(req.query.summarize || '').toLowerCase() === 'true' || req.query.summarize === '1';
    const limitParam = String(req.query.limit || '100');
    const targetCount = limitParam.toLowerCase() === 'all' ? Number.POSITIVE_INFINITY : Math.max(1, Math.min(5000, parseInt(limitParam) || 100));
    let remaining = targetCount;
    let pageToken = undefined;
    const messagesBasic = [];
    do {
      const pageSize = Math.min(500, Number.isFinite(remaining) ? remaining : 500);
      const page = await gmail.users.messages.list({ userId: 'me', labelIds, q, maxResults: pageSize, pageToken });
      const batch = page.data.messages || [];
      messagesBasic.push(...batch);
      pageToken = page.data.nextPageToken;
      if (Number.isFinite(remaining)) remaining -= batch.length;
    } while (pageToken && (!Number.isFinite(remaining) || remaining > 0));

    const details = await Promise.all(
      messagesBasic.map(async (m) => {
        const { data } = await gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: summarize ? 'full' : 'metadata',
          metadataHeaders: summarize ? undefined : ['Subject', 'From', 'Date'],
        });

        const headers = Object.fromEntries((data.payload?.headers || []).map((h) => [h.name, h.value]));
        const item = {
          id: m.id,
          threadId: data.threadId,
          subject: headers['Subject'] || '',
          from: headers['From'] || '',
          date: headers['Date'] || '',
          snippet: data.snippet || '',
          unread: Array.isArray(data.labelIds) ? data.labelIds.includes('UNREAD') : undefined,
          isStarred: Array.isArray(data.labelIds) ? data.labelIds.includes('STARRED') : undefined,
        };

        if (summarize) {
          try {
            const { bodyHtml, bodyText } = extractBody(data.payload);
            const plain = bodyText || htmlToText(bodyHtml || '', { wordwrap: false });
            const groqApiKey = process.env.GROQ_API_KEY;
            if (groqApiKey) {
              const groq = new Groq({ apiKey: groqApiKey });
              const prompt = `Summarize and classify importance. JSON only with keys: summary (<=40 words), importance (high|medium|low).\nSubject: ${item.subject}\nFrom: ${item.from}\nDate: ${item.date}\nBody: ${plain.slice(0, 6000)}`;
              const completion = await groq.chat.completions.create({
                model: 'openai/gpt-oss-20b',
                messages: [
                  { role: 'system', content: 'Return strict JSON only.' },
                  { role: 'user', content: prompt },
                ],
                temperature: 0.2,
                max_tokens: 200,
              });
              const text = completion.choices?.[0]?.message?.content || '{}';
              try {
                const j = JSON.parse(text);
                item.summary = j.summary;
                item.importance = j.importance;
              } catch {
                item.summary = text.trim().slice(0, 160);
                item.importance = 'medium';
              }
            } else {
              // No API key; skip summarization gracefully
            }
          } catch (e) {
            // Skip summarization errors per-message
          }
        }

        return item;
      })
    );

    res.json({ messages: details });
  } catch (err) {
    console.error('Gmail list error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Bulk delete (move to trash) a list of message IDs
router.post('/messages/bulk-delete', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const { ids = [] } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Missing ids' });

    const deleted = [];
    const failed = [];
    // Concurrency limiter
    const concurrency = 5;
    let index = 0;
    await Promise.all(
      Array.from({ length: Math.min(concurrency, ids.length) }).map(async () => {
        while (index < ids.length) {
          const i = index++;
          const id = ids[i];
          try {
            await gmail.users.messages.trash({ userId: 'me', id });
            deleted.push(id);
          } catch (e) {
            failed.push(id);
          }
        }
      })
    );

    res.json({ deleted, failed });
  } catch (err) {
    console.error('Bulk delete error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Suggest deletions based on simple heuristics (newsletters, promos, no-reply, unsubscribe, etc.)
router.get('/messages/suggest-deletions', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const folder = String(req.query.folder || 'inbox').toLowerCase();
    const labelIds = folder === 'sent' ? ['SENT'] : ['INBOX'];
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limitParam = String(req.query.limit || '200');
    const maxCount = Math.max(1, Math.min(1000, parseInt(limitParam) || 200));
    const strictMode = ['1', 'true', 'yes'].includes(String(req.query.strict || '1').toLowerCase());

    // Fetch a window of messages (metadata)
    let remaining = maxCount;
    let pageToken = undefined;
    const messagesBasic = [];
    do {
      const pageSize = Math.min(200, Number.isFinite(remaining) ? remaining : 200);
      const page = await gmail.users.messages.list({ userId: 'me', labelIds, q, maxResults: pageSize, pageToken });
      const batch = page.data.messages || [];
      messagesBasic.push(...batch);
      pageToken = page.data.nextPageToken;
      if (Number.isFinite(remaining)) remaining -= batch.length;
    } while (pageToken && (!Number.isFinite(remaining) || remaining > 0));

    const details = await Promise.all(
      messagesBasic.map(async (m) => {
        const { data } = await gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date', 'List-Unsubscribe', 'List-Unsubscribe-Post', 'To', 'Cc'],
        });
        const headers = Object.fromEntries((data.payload?.headers || []).map((h) => [h.name, h.value]));
        const item = {
          id: m.id,
          threadId: data.threadId,
          subject: headers['Subject'] || '',
          from: headers['From'] || '',
          date: headers['Date'] || '',
          snippet: data.snippet || '',
          labelIds: data.labelIds || [],
          listUnsub: headers['List-Unsubscribe'] || headers['List-unsubscribe'] || '',
        };
        return item;
      })
    );

    // Apply conservative heuristics as baseline
    const includePatterns = [
      /unsubscribe/i,
      /newsletter/i,
      /promotion|promo|deal|sale/i,
      /no[-\s]?reply|donotreply|do[-\s]?not[-\s]?reply/i,
      /digest/i,
    ];
    const protectPatterns = [
      /invoice|receipt|payment|paid|billing|bill|statement|salary|payroll|payout|refund|wire|transfer|bank|account|upi|gst|tax|pan/i,
      /order\b|tracking|shipment|shipping|delivery|itinerary|reservation|booking|ticket/i,
      /otp|one[-\s]?time|verification|2fa|two[-\s]?factor|security\s*code|passcode|login\s*code/i,
      /confirm|confirmation|approved|accepted|deadline|due|overdue|expires?/i,
    ];
    let baseline = details
      .map((d) => {
        const hay = `${d.subject}\n${d.from}\n${d.snippet}`;
        const hasListUnsub = !!d.listUnsub;
        const includeHit = includePatterns.find((p) => p.test(hay));
        const isSocialOrPromo = Array.isArray(d.labelIds) && (d.labelIds.includes('CATEGORY_PROMOTIONS') || d.labelIds.includes('CATEGORY_SOCIAL'));
        const looksReply = /^\s*(re:|fwd:)/i.test(d.subject || '');
        const protectedHit = protectPatterns.find((p) => p.test(hay));
        let score = 0;
        // Conservative: require list-unsubscribe OR clear include pattern or promotions/social label
        if (hasListUnsub) score += 2;
        if (includeHit) score += 1;
        if (isSocialOrPromo) score += 1;
        // Penalize if protected keywords or reply/forward
        if (protectedHit) score -= 3;
        if (looksReply) score -= 1;
        let reason = '';
        if (hasListUnsub) reason = 'Has List-Unsubscribe header';
        if (includeHit) reason = reason ? `${reason}; ${includeHit}` : `Matched pattern: ${includeHit}`;
        if (isSocialOrPromo) reason = reason ? `${reason}; Promotions/Social` : 'Promotions/Social';
        if (protectedHit && strictMode) reason = reason ? `${reason}; Protected: ${protectedHit}` : `Protected: ${protectedHit}`;
        return { ...d, reason, score };
      })
      .filter((d) => d.score >= (strictMode ? 2 : 1))
      .slice(0, 300);

    // If explicitly requested via ?ai=1, refine with AI classifier; default is FAST heuristics only
    const groqApiKey = process.env.GROQ_API_KEY;
    // Enable AI refinement by default when GROQ key is available; allow opting out via ai=0
    const aiParam = String(req.query.ai || (groqApiKey ? '1' : '0')).toLowerCase();
    const useAI = groqApiKey && ['1', 'true', 'yes'].includes(aiParam);
    if (groqApiKey && useAI && baseline.length) {
      try {
        const groq = new Groq({ apiKey: groqApiKey });
        const toClassify = baseline.slice(0, 80); // tighter cap for latency
        const concurrency = 6;
        let idx = 0;
        const refined = [];
        await Promise.all(
          Array.from({ length: Math.min(concurrency, toClassify.length) }).map(async () => {
            while (idx < toClassify.length) {
              const i = idx++;
              const d = toClassify[i];
              try {
                const prompt = `You are an email triage assistant. Decide if this message is low-value (promotions, newsletters, social digests, generic notifications, marketing blasts) and safe to move to Trash.

STRICTLY DO NOT delete anything related to: payments, invoices, receipts, bills, statements, banking, payroll, refunds, taxes, OTP/verification/security codes, orders, shipping/tracking, bookings/tickets/itineraries/reservations, confirmations, deadlines, account access, support tickets.

Return STRICT JSON: { "delete": boolean, "reason": string }

Subject: ${d.subject}\nFrom: ${d.from}\nSnippet: ${d.snippet}\nLabels: ${(d.labelIds || []).join(', ')}`;
                const completion = await groq.chat.completions.create({
                  model: 'openai/gpt-oss-20b',
                  messages: [
                    { role: 'system', content: 'Return strict JSON only.' },
                    { role: 'user', content: prompt },
                  ],
                  temperature: 0,
                  max_tokens: 150,
                });
                const text = completion.choices?.[0]?.message?.content || '{}';
                let decision = { delete: false, reason: '' };
                try {
                  decision = JSON.parse(text);
                } catch {}
                if (decision && decision.delete) {
                  refined.push({ id: d.id, threadId: d.threadId, subject: d.subject, from: d.from, date: d.date, snippet: d.snippet, reason: decision.reason || d.reason });
                }
              } catch {
                // Ignore AI failures per-item; fall back to baseline
                refined.push({ id: d.id, threadId: d.threadId, subject: d.subject, from: d.from, date: d.date, snippet: d.snippet, reason: d.reason });
              }
            }
          })
        );
        // If AI produced any, prefer refined; else fallback to baseline
        if (refined.length) {
          return res.json({ messages: refined.slice(0, 200) });
        }
      } catch (e) {
        // On global AI error, just fall back
      }
    }

    const suggestions = baseline.map(({ labelIds, score, ...rest }) => rest).slice(0, 200);
    res.json({ messages: suggestions });
  } catch (err) {
    console.error('Suggest deletions error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to suggest deletions' });
  }
});

// Unsubscribe suggestions: scan recent inbox for List-Unsubscribe headers
router.get('/unsubscribe/suggestions', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
    const user = req.session && req.session.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const limitParam = String(req.query.limit || '200');
    const maxCount = Math.max(1, Math.min(600, parseInt(limitParam) || 200));

    let remaining = maxCount;
    let pageToken = undefined;
    const messagesBasic = [];
    do {
      const pageSize = Math.min(200, Number.isFinite(remaining) ? remaining : 200);
      const page = await gmail.users.messages.list({ userId: 'me', labelIds: ['INBOX'], maxResults: pageSize, pageToken });
      const batch = page.data.messages || [];
      messagesBasic.push(...batch);
      pageToken = page.data.nextPageToken;
      if (Number.isFinite(remaining)) remaining -= batch.length;
    } while (pageToken && (!Number.isFinite(remaining) || remaining > 0));

    // Fetch headers including List-Unsubscribe
    const details = await Promise.all(
      messagesBasic.map(async (m) => {
        const { data } = await gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date', 'List-Unsubscribe', 'List-Unsubscribe-Post'],
        });
        const headers = parseHeaders(data.payload?.headers || []);
        const lu = headers['List-Unsubscribe'] || headers['List-unsubscribe'] || '';
        const lup = headers['List-Unsubscribe-Post'] || headers['List-unsubscribe-post'] || '';
        const options = parseListUnsubscribeHeader(lu);
        if (!options.length) return null;
        const hasOneClick = /one-click/i.test(String(lup || ''));
        return {
          id: m.id,
          threadId: data.threadId,
          subject: headers['Subject'] || '',
          from: headers['From'] || '',
          date: headers['Date'] || '',
          senderEmail: extractSenderEmail(headers['From'] || ''),
          hasOneClick,
          methods: options,
        };
      })
    );

    // Suppress already unsubscribed messageIds and senders for this user
    const prior = await Unsubscribe.find({ userId: user.id }).select('messageId senderEmail').lean();
    const suppressedMessageIds = new Set(prior.map((r) => r.messageId));
    const suppressedSenders = new Set(prior.map((r) => (r.senderEmail || '').toLowerCase()).filter(Boolean));

    // Deduplicate by senderEmail + method target where possible to reduce noise
    const unique = [];
    const seen = new Set();
    for (const d of details) {
      if (!d) continue;
      if (suppressedMessageIds.has(d.id)) continue;
      if (d.senderEmail && suppressedSenders.has(String(d.senderEmail).toLowerCase())) continue;
      const key = `${d.senderEmail}|${d.methods.map((o) => (o.type === 'http' ? o.url : o.address)).join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(d);
      if (unique.length >= maxCount) break;
    }

    res.json({ suggestions: unique });
  } catch (err) {
    console.error('Unsubscribe suggestions error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to fetch unsubscribe suggestions' });
  }
});

// Execute unsubscribe actions for selected messages (confirms required)
router.post('/unsubscribe/execute', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
    const user = req.session && req.session.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { ids = [], confirm } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Missing ids' });
    if (!confirm) return res.status(400).json({ error: 'Confirmation required' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let success = 0;
    const failed = [];
    const results = [];

    for (const id of ids) {
      try {
        const { data } = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date', 'List-Unsubscribe', 'List-Unsubscribe-Post'],
        });
        const headers = parseHeaders(data.payload?.headers || []);
        const lu = headers['List-Unsubscribe'] || headers['List-unsubscribe'] || '';
        const lup = headers['List-Unsubscribe-Post'] || headers['List-unsubscribe-post'] || '';
        const options = parseListUnsubscribeHeader(lu);
        if (!options.length) throw new Error('No unsubscribe options');

        const sender = extractSenderEmail(headers['From'] || '');
        const oneClick = /one-click/i.test(String(lup || ''));

        let performed = false;
        // Prefer One-Click HTTP if available
        if (!performed) {
          const httpOpt = options.find((o) => o.type === 'http');
          if (httpOpt) {
            try {
              if (oneClick) {
                // RFC8058 one-click: POST body 'List-Unsubscribe=One-Click'
                const r = await fetch(httpOpt.url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: 'List-Unsubscribe=One-Click',
                });
                performed = r.ok || (r.status >= 200 && r.status < 400);
              } else {
                const r = await fetch(httpOpt.url, { method: 'GET' });
                performed = r.ok || (r.status >= 200 && r.status < 400);
              }
            } catch {
              // fall back to mailto
            }
          }
        }

        // Fallback to mailto unsubscribe
        if (!performed) {
          const mailtoOpt = options.find((o) => o.type === 'mailto');
          if (mailtoOpt) {
            const to = mailtoOpt.address;
            const subject = mailtoOpt.subject || 'unsubscribe';
            const body = mailtoOpt.body || 'unsubscribe';
            const raw = [
              `To: ${to}`,
              `Subject: ${subject}`,
              'Content-Type: text/plain; charset="UTF-8"',
              '',
              body,
            ].join('\r\n');
            const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
            performed = true;
          }
        }

        if (performed) {
          success += 1;
          results.push({ id, sender, ok: true });
          try {
            await Unsubscribe.create({ userId: user.id, messageId: id, senderEmail: sender });
          } catch {}
        } else {
          failed.push(id);
          results.push({ id, sender, ok: false });
        }
      } catch (e) {
        failed.push(id);
      }
    }

    res.json({ success, failed, results });
  } catch (err) {
    console.error('Unsubscribe execute error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to execute unsubscribe' });
  }
});

// Quick view: detect OTP/verification code emails by simple keyword heuristics
router.get('/messages/otps', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const limitParam = String(req.query.limit || '300');
    const maxCount = Math.max(1, Math.min(800, parseInt(limitParam) || 300));

    // Fetch a window from INBOX
    let remaining = maxCount;
    let pageToken = undefined;
    const messagesBasic = [];
    do {
      const pageSize = Math.min(200, Number.isFinite(remaining) ? remaining : 200);
      const page = await gmail.users.messages.list({ userId: 'me', labelIds: ['INBOX'], maxResults: pageSize, pageToken });
      const batch = page.data.messages || [];
      messagesBasic.push(...batch);
      pageToken = page.data.nextPageToken;
      if (Number.isFinite(remaining)) remaining -= batch.length;
    } while (pageToken && (!Number.isFinite(remaining) || remaining > 0));

    // OTP keyword patterns
    const otpPattern = /\b(otp|one[-\s]?time(?:\s+(?:password|passcode|pin|code))?|verification(?:\s*code)?|passcode|login\s*code|security\s*code|2fa|two[-\s]?factor)\b/i;
    const codePattern = /\b\d{4,8}\b/; // common code lengths

    const details = await Promise.all(
      messagesBasic.map(async (m) => {
        const { data } = await gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });
        const headers = Object.fromEntries((data.payload?.headers || []).map((h) => [h.name, h.value]));
        const subject = headers['Subject'] || '';
        const hay = `${subject}\n${data.snippet || ''}`;
        const matched = otpPattern.test(hay) && codePattern.test(hay);
        return matched
          ? {
              id: m.id,
              threadId: data.threadId,
              subject,
              from: headers['From'] || '',
              date: headers['Date'] || '',
              snippet: data.snippet || '',
            }
          : null;
      })
    );

    const otps = details.filter(Boolean).slice(0, maxCount);
    res.json({ messages: otps });
  } catch (err) {
    console.error('OTPs quick-view error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to fetch OTP messages' });
  }
});

// Category APIs
router.get('/categories', async (req, res) => {
  try {
    const user = req.session && req.session.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const cats = await Category.find({ userId: user.id }).sort({ createdAt: 1 }).lean();
    res.json({ categories: cats });
  } catch (err) {
    console.error('List categories error:', err);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const user = req.session && req.session.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { name } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Missing name' });
    const created = await Category.create({ userId: user.id, name: String(name).trim() });
    res.json({ category: created });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const user = req.session && req.session.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { id } = req.params;
    await MailTag.deleteMany({ userId: user.id, categoryId: id });
    await Category.deleteOne({ _id: id, userId: user.id });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Tag mails into categories
router.get('/categories/:id/mails', async (req, res) => {
  try {
    const user = req.session && req.session.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { id } = req.params;
    const tags = await MailTag.find({ userId: user.id, categoryId: id }).lean();
    res.json({ messageIds: tags.map((t) => t.messageId) });
  } catch (err) {
    console.error('Get category mails error:', err);
    res.status(500).json({ error: 'Failed to list category mails' });
  }
});

router.post('/categories/:id/mails', async (req, res) => {
  try {
    const user = req.session && req.session.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { id } = req.params;
    const { messageId } = req.body || {};
    if (!messageId) return res.status(400).json({ error: 'Missing messageId' });
    const exists = await MailTag.findOne({ userId: user.id, categoryId: id, messageId }).lean();
    if (exists) return res.json({ ok: true });
    await MailTag.create({ userId: user.id, categoryId: id, messageId });
    res.json({ ok: true });
  } catch (err) {
    console.error('Add mail to category error:', err);
    res.status(500).json({ error: 'Failed to add mail to category' });
  }
});

router.delete('/categories/:id/mails/:messageId', async (req, res) => {
  try {
    const user = req.session && req.session.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { id, messageId } = req.params;
    await MailTag.deleteOne({ userId: user.id, categoryId: id, messageId });
    res.json({ ok: true });
  } catch (err) {
    console.error('Remove mail from category error:', err);
    res.status(500).json({ error: 'Failed to remove mail from category' });
  }
});

router.get('/messages/:id', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const { id } = req.params;
    const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const headers = parseHeaders(data.payload?.headers || []);
    const { bodyHtml, bodyText } = extractBody(data.payload);
  // Try to find a small inline image (e.g., sender avatar) if present
  let avatarDataUri = '';
  try {
    const parts = [];
    const stack = [data.payload];
    while (stack.length) {
      const part = stack.shift();
      if (!part) continue;
      if (part.parts && part.parts.length) stack.push(...part.parts);
      parts.push(part);
    }
    const imagePart = parts.find(
      (p) => p.mimeType && p.mimeType.startsWith('image/') && p.body && (p.body.attachmentId || p.body.data)
    );
    if (imagePart) {
      // If inline data exists, use it. Otherwise fetch via attachments.get
      if (imagePart.body.data) {
        avatarDataUri = `data:${imagePart.mimeType};base64,${imagePart.body.data.replace(/-/g, '+').replace(/_/g, '/')}`;
      } else if (imagePart.body.attachmentId) {
        const gmail = google.gmail({ version: 'v1', auth: createOAuthClientFromSession(tokens) });
        const att = await gmail.users.messages.attachments.get({ userId: 'me', messageId: data.id, id: imagePart.body.attachmentId });
        if (att.data && att.data.data) {
          avatarDataUri = `data:${imagePart.mimeType};base64,${att.data.data}`;
        }
      }
    }
  } catch (e) {
    // best effort; ignore errors
  }

    res.json({
      id: data.id,
      threadId: data.threadId,
      snippet: data.snippet,
      subject: headers['Subject'] || '',
      from: headers['From'] || '',
      to: headers['To'] || '',
      date: headers['Date'] || '',
      bodyHtml,
      bodyText,
      avatar: avatarDataUri,
      isStarred: Array.isArray(data.labelIds) ? data.labelIds.includes('STARRED') : undefined,
    });
  } catch (err) {
    console.error('Gmail message error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// Get full thread for a given message id
router.get('/messages/:id/thread', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const { id } = req.params;

    // First get message to find threadId
    const { data: msg } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const threadId = msg.threadId;
    if (!threadId) return res.json({ messages: [] });

    const { data: thread } = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
    const messages = (thread.messages || []).map((m) => {
      const headers = parseHeaders(m.payload?.headers || []);
      const { bodyHtml, bodyText } = extractBody(m.payload);
      return {
        id: m.id,
        from: headers['From'] || '',
        to: headers['To'] || '',
        date: headers['Date'] || '',
        bodyHtml,
        bodyText,
      };
    });

    // Sort by internalDate ascending (older first) if available
    messages.sort((a, b) => {
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      return da - db;
    });

    res.json({ threadId, messages });
  } catch (err) {
    console.error('Thread fetch error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

router.post('/messages/:id/summarize', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const { id } = req.params;
    const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });

    const headers = parseHeaders(data.payload?.headers || []);
    const { bodyHtml, bodyText } = extractBody(data.payload);
    const plain = bodyText || htmlToText(bodyHtml || '', { wordwrap: false });

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) return res.status(500).json({ error: 'Server missing GROQ_API_KEY' });

    const groq = new Groq({ apiKey: groqApiKey });
    const prompt = `You are an email assistant. Given an email's headers and body text, return a concise JSON with fields: summary (<=60 words), importance (one of: high, medium, low), reason (<=20 words). Focus on deadlines, money, access, requests, updates.

Headers:
Subject: ${headers['Subject'] || ''}
From: ${headers['From'] || ''}
To: ${headers['To'] || ''}
Date: ${headers['Date'] || ''}

Body:
${plain.slice(0, 8000)}

Return ONLY JSON.`;

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: 'Return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    const text = completion.choices?.[0]?.message?.content || '{}';
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = { summary: text.trim().slice(0, 200), importance: 'medium', reason: 'LLM non-JSON output' };
    }
    res.json({
      id,
      subject: headers['Subject'] || '',
      from: headers['From'] || '',
      ...parsed,
    });
  } catch (err) {
    console.error('Summarize error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to summarize message' });
  }
});

// Star/Unstar (Pin/Unpin)
router.post('/messages/:id/star', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const { id } = req.params;
    const { star = true } = req.body || {};
    await gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: star ? { addLabelIds: ['STARRED'] } : { removeLabelIds: ['STARRED'] },
    });
    res.json({ id, starred: !!star });
  } catch (err) {
    console.error('Star error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to update star' });
  }
});

// Delete message (move to Trash)
router.delete('/messages/:id', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const { id } = req.params;
    // Move to trash to be safe
    await gmail.users.messages.trash({ userId: 'me', id });
    res.json({ id, trashed: true });
  } catch (err) {
    console.error('Delete error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Mark read/unread
router.post('/messages/:id/read', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const { id } = req.params;
    const { read = true } = req.body || {};
    await gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: read ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] },
    });
    res.json({ id, read: !!read });
  } catch (err) {
    console.error('Read toggle error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to toggle read' });
  }
});

// Archive / Unarchive (remove/add INBOX)
router.post('/messages/:id/archive', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const { id } = req.params;
    const { archive = true } = req.body || {};
    await gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: archive ? { removeLabelIds: ['INBOX'] } : { addLabelIds: ['INBOX'] },
    });
    res.json({ id, archived: !!archive });
  } catch (err) {
    console.error('Archive error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to change archive' });
  }
});

// Mark spam / unspam
router.post('/messages/:id/spam', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const { id } = req.params;
    const { spam = true } = req.body || {};
    await gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: spam ? { addLabelIds: ['SPAM'] } : { removeLabelIds: ['SPAM'] },
    });
    res.json({ id, spam: !!spam });
  } catch (err) {
    console.error('Spam error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to toggle spam' });
  }
});

// Send reply
router.post('/messages/:id/reply', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const { id } = req.params;
    const { body = '', replyAll = false } = req.body || {};

    const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'To', 'Cc', 'Message-ID'] });
    const headers = parseHeaders(data.payload?.headers || []);
    const subject = headers['Subject'] || '';
    let to = headers['From'] || headers['To'] || '';
    if (replyAll) {
      const others = [headers['To'] || '', headers['Cc'] || ''].filter(Boolean).join(', ');
      to = others || to;
    }
    const inReplyTo = headers['Message-ID'] || '';

    const raw =
      `To: ${to}\r\n` +
      `Subject: Re: ${subject}\r\n` +
      (inReplyTo ? `In-Reply-To: ${inReplyTo}\r\nReferences: ${inReplyTo}\r\n` : '') +
      `Content-Type: text/plain; charset="UTF-8"\r\n` +
      `\r\n` +
      body;

    const encodedMessage = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage, threadId: data.threadId } });
    res.json({ id, sent: true });
  } catch (err) {
    console.error('Reply error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Suggest a reply with AI
router.post('/messages/:id/suggest-reply', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const { id } = req.params;

    const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const headers = parseHeaders(data.payload?.headers || []);
    const { bodyHtml, bodyText } = extractBody(data.payload);
    const plain = bodyText || htmlToText(bodyHtml || '', { wordwrap: false });

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) return res.status(500).json({ error: 'Server missing GROQ_API_KEY' });

    const groq = new Groq({ apiKey: groqApiKey });
    const prompt = `You are an assistant drafting professional email replies.
Return STRICT JSON with key: reply (string). Keep under 180 words. Be concise, polite, and actionable.

Original email headers:
Subject: ${headers['Subject'] || ''}
From: ${headers['From'] || ''}
To: ${headers['To'] || ''}
Date: ${headers['Date'] || ''}

Original email body (plain text):
${plain.slice(0, 8000)}

JSON only.`;

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: 'Return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });

    const text = completion.choices?.[0]?.message?.content || '{}';
    let reply = '';
    try {
      const j = JSON.parse(text);
      reply = String(j.reply || '').trim();
    } catch (e) {
      reply = text.trim().slice(0, 1500);
    }
    res.json({ id, reply });
  } catch (err) {
    console.error('Suggest-reply error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to suggest reply' });
  }
});

// Forward message
router.post('/messages/:id/forward', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const { id } = req.params;
    const { to = '', body = '' } = req.body || {};
    if (!to) return res.status(400).json({ error: 'Missing recipient' });

    const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const headers = parseHeaders(data.payload?.headers || []);
    const subject = headers['Subject'] || '';
    const plain = htmlToText(extractBody(data.payload).bodyHtml || extractBody(data.payload).bodyText || '', {
      wordwrap: false,
    });

    const raw =
      `To: ${to}\r\n` +
      `Subject: Fwd: ${subject}\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n` +
      `\r\n` +
      body +
      `\r\n\r\n---------- Forwarded message ---------\r\n` +
      plain;

    const encodedMessage = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
    res.json({ id, forwarded: true });
  } catch (err) {
    console.error('Forward error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to forward message' });
  }
});

// Compose and send new email
router.post('/messages/send', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const { to = '', cc = '', bcc = '', subject = '', body = '', attachments = [] } = req.body || {};
    if (!to) return res.status(400).json({ error: 'Missing recipient' });

    // Build MIME message (supports optional attachments)
    let raw = '';
    if (Array.isArray(attachments) && attachments.length > 0) {
      const boundary = 'invoxus-' + Math.random().toString(36).slice(2);
      const lines = [];
      lines.push(`To: ${to}`);
      if (cc) lines.push(`Cc: ${cc}`);
      if (bcc) lines.push(`Bcc: ${bcc}`);
      lines.push(`Subject: ${subject}`);
      lines.push('MIME-Version: 1.0');
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      lines.push('');
      // Text part
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(String(body || ''));
      // Attachments
      for (const att of attachments) {
        if (!att || !att.filename || !att.dataBase64) continue;
        const fname = String(att.filename);
        const ctype = String(att.contentType || 'application/octet-stream');
        const cleanBase64 = String(att.dataBase64).replace(/^data:[^;]+;base64,/, '');
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${ctype}; name="${fname}"`);
        lines.push('Content-Transfer-Encoding: base64');
        lines.push(`Content-Disposition: attachment; filename="${fname}"`);
        lines.push('');
        // Split long base64 into lines (RFC compliance)
        lines.push(cleanBase64.replace(/.{1,76}/g, '$&\r\n'));
      }
      lines.push(`--${boundary}--`);
      raw = lines.join('\r\n');
    } else {
      const headers = [
        `To: ${to}`,
        cc ? `Cc: ${cc}` : '',
        bcc ? `Bcc: ${bcc}` : '',
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
      ]
        .filter(Boolean)
        .join('\r\n');
      raw = `${headers}\r\n\r\n${body}`;
    }
    const encodedMessage = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
    res.json({ sent: true });
  } catch (err) {
    console.error('Send error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Top correspondents/contacts (from recent INBOX and SENT headers)
router.get('/contacts', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const oauth2Client = createOAuthClientFromSession(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const limitParam = String(req.query.limit || '400');
    const maxCount = Math.max(50, Math.min(1200, parseInt(limitParam) || 400));

    const labelSets = [['INBOX'], ['SENT']];
    const counts = new Map(); // key -> { name, email, count }
    for (const labelIds of labelSets) {
      let remaining = maxCount;
      let pageToken = undefined;
      do {
        const pageSize = Math.min(200, Number.isFinite(remaining) ? remaining : 200);
        const page = await gmail.users.messages.list({ userId: 'me', labelIds, maxResults: pageSize, pageToken });
        const items = page.data.messages || [];
        for (const m of items) {
          const { data } = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'To'] });
          const headers = parseHeaders(data.payload?.headers || []);
          const pair = [headers['From'] || '', headers['To'] || ''];
          for (const headerVal of pair) {
            const matches = String(headerVal)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            for (const v of matches) {
              const emailMatch = v.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
              const email = emailMatch ? emailMatch[0] : '';
              if (!email) continue;
              const nameMatch = v.match(/"?([^"<]+)"?\s*<.+?>/);
              const name = (nameMatch ? nameMatch[1] : v.split('<')[0]).trim();
              const key = `${name}|${email}`.toLowerCase();
              const prev = counts.get(key) || { name, email, count: 0 };
              prev.count += 1;
              counts.set(key, prev);
            }
          }
        }
        if (Number.isFinite(remaining)) remaining -= items.length;
        pageToken = page.data.nextPageToken;
      } while (pageToken && (!Number.isFinite(remaining) || remaining > 0));
    }

    const contacts = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 500);

    res.json({ contacts });
  } catch (err) {
    console.error('Contacts error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

module.exports = router;
 


