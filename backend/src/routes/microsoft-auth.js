const express = require('express');
const msal = require('@azure/msal-node');
const axios = require('axios');
const UserToken = require('../models/UserToken');
const microsoftConfig = require('../config/microsoft');

const router = express.Router();

// Create MSAL confidential client application
const msalClient = new msal.ConfidentialClientApplication({
  auth: microsoftConfig.auth,
  system: microsoftConfig.system,
});

/**
 * Initiate Microsoft OAuth flow
 * Returns the authorization URL for the frontend to redirect to
 */
router.get('/login', async (req, res) => {
  try {
    const authCodeUrlParameters = {
      scopes: microsoftConfig.scopes,
      redirectUri: microsoftConfig.redirectUri,
    };

    const authUrl = await msalClient.getAuthCodeUrl(authCodeUrlParameters);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating Microsoft auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * Handle OAuth callback from Microsoft
 * Exchange authorization code for tokens
 */
router.post('/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Exchange code for tokens
    const tokenRequest = {
      code,
      scopes: microsoftConfig.scopes,
      redirectUri: microsoftConfig.redirectUri,
    };

    const response = await msalClient.acquireTokenByCode(tokenRequest);
    
    // Get user info from Microsoft Graph
    const userInfo = await axios.get(`${microsoftConfig.graphEndpoint}/me`, {
      headers: {
        Authorization: `Bearer ${response.accessToken}`,
      },
    });

    const userData = userInfo.data;

    // Store tokens in database
    const tokens = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: new Date(response.expiresOn).getTime(),
    };

    await UserToken.findOneAndUpdate(
      { userId: userData.id, provider: 'microsoft' },
      {
        userId: userData.id,
        email: userData.userPrincipalName || userData.mail,
        provider: 'microsoft',
        tokens,
      },
      { upsert: true, new: true }
    );

    // Store in session
    req.session.tokens = tokens;
    req.session.provider = 'microsoft';
    req.session.userProfile = {
      id: userData.id,
      email: userData.userPrincipalName || userData.mail,
      name: userData.displayName,
      provider: 'microsoft',
    };

    res.json({ ok: true, profile: req.session.userProfile });
  } catch (error) {
    console.error('Error in Microsoft OAuth callback:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * Refresh Microsoft access token using refresh token
 */
async function refreshMicrosoftToken(refreshToken) {
  try {
    const tokenRequest = {
      refreshToken,
      scopes: microsoftConfig.scopes,
    };

    const response = await msalClient.acquireTokenByRefreshToken(tokenRequest);
    
    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken || refreshToken, // Keep old if new one not provided
      expiresAt: new Date(response.expiresOn).getTime(),
    };
  } catch (error) {
    console.error('Error refreshing Microsoft token:', error);
    throw error;
  }
}

/**
 * Get valid Microsoft access token (refresh if needed)
 */
async function getValidMicrosoftToken(userId) {
  try {
    const userToken = await UserToken.findOne({ userId, provider: 'microsoft' });
    if (!userToken) {
      throw new Error('No Microsoft token found for user');
    }

    const { tokens } = userToken;
    const now = Date.now();

    // If token expires in less than 5 minutes, refresh it
    if (tokens.expiresAt < now + 5 * 60 * 1000) {
      const newTokens = await refreshMicrosoftToken(tokens.refreshToken);
      
      // Update database
      await UserToken.findOneAndUpdate(
        { userId, provider: 'microsoft' },
        { tokens: newTokens }
      );

      return newTokens.accessToken;
    }

    return tokens.accessToken;
  } catch (error) {
    console.error('Error getting valid Microsoft token:', error);
    throw error;
  }
}

module.exports = router;
module.exports.getValidMicrosoftToken = getValidMicrosoftToken;
module.exports.refreshMicrosoftToken = refreshMicrosoftToken;

