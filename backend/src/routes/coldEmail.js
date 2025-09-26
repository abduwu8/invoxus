const express = require('express');
const { google } = require('googleapis');
const Groq = require('groq-sdk');

const router = express.Router();
// Lazy import for multipart/form-data handling
let multer;
try { multer = require('multer'); } catch (_) { multer = null }

function createOAuthClientFromSession(tokens) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'postmessage');
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

// Simple JSON extractor to handle code fences or extra text
function safeJsonParse(text) {
  if (!text || typeof text !== 'string') return null;
  let t = text.trim();
  // strip code fences
  if (t.startsWith('```')) {
    const first = t.indexOf('{');
    const last = t.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      t = t.slice(first, last + 1);
    }
  }
  // pick outermost braces if extra text exists
  if (!(t.startsWith('{') && t.endsWith('}'))) {
    const first = t.indexOf('{');
    const last = t.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      t = t.slice(first, last + 1);
    }
  }
  // normalize quotes
  t = t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  try {
    return JSON.parse(t);
  } catch (_) {
    return null;
  }
}

// Compose strictly via AI using provided context (no hardcoded text)
async function aiComposeStrict(groq, {
  model,
  role,
  company,
  industry,
  jobTitle,
  skillsForPrompt,
  achievements,
  portfolioLinks,
  fitSummary,
  ctaPreference,
  tone,
  desiredLength,
  lengthBounds,
  resumeText,
  availability,
  location,
  purpose = 'compose',
  opts = {}
}) {
  const composePrompt = `You are a senior job-application cold email copywriter. ${purpose === 'refine' ? 'Rewrite' : 'Compose'} a candidate-to-HR cold email using ONLY the context below.
Return STRICT JSON only with keys {"subject","body","reason"}. No markdown, no prose outside JSON.

Context:
- Recipient role: ${role}
- Company: ${company || 'n/a'}
- Industry: ${industry || 'n/a'}
- Job title targeted: ${jobTitle || 'n/a'}
- Key skills: ${skillsForPrompt}
- Achievements (short, quantified): ${String(achievements).trim() || 'n/a'}
- Why I’m a fit: ${String(fitSummary).trim() || 'n/a'}
- Portfolio/links: ${String(portfolioLinks).trim() || 'n/a'}
- Resume/profile highlights: ${String(resumeText).trim().slice(0, 800) || 'n/a'}
- Availability: ${String(availability).trim() || 'n/a'}
- Location: ${String(location).trim() || 'n/a'}
- Tone: ${tone}
- Desired length: ${desiredLength} (target ${lengthBounds[0]}–${lengthBounds[1]} words)

Style rules (must follow):
- Plain text only. No emojis, no brackets.
- Tone mapping: professional=confident/precise/results; friendly=warm/approachable; direct=outcome-first; curious=exploratory/questions.
 - If tone is "playful", you may use a fun opener (e.g., a short tl;dr line), light humor, and energetic cadence while staying respectful and professional.
- Structure by length: short=2 paragraphs+CTA; medium=2–3 paragraphs incl. 1 example; long=3–4 paragraphs incl. mini case.
- Put portfolio/links (if any) as the last content line before signature.
- Do NOT repeat sentences.
- End with a soft, specific CTA aligned to context.
`;

  const resp = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'Always return STRICT JSON only.' },
      { role: 'user', content: composePrompt },
    ],
    temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.35,
    max_tokens: typeof opts.maxTokens === 'number' ? opts.maxTokens : 700,
  });
  const text = resp?.choices?.[0]?.message?.content || '';
  return safeJsonParse(text) || {};
}

