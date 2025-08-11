const express = require('express');
const { serve } = require('inngest/express');
const { inngest } = require('./client');
const { scheduleFunction, sendEmailFunction } = require('./functions/schedule');

const router = express.Router();
router.use(
  serve({
    client: inngest,
    functions: [scheduleFunction, sendEmailFunction],
  })
);

module.exports = router;


