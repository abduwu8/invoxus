const mongoose = require('mongoose');

const UserTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true },
    email: String,
    provider: { type: String, enum: ['google', 'microsoft'], default: 'google', index: true },
    tokens: Object,
  },
  { timestamps: true }
);

// Compound index for efficient provider-specific queries
UserTokenSchema.index({ userId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.models.UserToken || mongoose.model('UserToken', UserTokenSchema);