// Length-aware fallback used only when AI fails
function buildFallbackCandidateEmail({ role, company, jobTitle, skillsForPrompt, achievements, portfolioLinks, fitSummary, availability, location, ctaPreference, desiredLength }) {
  const target = desiredLength === 'short' ? 110 : desiredLength === 'medium' ? 160 : 220;
  const introName = role || 'Hiring Team';
  const ach = String(achievements || '').split(/\n|,/).map(s=>s.trim()).filter(Boolean).slice(0,2);
  const parts = [];
  parts.push(`Hi ${introName},`);
  parts.push(`I’m reaching out about the ${jobTitle || 'open'} role at ${company || 'your company'}. I work with ${skillsForPrompt}.`);
  if (ach.length) parts.push(`Recent highlights: ${ach.join('; ')}.`);
  if (fitSummary) parts.push(fitSummary);
  if (availability || location) parts.push(`${availability ? `Availability: ${availability}. ` : ''}${location ? `Location: ${location}.` : ''}`.trim());
  parts.push(`Would you be open to a ${ctaPreference || 'short intro call'} to explore fit?`);
  if (portfolioLinks) parts.push(`Portfolio / links: ${portfolioLinks}`);
  let body = parts.join(' ');
  const extra = [
    'Happy to share a brief walkthrough of relevant work.',
    'I can send a short write‑up mapping experience to the role.',
    'I care about clear communication, reliable delivery, and measurable outcomes.',
    'I’m eager to learn your priorities and where I can add value.'
  ];
  let i = 0;
  while (body.trim().split(/\s+/).length < target && i < extra.length) {
    body += ` ${extra[i++]}`;
  }
  return `${body}\n\n— [Your Name]`;
}

router.post('/generate', async (req, res) => {
  try {

    const {
      to = '',
      skills = '',
      role = 'HR',
      company = '',
      industry = '',
      jobTitle = '',
      achievements = '',
      portfolioLinks = '',
      fitSummary = '',
      ctaPreference = '',
      tone = 'professional',
      desiredLength = 'long',
      resumeText = '',
      availability = '',
      location = '',
      lowCost = false,
    } = req.body || {};

    const skillsList = String(skills)
      .split(/[\,\n]/)
      .flatMap((part) => String(part).split(/\s+/))
      .map((s) => s.trim())
      .filter(Boolean);
    const skillsForPrompt = skillsList.length ? skillsList.slice(0, 12).join(', ') : 'skills, experience, projects';

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) return res.status(200).json({ to, subject: 'Hello', body: 'Please set GROQ_API_KEY on the server.', reason: 'Missing GROQ_API_KEY' });

    const groq = new Groq({ apiKey: groqApiKey });
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    const lengthBounds = desiredLength === 'short' ? [90, 120] : desiredLength === 'medium' ? [140, 180] : [200, 260];
    const maxTokens = lowCost ? 500 : 700;
    const temperature = lowCost ? 0.3 : 0.35;

    // First compose pass (AI only)
    let draft = {};
    try {
      draft = await aiComposeStrict(groq, {
        model,
        role,
        company,
        industry,
        jobTitle,
        skillsForPrompt,
        achievements,
        portfolioLinks,
        fitSummary,
        ctaPreference,
        tone,
        desiredLength,
        lengthBounds,
        resumeText,
        availability,
        location,
        purpose: 'compose',
        opts: { maxTokens, temperature }
      });
    } catch (e) {
      draft = {};
      console.warn('compose error', e?.response?.data || e?.message || e);
    }

    // If empty or invalid, attempt compose again once
    if (!draft || (!draft.subject && !draft.body)) {
      try {
        draft = await aiComposeStrict(groq, {
          model,
          role,
          company,
          industry,
          jobTitle,
          skillsForPrompt,
          achievements,
          portfolioLinks,
          fitSummary,
          ctaPreference,
          tone,
          desiredLength,
          lengthBounds,
          resumeText,
          availability,
          location,
          purpose: 'compose',
          opts: { maxTokens, temperature }
        });
      } catch (e) {
        draft = {};
      }
    }

    // Refine loop to hit tone/length
    const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
    let attempts = 0;
    while (
      attempts < 2 && (
        wordCount(draft.body) < lengthBounds[0] ||
        wordCount(draft.body) > lengthBounds[1] ||
        String(draft.subject || '').trim().length > 70
      )
    ) {
      try {
        const refine = await aiComposeStrict(groq, {
          model,
          role,
          company,
          industry,
          jobTitle,
          skillsForPrompt,
          achievements,
          portfolioLinks,
          fitSummary,
          ctaPreference,
          tone,
          desiredLength,
          lengthBounds,
          resumeText,
          availability,
          location,
          purpose: 'refine',
          opts: { maxTokens, temperature }
        });
        if (refine && (refine.subject || refine.body)) draft = refine;
      } catch (e) {
        break;
      }
      attempts += 1;
    }

    // Final guard: never 500 — return minimal draft if still empty
    if (!draft || (!draft.subject && !draft.body)) {
      draft = {
        subject: `Application — ${jobTitle || 'Role'} at ${company || 'your team'}`.slice(0, 70),
        body: buildFallbackCandidateEmail({ role, company, jobTitle, skillsForPrompt, achievements, portfolioLinks, fitSummary, availability, location, ctaPreference, desiredLength }),
        reason: 'Fallback draft due to AI unavailable',
      };
    }

    const subjectOut = String(draft.subject || '').trim().slice(0, 120) || `Application — ${jobTitle || 'Role'} at ${company || 'your team'}`.slice(0, 70);
    const bodyOut = String(draft.body || '').trim().slice(0, 4000);

    res.json({ to, subject: subjectOut, body: bodyOut, reason: draft.reason });
  } catch (err) {
    console.error('Cold email generate error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to generate cold email' });
  }
});

