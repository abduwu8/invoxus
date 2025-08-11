const { inngest } = require('../client');
const Groq = require('groq-sdk');
const { google } = require('googleapis');
const { htmlToText } = require('html-to-text');
const UserToken = require('../../models/UserToken');

async function gmailForUser(userId) {
  const rec = await UserToken.findOne({ userId });
  if (!rec) throw new Error('No tokens saved for user');
  const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, 'postmessage');
  oauth2.setCredentials(rec.tokens);
  return google.gmail({ version: 'v1', auth: oauth2 });
}

const scheduleFunction = inngest.createFunction(
  { id: 'email-ai-scheduler' },
  { event: 'email/schedule.requested' },
  async ({ event, step }) => {
    const { userId, prompt, timezone = 'UTC', to, subject, body } = event.data;

    const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
    let plan = { times: [] };

    if (groq) {
      const promptText = `You are a scheduler. Convert the user's intent into a JSON plan with fields:
- times: array of ISO datetimes in ${timezone} (max 24 entries)
- subject: string (fallback to provided subject)
- body: string (fallback to provided body)
User intent: ${prompt}`;
      const out = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Return strict JSON only.' },
          { role: 'user', content: promptText },
        ],
        temperature: 0.2,
        max_tokens: 500,
      });
      try { plan = JSON.parse(out.choices?.[0]?.message?.content || '{}'); } catch {}
    }

    const times = Array.isArray(plan.times) && plan.times.length ? plan.times : [];
    const finalSubject = plan.subject || subject;
    const finalBody = plan.body || body;

    for (const when of times) {
      await step.run(`send-at-${when}`, async (s) => {
        await s.sleepUntil(new Date(when).toISOString());
        await s.sendEvent('email/send', { data: { userId, to, subject: finalSubject, body: finalBody } });
      });
    }

    return { scheduled: times.length };
  }
);

const sendEmailFunction = inngest.createFunction(
  { id: 'email-sender' },
  { event: 'email/send' },
  async ({ event }) => {
    const { userId, to, subject, body } = event.data;
    const gmail = await gmailForUser(userId);
    const headers = [
      `To: ${to}`,
      `Subject: ${subject || '(No subject)'}`,
      'Content-Type: text/plain; charset="UTF-8"',
    ].join('\r\n');
    const raw = `${headers}\r\n\r\n${htmlToText(body || '', { wordwrap: false })}`;
    const encoded = Buffer.from(raw).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
    return { sent: true };
  }
);

module.exports = { scheduleFunction, sendEmailFunction };


