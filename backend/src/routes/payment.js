const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');

const router = express.Router();

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create payment order for cold email generation
router.post('/create-order', async (req, res) => {
  try {
    const { serviceData = {} } = req.body;
    
    // Validate required environment variables
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.log('Razorpay credentials missing:', {
        keyId: !!process.env.RAZORPAY_KEY_ID,
        keySecret: !!process.env.RAZORPAY_KEY_SECRET
      });
      return res.status(500).json({
        error: 'Payment service not configured',
        message: 'Razorpay credentials not found'
      });
    }

    // Create Razorpay order
    const orderOptions = {
      amount: 100, // ₹1.00 (amount in paise)
      currency: 'INR',
      receipt: `cold_email_${Date.now()}`,
      notes: {
        service: 'cold_email_generation',
        timestamp: new Date().toISOString()
      }
    };

    const order = await razorpay.orders.create(orderOptions);
    
    // Save payment record to database
    const payment = await Payment.createPayment(order, serviceData);
    
    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      paymentId: payment._id
    });

  } catch (error) {
    console.error('Payment order creation error:', error);
    res.status(500).json({
      error: 'Failed to create payment order',
      message: error.message
    });
  }
});

// Verify payment and mark as paid
router.post('/verify-payment', async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      paymentId 
    } = req.body;

    console.log('Payment verification request:', {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: razorpay_signature ? 'present' : 'missing',
      paymentId
    });

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.log('Missing payment verification data');
      return res.status(400).json({
        error: 'Missing payment verification data',
        message: 'All payment fields are required'
      });
    }

    // Find the payment record
    const payment = await Payment.findOne({ 
      razorpayOrderId: razorpay_order_id,
      _id: paymentId 
    });

    console.log('Payment record found:', payment ? 'Yes' : 'No');
    if (payment) {
      console.log('Payment status:', payment.status);
      console.log('Payment amount:', payment.amount);
    }

    if (!payment) {
      console.log('Payment not found in database');
      return res.status(404).json({
        error: 'Payment not found',
        message: 'Invalid payment order'
      });
    }

    // Check if payment is already processed
    if (payment.status === 'paid') {
      return res.json({
        success: true,
        message: 'Payment already verified',
        paymentId: payment._id,
        status: 'paid'
      });
    }

    // Check if payment is expired
    if (payment.isExpired()) {
      await payment.markAsFailed();
      return res.status(400).json({
        error: 'Payment expired',
        message: 'Please create a new payment order'
      });
    }

    // Verify the signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await payment.markAsFailed();
      return res.status(400).json({
        error: 'Invalid payment signature',
        message: 'Payment verification failed'
      });
    }

    // Mark payment as paid
    await payment.markAsPaid({
      razorpay_payment_id,
      razorpay_signature
    });

    res.json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: payment._id,
      status: 'paid',
      serviceData: payment.serviceData
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      error: 'Payment verification failed',
      message: error.message
    });
  }
});

// Get payment status
router.get('/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      paymentId: payment._id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      isExpired: payment.isExpired(),
      serviceData: payment.serviceData
    });

  } catch (error) {
    console.error('Payment status check error:', error);
    res.status(500).json({
      error: 'Failed to check payment status',
      message: error.message
    });
  }
});

// Webhook handler for Razorpay events (optional but recommended)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
      return res.status(400).json({ error: 'Webhook signature missing' });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(body);
    
    // Handle different webhook events
    switch (event.event) {
      case 'payment.captured':
        console.log('Payment captured:', event.payload.payment.entity.id);
        break;
      case 'payment.failed':
        console.log('Payment failed:', event.payload.payment.entity.id);
        break;
      default:
        console.log('Unhandled webhook event:', event.event);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
