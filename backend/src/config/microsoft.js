/**
 * Microsoft OAuth Configuration
 * Used for Outlook/Microsoft 365 email integration
 */
module.exports = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    authority: 'https://login.microsoftonline.com/common',
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(message);
        }
      },
      piiLoggingEnabled: false,
      logLevel: process.env.NODE_ENV === 'production' ? 3 : 1, // Error in prod, Info in dev
    },
  },
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:5173/auth-callback.html',
  scopes: [
    'https://graph.microsoft.com/User.Read',
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.ReadWrite',
    'https://graph.microsoft.com/Mail.Send',
    'offline_access',
  ],
  graphEndpoint: 'https://graph.microsoft.com/v1.0',
};

