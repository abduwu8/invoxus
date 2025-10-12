const express = require('express');
const Groq = require('groq-sdk');
const { htmlToText } = require('html-to-text');
const ChatMemory = require('../models/ChatMemory');
const ChatHistory = require('../models/ChatHistory');
const { getCached, setCached } = require('../config/redis');
const { 
  analyzeBusinessContext, 
  extractActionItems, 
  extractBusinessEntities, 
  generateBusinessPrompt,
  analyzeEmailBatch 
} = require('../services/businessContextProcessor');
const { generateFromTemplate, detectBestTemplate } = require('../services/businessTemplates');
const EmailProvider = require('../services/emailProvider');

const router = express.Router();

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

// POST /api/chat/ask  { question: string, sessionId?: string, limit?: number }
router.post('/ask', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session) return res.status(401).json({ error: 'Not authenticated' });
    const user = req.session.userProfile;
    const provider = user?.provider || 'google';
    
    // Gmail requires tokens, Outlook requires user profile
    if (provider === 'google' && !req.session.tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (provider === 'microsoft' && !user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { question = '', sessionId = null, limit = 50 } = req.body || {};
    if (!question.trim()) return res.status(400).json({ error: 'Missing question' });
    
    // Validate and sanitize limit
    const emailLimit = Math.min(Math.max(parseInt(limit) || 50, 10), 100);

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) return res.status(500).json({ error: 'Server missing GROQ_API_KEY' });

    // Use the unified EmailProvider
    const emailProvider = new EmailProvider(req.session);

    // Detect if this is a compose/send request early to limit context
    const isComposeRequest = /\b(send|compose|draft|write|email)\s+(?:a|an)?\s*(?:email|mail|message)?\s*(?:to|for)\b/i.test(question);

    // Load or create conversation history
    let conversation = null;
    let conversationContext = '';
    try {
      if (user && !isComposeRequest) {
        // Only include conversation history for non-compose requests
        conversation = await ChatHistory.getOrCreateConversation(user.id, sessionId);
        const recentMessages = conversation.getRecentContext(4); // Last 2 exchanges
        if (recentMessages.length > 0) {
          conversationContext = '\n\nRECENT CONTEXT (last 2 exchanges):\n' + 
            recentMessages.map(m => `${m.role.toUpperCase()}: ${m.content.slice(0, 200)}`).join('\n');
        }
      } else if (user) {
        conversation = await ChatHistory.getOrCreateConversation(user.id, sessionId);
      }
    } catch (err) {
      console.error('Conversation history error:', err);
      // Continue without history
    }

    // Ask LLM for up to 3 Gmail search queries
    const groq = new Groq({ apiKey: groqApiKey });
    const dateRange = parseDateRangeFromQuestion(question);
    const dateQ = dateRange ? ` after:${fmtYmd(dateRange.after)} before:${fmtYmd(dateRange.before)}` : '';

    const qPrompt = `You are an EXPERT EMAIL SEARCH ASSISTANT. Generate PRECISE Gmail queries to find exactly what the user needs.

User question: "${question}"

SMART CONTEXT UNDERSTANDING:
- Detect intent: find, summarize, compose, reply, analyze
- Recognize key terms: important, urgent, meetings, attachments
- Identify people, companies, dates, topics
- Understand time references: today, this week, last month

GMAIL SEARCH OPERATORS:
PARTICIPANTS: from:, to:, cc:, bcc:
CONTENT: subject:, has:attachment, filename:, has:drive, has:document
TIME: after:YYYY/MM/DD, before:YYYY/MM/DD, newer_than:7d, older_than:1m
STATUS: is:important, is:starred, is:unread, is:read, is:snoozed
LOCATION: in:inbox, in:sent, in:drafts, in:trash, in:anywhere
SPECIAL: larger:10M, has:yellow-star

SMART QUERY STRATEGY:
1. START SPECIFIC: Most precise interpretation first
   - "emails from John" → from:(john)
   - "important unread" → is:important is:unread
   - "with attachments" → has:attachment
   
2. USE VARIATIONS: Include synonyms and alternatives
   - Meeting = (meeting OR call OR zoom OR teams OR sync)
   - Important = (is:important OR subject:urgent OR subject:important)
   
3. COMBINE INTELLIGENTLY: Use compound queries
   - "urgent from Sarah" → from:(sarah) AND (is:important OR subject:urgent)
   
4. BROADEN AS NEEDED: Fallback queries if specific ones may be too narrow
   - Start specific, then add broader alternatives
   
5. TIME-AWARE: Handle date references properly
   - "today" → after:YYYY/MM/DD
   - "this week" → newer_than:7d

Return JSON: { 
  "queries": string[], 
  "intent": "search"|"summarize"|"compose"|"reply"|"analyze",
  "context": {
    "category": "important"|"meeting"|"financial"|"personal"|"work"|"general",
    "priority": "high"|"medium"|"low"
  },
  "entities": { 
    "people": string[], 
    "dates": string[], 
    "topics": string[] 
  } 
}`;

    const queriesText = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are an EXPERT EMAIL SEARCH ENGINE. You understand how people communicate via email and can generate PRECISE Gmail queries that find EXACTLY what users need. Return ONLY valid JSON.' },
        { role: 'user', content: qPrompt },
      ],
      temperature: 0.3, // Lower for more precise queries
      max_tokens: 500,
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

    // Try to extract a target name from the question (e.g., "send email to Irfan Khan")
    function extractTargetNameTokens(text = '') {
      const t = String(text).toLowerCase();
      // Common patterns around "send ... to <name> ..."
      const m = t.match(/(?:send|email|mail|compose|write)\b[\s\S]{0,40}?\bto\b\s+([^,\n]+?)(?:\s+(?:saying|that|about|regarding|with)\b|$)/i);
      const raw = m ? m[1] : '';
      const cleaned = raw
        .replace(/[^a-z\s@._-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const stop = new Set(['an', 'a', 'the', 'mr', 'mrs', 'ms', 'dr', 'me', 'him', 'her', 'them']);
      return cleaned
        .split(' ')
        .map((s) => s.trim())
        .filter((s) => s && !stop.has(s));
    }
    const targetNameTokens = extractTargetNameTokens(question);
    
    // Extract explicit email address from question if present
    function extractEmailFromQuestion(text = '') {
      const emailMatch = String(text).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      return emailMatch ? emailMatch[0] : null;
    }
    const explicitEmail = extractEmailFromQuestion(question);
    
    // Do NOT bias mailbox search toward the recipient mentioned after "send to ...".
    // The recipient is used later only to infer toEmail for the outgoing message.

    // OPTIMIZATION: Check cache first (5 min TTL)
    const cacheKey = `emails:${user?.id || 'guest'}:${JSON.stringify(queries.slice(0, 3))}:${provider}`;
    const cachedResults = await getCached(cacheKey);
    
    let results = [];
    let participantsSet = new Set();
    
    if (cachedResults) {
      console.log('✅ Cache hit for email query');
      results = cachedResults.results || [];
      participantsSet = new Set(cachedResults.participants || []);
    } else {
      console.log(`⏳ Cache miss - fetching from ${provider === 'microsoft' ? 'Outlook' : 'Gmail'} API`);
      
      try {
        // Use the unified EmailProvider to fetch emails with search
        // Note: For best results with Outlook, we'll fetch from both inbox and sent folders
        const folders = ['inbox', 'sent'];
        const emailsByFolder = await Promise.all(
          folders.map(async (folder) => {
            try {
              // For each query, fetch emails
              const emailPromises = queries.slice(0, 3).map(async (searchQuery) => {
                try {
                  return await emailProvider.fetchEmails({
                    maxResults: Math.ceil(emailLimit / 6), // Distribute limit across queries and folders
                    folder,
                    search: searchQuery
                  });
                } catch (error) {
                  console.error(`Error fetching emails for query "${searchQuery}":`, error.message);
                  return [];
                }
              });
              
              const resultsArrays = await Promise.all(emailPromises);
              return resultsArrays.flat();
            } catch (error) {
              console.error(`Error fetching from folder "${folder}":`, error.message);
              return [];
            }
          })
        );
        
        // Flatten and deduplicate by email ID
        const allEmails = emailsByFolder.flat();
        const uniqueEmails = new Map();
        
        for (const email of allEmails) {
          if (!uniqueEmails.has(email.id)) {
            uniqueEmails.set(email.id, email);
            // Collect participants
            if (email.from) participantsSet.add(email.from);
            if (email.to) participantsSet.add(email.to);
          }
        }
        
        results = Array.from(uniqueEmails.values()).slice(0, emailLimit);
        
      } catch (error) {
        console.error('Error fetching emails:', error);
        // Return empty results on error
        results = [];
      }
      
      // OPTIMIZATION: Cache results for 5 minutes (300 seconds)
      await setCached(cacheKey, {
        results: results,
        participants: Array.from(participantsSet)
      }, 300);
    }

    // Fallback enrichment: if few results, fetch more recent emails
    async function enrichWithRecentIfNeeded() {
      try {
        if (results.length >= 8) return;
        
        // Fetch recent emails from both folders
        const recentInbox = await emailProvider.fetchEmails({ maxResults: 30, folder: 'inbox' });
        const recentSent = await emailProvider.fetchEmails({ maxResults: 20, folder: 'sent' });
        const allRecent = [...recentInbox, ...recentSent];
        
        // If we have target name tokens, score and filter
        if (targetNameTokens.length > 0) {
          for (const email of allRecent) {
            const fromScore = scoreParticipant(email.from, targetNameTokens);
            const toScore = scoreParticipant(email.to, targetNameTokens);
            const maxScore = Math.max(fromScore, toScore);
            
            if (maxScore >= 3) {
              // Check if not already in results
              const exists = results.some(r => r.id === email.id);
              if (!exists) {
                results.push(email);
                if (email.from) participantsSet.add(email.from);
                if (email.to) participantsSet.add(email.to);
              }
            }
            
            if (results.length >= 20) break;
          }
        } else {
          // No specific target, just add recent unique emails
          for (const email of allRecent) {
            const exists = results.some(r => r.id === email.id);
            if (!exists) {
              results.push(email);
              if (email.from) participantsSet.add(email.from);
              if (email.to) participantsSet.add(email.to);
            }
            if (results.length >= 20) break;
          }
        }
      } catch (error) {
        console.error('Enrichment error:', error);
        // best effort
      }
    }

    // If nothing found with date window, try broader search
    if (!results.length && dateRange) {
      try {
        const recentEmails = await emailProvider.fetchEmails({ maxResults: 20, folder: 'inbox' });
        results = recentEmails.slice(0, 20);
        for (const email of results) {
          if (email.from) participantsSet.add(email.from);
          if (email.to) participantsSet.add(email.to);
        }
      } catch (error) {
        console.error('Fallback search error:', error);
      }
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
    
    // Use previously defined isComposeRequest
    const contextLimit = isComposeRequest ? 3 : 12; // Less context for compose requests
    
    // BUSINESS INTELLIGENCE: Analyze emails with business context
    const businessAnalyzedEmails = results.slice(0, contextLimit).map((r) => {
      const body = r.bodyText || htmlToText(r.bodyHtml || '', { wordwrap: false });
      const preview = (body || r.snippet || '').slice(0, 600);
      
      // Analyze business context
      const businessContext = analyzeBusinessContext({
        subject: r.subject,
        bodyText: body,
        snippet: r.snippet,
        from: r.from,
        to: r.to
      });
      
      // Extract action items if email contains actions
      const actions = businessContext.requiresAction ? extractActionItems(body.slice(0, 2000)) : [];
      
      // Extract business entities
      const entities = extractBusinessEntities((r.subject + ' ' + body).slice(0, 2000));
      
      return {
        id: r.id,
        subject: r.subject,
        from: r.from,
        to: r.to,
        date: r.date,
        preview,
        // Business metadata
        priority: businessContext.priority,
        categories: businessContext.categories,
        requiresAction: businessContext.requiresAction,
        requiresResponse: businessContext.requiresResponse,
        sentiment: businessContext.sentiment,
        amounts: businessContext.amounts,
        dates: businessContext.dates,
        actionItems: actions.map(a => a.text),
        entities: {
          companies: entities.companies,
          people: entities.people,
          documents: entities.documents
        }
      };
    });
    
    // Generate aggregate business insights
    const batchInsights = analyzeEmailBatch(results.slice(0, 20));
    
    let compact = businessAnalyzedEmails;
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
        
        // OPTIMIZATION: Reduced from 10 to 5 maxResults for summary
        const list = await gmail.users.messages.list({ userId: 'me', labelIds: ['INBOX'], q: focusQ, maxResults: 5 });
        const items = list.data.messages || [];
        
        // OPTIMIZATION: Already using Promise.all, but keeping it optimized
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
          const sPrompt = `You are an EXPERT EMAIL SUMMARIZER. Create clear, helpful summaries that capture what matters.

EMAIL TO SUMMARIZE:
Subject: ${top.subject}
Body: ${bodyPlain}

SUMMARY REQUIREMENTS:

1. 📊 KEY INFORMATION (Priority):
   - Important numbers: amounts, percentages, quantities
   - Dates and deadlines: specific dates and times
   - Action items: what needs to be done and when
   - Decisions needed: what requires a response
   - Key people: names and their role in the conversation

2. 📝 CLEAR STRUCTURE:
   - ONE-LINE SUMMARY (20-30 words) - what is this email about?
   - KEY POINTS (3-5 bullets):
     • Most important information first
     • Include specific details (numbers, dates)
     • Highlight any actions needed
     • Note important context
   - NEXT STEPS (if any actions needed)

3. 🎯 HELPFUL ANALYSIS:
   - Category: important, meeting, financial, personal, work, etc.
   - Priority level: high, medium, low
   - Sentiment: positive, negative, neutral, urgent
   - Importance: high, medium, low

4. ⚡ CLEAR COMMUNICATION:
   - Direct and easy to understand
   - Include exact details when available
   - Action-focused when relevant
   - Friendly and helpful tone
   - Skip unnecessary fluff

Return JSON: { 
  "summary": "Clear summary with structure:\n\nOVERVIEW:\n[One sentence explaining what this email is about]\n\nKEY POINTS:\n• Point 1\n• Point 2\n• Point 3\n\nACTION NEEDED:\n[If applicable, what you should do]",
  "category": "important|meeting|financial|personal|work|general",
  "priority": "high" | "medium" | "low",
  "urgency": "high" | "medium" | "low",
  "actionRequired": true | false,
  "deadline": "specific date/time or null",
  "keyDetails": ["Detail 1", "Detail 2"],
  "sentiment": "positive" | "negative" | "neutral" | "urgent",
  "importance": "high" | "medium" | "low",
  "nextSteps": ["Action 1", "Action 2"]
}`;
          const sOut = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are an EXPERT EMAIL SUMMARIZER. You distill emails into CLEAR, HELPFUL summaries. Your summaries are PRECISE, EASY TO UNDERSTAND, and CAPTURE WHAT MATTERS. You NEVER miss important details, dates, or action items. Return ONLY valid JSON.' },
              { role: 'user', content: sPrompt },
            ],
            temperature: 0.4, // Lower for accuracy
            max_tokens: 700, // More space for detailed summaries
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
      if (user && !isComposeRequest) {
        // Only include memory for non-compose requests to reduce pollution
        const notes = await ChatMemory.find({ userId: user.id }).sort({ updatedAt: -1 }).limit(5).lean();
        memoryNotes = notes.map((n) => `(${n.type || 'note'}) ${n.key}: ${n.value}`).join('\n');
      }
    } catch {}

    // Detect template suggestion for compose requests
    const templateSuggestion = detectBestTemplate(question, question, {});
    let templateHint = '';
    if (templateSuggestion && /\b(compose|draft|send|email|write)\b/i.test(question)) {
      templateHint = `\n\nSUGGESTED TEMPLATE: Use ${templateSuggestion.category}.${templateSuggestion.type} template structure for professional tone.`;
    }

    const aPrompt = `You are an ADVANCED AI EMAIL ASSISTANT with intelligent email management capabilities.

USER QUESTION: "${question}"
${conversationContext}

EMAIL CONTEXT & ANALYTICS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 AGGREGATE INSIGHTS:
   • Total Emails Scanned: ${batchInsights.totalEmails}
   • Urgent/High Priority: ${batchInsights.urgentCount}
   • Action Required: ${batchInsights.actionRequiredCount}
   • Unanswered Client Emails: ${batchInsights.unansweredClientEmails}
   • Critical Items: ${batchInsights.criticalItems.length}
   ${batchInsights.criticalItems.length > 0 ? '\n   Critical: ' + batchInsights.criticalItems.map(c => `${c.subject} from ${c.from}`).join(', ') : ''}
   
📋 CATEGORY BREAKDOWN:
   ${Object.entries(batchInsights.categoryBreakdown).map(([k, v]) => `• ${k}: ${v}`).join('\n   ')}
   
💰 FINANCIAL MENTIONS:
   ${batchInsights.totalAmountsMentioned.slice(0, 5).join(', ') || 'None'}

📅 UPCOMING DEADLINES:
   ${batchInsights.upcomingDeadlines.slice(0, 5).join(', ') || 'None'}

👥 TOP SENDERS:
   ${Object.entries(batchInsights.topSenders).map(([email, count]) => `• ${email}: ${count} emails`).join('\n   ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DETAILED EMAIL DATA (with Business Intelligence):
${JSON.stringify(compact, null, 2)}

PARTICIPANTS: ${participants || 'none'}
USER MEMORY: ${memoryNotes || 'none'}
TARGET RECIPIENT FROM QUESTION: ${targetNameTokens.join(' ') || 'none'} ${explicitEmail ? `(Email: ${explicitEmail})` : ''}
DATE CONTEXT: ${dateRange ? dateRange.desc : 'no date filter'}${templateHint}

⚠️ FOR COMPOSE REQUESTS: If the user wants to send an email to someone:
1. Look at TARGET RECIPIENT FROM QUESTION first
2. Match the name to find their email in PARTICIPANTS list
3. Set send.toEmail to the MATCHED EMAIL, not a random one from search results
4. If name is "irfan" or "Irfan", search PARTICIPANTS for emails containing "irfan"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 YOUR ADVANCED CAPABILITIES:

1. INTELLIGENT EMAIL UNDERSTANDING
   ✓ Understand complex multi-intent queries instantly
   ✓ Extract key information: dates, amounts, names, important details
   ✓ Recognize patterns and conversation threads
   ✓ Prioritize based on importance and urgency
   ✓ Identify what needs attention or action

2. SMART EMAIL ANALYSIS
   ✓ Categorize: important, meetings, finances, personal, work
   ✓ Detect sentiment: positive, negative, neutral, urgent
   ✓ Extract entities: people, companies, dates, documents
   ✓ Track action items and things to remember
   ✓ Monitor conversations and follow-ups

3. HELPFUL COMMUNICATION
   ✓ Generate well-written emails with appropriate tone
   ✓ Use templates for common email scenarios
   ✓ Adapt writing style to match the context
   ✓ Include relevant context from previous emails
   ✓ Professional and friendly formatting

4. PROACTIVE ASSISTANCE
   ✓ Alert about important unread messages
   ✓ Suggest priority actions
   ✓ Recommend follow-ups when needed
   ✓ Identify emails needing response
   ✓ Summarize long email threads clearly

5. SMART FEATURES
   ✓ Compose: Well-written emails with context
   ✓ Reply: Helpful responses matching tone
   ✓ Summarize: Clear summaries with key points
   ✓ Analyze: Insights and patterns
   ✓ Search: Find exactly what you need

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 RESPONSE GUIDELINES:

✓ ACCURACY: Provide exact information - dates, names, amounts
✓ CLARITY: Use bullet points and clear formatting
✓ HELPFUL: Include next steps and suggestions
✓ CONTEXT: Reference specific emails when relevant
✓ PRIORITY: Highlight important items
✓ COMPLETE: Don't miss key details
✓ FRIENDLY: Maintain helpful, professional tone
✓ CONCISE: Be clear but comprehensive

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 RESPONSE FORMAT (JSON):
{
  "answer": "Clear, user-friendly text response. Write as plain text with bullets/formatting. DO NOT include JSON structures within this field.",
  "citations": ["📧 Email 1: [Subject] from [Sender] - [Date]"],
  "keyInsights": ["💡 Critical insight 1", "💡 Critical insight 2"],
  "actionItems": ["✓ Action 1 (Priority: high, Deadline: date)", "✓ Action 2"],
  "suggestedActions": ["Next step 1", "Next step 2"],
  "businessMetrics": {
    "urgentCount": 0,
    "totalAmount": "$0",
    "pendingResponses": 0,
    "upcomingDeadlines": []
  },
  "priority": "critical" | "high" | "medium" | "low",
  "action": "send" | "schedule" | "reply" | null,
  "send": { 
    "toEmail": "email@example.com", 
    "toName": "Name",
    "subject": "Professional, clear subject line", 
    "body": "Complete professional email:\n\nHi [Name],\n\n[Context paragraph]\n\n[Main content with clear structure]\n\n[Call to action if needed]\n\nBest regards"
  },
  "schedule": { 
    "when": "specific time/date",
    "toEmail": "email@example.com",
    "subject": "...",
    "body": "..."
  }
}

⚠️ CRITICAL: The "answer" field must be plain, readable text - NOT nested JSON or code blocks!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 INTENT DETECTION (CRITICAL - Set action field correctly):

📧 COMPOSE/SEND (action: "send"):
   - "send email to [person]" → action: "send"
   - "compose/draft/write to [person]" → action: "send"
   - "email [person] about [topic]" → action: "send"
   ⚠️ IMPORTANT: If user wants to COMPOSE, set action="send", NOT "search"

🔍 SEARCH/SHOW (action: null):
   - "show me emails from [person]"
   - "find emails about [topic]"
   - "what emails need response"
   - "important unread emails"

📝 SUMMARIZE (action: null):
   - "summarize emails from [person/date]"
   - "what's the latest"
   - "brief me on [topic]"

💬 REPLY (action: "reply"):
   - "reply to [email/person]"
   - "respond to the latest"

📅 SCHEDULE (action: "schedule"):
   - "schedule email for [time]"
   - "send later"

⚠️ KEY RULE: Only set action="send" when user explicitly wants to COMPOSE/SEND an email, NOT when they want to search/view emails

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎓 EMAIL COMPOSITION GUIDELINES:

When composing/drafting emails:
1. STRUCTURE: Greeting → Context → Main Content → Closing
2. TONE: Appropriate for the recipient and situation
3. SUBJECT: Clear and specific
4. CONTENT: Clear paragraphs, bullet points when helpful
5. CONTEXT: Reference previous emails ONLY if highly relevant
6. FORMATTING: Easy to read with proper spacing
7. CLOSING: Appropriate sign-off (Best regards, Thanks, etc.)
8. QUALITY: Good grammar, spelling, and punctuation

⚠️ CRITICAL FOR COMPOSE REQUESTS:
- If user wants to COMPOSE/SEND: Focus ONLY on creating the email
- Do NOT list or describe emails in the answer
- Do NOT explain what emails were found
- ONLY set action="send" and provide send.toEmail, send.subject, send.body
- Keep answer brief: "I'll help you compose that email" or similar

Now analyze the email context and provide an intelligent, helpful response:`;

    const answerText = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { 
          role: 'system', 
          content: 'You are an INTELLIGENT EMAIL ASSISTANT helping users manage their inbox efficiently. You provide ACCURATE, HELPFUL responses with ZERO hallucination. Your responses are: 1) PRECISE with exact dates/names/amounts, 2) CONTEXT-AWARE with priority understanding, 3) CLEARLY formatted and easy to read, 4) PROACTIVELY helpful. You NEVER miss important details. You ALWAYS cite sources. You ONLY use information from provided emails. Return ONLY valid JSON with clean, user-friendly text in the answer field (not JSON within JSON).'
        },
        { role: 'user', content: aPrompt },
      ],
      temperature: 0.5, // Reduced for more accuracy
      max_tokens: 1500, // Increased for detailed responses
    });
    let payload = { answer: 'No answer', citations: [], action: null, send: null, schedule: null };
    try {
      let rawContent = answerText.choices?.[0]?.message?.content || '{}';
      
      // Try to extract JSON from markdown code blocks if present
      let jsonContent = rawContent;
      const jsonMatch = rawContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
      
      // Fix control characters that break JSON parsing
      jsonContent = jsonContent
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      
      payload = JSON.parse(jsonContent);
      
      // If answer contains JSON-like structures or raw JSON, clean it up
      if (payload.answer && typeof payload.answer === 'string') {
        // Remove any JSON formatting from the answer
        payload.answer = payload.answer
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .replace(/^\s*\{\s*/g, '')
          .replace(/\s*\}\s*$/g, '')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .trim();
        
        // If the answer is just a raw JSON dump, extract meaningful text
        if (payload.answer.startsWith('"answer"') || payload.answer.includes('"keyInsights"')) {
          // Try to extract just the meaningful text
          const answerMatch = payload.answer.match(/"answer"\s*:\s*"([^"]+)"/);
          if (answerMatch) {
            payload.answer = answerMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t');
          }
        }
      }
    } catch (e) {
      console.error('JSON parse error:', e);
      // Fallback: try to extract text content
      const rawText = answerText.choices?.[0]?.message?.content || '';
      // Try to extract just the answer text if it's in JSON format
      const answerMatch = rawText.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (answerMatch) {
        payload.answer = answerMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      } else {
        payload.answer = rawText.replace(/```json|```|\{|\}/g, '').trim();
      }
    }

    // If model returned empty or missing answer, synthesize a fallback summary from the top candidate(s)
    if ((!payload || !payload.answer || payload.answer === 'No answer') && results.length) {
      const top = results[0];
      const body = top.bodyText || htmlToText(top.bodyHtml || '', { wordwrap: false });
      const sPrompt = `Analyze this email and provide an intelligent summary based on the user's question: "${question}"

EMAIL:
Subject: ${top.subject}
From: ${top.from}
Date: ${top.date}
Body: ${String(body).slice(0, 9000)}

Provide a detailed, contextual answer that:
1. Directly addresses the user's question
2. Highlights key information: amounts, dates, actions, deadlines
3. Identifies urgency and priority
4. Suggests next steps if relevant
5. Uses conversational, helpful tone

Return JSON: { 
  "summary": "Comprehensive, contextual answer",
  "keyPoints": ["Point 1", "Point 2", "Point 3"]
}`;
      try {
        const sOut = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are a helpful email assistant that provides clear, actionable summaries. Return only valid JSON.' },
            { role: 'user', content: sPrompt },
          ],
          temperature: 0.5,
          max_tokens: 500,
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
      
      // 1) If the question contains an explicit email address, use it
      if (explicitEmail) {
        candidateEmail = explicitEmail;
      }
      
      // 2) If we have target name tokens, search for matching email in recent participants
      if (!candidateEmail && targetNameTokens.length > 0) {
        // Try to find a matching participant from the search results
        const matchScores = Array.from(participantsSet).map(participant => {
          const score = scoreParticipant(participant, targetNameTokens);
          return { email: extractEmail(participant), score };
        }).filter(m => m.email && m.score > 0);
        
        matchScores.sort((a, b) => b.score - a.score);
        if (matchScores.length > 0 && matchScores[0].score >= 3) {
          candidateEmail = matchScores[0].email;
        }
      }
      
      // 3) Fallback: if still no match and user clearly wants to compose, use first result
      if (!candidateEmail && results.length > 0 && explicitSendIntent) {
        candidateEmail = extractEmail(results[0].from) || extractEmail(results[0].to);
      }
      
      if (candidateEmail) {
        const defaultSubject = 'Hello';
        const defaultBody = 'Hi,\n\nI hope this email finds you well.\n\nBest regards';
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

    // Save conversation history
    try {
      if (conversation) {
        await conversation.addMessage('user', question, {
          intent: payload.action || 'search',
          emailsFound: results.length,
          cached: !!cachedResults
        });
        await conversation.addMessage('assistant', payload.answer || 'No answer', {
          action: payload.action,
          citations: payload.citations?.length || 0
        });
      }
    } catch (err) {
      console.error('Failed to save conversation:', err);
      // Don't fail the request if history save fails
    }

    // Filter messages based on intent - for compose/send, only return minimal context
    let messagesToReturn = results;
    if (payload.action === 'send' || payload.action === 'compose' || payload.action === 'schedule') {
      // For compose actions, only return the most relevant 1-2 emails for context
      messagesToReturn = results.slice(0, 2);
    } else {
      // For search/show requests, return top relevant emails based on priority
      // Sort by priority and filter to most relevant
      const priorityEmails = businessAnalyzedEmails
        .filter(e => e.priority === 'critical' || e.priority === 'high' || e.requiresAction)
        .slice(0, 10);
      
      if (priorityEmails.length > 0) {
        messagesToReturn = priorityEmails.map(e => results.find(r => r.id === e.id)).filter(Boolean);
      } else {
        // If no high priority, return first 8 most recent
        messagesToReturn = results.slice(0, 8);
      }
    }
    
    res.json({ 
      ...payload, 
      messages: messagesToReturn, 
      queries,
      sessionId: conversation?.sessionId || null,
      conversationLength: conversation?.messages.length || 0
    });
  } catch (err) {
    console.error('AI chat ask error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to answer' });
  }
});

module.exports = router;