// Suggest field values (pain points, value prop, proof, CTA, tone, length, keywords) using AI
router.post('/suggest', async (req, res) => {
  try {
    const tokens = req.session && req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const {
      industry = '',
      role = 'HR',
      company = '',
      resumeText = '',
      skills = '',
      jobTitle = '',
      portfolioLinks = '',
    } = req.body || {};

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) return res.status(200).json({
      painPoints: '', valueProp: '', proof: '', ctaPreference: '', tone: 'professional', desiredLength: 'long', keywords
    });

    const groq = new Groq({ apiKey: groqApiKey });
    const prompt = `You are a senior job-application strategist.
Given minimal context, propose concise suggestions to guide a candidate-to-HR cold email.

Context:
- Industry: ${String(industry).trim() || 'n/a'}
- Role: ${String(role).trim() || 'n/a'}
- Company: ${String(company).trim() || 'n/a'}
- Resume/Profile highlights: ${String(resumeText).trim().slice(0, 1200) || 'n/a'}
- Skills: ${String(skills).trim() || 'n/a'}
- Job title targeted: ${String(jobTitle).trim() || 'n/a'}
- Portfolio/links: ${String(portfolioLinks).trim() || 'n/a'}

Return STRICT JSON only with keys:
{
  "skills": string,            // refined skills list (comma-separated)
  "achievements": string,      // 1–3 quantified items
  "fitSummary": string,        // 1 sentence on fit
  "portfolioLinks": string,    // links to include or keep
  "ctaPreference": string,     // e.g., quick intro/interview scheduling
  "tone": "professional" | "friendly" | "direct" | "curious" | "playful",
  "desiredLength": "short" | "medium" | "long",
  "availability": string,
  "location": string
}`;

    const result = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: 'Always return STRICT JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 700,
      response_format: { type: 'json_object' },
    });
    let suggestions = {};
    try {
      suggestions = JSON.parse(result?.choices?.[0]?.message?.content || '{}');
    } catch {}
    const out = {
      skills: String(suggestions.skills || skills || ''),
      achievements: String(suggestions.achievements || ''),
      fitSummary: String(suggestions.fitSummary || ''),
      portfolioLinks: String(suggestions.portfolioLinks || portfolioLinks || ''),
      ctaPreference: String(suggestions.ctaPreference || ''),
      tone: ['professional','friendly','direct','curious'].includes(String(suggestions.tone)) ? suggestions.tone : 'professional',
      desiredLength: ['short','medium','long'].includes(String(suggestions.desiredLength)) ? suggestions.desiredLength : 'long',
      availability: String(suggestions.availability || ''),
      location: String(suggestions.location || ''),
    };
    res.json(out);
  } catch (err) {
    console.error('Cold email suggest error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to suggest fields' });
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

// Extract plain text from uploaded resume (pdf/docx/txt)
router.post('/resume/extract', async (req, res) => {
  try {
    if (!multer) return res.status(500).json({ error: 'multer not installed' });
  } catch (_) {}
});

module.exports = router;


