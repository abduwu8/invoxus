const express = require('express');
const Groq = require('groq-sdk');
const OutlookService = require('../services/outlookService');
const { getValidMicrosoftToken } = require('./microsoft-auth');
const Unsubscribe = require('../models/Unsubscribe');
const mongoose = require('mongoose');

const router = express.Router();

// Category and MailTag models (shared with Gmail)
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

/**
 * Helper to create Outlook service instance from session
 */
async function getOutlookService(req) {
  const userId = req.session?.userProfile?.id;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const accessToken = await getValidMicrosoftToken(userId);
  return new OutlookService(accessToken);
}

/**
 * GET /api/outlook/messages
 * Fetch emails from Outlook inbox
 */
router.get('/messages', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { maxResults = 50, pageToken, folder = 'inbox', search } = req.query;

    const result = await outlookService.fetchEmails({
      maxResults: parseInt(maxResults),
      pageToken,
      folder,
      search,
    });

    res.json({
      messages: result.emails,
      nextPageToken: result.nextPageToken,
      totalResults: result.totalResults,
    });
  } catch (error) {
    console.error('Error fetching Outlook messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/outlook/messages/send
 * Send a new email via Outlook
 */
router.post('/messages/send', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { to, subject, body, cc, bcc } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }

    await outlookService.sendEmail({ to, subject, body, cc, bcc });
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending Outlook email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * POST /api/outlook/messages/bulk-delete
 * Delete multiple emails
 */
router.post('/messages/bulk-delete', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { ids = [] } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Missing ids' });
    }

    const deleted = [];
    const failed = [];
    
    // Delete all messages with error tracking
    const concurrency = 5;
    let index = 0;
    await Promise.all(
      Array.from({ length: Math.min(concurrency, ids.length) }).map(async () => {
        while (index < ids.length) {
          const i = index++;
          const id = ids[i];
          try {
            await outlookService.deleteEmail(id);
            deleted.push(id);
          } catch (e) {
            console.error(`Failed to delete message ${id}:`, e);
            failed.push(id);
          }
        }
      })
    );

    res.json({ deleted, failed });
  } catch (error) {
    console.error('Error bulk deleting Outlook messages:', error);
    res.status(500).json({ error: 'Failed to delete messages' });
  }
});

/**
 * GET /api/outlook/messages/suggest-deletions
 * Suggest emails to delete based on heuristics
 */
