/**
 * Business Context Processor
 * Enhances AI understanding for business/company email scenarios
 */

// Business-relevant keywords and patterns
const BUSINESS_PATTERNS = {
  urgent: /\b(urgent|asap|immediately|critical|emergency|time[- ]?sensitive|deadline|priority|pressing)\b/gi,
  meeting: /\b(meeting|call|conference|zoom|teams|schedule|calendar|appointment|sync|standup|discussion)\b/gi,
  financial: /\b(invoice|payment|quote|proposal|budget|cost|price|billing|expense|refund|transaction|purchase order|PO)\b/gi,
  contract: /\b(contract|agreement|terms|NDA|non[- ]?disclosure|legal|clause|amendment|renewal|signature)\b/gi,
  deadline: /\b(deadline|due date|by\s+\w+day|EOD|end of day|COB|close of business|before|until)\b/gi,
  actionRequired: /\b(action required|please\s+\w+|need your|waiting for|approval|approve|review|confirm|respond|reply)\b/gi,
  followUp: /\b(follow[- ]?up|follow[- ]?ing up|checking in|circling back|reminder|any update)\b/gi,
  client: /\b(client|customer|vendor|partner|stakeholder|prospect|lead)\b/gi,
  project: /\b(project|initiative|campaign|milestone|deliverable|sprint|roadmap|timeline)\b/gi,
  complaint: /\b(complaint|issue|problem|concern|dissatisfied|unhappy|disappointed|frustrated)\b/gi,
};

// Extract amounts/numbers
const AMOUNT_PATTERNS = [
  /\$[\d,]+(?:\.\d{2})?/g,                    // $1,234.56
  /\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|dollars?|euros?|pounds?)\b/gi,
  /\b(?:USD|EUR|GBP)\s*\d+(?:,\d{3})*(?:\.\d{2})?\b/gi,
];

// Date patterns
const DATE_PATTERNS = [
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,        // 12/31/2024, 12-31-24
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}\b/gi,  // January 15, 2024
  /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}\b/gi,     // 15 January 2024
  /\b(?:tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month)\b/gi,
];

/**
 * Analyzes email content for business context
 * @param {Object} email - Email object with subject, from, body, etc.
 * @returns {Object} Business context metadata
 */
