const mongoose = require('mongoose');

const ChatMemorySchema = new mongoose.Schema(
  {
    userId: { type: String, index: true, required: true },
    type: { type: String, index: true }, // e.g., 'preference', 'note', 'style'
    key: { type: String, index: true },  // e.g., 'signature', 'tone', 'contact_alias:john'
    value: { type: String },
  },
  { timestamps: true }
);

ChatMemorySchema.index({ userId: 1, key: 1 }, { unique: false });

module.exports = mongoose.models.ChatMemory || mongoose.model('ChatMemory', ChatMemorySchema);