router.get('/messages/suggest-deletions', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { limit = 200, strict = '1', ai = '1' } = req.query;
    const strictMode = ['1', 'true', 'yes'].includes(String(strict).toLowerCase());
    const useAI = ['1', 'true', 'yes'].includes(String(ai).toLowerCase());
    
    // Fetch recent emails
    const result = await outlookService.fetchEmails({
      maxResults: parseInt(limit),
      folder: 'inbox',
    });

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

    // Apply heuristics
    let suggestions = result.emails
      .map((email) => {
        const hay = `${email.subject}\n${email.from}\n${email.snippet}`;
        const includeHit = includePatterns.find((p) => p.test(hay));
        const looksReply = /^\s*(re:|fwd:)/i.test(email.subject || '');
        const protectedHit = protectPatterns.find((p) => p.test(hay));
        
        let score = 0;
        if (includeHit) score += 2;
        if (protectedHit) score -= 3;
        if (looksReply) score -= 1;
        
        let reason = '';
        if (includeHit) reason = `Matched pattern: ${includeHit}`;
        if (protectedHit && strictMode) reason = reason ? `${reason}; Protected: ${protectedHit}` : `Protected: ${protectedHit}`;
        
        return { ...email, reason, score };
      })
      .filter((email) => email.score >= (strictMode ? 2 : 1))
      .slice(0, 300);

    // Optional AI refinement
    const groqApiKey = process.env.GROQ_API_KEY;
    if (groqApiKey && useAI && suggestions.length) {
      try {
        const Groq = require('groq-sdk');
        const groq = new Groq({ apiKey: groqApiKey });
        const toClassify = suggestions.slice(0, 80);
        const concurrency = 6;
        let idx = 0;
        const refined = [];

        await Promise.all(
          Array.from({ length: Math.min(concurrency, toClassify.length) }).map(async () => {
            while (idx < toClassify.length) {
              const i = idx++;
              const email = toClassify[i];
              try {
                const prompt = `You are an email triage assistant. Decide if this message is low-value (promotions, newsletters, social digests, generic notifications, marketing blasts) and safe to move to Trash.

STRICTLY DO NOT delete anything related to: payments, invoices, receipts, bills, statements, banking, payroll, refunds, taxes, OTP/verification/security codes, orders, shipping/tracking, bookings/tickets/itineraries/reservations, confirmations, deadlines, account access, support tickets.

Return STRICT JSON: { "delete": boolean, "reason": string }

Subject: ${email.subject}\nFrom: ${email.from}\nSnippet: ${email.snippet}`;
                
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
                  refined.push({
                    id: email.id,
                    threadId: email.threadId,
                    subject: email.subject,
                    from: email.from,
                    date: email.date,
                    snippet: email.snippet,
                    reason: decision.reason || email.reason,
                  });
                }
              } catch {
                // Fallback to baseline on error
                refined.push({
                  id: email.id,
                  threadId: email.threadId,
                  subject: email.subject,
                  from: email.from,
                  date: email.date,
                  snippet: email.snippet,
                  reason: email.reason,
                });
              }
            }
          })
        );

        if (refined.length) {
          return res.json({ messages: refined.slice(0, 200) });
        }
      } catch (e) {
        console.error('AI refinement error:', e);
        // Fall back to heuristics
      }
    }

    const finalSuggestions = suggestions.map(({ score, ...rest }) => rest).slice(0, 200);
    res.json({ messages: finalSuggestions });
  } catch (error) {
    console.error('Error suggesting deletions:', error);
    res.status(500).json({ error: 'Failed to suggest deletions' });
  }
});

/**
 * GET /api/outlook/messages/otps
 * Detect OTP/verification code emails
 */
router.get('/messages/otps', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { limit = 300 } = req.query;
    
    // Fetch recent emails
    const result = await outlookService.fetchEmails({
      maxResults: parseInt(limit),
      folder: 'inbox',
    });

    // OTP patterns
    const otpPattern = /\b(otp|one[-\s]?time(?:\s+(?:password|passcode|pin|code))?|verification(?:\s*code)?|passcode|login\s*code|security\s*code|2fa|two[-\s]?factor)\b/i;
    const codePattern = /\b\d{4,8}\b/;

    const otps = result.emails
      .filter((email) => {
        const hay = `${email.subject}\n${email.snippet}`;
        return otpPattern.test(hay) && codePattern.test(hay);
      })
      .slice(0, parseInt(limit));

    res.json({ messages: otps });
  } catch (error) {
    console.error('Error fetching OTPs:', error);
    res.status(500).json({ error: 'Failed to fetch OTP messages' });
  }
});

/**
 * GET /api/outlook/messages/:id
 * Get a specific email by ID
 */
router.get('/messages/:id', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const email = await outlookService.getEmail(req.params.id);
    res.json(email);
  } catch (error) {
    console.error('Error fetching Outlook message:', error);
    res.status(404).json({ error: 'Message not found' });
  }
});

/**
 * POST /api/outlook/messages/:id/reply
 * Reply to an email
 */