function analyzeBusinessContext(email) {
  const text = `${email.subject || ''} ${email.bodyText || ''} ${email.snippet || ''}`.toLowerCase();
  
  const context = {
    // Urgency level (0-10)
    urgencyScore: 0,
    
    // Categories (can have multiple)
    categories: [],
    
    // Extracted entities
    amounts: [],
    dates: [],
    emails: [],
    phoneNumbers: [],
    
    // Intent signals
    requiresAction: false,
    requiresResponse: false,
    isFollowUp: false,
    
    // Business type
    businessType: null, // 'financial', 'legal', 'client_communication', 'internal', 'meeting'
    
    // Sentiment
    sentiment: 'neutral', // 'positive', 'negative', 'neutral', 'urgent'
    
    // Key topics
    topics: [],
    
    // Priority (calculated from multiple factors)
    priority: 'medium' // 'critical', 'high', 'medium', 'low'
  };
  
  // Detect categories and calculate urgency
  if (BUSINESS_PATTERNS.urgent.test(text)) {
    context.urgencyScore += 5;
    context.categories.push('urgent');
    context.sentiment = 'urgent';
  }
  
  if (BUSINESS_PATTERNS.meeting.test(text)) {
    context.categories.push('meeting');
    context.businessType = 'meeting';
    context.requiresResponse = true;
    context.urgencyScore += 2;
  }
  
  if (BUSINESS_PATTERNS.financial.test(text)) {
    context.categories.push('financial');
    context.businessType = context.businessType || 'financial';
    context.urgencyScore += 3;
  }
  
  if (BUSINESS_PATTERNS.contract.test(text)) {
    context.categories.push('contract');
    context.businessType = 'legal';
    context.urgencyScore += 4;
  }
  
  if (BUSINESS_PATTERNS.deadline.test(text)) {
    context.categories.push('deadline');
    context.requiresAction = true;
    context.urgencyScore += 4;
  }
  
  if (BUSINESS_PATTERNS.actionRequired.test(text)) {
    context.requiresAction = true;
    context.requiresResponse = true;
    context.urgencyScore += 3;
  }
  
  if (BUSINESS_PATTERNS.followUp.test(text)) {
    context.isFollowUp = true;
    context.categories.push('follow-up');
  }
  
  if (BUSINESS_PATTERNS.client.test(text)) {
    context.categories.push('client');
    context.businessType = context.businessType || 'client_communication';
  }
  
  if (BUSINESS_PATTERNS.project.test(text)) {
    context.categories.push('project');
    context.topics.push('project_related');
  }
  
  if (BUSINESS_PATTERNS.complaint.test(text)) {
    context.sentiment = 'negative';
    context.categories.push('complaint');
    context.urgencyScore += 4;
    context.requiresResponse = true;
  }
  
  // Extract amounts
  for (const pattern of AMOUNT_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      context.amounts.push(...matches);
      context.urgencyScore += 1; // Financial mentions add urgency
    }
  }
  
  // Extract dates
  for (const pattern of DATE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      context.dates.push(...matches);
    }
  }
  
  // Extract emails
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailMatches = text.match(emailPattern);
  if (emailMatches) {
    context.emails.push(...emailMatches);
  }
  
  // Extract phone numbers
  const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\b\(\d{3}\)\s*\d{3}[-.]?\d{4}\b/g;
  const phoneMatches = text.match(phonePattern);
  if (phoneMatches) {
    context.phoneNumbers.push(...phoneMatches);
  }
  
  // Calculate priority based on urgency score
  if (context.urgencyScore >= 8) {
    context.priority = 'critical';
  } else if (context.urgencyScore >= 5) {
    context.priority = 'high';
  } else if (context.urgencyScore >= 2) {
    context.priority = 'medium';
  } else {
    context.priority = 'low';
  }
  
  // Detect sentiment from common phrases
  if (/\b(thank|thanks|appreciate|great|excellent|wonderful|pleased|happy)\b/i.test(text)) {
    if (context.sentiment === 'neutral') context.sentiment = 'positive';
  }
  if (/\b(sorry|apologize|regret|mistake|error|problem|issue)\b/i.test(text)) {
    if (context.sentiment === 'neutral') context.sentiment = 'negative';
  }
  
  // If internal email (common company domains or no client signals)
  const isInternal = /@(company|internal|corp)\./i.test(email.from || '') || 
                     (!context.categories.includes('client') && !context.categories.includes('contract'));
  if (isInternal && !context.businessType) {
    context.businessType = 'internal';
  }
  
  return context;
}

/**
 * Extracts action items from email text
 * @param {string} text - Email text content
 * @returns {Array} List of action items
 */
function extractActionItems(text) {
  const actionItems = [];
  const lines = text.split(/[\n\r]+/);
  
  // Patterns that indicate action items
  const actionPatterns = [
    /^[-*•]\s*(.+)/,  // Bullet points
    /^\d+\.\s*(.+)/,  // Numbered lists
    /\b(please|kindly|could you|can you|would you)\s+(.{10,100})/gi,
    /\b(need to|have to|must|should)\s+(.{10,100})/gi,
    /\b(action|task|todo|to-do):\s*(.+)/gi,
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 5 || trimmed.length > 200) continue;
    
    for (const pattern of actionPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const item = (match[1] || match[2] || match[0]).trim();
        if (item.length > 10 && item.length < 200) {
          actionItems.push({
            text: item,
            confidence: match.index === 0 ? 'high' : 'medium'
          });
          break; // Only add once per line
        }
      }
    }
  }
  
  // Deduplicate similar action items
  const unique = [];
  for (const item of actionItems) {
    const isDuplicate = unique.some(u => 
      u.text.toLowerCase().includes(item.text.toLowerCase().slice(0, 30)) ||
      item.text.toLowerCase().includes(u.text.toLowerCase().slice(0, 30))
    );
    if (!isDuplicate) {
      unique.push(item);
    }
  }
  
  return unique.slice(0, 5); // Return top 5 action items
}

/**
 * Extracts key business entities (companies, people, projects)
 * @param {string} text - Email text content
 * @returns {Object} Extracted entities
 */
