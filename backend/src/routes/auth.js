const express = require('express');
const { google } = require('googleapis');
const UserToken = require('../models/UserToken');

const router = express.Router();

router.get('/me', async (req, res) => {
  const profile = req.session && req.session.userProfile;
  if (!profile) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true, profile });
});

router.post('/google', async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Missing authorization code' });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Server missing Google client configuration' });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'postmessage');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userinfo } = await oauth2.userinfo.get();

    req.session.tokens = tokens;
    try {
      await UserToken.findOneAndUpdate(
        { userId: userinfo.id },
        { userId: userinfo.id, email: userinfo.email, tokens },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.error('Failed to persist user tokens', e);
    }
    req.session.userProfile = {
      id: userinfo.id,
      email: userinfo.email,
      name: userinfo.name,
      picture: userinfo.picture,
    };

    res.json({ ok: true, profile: req.session.userProfile });
  } catch (err) {
    console.error('Google auth error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

module.exports = router;


