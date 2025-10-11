import React, { useState } from 'react';
import { toast } from 'sonner';

interface PaymentProps {
  onPaymentSuccess: (paymentId: string) => void;
  onPaymentError?: (error: string) => void;
  serviceData?: any;
  usage?: {
    freeGenerationsUsed: number;
    paidGenerationsUsed: number;
    remainingFreeGenerations: number;
    freeTrialCompleted: boolean;
    totalPaid: number;
  };
  onUsageUpdate?: (usage: any) => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PaymentComponent: React.FC<PaymentProps> = ({ 
  onPaymentSuccess, 
  onPaymentError,
  serviceData = {},
  usage,
  onUsageUpdate
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE = import.meta.env.PROD ? '' : ((import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000');

  const loadRazorpayScript = (): Promise<void> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => {
        toast.error('Failed to load payment gateway');
        setIsLoading(false);
      };
      document.body.appendChild(script);
    });
  };

  const createPaymentOrder = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ serviceData }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment order');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating payment order:', error);
      throw error;
    }
  };

  const verifyPayment = async (paymentData: any) => {
    try {
      const response = await fetch(`${API_BASE}/api/payment/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          razorpay_order_id: paymentData.razorpay_order_id,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_signature: paymentData.razorpay_signature,
          paymentId: paymentData.paymentId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Payment verification failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw error;
    }
  };

  const handlePayment = async () => {
    if (isLoading) return;

    // If user has free generations left, generate directly without payment
    if (usage && usage.remainingFreeGenerations > 0) {
      setIsLoading(true);
      try {
        // Call the generation API without payment
        const response = await fetch(`${API_BASE}/api/cold-email/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(serviceData),
        });

        if (!response.ok) {
          throw new Error('Failed to generate email');
        }

        const result = await response.json();
        toast.success('Free email generated successfully!');
        
        // Update usage if provided in response
        if (result.usage && onUsageUpdate) {
          onUsageUpdate(result.usage);
        }
        
        onPaymentSuccess('free_generation'); // Use special ID for free generations
      } catch (error) {
        console.error('Free generation error:', error);
        toast.error('Failed to generate email. Please try again.');
        onPaymentError?.('Free generation failed');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Proceed with payment for paid generations
    setIsLoading(true);

    try {
      // Load Razorpay script
      await loadRazorpayScript();

      // Create payment order
      const orderData = await createPaymentOrder();
      const currentPaymentId = orderData.paymentId;

      // Configure Razorpay options
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Invoxus',
        description: 'Cold Email Generation Service',
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            // Verify payment on backend with the correct paymentId
            const verificationResult = await verifyPayment({
              ...response,
              paymentId: currentPaymentId
            });
            
            if (verificationResult.success) {
              toast.success('Payment successful! Generating your cold email...');
              onPaymentSuccess(verificationResult.paymentId);
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error) {
            console.error('Payment verification error:', error);
            toast.error('Payment verification failed. Please try again.');
            onPaymentError?.('Payment verification failed');
          }
        },
        prefill: {
          name: 'User',
          email: 'user@example.com',
        },
        theme: {
          color: '#6366f1',
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false);
            toast.info('Payment cancelled');
          },
        },
      };

      // Open Razorpay checkout
      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();

    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
      onPaymentError?.('Payment failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-neutral-900/50 rounded-lg border border-neutral-800">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-neutral-100 mb-2">
          Cold Email Generation
        </h3>
        
        {usage && usage.remainingFreeGenerations > 0 ? (
          <div className="mb-4">
            <p className="text-green-400 text-sm mb-2">
              🎉 You have {usage.remainingFreeGenerations} free generation{usage.remainingFreeGenerations !== 1 ? 's' : ''} left!
            </p>
            <p className="text-neutral-400 text-xs">
              After {usage.remainingFreeGenerations} more generation{usage.remainingFreeGenerations !== 1 ? 's' : ''}, you'll need to pay ₹1 per email
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-neutral-400 text-sm mb-2">
              Free trial completed ({usage?.freeGenerationsUsed || 0}/5 used)
            </p>
            <p className="text-neutral-300 text-sm">
              Generate AI-powered cold emails for just ₹1
            </p>
          </div>
        )}
        
        <div className="text-2xl font-bold text-green-400 mb-4">
          {usage && usage.remainingFreeGenerations > 0 ? 'FREE' : '₹1.00'}
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={isLoading}
        className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
          isLoading
            ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
            : usage && usage.remainingFreeGenerations > 0
            ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin"></div>
            Processing...
          </div>
        ) : usage && usage.remainingFreeGenerations > 0 ? (
          'Generate Free Email'
        ) : (
          'Pay ₹1 & Generate Email'
        )}
      </button>

      <div className="text-xs text-neutral-500 text-center max-w-sm">
        {usage && usage.remainingFreeGenerations > 0 ? (
          'This generation is free! No payment required.'
        ) : (
          'Secure payment powered by Razorpay. Your payment information is encrypted and secure.'
        )}
      </div>
    </div>
  );
};

export default PaymentComponent;
