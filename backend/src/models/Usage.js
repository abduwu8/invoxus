const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
  // User identification
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    sparse: true,
    index: true
  },
  
  // Usage tracking
  freeGenerationsUsed: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  paidGenerationsUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Trial status
  freeTrialCompleted: {
    type: Boolean,
    default: false
  },
  
  // Timestamps
  firstUsedAt: {
    type: Date,
    default: Date.now
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  
  // Payment tracking
  totalPaid: {
    type: Number,
    default: 0
  },
  lastPaymentAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better performance
usageSchema.index({ sessionId: 1 });
usageSchema.index({ userEmail: 1 });
usageSchema.index({ freeTrialCompleted: 1 });
usageSchema.index({ firstUsedAt: -1 });

// Static method to get or create usage record
usageSchema.statics.getOrCreateUsage = async function(sessionId, userEmail = null) {
  // For authenticated users, prioritize email-based lookup
  if (userEmail) {
    let usage = await this.findOne({ userEmail });
    if (usage) {
      // Update sessionId if it changed (user logged in from different device)
      if (usage.sessionId !== sessionId) {
        usage.sessionId = sessionId;
        await usage.save();
      }
      return usage;
    }
  }
  
  // Fallback to sessionId lookup
  let usage = await this.findOne({ sessionId });
  
  if (!usage) {
    usage = new this({
      sessionId,
      userEmail
    });
    await usage.save();
  } else if (userEmail && !usage.userEmail) {
    // If user just logged in, associate the session with their email
    usage.userEmail = userEmail;
    await usage.save();
  }
  
  return usage;
};

// Instance method to check if free trial is available
usageSchema.methods.hasFreeTrialLeft = function() {
  return this.freeGenerationsUsed < 5 && !this.freeTrialCompleted;
};

// Instance method to get remaining free generations
usageSchema.methods.getRemainingFreeGenerations = function() {
  return Math.max(0, 5 - this.freeGenerationsUsed);
};

// Instance method to use a free generation
usageSchema.methods.useFreeGeneration = async function() {
  if (!this.hasFreeTrialLeft()) {
    throw new Error('No free generations remaining');
  }
  
  this.freeGenerationsUsed += 1;
  this.lastUsedAt = new Date();
  
  // Mark trial as completed if this was the 5th use
  if (this.freeGenerationsUsed >= 5) {
    this.freeTrialCompleted = true;
  }
  
  return await this.save();
};

// Instance method to use a paid generation
usageSchema.methods.usePaidGeneration = async function(amount = 100) {
  this.paidGenerationsUsed += 1;
  this.totalPaid += amount;
  this.lastPaymentAt = new Date();
  this.lastUsedAt = new Date();
  
  return await this.save();
};

// Instance method to get usage summary
usageSchema.methods.getUsageSummary = function() {
  return {
    freeGenerationsUsed: this.freeGenerationsUsed,
    paidGenerationsUsed: this.paidGenerationsUsed,
    remainingFreeGenerations: this.getRemainingFreeGenerations(),
    freeTrialCompleted: this.freeTrialCompleted,
    totalPaid: this.totalPaid,
    firstUsedAt: this.firstUsedAt,
    lastUsedAt: this.lastUsedAt
  };
};

module.exports = mongoose.model('Usage', usageSchema);
