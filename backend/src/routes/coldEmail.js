const express = require('express');
const Groq = require('groq-sdk');
const multer = require('multer');
const Payment = require('../models/Payment');
const Usage = require('../models/Usage');
const EmailProvider = require('../services/emailProvider');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF, DOC, and DOCX files
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
    }
  }
});

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

// Middleware to check usage and handle free trials
const checkUsageAndPayment = async (req, res, next) => {
  try {
    // Use authenticated user's email if available, otherwise fallback to session ID
    const userEmail = req.session?.userProfile?.email;
    const sessionId = req.sessionID || 
      `${req.ip}_${req.get('User-Agent')?.slice(0, 50) || 'unknown'}`;
    
    // Get or create usage record - prioritize user email for authenticated users
    const usage = await Usage.getOrCreateUsage(sessionId, userEmail);
    
    // Check if user has free trial left
    if (usage.hasFreeTrialLeft()) {
      // User can use free generation
      req.usage = usage;
      req.isFreeGeneration = true;
      next();
      return;
    }
    
    // Free trial exhausted, check for payment
    const { paymentId } = req.body;
    
    if (!paymentId) {
      return res.status(402).json({
        error: 'Free trial exhausted',
        message: 'You have used all 5 free generations. Please pay ₹1 to continue.',
        paymentRequired: true,
        usage: usage.getUsageSummary()
      });
    }

    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'Invalid payment ID',
        paymentRequired: true,
        usage: usage.getUsageSummary()
      });
    }

    if (payment.status !== 'paid') {
      return res.status(402).json({
        error: 'Payment not completed',
        message: 'Please complete payment to generate cold email',
        paymentRequired: true,
        paymentStatus: payment.status,
        usage: usage.getUsageSummary()
      });
    }

    if (payment.isExpired()) {
      return res.status(400).json({
        error: 'Payment expired',
        message: 'Please create a new payment order',
        paymentRequired: true,
        usage: usage.getUsageSummary()
      });
    }

    // Attach payment and usage info to request
    req.payment = payment;
    req.usage = usage;
    req.isFreeGeneration = false;
    next();

  } catch (error) {
    console.error('Usage/payment check error:', error);
    res.status(500).json({
      error: 'Usage verification failed',
      message: 'Unable to verify usage status'
    });
  }
};

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
- EXACTLY 2 paragraphs, 120-160 words total (be concise!)
- Start with appropriate salutation (Dear [Name/Team], Hi [Name], etc.)
- Paragraph 1: Start with an innovative, fun opener like "TL;DR: I'm the developer your team didn't know they needed" or "TL;DR: Ready to turn your tech stack into a powerhouse?" - be creative and memorable. Introduce yourself and the role. Keep it brief and punchy.
- Paragraph 2: Showcase your skills, projects, and relevant experience using bullet points for key highlights. Include specific examples and metrics. End with a creative call-to-action with personality. Use tech metaphors and show enthusiasm. Be direct and to the point.
- After the second paragraph, include a clean links section followed by LinkedIn and GitHub links (use actual URLs from portfolioLinks if provided, otherwise use placeholder URLs)
- End with proper email closing (Best regards, Sincerely, etc.) and signature placeholder
- Be innovative, use tech metaphors, show personality while staying professional. Make HR think "this person is creative and would bring fresh energy to our team". Use phrases like "code wizard", "bug slayer", "performance optimizer", or creative analogies

CRITICAL: Return ONLY valid JSON, no other text, no code blocks, no explanations:
{
  "subject": "Email subject (max 70 chars)",
  "body": "Proper email format with salutation, 2 paragraphs with bullet points (120-160 words), links section, and closing",
  "reason": "Brief approach explanation"
}`;

    const response = await groq.chat.completions.create({
      model,
      messages: [
        { 
          role: 'system', 
          content: `You are a professional email writer with a creative edge. Always return valid JSON with subject, body, and reason fields. Never return empty responses or code blocks.
          
          CRITICAL: The email body MUST be exactly 2 paragraphs. Each paragraph should be well-structured and readable.
          
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

