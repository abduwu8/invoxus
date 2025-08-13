const mongoose = require('mongoose');

const UnsubscribeSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true, required: true },
    messageId: { type: String, index: true },
    senderEmail: { type: String, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Unsubscribe || mongoose.model('Unsubscribe', UnsubscribeSchema);


