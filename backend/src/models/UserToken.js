const mongoose = require('mongoose');

const UserTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true },
    email: String,
    tokens: Object,
  },
  { timestamps: true }
);

module.exports = mongoose.models.UserToken || mongoose.model('UserToken', UserTokenSchema);


