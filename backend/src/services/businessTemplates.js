/**
 * Business Email Templates
 * Professional templates for common business scenarios
 */

const TEMPLATES = {
  // Meeting requests
  meeting: {
    requestMeeting: (context) => ({
      subject: `Meeting Request: ${context.topic || 'Discussion'}`,
      body: `Hi ${context.name || 'there'},

I hope this email finds you well.

I would like to schedule a meeting to discuss ${context.topic || 'an important matter'}${context.details ? `. Specifically, ${context.details}` : ''}.

${context.proposedTimes || 'Would you be available sometime this week or next?'} The meeting should take approximately ${context.duration || '30 minutes'}.

Please let me know what works best for your schedule.

Best regards`
    }),
    
    confirmMeeting: (context) => ({
      subject: `Re: Meeting Confirmation - ${context.topic || 'Discussion'}`,
      body: `Hi ${context.name || 'there'},

Thank you for scheduling the meeting.

I confirm our meeting on ${context.date || '[DATE]'} at ${context.time || '[TIME]'}${context.location ? ` at ${context.location}` : ''}.

${context.agenda ? `\nAgenda:\n${context.agenda}\n` : ''}
Looking forward to our discussion.

Best regards`
    }),
    
    rescheduleMeeting: (context) => ({
      subject: `Re: Request to Reschedule - ${context.topic || 'Our Meeting'}`,
      body: `Hi ${context.name || 'there'},

I apologize, but I need to reschedule our meeting originally planned for ${context.originalDate || '[DATE]'}.

${context.reason || 'Due to an unexpected conflict,'} would it be possible to meet ${context.newProposal || 'at an alternative time'}?

I apologize for any inconvenience this may cause.

Best regards`
    })
  },
  
  // Follow-ups
  followUp: {
    gentle: (context) => ({
      subject: `Re: Following Up - ${context.topic || 'Previous Email'}`,
      body: `Hi ${context.name || 'there'},

I wanted to follow up on my previous email regarding ${context.topic || 'our discussion'}.

${context.context || 'I understand you may be busy, but I would appreciate your thoughts when you have a moment.'}

${context.deadline ? `This is needed by ${context.deadline} if possible.\n\n` : ''}Please let me know if you need any additional information from me.

Best regards`
    }),
    
    urgent: (context) => ({
      subject: `URGENT: Follow Up Required - ${context.topic || 'Important Matter'}`,
      body: `Hi ${context.name || 'there'},

I'm following up on my previous email as this matter is time-sensitive.

${context.context || 'We need your input to move forward'} and the deadline is ${context.deadline || 'approaching quickly'}.

Could you please provide an update at your earliest convenience?

${context.impact ? `\nImpact: ${context.impact}\n` : ''}Thank you for your prompt attention to this matter.

Best regards`
    }),
    
    payment: (context) => ({
      subject: `Payment Follow-Up - Invoice ${context.invoiceNumber || '#[NUMBER]'}`,
      body: `Hi ${context.name || 'there'},

I'm following up regarding invoice ${context.invoiceNumber || '#[NUMBER]'} dated ${context.date || '[DATE]'} for ${context.amount || '[AMOUNT]'}.

${context.daysOverdue ? `This invoice is now ${context.daysOverdue} days overdue. ` : ''}According to our records, we have not yet received payment.

Could you please confirm the status of this payment? If there are any issues or questions regarding this invoice, please let me know so we can resolve them promptly.

Thank you for your attention to this matter.

Best regards`
    })
  },
  
  // Thank you emails
  thankYou: {
    general: (context) => ({
      subject: `Thank You - ${context.topic || ''}`,
      body: `Hi ${context.name || 'there'},

Thank you ${context.for || 'for your time and assistance'}.

${context.details || 'I appreciate your help and look forward to continuing our collaboration.'}

Please don't hesitate to reach out if you need anything from my end.

Best regards`
    }),
    
    meeting: (context) => ({
      subject: `Thank You for the Meeting`,
      body: `Hi ${context.name || 'there'},

Thank you for taking the time to meet with me ${context.when || 'today'}.

${context.keyPoints ? `Key takeaways from our discussion:\n${context.keyPoints}\n\n` : ''}${context.nextSteps ? `Next steps:\n${context.nextSteps}\n\n` : ''}I look forward to our continued collaboration.

Best regards`
    })
  },
  
  // Client communication
  client: {
    statusUpdate: (context) => ({
      subject: `Project Update: ${context.project || '[PROJECT NAME]'}`,
      body: `Hi ${context.name || 'there'},

I wanted to provide you with an update on ${context.project || 'the project'}.

Current Status: ${context.status || '[STATUS]'}

${context.accomplishments ? `\nCompleted:\n${context.accomplishments}\n` : ''}${context.inProgress ? `\nIn Progress:\n${context.inProgress}\n` : ''}${context.upcoming ? `\nUpcoming:\n${context.upcoming}\n` : ''}${context.blockers ? `\nBlockers/Issues:\n${context.blockers}\n` : ''}${context.nextSteps ? `\nNext Steps:\n${context.nextSteps}\n` : ''}Please let me know if you have any questions or concerns.

Best regards`
    }),
    
    deliveryConfirmation: (context) => ({
      subject: `Delivery: ${context.deliverable || '[DELIVERABLE]'}`,
      body: `Hi ${context.name || 'there'},

I'm pleased to inform you that ${context.deliverable || 'the deliverable'} is now complete and ready for your review.

${context.details || 'The files/documents have been shared with you via [METHOD].'}

${context.highlights ? `\nHighlights:\n${context.highlights}\n` : ''}${context.instructions ? `\nInstructions:\n${context.instructions}\n` : ''}Please review at your convenience and let me know if you have any feedback or questions.

Best regards`
    }),
    
    problemResolution: (context) => ({
      subject: `Resolution: ${context.issue || '[ISSUE]'}`,
      body: `Hi ${context.name || 'there'},

Thank you for bringing ${context.issue || 'this matter'} to our attention.

${context.acknowledgment || 'I understand your concern and apologize for any inconvenience this has caused.'}

Resolution:
${context.solution || '[SOLUTION DETAILS]'}

${context.prevention ? `\nWe have taken the following steps to prevent this from happening again:\n${context.prevention}\n` : ''}${context.compensation ? `\n${context.compensation}\n` : ''}Please let me know if this resolves the issue to your satisfaction or if you need any further assistance.

Best regards`
    })
  },
  
  // Quick responses
  quick: {
    acknowledged: (context) => ({
      subject: `Re: ${context.topic || 'Your Email'}`,
      body: `Hi ${context.name || 'there'},

Thank you for your email. I've received your message regarding ${context.topic || 'this matter'} and ${context.action || 'will review it shortly'}.

${context.timeline ? `I will get back to you ${context.timeline}.\n\n` : ''}Best regards`
    }),
    
    approved: (context) => ({
      subject: `Re: Approval - ${context.topic || ''}`,
      body: `Hi ${context.name || 'there'},

This is to confirm that I have reviewed and approved ${context.what || 'your request'}.

${context.nextSteps || 'Please proceed as planned.'}

Best regards`
    }),
    
    declined: (context) => ({
      subject: `Re: ${context.topic || 'Your Request'}`,
      body: `Hi ${context.name || 'there'},

Thank you for ${context.what || 'your request'}.

Unfortunately, ${context.reason || 'I am unable to accommodate this at this time'}.

${context.alternative || 'Please let me know if there is an alternative approach we can consider.'}

Best regards`
    })
  },
  
  // Professional announcements
  announcement: {
    general: (context) => ({
      subject: context.subject || 'Important Announcement',
      body: `Dear ${context.recipients || 'Team'},

${context.announcement || '[ANNOUNCEMENT]'}

${context.details || ''}

${context.effectiveDate ? `Effective Date: ${context.effectiveDate}\n\n` : ''}${context.action ? `Action Required:\n${context.action}\n\n` : ''}${context.questions ? `Questions: ${context.questions}\n\n` : ''}Thank you for your attention.

Best regards`
    })
  }
};

