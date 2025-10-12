const axios = require('axios');
const { convert } = require('html-to-text');
const microsoftConfig = require('../config/microsoft');

/**
 * Outlook/Microsoft Graph API Service
 * Similar to Gmail service but using Microsoft Graph API
 */
class OutlookService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.graphEndpoint = microsoftConfig.graphEndpoint;
  }

  /**
   * Make authenticated request to Microsoft Graph API
   */
  async makeRequest(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${this.graphEndpoint}${endpoint}`,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`Error making Graph API request to ${endpoint}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Fetch emails from Outlook
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of emails
   */
  async fetchEmails(options = {}) {
    const {
      maxResults = 50,
      pageToken = null,
      folder = 'inbox',
      filter = null,
      search = null,
    } = options;

    try {
      let endpoint = `/me/messages`;  // Use /me/messages instead of /me/mailFolders/inbox/messages
      const params = new URLSearchParams();

      params.append('$top', maxResults.toString());
      params.append('$orderby', 'receivedDateTime desc');
      params.append('$select', 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,bodyPreview,body,conversationId,flag');

      if (filter) {
        params.append('$filter', filter);
      }

      if (search) {
        params.append('$search', `"${search}"`);
      }

      if (pageToken) {
        // Use the nextLink URL directly if provided
        endpoint = pageToken.replace(this.graphEndpoint, '');
      } else {
        endpoint += `?${params.toString()}`;
      }

      console.log('[DEBUG] Fetching from Microsoft Graph:', endpoint);
      const data = await this.makeRequest('get', endpoint);
      console.log('[DEBUG] Microsoft Graph response:', {
        count: data.value?.length || 0,
        hasNextLink: !!data['@odata.nextLink']
      });

      // Transform to unified format (similar to Gmail format)
      const emails = data.value.map(msg => this.transformToUnifiedFormat(msg));

      return {
        emails,
        nextPageToken: data['@odata.nextLink'] || null,
        totalResults: data['@odata.count'] || emails.length,
      };
    } catch (error) {
      console.error('Error fetching Outlook emails:', error);
      throw error;
    }
  }

  /**
   * Get a specific email by ID
   */
  async getEmail(messageId) {
    try {
      console.log('[DEBUG] Fetching email with ID:', messageId);
      const data = await this.makeRequest('get', `/me/messages/${messageId}`);
      console.log('[DEBUG] Email fetched successfully, subject:', data.subject);
      const transformed = this.transformToUnifiedFormat(data);
      return transformed;
    } catch (error) {
      console.error('Error getting Outlook email:', error);
      throw error;
    }
  }

  /**
   * Search emails with query
   */
  async searchEmails(query, maxResults = 20) {
    try {
      const params = new URLSearchParams();
      params.append('$search', `"${query}"`);
      params.append('$top', maxResults.toString());
      params.append('$orderby', 'receivedDateTime desc');
      params.append('$select', 'id,subject,from,toRecipients,receivedDateTime,isRead,bodyPreview,body');

      const data = await this.makeRequest('get', `/me/messages?${params.toString()}`);
      const emails = data.value.map(msg => this.transformToUnifiedFormat(msg));

      return {
        emails,
        nextPageToken: data['@odata.nextLink'] || null,
      };
    } catch (error) {
      console.error('Error searching Outlook emails:', error);
      throw error;
    }
  }

  /**
   * Send email via Outlook
   */
  async sendEmail(emailData) {
    const { to, subject, body, cc = [], bcc = [], replyToMessageId = null } = emailData;

    try {
      const message = {
        subject,
        body: {
          contentType: 'HTML',
          content: body,
        },
        toRecipients: Array.isArray(to) 
          ? to.map(email => ({ emailAddress: { address: email } }))
          : [{ emailAddress: { address: to } }],
      };

      if (cc.length > 0) {
        message.ccRecipients = cc.map(email => ({ emailAddress: { address: email } }));
      }

      if (bcc.length > 0) {
        message.bccRecipients = bcc.map(email => ({ emailAddress: { address: email } }));
      }

      // If replying to a message
      if (replyToMessageId) {
        await this.makeRequest('post', `/me/messages/${replyToMessageId}/reply`, {
          message,
          comment: convert(body, { wordwrap: false }),
        });
      } else {
        // Send new message
        await this.makeRequest('post', '/me/sendMail', {
          message,
          saveToSentItems: true,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending Outlook email:', error);
      throw error;
    }
  }

  /**
   * Mark email as read/unread
   */
  async markAsRead(messageId, isRead = true) {
    try {
      await this.makeRequest('patch', `/me/messages/${messageId}`, {
        isRead,
      });
      return { success: true };
    } catch (error) {
      console.error('Error marking Outlook email:', error);
      throw error;
    }
  }

  /**
   * Delete email
   */
  async deleteEmail(messageId) {
    try {
      await this.makeRequest('delete', `/me/messages/${messageId}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting Outlook email:', error);
      throw error;
    }
  }

  /**
   * Get email folders
   */
  async getFolders() {
    try {
      const data = await this.makeRequest('get', '/me/mailFolders');
      return data.value.map(folder => ({
        id: folder.id,
        name: folder.displayName,
        totalItems: folder.totalItemCount,
        unreadItems: folder.unreadItemCount,
      }));
    } catch (error) {
      console.error('Error getting Outlook folders:', error);
      throw error;
    }
  }

  /**
   * Star/Flag email (Outlook uses flags instead of stars)
   */
  async starEmail(messageId, flagged = true) {
    try {
      await this.makeRequest('patch', `/me/messages/${messageId}`, {
        flag: {
          flagStatus: flagged ? 'flagged' : 'notFlagged'
        }
      });
      return { success: true };
    } catch (error) {
      console.error('Error flagging Outlook email:', error);
      throw error;
    }
  }

  /**
   * Archive email (move to Archive folder)
   */
  async archiveEmail(messageId, archive = true) {
    try {
      if (archive) {
        // Move to Archive folder
        await this.makeRequest('post', `/me/messages/${messageId}/move`, {
          destinationId: 'archive'
        });
      } else {
        // Move back to Inbox
        await this.makeRequest('post', `/me/messages/${messageId}/move`, {
          destinationId: 'inbox'
        });
      }
      return { success: true };
    } catch (error) {
      console.error('Error archiving Outlook email:', error);
      throw error;
    }
  }

  /**
   * Mark as spam (move to Junk folder)
   */
  async markAsSpam(messageId, spam = true) {
    try {
      if (spam) {
        await this.makeRequest('post', `/me/messages/${messageId}/move`, {
          destinationId: 'junkemail'
        });
      } else {
        await this.makeRequest('post', `/me/messages/${messageId}/move`, {
          destinationId: 'inbox'
        });
      }
      return { success: true };
    } catch (error) {
      console.error('Error marking Outlook email as spam:', error);
      throw error;
    }
  }

  /**
   * Get email thread/conversation
   */
  async getThread(messageId) {
    try {
      // First get the message to find its conversationId
      const message = await this.getEmail(messageId);
      const conversationId = message.threadId;

      if (!conversationId) {
        return { threadId: null, messages: [message] };
      }

      // Get all messages in the conversation
      const params = new URLSearchParams();
      params.append('$filter', `conversationId eq '${conversationId}'`);
      params.append('$orderby', 'receivedDateTime asc');
      params.append('$select', 'id,subject,from,toRecipients,receivedDateTime,body,bodyPreview');

      const data = await this.makeRequest('get', `/me/messages?${params.toString()}`);
      const messages = data.value.map(msg => this.transformToUnifiedFormat(msg));

      return {
        threadId: conversationId,
        messages
      };
    } catch (error) {
      console.error('Error getting Outlook thread:', error);
      throw error;
    }
  }

  /**
   * Get contacts from Outlook
   */
  async getContacts(maxResults = 100) {
    try {
      const params = new URLSearchParams();
      params.append('$top', maxResults.toString());
      params.append('$select', 'emailAddresses,displayName,givenName,surname');

      const data = await this.makeRequest('get', `/me/contacts?${params.toString()}`);
      
      const contacts = data.value
        .filter(contact => contact.emailAddresses && contact.emailAddresses.length > 0)
        .map(contact => ({
          name: contact.displayName || `${contact.givenName || ''} ${contact.surname || ''}`.trim(),
          email: contact.emailAddresses[0].address,
          count: 1 // Outlook API doesn't provide frequency, so we set to 1
        }));

      return { contacts };
    } catch (error) {
      console.error('Error getting Outlook contacts:', error);
      throw error;
    }
  }

  /**
   * Transform Microsoft Graph email format to unified format
   * Makes it compatible with existing Gmail-based code
   */
  transformToUnifiedFormat(msg) {
    const plainText = msg.body?.contentType === 'text' 
      ? msg.body.content 
      : convert(msg.body?.content || '', { wordwrap: false });

    const toAddresses = msg.toRecipients?.map(r => r.emailAddress.address) || [];
    const ccAddresses = msg.ccRecipients?.map(r => r.emailAddress.address) || [];

    return {
      id: msg.id,
      threadId: msg.conversationId,
      subject: msg.subject || '(No Subject)',
      from: msg.from?.emailAddress?.address || '',
      fromName: msg.from?.emailAddress?.name || '',
      to: toAddresses.join(', '), // Convert array to comma-separated string for frontend compatibility
      toRecipients: toAddresses, // Keep array for other uses
      cc: ccAddresses.join(', '), // Convert array to comma-separated string
      ccRecipients: ccAddresses, // Keep array for other uses
      date: msg.receivedDateTime,
      timestamp: new Date(msg.receivedDateTime).getTime(),
      snippet: msg.bodyPreview || '',
      body: msg.body?.content || '',
      bodyHtml: msg.body?.content || '', // Frontend expects bodyHtml
      bodyText: plainText,
      isRead: msg.isRead,
      unread: !msg.isRead, // Add unread field for compatibility
      hasAttachments: msg.hasAttachments || false,
      isStarred: msg.flag?.flagStatus === 'flagged', // Map flag to star
      labels: [], // Outlook doesn't have labels like Gmail
      provider: 'microsoft',
    };
  }
}

module.exports = OutlookService;