// Validate that email body has exactly 2 paragraphs
function validateTwoParagraphs(body) {
  if (!body || typeof body !== 'string') return false;
  
  // Split by double line breaks or paragraph breaks
  const paragraphs = body.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // Also check for single line breaks that might indicate paragraphs
  if (paragraphs.length < 2) {
    const singleLineParagraphs = body.split(/\n/).filter(p => p.trim().length > 20);
    return singleLineParagraphs.length >= 2;
  }
  
  return paragraphs.length >= 2;
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
  projects,
  education,
  portfolioLinks,
  fitSummary,
  ctaPreference,
  tone,
  experienceLevel,
  hasResume = false,
  resumeFileName = '',
  availability,
  location,
  purpose = 'compose',
  opts = {}
}) {

  const composePrompt = `Write a cold outreach email to talent acquisition teams. Return ONLY valid JSON: {"subject","body","reason"}.

CONTEXT:
Role: ${role} | Company: ${company || 'a company'} | Job: ${jobTitle || 'a position'}
Skills: ${skillsForPrompt} | Projects: ${String(projects).trim().slice(0, 200) || 'relevant project experience'}
Education: ${String(education).trim().slice(0, 150) || 'relevant educational background'}
Resume: ${hasResume ? `Attached (${resumeFileName})` : 'Not attached'}
Tone: ${tone} | Experience: ${experienceLevel} | Availability: ${availability || 'flexible'}

REQUIREMENTS:
- Proper email format with salutation, 2 paragraphs (120-160 words), links section, closing
- Include ALL provided context information (skills, projects, education, availability, location)
- Education MUST be included if provided in context
- If resume is attached, MUST mention it in the email body (e.g., "I've attached my resume for your review" or "Please find my resume attached")

APPROACH:
- This is NETWORKING, not job application
- Start with networking language: "I've been following", "I wanted to connect", "I noticed your company"
- NEVER use: "I'm applying for", "I'm interested in applying", "I'm thrilled to apply"
- ALWAYS generate completely unique content - never repeat phrases, openers, or structures

${experienceLevel === 'intern' ? 
  'INTERN: Emphasize eagerness to learn, academic projects, enthusiasm for gaining experience. Use language like "I\'m excited to learn", "I\'m eager to contribute".' :
  'FRESHER: Emphasize recent graduation, academic excellence, readiness to contribute. Use language like "I\'m ready to contribute", "I\'m confident in my ability".'}

${tone === 'tldr' ? 
  'TLDR: Generate everything in TLDR style - be innovative, fun, and memorable throughout BOTH paragraphs while staying professional. Use creative tech metaphors, show personality, and make the email stand out. Start with a unique, creative opener like "TL;DR: I\'m the developer your team didn\'t know they needed" or "TL;DR: Ready to turn your tech stack into a powerhouse?" - be creative and memorable. In BOTH paragraphs, use phrases like "code wizard", "bug slayer", "performance optimizer", creative analogies, and tech metaphors. Use bullet points whenever necessary to highlight key skills and achievements. Make HR think "this person is creative and would bring fresh energy to our team". NEVER use the same opener twice - always create something completely new and unique.' :
  tone === 'casual' ?
  'CASUAL: Generate everything in casual, friendly style - be approachable, conversational, and warm while maintaining professionalism. Use friendly language like "I\'d love to", "excited about", "great fit". Write as if talking to a friendly colleague. Use contractions (I\'m, I\'d, you\'re) naturally. Keep it relaxed but respectful. Show genuine interest and enthusiasm without being over-the-top.' :
  tone === 'formal' ?
  'FORMAL: Generate everything in formal, executive style - be polished, sophisticated, and highly professional. Use formal language, complete sentences, no contractions. Emphasize credentials, achievements, and qualifications with precision. Write as if addressing C-level executives. Use phrases like "I would be honored", "distinguished background", "extensive experience". Maintain dignity and respect throughout.' :
  tone === 'enthusiastic' ?
  'ENTHUSIASTIC: Generate everything with high energy and genuine excitement - be passionate, motivated, and eager while staying professional. Use energetic language like "thrilled", "excited", "passionate about", "can\'t wait to". Show genuine enthusiasm for the company and role. Use exclamation marks sparingly but effectively. Convey positive energy that\'s infectious but not overwhelming. Make them feel your genuine interest and drive.' :
  tone === 'confident' ?
  'CONFIDENT: Generate everything with strong confidence and directness - be assertive, self-assured, and results-focused. Use confident language like "I will", "I excel at", "proven track record", "consistently deliver". State achievements boldly without arrogance. Be direct and to-the-point. Show you know your worth and what you bring. No hedging or uncertain language - be clear and decisive.' :
  'PROFESSIONAL: Generate everything in professional style - be results-focused, confident, specific. Use clear value propositions and bullet points whenever necessary to highlight key skills and achievements.'}

TONE-SPECIFIC EXAMPLES & CRITICAL NOTES:

${tone === 'professional' ? `
PROFESSIONAL EXAMPLES:
- Opener: "I've been following [Company]'s work in [industry] and wanted to connect with your talent team."
- Body: "With expertise in [skills], I've successfully [achievement]. My background in [area] has equipped me to deliver measurable results."
- Closing: "I'd welcome the opportunity to discuss how my experience aligns with your team's goals."
` : tone === 'tldr' ? `
TLDR EXAMPLES:
- Opener: "TL;DR: I'm the full-stack developer who turns coffee into scalable solutions ☕→🚀"
- Body: "Think of me as your team's Swiss Army knife for development - React wizard by day, Node.js ninja by night. I've shipped [achievement] and debugged code that would make senior devs cry."
- Style: Keep the creative energy THROUGHOUT both paragraphs - no dropping into boring professional tone midway

CRITICAL FOR TLDR:
- First paragraph: Creative TL;DR opener + fun tech metaphors
- Second paragraph: MORE creative language, tech analogies, personality
- Both paragraphs = same high creative energy
- Use phrases: "code wizard", "bug slayer", "performance optimizer"
` : tone === 'casual' ? `
CASUAL EXAMPLES:
- Opener: "Hey there! I've been following [Company]'s journey and I'd love to connect with your team."
- Body: "I'm pretty excited about what you're building. I've got experience in [skills] and honestly, I think I'd be a great fit for your team."
- Closing: "Would love to chat more about this! Let me know if you're interested."

CRITICAL FOR CASUAL:
- Use contractions naturally (I'm, I'd, you're, can't, won't)
- Write like you're emailing a friend (but keep it professional)
- Use "pretty", "really", "honestly" to sound conversational
- Avoid stiff formal language
` : tone === 'formal' ? `
FORMAL EXAMPLES:
- Opener: "I am writing to express my interest in connecting with your distinguished talent acquisition team."
- Body: "I possess extensive experience in [skills] and have consistently demonstrated excellence in [area]. My credentials include [achievement], which I believe would be of significant value to your organization."
- Closing: "I would be honored to discuss how my qualifications align with your organization's objectives."

CRITICAL FOR FORMAL:
- NO contractions (use "I am" not "I'm", "I would" not "I'd")
- Use elevated vocabulary: "possess", "demonstrate", "credentials"
- Complete, sophisticated sentences
- Address as if writing to executives or board members
` : tone === 'enthusiastic' ? `
ENTHUSIASTIC EXAMPLES:
- Opener: "I'm so excited to reach out! I've been following [Company]'s incredible work and I'm passionate about what you're building."
- Body: "I absolutely love working with [skills]! I've had the amazing opportunity to [achievement], and I'm thrilled about the possibility of bringing that energy to your team."
- Closing: "I can't wait to hear from you and discuss how I can contribute to your awesome team!"

CRITICAL FOR ENTHUSIASTIC:
- Use energetic words: "excited", "thrilled", "passionate", "love", "amazing", "incredible"
- 1-2 exclamation marks per paragraph (don't overdo it!)
- Show genuine emotion and eagerness
- Convey infectious positive energy
` : tone === 'confident' ? `
CONFIDENT EXAMPLES:
- Opener: "I'm reaching out because I know I can deliver exceptional value to your team."
- Body: "I excel at [skills] and consistently deliver results. My track record includes [achievement] - I don't just meet expectations, I exceed them."
- Closing: "I'm confident we should talk. I know what I bring to the table and I'm ready to prove it."

CRITICAL FOR CONFIDENT:
- Use strong, assertive language: "I will", "I excel", "I consistently"
- State achievements boldly (no "I think" or "maybe")
- Be direct - no hedging, no uncertainty
- Show you know your worth without arrogance
` : `
PROFESSIONAL EXAMPLES:
- Standard networking approach with clear value propositions
`}

Return ONLY this JSON format:
{
  "subject": "Email subject (max 70 chars)",
  "body": "Complete email with salutation, 2 paragraphs with bullet points, links section, closing",
  "reason": "Brief approach explanation"
}`;

  // Enhanced retry logic with different models and better debugging
  let resp;
  let attempts = 0;
  const maxAttempts = 5;
  const modelsToTry = [model, 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];
  
  while (attempts < maxAttempts) {
    const currentModel = modelsToTry[attempts % modelsToTry.length];
    
    try {
      resp = await groq.chat.completions.create({
        model: currentModel,
        messages: [
          { 
            role: 'system', 
            content: `You are a cold email writer for talent acquisition outreach. Return ONLY valid JSON with subject, body, and reason fields.

PURPOSE: NETWORKING, not job applications. Position sender as valuable to know.

FORMAT: Proper email with salutation, 2 paragraphs (120-160 words), bullet points, links section, closing.

REQUIREMENTS:
- Include ALL provided context (skills, projects, education, availability, location)
- Education MUST be included if provided
- If resume is attached, MUST mention it in the email body (e.g., "I've attached my resume for your review")
- Start with networking language: "I've been following", "I wanted to connect"
- NEVER use: "I'm applying for", "I'm interested in applying", "I'm thrilled to apply"
- Be unique and creative every time - NEVER repeat the same opener or phrases

TONE GUIDELINES:

PROFESSIONAL: Results-focused, confident, specific. Use clear value propositions and bullet points to highlight key skills and achievements.

TLDR: Innovative, fun, and memorable throughout BOTH paragraphs while staying professional. Use creative tech metaphors, show personality. Start with unique, creative openers like "TL;DR: I'm the developer your team didn't know they needed" or "TL;DR: Ready to turn your tech stack into a powerhouse?". Use phrases like "code wizard", "bug slayer", "performance optimizer". Make HR think "this person is creative and would bring fresh energy". NEVER repeat the same opener.

CASUAL: Approachable, conversational, warm while maintaining professionalism. Use friendly language like "I'd love to", "excited about", "great fit". Write as if talking to a friendly colleague. Use contractions (I'm, I'd, you're) naturally. Keep it relaxed but respectful.

FORMAL: Polished, sophisticated, highly professional. Use formal language, complete sentences, no contractions. Emphasize credentials and qualifications with precision. Write as if addressing C-level executives. Use phrases like "I would be honored", "distinguished background", "extensive experience".

ENTHUSIASTIC: High energy and genuine excitement - passionate, motivated, eager while staying professional. Use energetic language like "thrilled", "excited", "passionate about", "can't wait to". Show genuine enthusiasm for the company and role. Use exclamation marks sparingly but effectively. Convey infectious positive energy.

CONFIDENT: Strong confidence and directness - assertive, self-assured, results-focused. Use confident language like "I will", "I excel at", "proven track record", "consistently deliver". State achievements boldly without arrogance. Be direct and to-the-point. Show you know your worth. No hedging or uncertain language.` 
          },
          { role: 'user', content: composePrompt },
        ],
        temperature: typeof opts.temperature === 'number' ? opts.temperature : (tone === 'tldr' ? 0.7 : 0.6),
        max_tokens: typeof opts.maxTokens === 'number' ? opts.maxTokens : (tone === 'tldr' ? 600 : 800),
      });
      
      const text = resp?.choices?.[0]?.message?.content || '';
      
      if (text && text.trim() !== '') {
        const parsed = safeJsonParse(text);
        
        if (parsed && typeof parsed === 'object' && parsed.subject && parsed.body && 
            parsed.subject.trim() !== '' && parsed.body.trim() !== '' && 
            validateTwoParagraphs(parsed.body)) {
          return parsed;
        } else {
          
          // Try to extract content manually if JSON parsing failed
          const manualExtract = extractEmailContentManually(text);
          if (manualExtract && manualExtract.subject && manualExtract.body && 
              validateTwoParagraphs(manualExtract.body)) {
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


router.post('/generate', upload.single('resumeFile'), checkUsageAndPayment, async (req, res) => {
  try {
    // Log generation type and usage
    if (req.isFreeGeneration) {
      console.log('Free generation used:', {
        usageId: req.usage._id,
        freeGenerationsUsed: req.usage.freeGenerationsUsed,
        remainingFree: req.usage.getRemainingFreeGenerations()
      });
    } else {
      console.log('Paid generation used:', {
        paymentId: req.payment._id,
        amount: req.payment.amount,
        currency: req.payment.currency,
        paidAt: req.payment.paidAt,
        usageId: req.usage._id
      });
    }

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

    // Handle both JSON and FormData
    const body = req.body || {};
    const resumeFile = req.file;

    const {
      to = '',
      skills = '',
      role = 'HR',
      company = '',
      jobTitle = '',
      projects = '',
      education = '',
      portfolioLinks = '',
      fitSummary = '',
      ctaPreference = '',
      tone = 'professional',
      experienceLevel = 'fresher',
      availability = '',
      location = '',
      lowCost = false,
    } = body;

    // Process resume file if provided (only once, lightweight)
    const hasResume = !!resumeFile;
    const resumeFileName = resumeFile ? resumeFile.originalname : '';
    if (resumeFile) {
      console.log('Resume file received:', resumeFile.originalname, 'Size:', resumeFile.size);
    }


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
    const fallbackModel = 'llama-3.3-70b-versatile';
    let model = primaryModel;
    
    // Test API key with a simple call and retry with different models if needed
    let modelWorking = false;
    const modelsToTry = [primaryModel, fallbackModel, 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];
    
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
    const lengthBounds = [120, 160];
    
    // Tone-specific token and temperature settings for unique outputs
    let maxTokens, temperature;
    
    if (lowCost) {
      maxTokens = 1000;
      temperature = 0.8;
    } else {
      switch(tone) {
        case 'tldr':
          maxTokens = 600;
          temperature = 0.8; // High creativity for fun, unique metaphors
          break;
        case 'casual':
          maxTokens = 700;
          temperature = 0.7; // Moderate creativity for conversational tone
          break;
        case 'formal':
          maxTokens = 800;
          temperature = 0.4; // Low creativity for precise, polished language
          break;
        case 'enthusiastic':
          maxTokens = 750;
          temperature = 0.75; // Higher creativity for energetic, varied expressions
          break;
        case 'confident':
          maxTokens = 750;
          temperature = 0.5; // Moderate-low for assertive, direct language
          break;
        case 'professional':
        default:
          maxTokens = 800;
          temperature = 0.6; // Balanced for professional tone
          break;
      }
    }

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
          projects,
          education,
          portfolioLinks,
          fitSummary,
          ctaPreference,
          tone,
          experienceLevel,
          availability,
          location,
          hasResume,
          resumeFileName,
          purpose: 'compose',
          opts: { maxTokens, temperature }
        });
        
        // If we got a valid draft with 2 paragraphs, break out of retry loop
        if (draft && draft.subject && draft.body && draft.subject.trim() !== '' && 
            draft.body.trim() !== '' && validateTwoParagraphs(draft.body)) {
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
    
    // If we still don't have a valid draft with 2 paragraphs, throw error
    if (!draft || !draft.subject || !draft.body || draft.subject.trim() === '' || 
        draft.body.trim() === '' || !validateTwoParagraphs(draft.body)) {
      throw new Error('Failed to generate valid email content with 2 paragraphs after multiple attempts');
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
          projects,
          education,
          portfolioLinks,
          fitSummary,
          ctaPreference,
          tone,
          experienceLevel,
          hasResume: false, // Skip resume for refinement to speed up
          resumeFileName: '',
          availability,
          location,
          purpose: 'refine',
          opts: { maxTokens: maxTokens + 200, temperature: tone === 'tldr' ? 0.7 : temperature + 0.2 }
        });
        
        if (refine && refine.subject && refine.body && refine.subject.trim() !== '' && 
            refine.body.trim() !== '' && validateTwoParagraphs(refine.body)) {
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
          projects,
          education,
          portfolioLinks,
          fitSummary,
          ctaPreference,
          tone,
          experienceLevel,
          hasResume, // Include resume for final attempt
          resumeFileName,
          availability,
          location,
          purpose: 'final_attempt',
          opts: { maxTokens: 1000, temperature: tone === 'tldr' ? 0.7 : 0.8 }
        });
        
        if (finalAttempt && finalAttempt.subject && finalAttempt.body && 
            validateTwoParagraphs(finalAttempt.body)) {
          draft = finalAttempt;
        } else {
          throw new Error('AI failed to generate valid email content with 2 paragraphs after multiple attempts');
        }
      } catch (finalError) {
        throw new Error(`AI email generation failed: ${finalError.message}. Please try again.`);
      }
    }

    const subjectOut = String(draft.subject || '').trim().slice(0, 120) || `Application — ${jobTitle || 'Role'} at ${company || 'your team'}`.slice(0, 70);
    const bodyOut = String(draft.body || '').trim().slice(0, 4000);

    // Track usage
    if (req.isFreeGeneration) {
      await req.usage.useFreeGeneration();
    } else {
      await req.usage.usePaidGeneration(req.payment.amount);
    }

    // Increment daily counter - COMMENTED OUT FOR TESTING
    // if (req.session) {
    //   req.session[sessionKey] = (currentCount + 1).toString();
    // }

    res.json({ 
      to, 
      subject: subjectOut, 
      body: bodyOut, 
      reason: draft.reason,
      usage: req.usage.getUsageSummary(),
      isFreeGeneration: req.isFreeGeneration,
      payment: req.isFreeGeneration ? null : {
        id: req.payment._id,
        amount: req.payment.amount,
        currency: req.payment.currency,
        paidAt: req.payment.paidAt
      }
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

// Check usage status
router.get('/usage-status', async (req, res) => {
  try {
    // Use authenticated user's email if available, otherwise fallback to session ID
    const userEmail = req.session?.userProfile?.email;
    const sessionId = req.sessionID || 
      `${req.ip}_${req.get('User-Agent')?.slice(0, 50) || 'unknown'}`;
    
    const usage = await Usage.getOrCreateUsage(sessionId, userEmail);
    
    res.json({
      success: true,
      usage: usage.getUsageSummary()
    });
  } catch (error) {
    console.error('Usage status check error:', error);
    res.status(500).json({
      error: 'Failed to check usage status',
      message: error.message
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
      education = '',
      portfolioLinks = '',
      experienceLevel = 'fresher',
    } = req.body || {};

    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (!groqApiKey) {
      return res.status(200).json({
        skills: skills || '',
        projects: '',
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
    
    const prompt = `Suggest improvements for a networking email to talent acquisition teams.

CONTEXT: Role: ${String(role).trim().slice(0, 30) || 'HR'} | Company: ${String(company).trim().slice(0, 50) || 'a company'} | Job: ${String(jobTitle).trim().slice(0, 50) || 'a position'} | Skills: ${String(skills).trim().slice(0, 100) || 'various skills'} | Education: ${String(education).trim().slice(0, 100) || 'relevant educational background'} | Experience: ${experienceLevel}

${experienceLevel === 'intern' ? 
  'INTERN: Focus on learning opportunities, academic projects, eagerness to contribute.' :
  'FRESHER: Focus on recent graduation, academic excellence, readiness to contribute.'}

Return ONLY this JSON:
{
  "skills": "refined, relevant skills list",
  "projects": "1-3 notable projects with brief descriptions", 
  "education": "relevant educational background and qualifications",
  "fitSummary": "1 sentence explaining why you're a good fit",
  "portfolioLinks": "LinkedIn profile and relevant portfolio or work samples",
  "ctaPreference": "suggested call-to-action",
  "tone": "professional",
  "experienceLevel": "${experienceLevel}",
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
      projects: String(suggestions.projects || ''),
      education: String(suggestions.education || education || ''),
      fitSummary: String(suggestions.fitSummary || ''),
      portfolioLinks: String(suggestions.portfolioLinks || portfolioLinks || ''),
      ctaPreference: String(suggestions.ctaPreference || ''),
      tone: ['professional','tldr'].includes(String(suggestions.tone)) ? suggestions.tone : 'professional',
      experienceLevel: ['fresher','intern'].includes(String(suggestions.experienceLevel)) ? suggestions.experienceLevel : experienceLevel,
      availability: String(suggestions.availability || ''),
      location: String(suggestions.location || ''),
    };
    
    res.json(out);
  } catch (err) {
    // Return default suggestions instead of error
    res.status(200).json({
      skills: '',
      projects: '',
      education: '',
      fitSummary: '',
      portfolioLinks: '',
      ctaPreference: '',
      tone: 'professional',
      experienceLevel: 'fresher',
      availability: '',
      location: ''
    });
  }
});

// Send an email using the unified EmailProvider (Gmail or Outlook)
router.post('/send', upload.single('resumeFile'), async (req, res) => {
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
    
    const { to, subject = 'Hello', body = '' } = req.body || {};
    const resumeFile = req.file;
    
    if (!to) return res.status(400).json({ error: 'Missing recipient email (to)' });

    // Use the unified EmailProvider
    const emailProvider = new EmailProvider(req.session);

    // For now, EmailProvider doesn't support attachments via the unified interface
    // If attachment is required and provider is Outlook, we'll need special handling
    if (resumeFile && provider === 'microsoft') {
      return res.status(400).json({ 
        error: 'Attachments are not yet supported for Outlook accounts',
        message: 'Please remove the attachment or use a Gmail account'
      });
    }

    // Send the email
    await emailProvider.sendEmail({
      to,
      subject,
      body: body || 'Hello',
    });
    
    res.json({ sent: true });
  } catch (err) {
    console.error('Cold email send error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});


module.exports = router;


