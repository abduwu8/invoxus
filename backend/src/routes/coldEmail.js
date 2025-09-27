const express = require('express');
const { google } = require('googleapis');
const Groq = require('groq-sdk');

const router = express.Router();

// Middleware to handle JSON parsing errors
router.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON parsing error:', err.message);
    return res.status(400).json({ 
      error: 'Invalid JSON in request body',
      details: err.message 
    });
  }
  next(err);
});

// Test endpoint to verify request body parsing
router.post('/test', (req, res) => {
  res.json({
    success: true,
    body: req.body,
    bodyType: typeof req.body,
    bodyIsNull: req.body === null,
    bodyIsUndefined: req.body === undefined
  });
});

// Test GROQ API endpoint
router.post('/test-groq', async (req, res) => {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return res.json({ error: 'No GROQ_API_KEY' });
    }

    const groq = new Groq({ apiKey: groqApiKey });
    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

    const response = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say "Hello" in one word.' }],
      max_tokens: 50,
    });

    res.json({
      success: true,
      response: response,
      content: response?.choices?.[0]?.message?.content
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      details: error?.response?.data || error
    });
  }
});

// Debug endpoint to test AI email generation
router.post('/debug-ai', async (req, res) => {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return res.json({ error: 'No GROQ_API_KEY' });
    }

    const groq = new Groq({ apiKey: groqApiKey });
    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

    const testPrompt = `Write a job application email. Return ONLY valid JSON with these exact fields: {"subject","body","reason"}.

CONTEXT:
Role: HR
Company: Test Company
Job: Software Developer
Skills: JavaScript, React, Node.js
Achievements: Built 3 web applications
Fit: Strong technical background
Portfolio: github.com/username
Tone: tldr
Availability: flexible
Location: remote

REQUIREMENTS:
- Format as a proper email with salutation and closing
- EXACTLY 3 paragraphs, 180-220 words total (be concise!)
- Start with appropriate salutation (Dear [Name/Team], Hi [Name], etc.)
- Paragraph 1: Start with an innovative, fun opener like "TL;DR: I'm the developer your team didn't know they needed" or "TL;DR: Ready to turn your tech stack into a powerhouse?" - be creative and memorable. Introduce yourself and the role. Keep it brief and punchy.
- Paragraph 2: Showcase your skills, achievements, and relevant experience. Include specific examples and metrics. Be direct and to the point.
- Paragraph 3: Creative call-to-action with personality. Use tech metaphors and show enthusiasm. Keep it short and impactful.
- End with proper email closing (Best regards, Sincerely, etc.) and signature placeholder
- Be innovative, use tech metaphors, show personality while staying professional. Make HR think "this person is creative and would bring fresh energy to our team". Use phrases like "code wizard", "bug slayer", "performance optimizer", or creative analogies

CRITICAL: Return ONLY valid JSON, no other text, no code blocks, no explanations:
{
  "subject": "Email subject (max 70 chars)",
  "body": "Proper email format with salutation, 3 paragraphs (180-220 words), and closing",
  "reason": "Brief approach explanation"
}`;

    const response = await groq.chat.completions.create({
      model,
      messages: [
        { 
          role: 'system', 
          content: `You are a professional email writer with a creative edge. Always return valid JSON with subject, body, and reason fields. Never return empty responses or code blocks.
          
          CRITICAL: The email body MUST be exactly 3 paragraphs. Each paragraph should be well-structured and readable.
          
          For TLDR tone: Be innovative, fun, and memorable while staying professional. Use creative tech metaphors, show personality, and make the email stand out. Think like a creative developer who knows how to make an impression.` 
        },
        { role: 'user', content: testPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const rawContent = response?.choices?.[0]?.message?.content || '';
    const parsed = safeJsonParse(rawContent);

    res.json({
      success: true,
      rawContent: rawContent,
      parsed: parsed,
      isValid: !!(parsed && parsed.subject && parsed.body),
      response: response
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      details: error?.response?.data || error
    });
  }
});

function createOAuthClientFromSession(tokens) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'postmessage');
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

// Validate that email body has exactly 3 paragraphs
function validateThreeParagraphs(body) {
  if (!body || typeof body !== 'string') return false;
  
  // Split by double line breaks or paragraph breaks
  const paragraphs = body.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // Also check for single line breaks that might indicate paragraphs
  if (paragraphs.length < 3) {
    const singleLineParagraphs = body.split(/\n/).filter(p => p.trim().length > 20);
    return singleLineParagraphs.length >= 3;
  }
  
  return paragraphs.length >= 3;
}

// Manual content extraction when JSON parsing fails
function extractEmailContentManually(text) {
  try {
    // Try to find subject and body using regex patterns
    const subjectMatch = text.match(/"subject"\s*:\s*"([^"]+)"/i) || 
                        text.match(/subject["\s]*:["\s]*([^\n\r,}]+)/i);
    
    const bodyMatch = text.match(/"body"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/i) ||
                     text.match(/body["\s]*:["\s]*([^\n\r,}]+)/i);
    
    const reasonMatch = text.match(/"reason"\s*:\s*"([^"]+)"/i) ||
                       text.match(/reason["\s]*:["\s]*([^\n\r,}]+)/i);
    
    if (subjectMatch && bodyMatch) {
      const result = {
        subject: subjectMatch[1].trim(),
        body: bodyMatch[1].trim().replace(/\\n/g, '\n').replace(/\\"/g, '"'),
        reason: reasonMatch ? reasonMatch[1].trim() : 'AI-generated email'
      };
      
      return result;
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

// Enhanced JSON extractor to handle code fences or extra text
function safeJsonParse(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  
  let t = text.trim();
  
  // strip code fences (```json or ```)
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
  
  // normalize quotes and fix common issues
  t = t.replace(/[""]/g, '"').replace(/['']/g, "'");
  
  // Fix common JSON issues
  t = t.replace(/,\s*}/g, '}'); // Remove trailing commas
  t = t.replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
  
  try {
    const result = JSON.parse(t);
    return result;
  } catch (e) {
    return null;
  }
}

// Compose strictly via AI using provided context (no hardcoded text)
async function aiComposeStrict(groq, {
  model,
  role,
  company,
  jobTitle,
  skillsForPrompt,
  achievements,
  portfolioLinks,
  fitSummary,
  ctaPreference,
  tone,
  resumeText,
  availability,
  location,
  purpose = 'compose',
  opts = {}
}) {

  const composePrompt = `Write a unique, creative job application email. Return ONLY valid JSON with these exact fields: {"subject","body","reason"}.

CONTEXT:
Role: ${role}
Company: ${company || 'a company'}
Job: ${jobTitle || 'a position'}
Skills: ${skillsForPrompt}
Achievements: ${String(achievements).trim().slice(0, 200) || 'relevant experience'}
Fit: ${String(fitSummary).trim().slice(0, 150) || 'strong background'}
Portfolio: ${String(portfolioLinks).trim().slice(0, 100) || 'LinkedIn profile and work samples'}
Tone: ${tone}
Availability: ${availability || 'flexible'}
Location: ${location || 'remote/onsite'}

REQUIREMENTS:
- Format as a proper email with salutation and closing
- EXACTLY 3 paragraphs, 180-220 words total (be concise!)
- Start with appropriate salutation (Dear [Name/Team], Hi [Name], etc.)
- Paragraph 1: ${tone === 'tldr' ? `Start with a creative, unique opener. Be innovative and memorable. Use fresh language and avoid clichés. Introduce yourself and the role with personality. Keep it brief and punchy.` : 'Professional introduction with your background and interest in the role. Be specific and engaging. Keep it concise.'}
- Paragraph 2: Showcase your skills, achievements, and relevant experience. Include specific examples and metrics. Make it personal and compelling. Be direct and to the point.
- Paragraph 3: ${tone === 'tldr' ? 'Creative call-to-action with personality. Use fresh metaphors and show genuine enthusiasm. Be memorable and engaging. Keep it short and impactful.' : 'Professional call-to-action with clear next steps and availability. Be confident and specific. Keep it brief.'}
- End with proper email closing (Best regards, Sincerely, etc.) and signature placeholder

CREATIVITY RULES:
- ${tone === 'tldr' ? 'Be completely innovative, creative, and unique every time. Invent your own fresh language, metaphors, and approaches. Show personality and make HR think "this person is creative and would bring fresh energy". Never use clichés or common phrases.' : 'Be results-focused, confident, and professional. Use specific examples and clear value propositions. Be authentic and genuine.'}
- NEVER repeat the same phrases, metaphors, structures, or approaches from any previous emails
- Create completely original content every single time - no templates or patterns
- Invent fresh language, unique metaphors, and creative approaches
- Make each email feel completely fresh, unique, and personally crafted
- Use varied vocabulary, sentence structures, and writing styles
- Be authentic, genuine, and creative in your approach
- Think outside the box and surprise the reader with originality

CRITICAL: Return ONLY valid JSON, no other text, no code blocks, no explanations:
{
  "subject": "Email subject (max 70 chars)",
  "body": "Proper email format with salutation, 3 paragraphs (180-220 words), and closing",
  "reason": "Brief approach explanation"
}`;

  // Enhanced retry logic with different models and better debugging
  let resp;
  let attempts = 0;
  const maxAttempts = 5;
  const modelsToTry = [model, 'llama-3.1-8b-instant', 'llama-3.1-70b-versatile'];
  
  while (attempts < maxAttempts) {
    const currentModel = modelsToTry[attempts % modelsToTry.length];
    
    try {
      resp = await groq.chat.completions.create({
        model: currentModel,
        messages: [
          { 
            role: 'system', 
            content: `You are a professional email writer with a creative edge. You MUST return valid JSON with subject, body, and reason fields. Never return empty responses, code blocks, or explanations. Only return the JSON object.
            
            CRITICAL: The email body MUST be formatted as a proper email with:
            - Appropriate salutation (Dear [Name/Team], Hi [Name], etc.)
            - Exactly 3 well-structured paragraphs (180-220 words total)
            - Proper email closing (Best regards, Sincerely, etc.)
            - Signature placeholder ([Your Name])
            
            UNIQUENESS REQUIREMENT: Every email must be completely unique and different from previous ones. Never repeat phrases, structures, or approaches. Be creative and innovative every single time.
            
            For TLDR tone: Be innovative, fun, and memorable while staying professional. Use creative tech metaphors, show personality, and make the email stand out. Think like a creative developer who knows how to make an impression. Vary your language, metaphors, and approach every time.` 
          },
          { role: 'user', content: composePrompt },
        ],
        temperature: typeof opts.temperature === 'number' ? opts.temperature : (tone === 'tldr' ? 1.0 : 0.6),
        max_tokens: typeof opts.maxTokens === 'number' ? opts.maxTokens : 800,
      });
      
      const text = resp?.choices?.[0]?.message?.content || '';
      
      if (text && text.trim() !== '') {
        const parsed = safeJsonParse(text);
        
        if (parsed && typeof parsed === 'object' && parsed.subject && parsed.body && 
            parsed.subject.trim() !== '' && parsed.body.trim() !== '' && 
            validateThreeParagraphs(parsed.body)) {
          return parsed;
        } else {
          
          // Try to extract content manually if JSON parsing failed
          const manualExtract = extractEmailContentManually(text);
          if (manualExtract && manualExtract.subject && manualExtract.body && 
              validateThreeParagraphs(manualExtract.body)) {
            return manualExtract;
          }
        }
      }
    } catch (groqError) {
    }
    
    attempts++;
    if (attempts < maxAttempts) {
      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }
  
  throw new Error('AI failed to generate valid email content after multiple attempts with different models');
}


router.post('/generate', async (req, res) => {
  try {
    // Simple rate limiting for startup phase - COMMENTED OUT FOR TESTING
    // const sessionKey = 'cold_email_count_' + new Date().toDateString();
    // const currentCount = parseInt(req.session?.[sessionKey] || '0');
    
    // if (currentCount >= 10) {
    //   return res.status(429).json({
    //     error: 'Daily limit reached',
    //     message: 'You\'ve reached the daily limit of 10 cold emails. Premium plans coming soon!',
    //     limit: 10,
    //     used: currentCount
    //   });
    // }

    // Ensure req.body exists and is an object
    const body = req.body || {};

    const {
      to = '',
      skills = '',
      role = 'HR',
      company = '',
      jobTitle = '',
      achievements = '',
      portfolioLinks = '',
      fitSummary = '',
      ctaPreference = '',
      tone = 'professional',
      availability = '',
      location = '',
      lowCost = false,
    } = body;


    const skillsList = String(skills)
      .split(/[\,\n]/)
      .flatMap((part) => String(part).split(/\s+/))
      .map((s) => s.trim())
      .filter(Boolean);
    const skillsForPrompt = skillsList.length ? skillsList.slice(0, 12).join(', ') : 'skills, experience, projects';

    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (!groqApiKey) {
      return res.status(200).json({ to, subject: 'Hello', body: 'Please set GROQ_API_KEY on the server.', reason: 'Missing GROQ_API_KEY' });
    }

    const groq = new Groq({ apiKey: groqApiKey });
    const primaryModel = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    const fallbackModel = 'llama-3.1-70b-versatile';
    let model = primaryModel;
    
    // Test API key with a simple call and retry with different models if needed
    let modelWorking = false;
    const modelsToTry = [primaryModel, fallbackModel, 'llama-3.1-8b-instant', 'llama-3.1-70b-versatile'];
    
    for (const testModel of modelsToTry) {
      try {
        const testResponse = await groq.chat.completions.create({
          model: testModel,
          messages: [{ role: 'user', content: 'Say "Hello" in one word.' }],
          max_tokens: 50,
        });
        const testContent = testResponse?.choices?.[0]?.message?.content;
        
        if (testContent && testContent.trim() !== '') {
          model = testModel;
          modelWorking = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!modelWorking) {
      throw new Error('All AI models are currently unavailable. Please try again in a few moments.');
    }
    const lengthBounds = [180, 220];
    const maxTokens = lowCost ? 600 : 800; // Increased significantly for proper email generation
    const temperature = lowCost ? 0.2 : (tone === 'tldr' ? 1.0 : 0.6); // Maximum creativity for TLDR

    // First compose pass (AI only) - enhanced retry logic
    let draft = null;
    let composeAttempts = 0;
    const maxComposeAttempts = 5;
    
    while (composeAttempts < maxComposeAttempts) {
      try {
        draft = await aiComposeStrict(groq, {
          model,
          role,
          company,
          jobTitle,
          skillsForPrompt,
          achievements,
          portfolioLinks,
          fitSummary,
          ctaPreference,
          tone,
          availability,
          location,
          purpose: 'compose',
          opts: { maxTokens, temperature }
        });
        
        // If we got a valid draft with 3 paragraphs, break out of retry loop
        if (draft && draft.subject && draft.body && draft.subject.trim() !== '' && 
            draft.body.trim() !== '' && validateThreeParagraphs(draft.body)) {
          break;
        }
      } catch (e) {
        draft = null;
      }
      composeAttempts++;
      
      if (composeAttempts < maxComposeAttempts) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // If we still don't have a valid draft with 3 paragraphs, throw error
    if (!draft || !draft.subject || !draft.body || draft.subject.trim() === '' || 
        draft.body.trim() === '' || !validateThreeParagraphs(draft.body)) {
      throw new Error('Failed to generate valid email content with 3 paragraphs after multiple attempts');
    }

    // Refine loop to hit tone/length - only if needed
    const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
    let attempts = 0;
    const maxRefineAttempts = 2;
    
    while (
      attempts < maxRefineAttempts && draft && draft.body && (
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
          jobTitle,
          skillsForPrompt,
          achievements,
          portfolioLinks,
          fitSummary,
          ctaPreference,
          tone,
          availability,
          location,
          purpose: 'refine',
          opts: { maxTokens: maxTokens + 200, temperature: tone === 'tldr' ? 1.0 : temperature + 0.2 }
        });
        
        if (refine && refine.subject && refine.body && refine.subject.trim() !== '' && 
            refine.body.trim() !== '' && validateThreeParagraphs(refine.body)) {
          draft = refine;
        }
      } catch (e) {
        break; // Don't fail completely if refinement fails
      }
      attempts += 1;
    }

    // Final validation - ensure we have valid AI-generated content
    if (!draft || !draft.subject || !draft.body || draft.subject.trim() === '' || draft.body.trim() === '') {
      // Try one more time with a different approach
      try {
        const finalAttempt = await aiComposeStrict(groq, {
          model,
          role,
          company,
          jobTitle,
          skillsForPrompt,
          achievements,
          portfolioLinks,
          fitSummary,
          ctaPreference,
          tone,
          availability,
          location,
          purpose: 'final_attempt',
          opts: { maxTokens: 1000, temperature: tone === 'tldr' ? 1.0 : 0.8 }
        });
        
        if (finalAttempt && finalAttempt.subject && finalAttempt.body && 
            validateThreeParagraphs(finalAttempt.body)) {
          draft = finalAttempt;
        } else {
          throw new Error('AI failed to generate valid email content with 3 paragraphs after multiple attempts');
        }
      } catch (finalError) {
        throw new Error(`AI email generation failed: ${finalError.message}. Please try again.`);
      }
    }

    const subjectOut = String(draft.subject || '').trim().slice(0, 120) || `Application — ${jobTitle || 'Role'} at ${company || 'your team'}`.slice(0, 70);
    const bodyOut = String(draft.body || '').trim().slice(0, 4000);

    // Increment daily counter - COMMENTED OUT FOR TESTING
    // if (req.session) {
    //   req.session[sessionKey] = (currentCount + 1).toString();
    // }

    res.json({ 
      to, 
      subject: subjectOut, 
      body: bodyOut, 
      reason: draft.reason
      // dailyLimit: 10,
      // used: currentCount + 1,
      // remaining: 10 - (currentCount + 1)
    });
  } catch (err) {
    console.error('Cold email generate error:', err?.response?.data || err);
    console.error('Full generate error:', err);
    console.error('Error stack:', err?.stack);
    console.error('Request body in error handler:', req.body);
    console.error('Request body type in error handler:', typeof req.body);
    
    // Return error response - let frontend handle retry logic
    const safeBody = req.body || {};
    
    res.status(500).json({ 
      error: 'AI email generation failed',
      message: err?.message || 'Unknown error occurred',
      details: 'Please try again or contact support if the issue persists'
    });
  }
});

// Suggest field values (pain points, value prop, proof, CTA, tone, length, keywords) using AI
router.post('/suggest', async (req, res) => {
  try {
    
    // Remove authentication requirement for suggest endpoint
    // const tokens = req.session && req.session.tokens;
    // if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const {
      role = 'HR',
      company = '',
      skills = '',
      jobTitle = '',
      portfolioLinks = '',
    } = req.body || {};

    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (!groqApiKey) {
      return res.status(200).json({
        skills: skills || '',
        achievements: '',
        fitSummary: '',
        portfolioLinks: portfolioLinks || '',
        ctaPreference: '',
        tone: 'professional',
        availability: '',
        location: ''
      });
    }

    const groq = new Groq({ apiKey: groqApiKey });
    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    
    const prompt = `You are a career advisor helping someone write a job application email.

CONTEXT:
- Role: ${String(role).trim().slice(0, 30) || 'HR'}
- Company: ${String(company).trim().slice(0, 50) || 'a company'}
- Current Skills: ${String(skills).trim().slice(0, 100) || 'various skills'}
- Job Title: ${String(jobTitle).trim().slice(0, 50) || 'a position'}

TASK: Based on the job title, suggest relevant improvements for a job application email.

Return ONLY valid JSON in this exact format:
{
  "skills": "refined, relevant skills list",
  "achievements": "1-3 quantified achievements",
  "fitSummary": "1 sentence explaining why you're a good fit",
  "portfolioLinks": "LinkedIn profile and relevant portfolio or work samples",
  "ctaPreference": "suggested call-to-action",
  "tone": "professional",
  "availability": "availability status",
  "location": "location preference"
}`;

    const result = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that always returns valid JSON. Never return empty responses.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 600,
    });
    
    const responseText = result?.choices?.[0]?.message?.content || '';
    
    let suggestions = {};
    try {
      suggestions = JSON.parse(responseText);
    } catch (e) {
      suggestions = {};
    }
    
    const out = {
      skills: String(suggestions.skills || skills || ''),
      achievements: String(suggestions.achievements || ''),
      fitSummary: String(suggestions.fitSummary || ''),
      portfolioLinks: String(suggestions.portfolioLinks || portfolioLinks || ''),
      ctaPreference: String(suggestions.ctaPreference || ''),
      tone: ['professional','tldr'].includes(String(suggestions.tone)) ? suggestions.tone : 'professional',
      availability: String(suggestions.availability || ''),
      location: String(suggestions.location || ''),
    };
    
    res.json(out);
  } catch (err) {
    // Return default suggestions instead of error
    res.status(200).json({
      skills: '',
      achievements: '',
      fitSummary: '',
      portfolioLinks: '',
      ctaPreference: '',
      tone: 'professional',
      availability: '',
      location: ''
    });
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


