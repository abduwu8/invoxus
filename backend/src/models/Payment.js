const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Razorpay order details
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true
  },
  razorpayPaymentId: {
    type: String,
    unique: true,
    sparse: true // Allows null values but ensures uniqueness when present
  },
  razorpaySignature: {
    type: String,
    sparse: true
  },
  
  // Payment details
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'paid', 'failed', 'cancelled'],
    default: 'created'
  },
  
  // Service details
  service: {
    type: String,
    enum: ['cold_email_generation'],
    required: true
  },
  serviceData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // User identification (optional for anonymous payments)
  userEmail: {
    type: String,
    sparse: true
  },
  sessionId: {
    type: String,
    sparse: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  paidAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  }
}, {
  timestamps: true
});

// Indexes for better performance
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired orders

// Static method to create a new payment record
paymentSchema.statics.createPayment = async function(orderData, serviceData = {}) {
  const payment = new this({
    razorpayOrderId: orderData.id,
    amount: orderData.amount,
    currency: orderData.currency,
    service: 'cold_email_generation',
    serviceData: serviceData
  });
  
  return await payment.save();
};

// Instance method to mark payment as paid
paymentSchema.methods.markAsPaid = async function(paymentData) {
  this.razorpayPaymentId = paymentData.razorpay_payment_id;
  this.razorpaySignature = paymentData.razorpay_signature;
  this.status = 'paid';
  this.paidAt = new Date();
  
  return await this.save();
};

// Instance method to mark payment as failed
paymentSchema.methods.markAsFailed = async function() {
  this.status = 'failed';
  return await this.save();
};

// Instance method to check if payment is expired
paymentSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

module.exports = mongoose.model('Payment', paymentSchema);