function extractBusinessEntities(text) {
  const entities = {
    companies: [],
    people: [],
    projects: [],
    documents: []
  };
  
  // Common company suffixes
  const companySuffixes = /\b([A-Z][A-Za-z0-9]+)\s+(Inc|LLC|Ltd|Corporation|Corp|Company|Co|Limited|LP|LLP|GmbH)\b/g;
  const companyMatches = text.match(companySuffixes);
  if (companyMatches) {
    entities.companies.push(...companyMatches.slice(0, 5));
  }
  
  // Proper nouns (basic name detection)
  const properNouns = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g);
  if (properNouns) {
    // Filter common false positives
    const filtered = properNouns.filter(name => 
      !/(Dear|From|To|Subject|Date|Hello|Best|Kind|Thank|Please)/i.test(name)
    );
    entities.people.push(...filtered.slice(0, 5));
  }
  
  // Project names (often capitalized or in quotes)
  const projectPatterns = [
    /\bproject\s+([A-Z][A-Za-z0-9\s]+)/gi,
    /"([A-Z][A-Za-z0-9\s]{3,30})"/g,
    /\b([A-Z][A-Z0-9]{2,})\s+(?:project|initiative|campaign)/gi
  ];
  
  for (const pattern of projectPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      entities.projects.push(...matches.slice(0, 3));
    }
  }
  
  // Document references
  const docPatterns = [
    /\b[\w-]+\.(?:pdf|doc|docx|xlsx|xls|ppt|pptx)\b/gi,
    /\b(?:invoice|contract|agreement|proposal|report)\s*#?\s*[\w-]+/gi
  ];
  
  for (const pattern of docPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      entities.documents.push(...matches.slice(0, 5));
    }
  }
  
  return entities;
}

/**
 * Generates a business-focused summary prompt
 * @param {Object} email - Email object
 * @param {Object} context - Business context from analyzeBusinessContext
 * @returns {string} Enhanced prompt for LLM
 */
function generateBusinessPrompt(email, context) {
  const urgencyText = context.priority === 'critical' ? ' [CRITICAL]' : 
                      context.priority === 'high' ? ' [HIGH PRIORITY]' : '';
  
  const categoriesText = context.categories.length > 0 ? 
    `\nCategories: ${context.categories.join(', ')}` : '';
  
  const amountsText = context.amounts.length > 0 ?
    `\nFinancial Amounts: ${context.amounts.join(', ')}` : '';
  
  const datesText = context.dates.length > 0 ?
    `\nImportant Dates: ${context.dates.join(', ')}` : '';
  
  return `${urgencyText}${categoriesText}${amountsText}${datesText}
  
Business Type: ${context.businessType || 'general'}
Requires Action: ${context.requiresAction ? 'YES' : 'No'}
Requires Response: ${context.requiresResponse ? 'YES' : 'No'}
Sentiment: ${context.sentiment}`;
}

/**
 * Batch analyze multiple emails for aggregate insights
 * @param {Array} emails - Array of email objects
 * @returns {Object} Aggregate business insights
 */
function analyzeEmailBatch(emails) {
  const insights = {
    totalEmails: emails.length,
    urgentCount: 0,
    actionRequiredCount: 0,
    unansweredClientEmails: 0,
    upcomingDeadlines: [],
    totalAmountsMentioned: [],
    topSenders: {},
    categoryBreakdown: {},
    averageResponseTime: null,
    criticalItems: []
  };
  
  for (const email of emails) {
    const context = analyzeBusinessContext(email);
    
    if (context.priority === 'critical' || context.priority === 'high') {
      insights.urgentCount++;
      if (context.priority === 'critical') {
        insights.criticalItems.push({
          subject: email.subject,
          from: email.from,
          date: email.date,
          reason: context.categories.join(', ')
        });
      }
    }
    
    if (context.requiresAction) {
      insights.actionRequiredCount++;
    }
    
    if (context.categories.includes('client') && !email.snippet?.includes('Re:')) {
      insights.unansweredClientEmails++;
    }
    
    if (context.amounts.length > 0) {
      insights.totalAmountsMentioned.push(...context.amounts);
    }
    
    if (context.dates.length > 0) {
      insights.upcomingDeadlines.push(...context.dates);
    }
    
    // Track senders
    const sender = email.from?.match(/<(.+?)>/)?.[1] || email.from || 'unknown';
    insights.topSenders[sender] = (insights.topSenders[sender] || 0) + 1;
    
    // Track categories
    for (const cat of context.categories) {
      insights.categoryBreakdown[cat] = (insights.categoryBreakdown[cat] || 0) + 1;
    }
  }
  
  // Sort top senders
  insights.topSenders = Object.entries(insights.topSenders)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  
  return insights;
}

module.exports = {
  analyzeBusinessContext,
  extractActionItems,
  extractBusinessEntities,
  generateBusinessPrompt,
  analyzeEmailBatch
};

