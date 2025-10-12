const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString(),
    index: true
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: {
      intent: String,
      action: String,
      emailsFound: Number,
      cached: Boolean
    }
  }],
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
chatHistorySchema.index({ userId: 1, lastActivity: -1 });
chatHistorySchema.index({ sessionId: 1 });

// Auto-expire sessions after 24 hours of inactivity
chatHistorySchema.index({ lastActivity: 1 }, { expireAfterSeconds: 86400 });

// Static method to get or create conversation
chatHistorySchema.statics.getOrCreateConversation = async function(userId, sessionId = null) {
  if (sessionId) {
    const existing = await this.findOne({ userId, sessionId });
    if (existing) return existing;
  }
  
  // Create new conversation
  return await this.create({
    userId,
    sessionId: sessionId || new mongoose.Types.ObjectId().toString(),
    messages: []
  });
};

// Instance method to add message
chatHistorySchema.methods.addMessage = async function(role, content, metadata = {}) {
  this.messages.push({
    role,
    content,
    timestamp: new Date(),
    metadata
  });
  
  // Keep only last 20 messages for context (10 exchanges)
  if (this.messages.length > 20) {
    this.messages = this.messages.slice(-20);
  }
  
  this.lastActivity = new Date();
  return await this.save();
};

// Instance method to get recent context
chatHistorySchema.methods.getRecentContext = function(limit = 6) {
  // Return last N messages (default 6 = 3 exchanges)
  return this.messages.slice(-limit).map(m => ({
    role: m.role,
    content: m.content
  }));
};

// Instance method to get conversation summary
chatHistorySchema.methods.getSummary = function() {
  return {
    sessionId: this.sessionId,
    messageCount: this.messages.length,
    lastActivity: this.lastActivity,
    recentTopics: this.messages.slice(-5).map(m => m.content.slice(0, 50) + '...')
  };
};

module.exports = mongoose.model('ChatHistory', chatHistorySchema);