router.post('/messages/:id/reply', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { body } = req.body;

    if (!body) {
      return res.status(400).json({ error: 'Missing reply body' });
    }

    // Get original message to extract recipient info
    const originalMessage = await outlookService.getEmail(req.params.id);

    await outlookService.sendEmail({
      to: originalMessage.from,
      subject: `Re: ${originalMessage.subject}`,
      body,
      replyToMessageId: req.params.id,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error replying to Outlook message:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

/**
 * POST /api/outlook/messages/:id/suggest-reply
 * AI-powered reply suggestions (matches Gmail format)
 */
router.post('/messages/:id/suggest-reply', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const message = await outlookService.getEmail(req.params.id);

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) return res.status(500).json({ error: 'Server missing GROQ_API_KEY' });

    const groq = new Groq({ apiKey: groqApiKey });
    const emailText = message.bodyText || message.snippet;
    
    const prompt = `You are an intelligent email reply assistant. Generate a professional, contextual reply.

ORIGINAL EMAIL:
Subject: ${message.subject || ''}
From: ${message.fromName} <${message.from}>
To: ${message.to || ''}
Date: ${message.date || ''}
Body: ${emailText.slice(0, 8000)}

REPLY REQUIREMENTS:
1. CONTEXT UNDERSTANDING:
   - Understand the sender's intent and tone
   - Identify questions that need answers
   - Note any requests or action items
   - Recognize urgency level

2. REPLY STRUCTURE:
   - Professional greeting appropriate to relationship
   - Directly address all points raised
   - Provide clear, specific answers
   - Offer next steps if relevant
   - Professional closing

3. TONE & STYLE:
   - Match the formality level of original email
   - Be warm yet professional
   - Show understanding and empathy
   - Be concise but thorough (150-200 words)
   - Use active voice

4. SMART FEATURES:
   - Reference specific points from their email
   - Provide helpful suggestions
   - Set clear expectations
   - Include timeline if relevant

Return JSON: { 
  "reply": "Complete email reply with greeting, body, and closing",
  "tone": "formal" | "professional" | "casual",
  "suggestedSubject": "Re: appropriate subject"
}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(responseText);
      if (parsed.reply) {
        return res.json(parsed);
      }
    } catch (parseError) {
      // If not valid JSON, return the text as-is
      console.log('[DEBUG] AI response is not JSON, returning as plain text');
      return res.json({ reply: responseText });
    }

    // Fallback
    res.json({ reply: responseText });
  } catch (error) {
    console.error('Error generating Outlook reply suggestions:', error);
    res.status(500).json({ 
      error: 'Failed to generate suggestions',
      reply: 'Thank you for your email. I will review this and get back to you soon.'
    });
  }
});

/**
 * POST /api/outlook/messages/:id/forward
 * Forward an email
 */
router.post('/messages/:id/forward', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { to, body: additionalMessage } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Missing recipient email' });
    }

    const originalMessage = await outlookService.getEmail(req.params.id);

    const forwardBody = `
${additionalMessage || ''}

---------- Forwarded message ----------
From: ${originalMessage.fromName} <${originalMessage.from}>
Date: ${new Date(originalMessage.date).toLocaleString()}
Subject: ${originalMessage.subject}

${originalMessage.body}
    `;

    await outlookService.sendEmail({
      to,
      subject: `Fwd: ${originalMessage.subject}`,
      body: forwardBody,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error forwarding Outlook message:', error);
    res.status(500).json({ error: 'Failed to forward email' });
  }
});

/**
 * POST /api/outlook/messages/:id/read
 * Mark email as read/unread
 */
router.post('/messages/:id/read', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { isRead = true } = req.body;

    await outlookService.markAsRead(req.params.id, isRead);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking Outlook message:', error);
    res.status(500).json({ error: 'Failed to update read status' });
  }
});

/**
 * DELETE /api/outlook/messages/:id
 * Delete an email
 */
router.delete('/messages/:id', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    await outlookService.deleteEmail(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting Outlook message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

/**
 * GET /api/outlook/folders
 * Get all mail folders
 */
router.get('/folders', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const folders = await outlookService.getFolders();
    res.json({ folders });
  } catch (error) {
    console.error('Error fetching Outlook folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

/**
 * POST /api/outlook/messages/:id/summarize
 * AI-powered email summarization
 */
router.post('/messages/:id/summarize', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const message = await outlookService.getEmail(req.params.id);

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const emailText = message.bodyText || message.snippet;
    const prompt = `Summarize this email concisely (2-3 sentences):

From: ${message.fromName} <${message.from}>
Subject: ${message.subject}
Message: ${emailText.substring(0, 2000)}

Summary:`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 200,
    });

    const summary = completion.choices[0].message.content.trim();
    res.json({ summary });
  } catch (error) {
    console.error('Error summarizing Outlook message:', error);
    res.status(500).json({ error: 'Failed to summarize message' });
  }
});

/**
 * GET /api/outlook/search
 * Search emails
 */
router.get('/search', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { q, maxResults = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    const result = await outlookService.searchEmails(q, parseInt(maxResults));
    res.json({
      messages: result.emails,
      nextPageToken: result.nextPageToken,
    });
  } catch (error) {
    console.error('Error searching Outlook messages:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

/**
 * POST /api/outlook/messages/:id/star
 * Star/flag an email
 */
router.post('/messages/:id/star', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { star = true } = req.body;
    
    await outlookService.starEmail(req.params.id, star);
    res.json({ id: req.params.id, starred: star });
  } catch (error) {
    console.error('Error starring Outlook message:', error);
    res.status(500).json({ error: 'Failed to star message' });
  }
});

/**
 * POST /api/outlook/messages/:id/archive
 * Archive/unarchive an email
 */
router.post('/messages/:id/archive', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { archive = true } = req.body;
    
    await outlookService.archiveEmail(req.params.id, archive);
    res.json({ id: req.params.id, archived: archive });
  } catch (error) {
    console.error('Error archiving Outlook message:', error);
    res.status(500).json({ error: 'Failed to archive message' });
  }
});

/**
 * POST /api/outlook/messages/:id/spam
 * Mark email as spam/not spam
 */
router.post('/messages/:id/spam', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { spam = true } = req.body;
    
    await outlookService.markAsSpam(req.params.id, spam);
    res.json({ id: req.params.id, spam });
  } catch (error) {
    console.error('Error marking Outlook message as spam:', error);
    res.status(500).json({ error: 'Failed to mark as spam' });
  }
});

/**
 * GET /api/outlook/messages/:id/thread
 * Get email thread/conversation
 */
router.get('/messages/:id/thread', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const thread = await outlookService.getThread(req.params.id);
    res.json(thread);
  } catch (error) {
    console.error('Error getting Outlook thread:', error);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

/**
 * GET /api/outlook/contacts
 * Get contacts list
 */
router.get('/contacts', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const { limit = 100 } = req.query;
    const contacts = await outlookService.getContacts(parseInt(limit));
    res.json(contacts);
  } catch (error) {
    console.error('Error getting Outlook contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

/**
 * GET /api/outlook/unsubscribe/suggestions
 * Find emails with unsubscribe links
 */
router.get('/unsubscribe/suggestions', async (req, res) => {
  try {
    const outlookService = await getOutlookService(req);
    const user = req.session?.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const { limit = 200 } = req.query;
    
    // Fetch recent emails
    const result = await outlookService.fetchEmails({
      maxResults: parseInt(limit),
      folder: 'inbox',
    });

    // Get already unsubscribed senders
    const prior = await Unsubscribe.find({ userId: user.id }).select('messageId senderEmail').lean();
    const suppressedMessageIds = new Set(prior.map((r) => r.messageId));
    const suppressedSenders = new Set(prior.map((r) => (r.senderEmail || '').toLowerCase()).filter(Boolean));

    // Filter emails with unsubscribe patterns
    const suggestions = [];
    const seen = new Set();
    
    for (const email of result.emails) {
      if (suppressedMessageIds.has(email.id)) continue;
      if (email.from && suppressedSenders.has(email.from.toLowerCase())) continue;
      
      // Check body for unsubscribe links
      const bodyText = email.bodyText || email.snippet || '';
      const hasUnsubscribeLink = /unsubscribe|opt[-\s]out/i.test(bodyText);
      
      if (hasUnsubscribeLink) {
        const key = `${email.from}`;
        if (seen.has(key)) continue;
        seen.add(key);
        
        suggestions.push({
          id: email.id,
          threadId: email.threadId,
          subject: email.subject,
          from: email.from,
          date: email.date,
          senderEmail: email.from,
          hasOneClick: false, // Outlook API doesn't expose this easily
          methods: [{ type: 'manual', note: 'Check email body for unsubscribe link' }],
        });
        
        if (suggestions.length >= parseInt(limit)) break;
      }
    }

    res.json({ suggestions });
  } catch (error) {
    console.error('Error fetching unsubscribe suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch unsubscribe suggestions' });
  }
});

/**
 * POST /api/outlook/unsubscribe/execute
 * Execute unsubscribe (mark for tracking purposes)
 */
router.post('/unsubscribe/execute', async (req, res) => {
  try {
    const user = req.session?.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    
    const { ids = [], confirm } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Missing ids' });
    }
    if (!confirm) {
      return res.status(400).json({ error: 'Confirmation required' });
    }

    const outlookService = await getOutlookService(req);
    const results = [];
    let success = 0;
    const failed = [];

    for (const id of ids) {
      try {
        const email = await outlookService.getEmail(id);
        const sender = email.from;
        
        // Record unsubscribe in database for tracking
        await Unsubscribe.create({
          userId: user.id,
          messageId: id,
          senderEmail: sender,
        });
        
        success += 1;
        results.push({ id, sender, ok: true });
      } catch (error) {
        console.error(`Failed to process unsubscribe for ${id}:`, error);
        failed.push(id);
        results.push({ id, ok: false });
      }
    }

    res.json({ success, failed, results });
  } catch (error) {
    console.error('Error executing unsubscribe:', error);
    res.status(500).json({ error: 'Failed to execute unsubscribe' });
  }
});

/**
 * GET /api/outlook/categories
 * Get all categories for the user
 */
router.get('/categories', async (req, res) => {
  try {
    const user = req.session?.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    
    const cats = await Category.find({ userId: user.id }).sort({ createdAt: 1 }).lean();
    res.json({ categories: cats });
  } catch (error) {
    console.error('Error listing categories:', error);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

/**
 * POST /api/outlook/categories
 * Create a new category
 */
router.post('/categories', async (req, res) => {
  try {
    const user = req.session?.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Missing name' });
    }
    
    const created = await Category.create({
      userId: user.id,
      name: String(name).trim(),
    });
    
    res.json({ category: created });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

/**
 * DELETE /api/outlook/categories/:id
 * Delete a category and all its tags
 */
router.delete('/categories/:id', async (req, res) => {
  try {
    const user = req.session?.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    
    const { id } = req.params;
    await MailTag.deleteMany({ userId: user.id, categoryId: id });
    await Category.deleteOne({ _id: id, userId: user.id });
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

/**
 * GET /api/outlook/categories/:id/mails
 * Get all emails tagged with a category
 */
router.get('/categories/:id/mails', async (req, res) => {
  try {
    const user = req.session?.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    
    const { id } = req.params;
    const tags = await MailTag.find({ userId: user.id, categoryId: id }).lean();
    
    res.json({ messageIds: tags.map((t) => t.messageId) });
  } catch (error) {
    console.error('Error getting category mails:', error);
    res.status(500).json({ error: 'Failed to list category mails' });
  }
});

/**
 * POST /api/outlook/categories/:id/mails
 * Add an email to a category
 */
router.post('/categories/:id/mails', async (req, res) => {
  try {
    const user = req.session?.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    
    const { id } = req.params;
    const { messageId } = req.body;
    
    if (!messageId) {
      return res.status(400).json({ error: 'Missing messageId' });
    }
    
    const exists = await MailTag.findOne({ userId: user.id, categoryId: id, messageId }).lean();
    if (exists) return res.json({ ok: true });
    
    await MailTag.create({ userId: user.id, categoryId: id, messageId });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error adding mail to category:', error);
    res.status(500).json({ error: 'Failed to add mail to category' });
  }
});

/**
 * DELETE /api/outlook/categories/:id/mails/:messageId
 * Remove an email from a category
 */
router.delete('/categories/:id/mails/:messageId', async (req, res) => {
  try {
    const user = req.session?.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    
    const { id, messageId } = req.params;
    await MailTag.deleteOne({ userId: user.id, categoryId: id, messageId });
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error removing mail from category:', error);
    res.status(500).json({ error: 'Failed to remove mail from category' });
  }
});

module.exports = router;

