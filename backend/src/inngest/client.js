const { Inngest } = require('inngest');

const appId = process.env.INNGEST_APP_ID || 'email-app';
const appName = process.env.INNGEST_APP_NAME || 'Email App';

const inngest = new Inngest({ id: appId, name: appName, signingKey: process.env.INNGEST_SIGNING_KEY });

module.exports = { inngest };


