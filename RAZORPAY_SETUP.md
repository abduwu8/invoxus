# Razorpay Payment Integration Setup

## Backend Environment Variables (.env)

Add these to your `backend/.env` file:

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_KEY_SECRET=your_key_secret_here

# Razorpay Webhook Secret (optional but recommended)
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Payment Configuration
RAZORPAY_CURRENCY=INR
RAZORPAY_MODE=test
```

## Frontend Environment Variables (.env)

Add these to your `frontend/.env` file:

```env
# Razorpay Frontend Configuration
VITE_RAZORPAY_KEY_ID=rzp_test_your_key_id_here
VITE_RAZORPAY_CURRENCY=INR

# API Configuration
VITE_API_BASE=http://localhost:4000
```

## Features Implemented

### Backend
1. **Payment Model** (`backend/src/models/Payment.js`)
   - Tracks payment orders and verification
   - Auto-expires orders after 15 minutes
   - Supports payment status tracking

2. **Payment Routes** (`backend/src/routes/payment.js`)
   - `POST /api/payment/create-order` - Creates Razorpay order
   - `POST /api/payment/verify-payment` - Verifies payment signature
   - `GET /api/payment/status/:paymentId` - Checks payment status
   - `POST /api/payment/webhook` - Handles Razorpay webhooks

3. **Cold Email Integration** (`backend/src/routes/coldEmail.js`)
   - Added payment verification middleware
   - Requires valid payment before email generation
   - Logs payment information for audit

### Frontend
1. **Payment Component** (`frontend/src/components/PaymentComponent.tsx`)
   - Razorpay checkout integration
   - Payment verification handling
   - Error handling and user feedback

2. **Cold Email Modal Integration** (`frontend/src/Pages/MailDashboard.tsx`)
   - Payment required before generation
   - Payment modal integration
   - Updated form handling with payment ID

## Payment Flow

1. User fills out cold email form
2. Clicks "Pay ₹1 & Generate Email" button
3. Payment modal opens with Razorpay checkout
4. User completes payment (₹1.00)
5. Payment is verified on backend
6. User can now generate the cold email
7. Email generation includes payment verification

## Testing

### Test Cards (Razorpay Test Mode)
- **Success**: `4111 1111 1111 1111`
- **Failure**: `4000 0000 0000 0002`

#### Test Card Details
```
Card Number: 4111 1111 1111 1111
Expiry Month: 12 (or any future month)
Expiry Year: 2025 (or any future year)
CVV: 123 (or any 3-digit number)
Name: Test User (or any name)
```

**Note**: In test mode, you can use any valid future expiry date and any 3-digit CVV.

### Test Flow
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Open cold email modal
4. Fill form and click "Pay ₹1 & Generate Email"
5. Use test card `for `
6. Complete payment and generate email

## Security Features

- Payment signature verification
- Order expiration (15 minutes)
- Secure API key handling
- Payment status validation
- Webhook signature verification

## Production Deployment

1. Switch to Live Mode in Razorpay dashboard
2. Update environment variables with live keys
3. Set `RAZORPAY_MODE=live`
4. Configure webhook URLs for production
5. Test with real payment methods

## API Endpoints

- `POST /api/payment/create-order` - Create payment order
- `POST /api/payment/verify-payment` - Verify payment
- `GET /api/payment/status/:id` - Check payment status
- `POST /api/payment/webhook` - Razorpay webhooks
- `POST /api/cold-email/generate` - Generate email (requires payment)
