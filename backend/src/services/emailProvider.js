const { google } = require('googleapis');
const OutlookService = require('./outlookService');
const { getValidMicrosoftToken } = require('../routes/microsoft-auth');
const { htmlToText } = require('html-to-text');

/**
 * Unified Email Provider Service
 * Provides a consistent interface for both Gmail and Outlook
 */
class EmailProvider {
  constructor(session) {
    this.session = session;
    this.provider = session?.userProfile?.provider || 'google';
  }

  /**
   * Get the appropriate service based on provider
   */
  async getService() {
    if (this.provider === 'microsoft') {
      const userId = this.session?.userProfile?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const accessToken = await getValidMicrosoftToken(userId);
      return new OutlookService(accessToken);
    } else {
      // Gmail
      const tokens = this.session?.tokens;
      if (!tokens) {
        throw new Error('Not authenticated');
      }
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'postmessage');
      oauth2Client.setCredentials(tokens);
      return google.gmail({ version: 'v1', auth: oauth2Client });
    }
  }

  /**
   * Fetch emails with unified format
   */
  async fetchEmails(options = {}) {
    const { maxResults = 50, folder = 'inbox', search } = options;

    if (this.provider === 'microsoft') {
      const service = await this.getService();
      const result = await service.fetchEmails({
        maxResults,
        folder,
        search,
      });
      return result.emails;
    } else {
      // Gmail
      const gmail = await this.getService();
      const labelIds = folder === 'sent' ? ['SENT'] : ['INBOX'];
      const q = search || undefined;

      const { data } = await gmail.users.messages.list({
        userId: 'me',
        labelIds,
        q,
        maxResults,
      });

      const messages = data.messages || [];
      const details = await Promise.all(
        messages.map(async (m) => {
          const { data: msg } = await gmail.users.messages.get({
            userId: 'me',
            id: m.id,
            format: 'full',
          });

          const headers = Object.fromEntries((msg.payload?.headers || []).map((h) => [h.name, h.value]));
          const body = this._extractGmailBody(msg.payload);
          const plainText = body.bodyText || htmlToText(body.bodyHtml || '', { wordwrap: false });

          return {
            id: m.id,
            threadId: msg.threadId,
            subject: headers['Subject'] || '',
            from: headers['From'] || '',
            to: headers['To'] || '',
            date: headers['Date'] || '',
            snippet: msg.snippet || '',
            bodyHtml: body.bodyHtml,
            bodyText: plainText,
            isRead: !msg.labelIds?.includes('UNREAD'),
            provider: 'google',
          };
        })
      );

      return details;
    }
  }

  /**
   * Send an email
   */
  async sendEmail(emailData) {
    const { to, subject, body, cc, bcc } = emailData;

    try {
      if (this.provider === 'microsoft') {
        const service = await this.getService();
        await service.sendEmail({ to, subject, body, cc, bcc });
        return { success: true, provider: 'microsoft' };
      } else {
        // Gmail
        const gmail = await this.getService();
        
        const headers = [
          `To: ${to}`,
          cc ? `Cc: ${cc}` : '',
          bcc ? `Bcc: ${bcc}` : '',
          `Subject: ${subject}`,
          'Content-Type: text/plain; charset="UTF-8"',
        ]
          .filter(Boolean)
          .join('\r\n');
        
        const raw = `${headers}\r\n\r\n${body}`;
        const encodedMessage = Buffer.from(raw)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: encodedMessage },
        });

        return { success: true, provider: 'google', messageId: response.data.id };
      }
    } catch (error) {
      console.error('Error sending email:', {
        provider: this.provider,
        error: error.message,
        status: error?.response?.status
      });
      
      // Enhance error message based on error type
      if (error?.response?.status === 401 || error?.code === 'invalid_grant') {
        throw new Error('Authentication expired. Please log in again.');
      } else if (error?.response?.status === 403) {
        throw new Error('Permission denied. Please check your email account permissions.');
      } else if (error?.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few minutes.');
      } else if (error?.response?.status >= 500) {
        throw new Error('Email service temporarily unavailable. Please try again later.');
      } else {
        throw new Error(error.message || 'Failed to send email');
      }
    }
  }

  /**
   * Get a specific email by ID
   */
  async getEmail(messageId) {
    if (this.provider === 'microsoft') {
      const service = await this.getService();
      return await service.getEmail(messageId);
    } else {
      // Gmail
      const gmail = await this.getService();
      const { data } = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const headers = Object.fromEntries((data.payload?.headers || []).map((h) => [h.name, h.value]));
      const body = this._extractGmailBody(data.payload);
      const plainText = body.bodyText || htmlToText(body.bodyHtml || '', { wordwrap: false });

      return {
        id: data.id,
        threadId: data.threadId,
        subject: headers['Subject'] || '',
        from: headers['From'] || '',
        to: headers['To'] || '',
        date: headers['Date'] || '',
        snippet: data.snippet || '',
        bodyHtml: body.bodyHtml,
        bodyText: plainText,
        isRead: !data.labelIds?.includes('UNREAD'),
        provider: 'google',
      };
    }
  }

  /**
   * Extract body from Gmail payload
   */
  _extractGmailBody(payload) {
    if (!payload) return { bodyText: '', bodyHtml: '' };

    const base64UrlDecode = (data) => {
      if (!data) return '';
      let b64 = data.replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4;
      if (pad) b64 += '='.repeat(4 - pad);
      return Buffer.from(b64, 'base64').toString('utf-8');
    };

    // Direct body
    if (payload.body && payload.body.data) {
      const content = base64UrlDecode(payload.body.data);
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
        const content = base64UrlDecode(part.body.data);
        if (!bodyHtml && (part.mimeType || '').includes('text/html')) bodyHtml = content;
        else if (!bodyText && (part.mimeType || '').includes('text/plain')) bodyText = content;
        if (bodyHtml && bodyText) break;
      }
    }
    return { bodyHtml, bodyText };
  }
}

module.exports = EmailProvider;