/**
 * Generate email from template
 * @param {string} category - Template category (meeting, followUp, etc.)
 * @param {string} type - Template type within category
 * @param {Object} context - Context variables for template
 * @returns {Object} Generated email with subject and body
 */
function generateFromTemplate(category, type, context = {}) {
  if (!TEMPLATES[category] || !TEMPLATES[category][type]) {
    return null;
  }
  
  const template = TEMPLATES[category][type];
  return template(context);
}

/**
 * Detect best template for given scenario
 * @param {string} intent - User's intent (from AI analysis)
 * @param {string} text - User's input text
 * @param {Object} emailContext - Context from previous emails
 * @returns {Object} Recommended template info
 */
function detectBestTemplate(intent, text, emailContext = {}) {
  const lowerText = text.toLowerCase();
  
  // Meeting-related
  if (/\b(schedule|meeting|call|zoom|sync|discuss)\b/i.test(lowerText)) {
    if (/\b(reschedule|change|move)\b/i.test(lowerText)) {
      return { category: 'meeting', type: 'rescheduleMeeting' };
    } else if (/\b(confirm|confirmation)\b/i.test(lowerText)) {
      return { category: 'meeting', type: 'confirmMeeting' };
    } else {
      return { category: 'meeting', type: 'requestMeeting' };
    }
  }
  
  // Follow-up
  if (/\b(follow[- ]?up|following up|check in|checking in|reminder)\b/i.test(lowerText)) {
    if (/\b(urgent|asap|immediately|critical)\b/i.test(lowerText)) {
      return { category: 'followUp', type: 'urgent' };
    } else if (/\b(payment|invoice|overdue)\b/i.test(lowerText)) {
      return { category: 'followUp', type: 'payment' };
    } else {
      return { category: 'followUp', type: 'gentle' };
    }
  }
  
  // Thank you
  if (/\b(thank|thanks|appreciate)\b/i.test(lowerText)) {
    if (/\b(meeting|call)\b/i.test(lowerText)) {
      return { category: 'thankYou', type: 'meeting' };
    } else {
      return { category: 'thankYou', type: 'general' };
    }
  }
  
  // Quick responses
  if (/\b(approve|approved|approval)\b/i.test(lowerText)) {
    return { category: 'quick', type: 'approved' };
  }
  if (/\b(decline|reject|cannot|unable)\b/i.test(lowerText)) {
    return { category: 'quick', type: 'declined' };
  }
  if (/\b(acknowledge|received|noted)\b/i.test(lowerText)) {
    return { category: 'quick', type: 'acknowledged' };
  }
  
  // Client communication
  if (/\b(status|update|progress)\b/i.test(lowerText) && /\b(project|client)\b/i.test(lowerText)) {
    return { category: 'client', type: 'statusUpdate' };
  }
  if (/\b(deliver|delivery|complete|finished)\b/i.test(lowerText)) {
    return { category: 'client', type: 'deliveryConfirmation' };
  }
  if (/\b(issue|problem|complaint|resolve)\b/i.test(lowerText)) {
    return { category: 'client', type: 'problemResolution' };
  }
  
  return null;
}

/**
 * Get all available templates
 * @returns {Object} All templates organized by category
 */
function getAllTemplates() {
  return TEMPLATES;
}

module.exports = {
  generateFromTemplate,
  detectBestTemplate,
  getAllTemplates,
  TEMPLATES
};

