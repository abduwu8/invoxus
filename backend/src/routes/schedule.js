const express = require('express');
const router = express.Router();
const { inngest } = require('../inngest/client');

router.post('/schedule', async (req, res) => {
  try {
    const user = req.session && req.session.userProfile;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { to, subject, body, prompt, timezone } = req.body || {};
    if (!to || !prompt) return res.status(400).json({ error: 'to and prompt required' });

    await inngest.send({
      name: 'email/schedule.requested',
      data: { userId: user.id, to, subject, body, prompt, timezone: timezone || 'UTC' },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('Schedule error:', e);
    res.status(500).json({ error: 'Failed to schedule' });
  }
});

module.exports = router;


