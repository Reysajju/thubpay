'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Home, RefreshCw, CreditCard } from 'lucide-react';
import { Stripe } from 'stripe';

export default function PaymentSuccessPage() {
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (sessionId) {
      verifyPayment(sessionId);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyPayment = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/public/payment-success?session_id=${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setPayment(data.payment);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Payment Successful',
          text: `Your payment of ${formatAmount(payment?.amount)} was successful!`,
          url: window.location.href
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Copy to clipboard
      const text = `Payment Successful: ${formatAmount(payment?.amount)}`;
      navigator.clipboard.writeText(text);
      alert('Payment amount copied to clipboard');
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: payment?.currency || 'USD'
    }).format(amount / 100);
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Success Header */}
          <div className="bg-green-50 px-6 py-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-green-700">Thank you for your payment</p>
          </div>

          {/* Payment Details */}
          <div className="p-8">
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-500">Payment Amount</p>
                    <p className="text-xl font-bold text-gray-900">
                      {formatAmount(payment?.amount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Payment Method</p>
                  <p className="font-medium text-gray-900">
                    {payment?.gateway === 'stripe' ? 'Credit Card' : 'Card'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Transaction ID</p>
                  <p className="font-mono text-sm text-gray-900 break-all">
                    {payment?.stripe_payment_intent}
                  </p>
                </div>
              </div>

              {payment?.amount_details?.tax && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Tax</span>
                    <span className="font-medium text-gray-900">
                      {formatAmount(payment.amount_details.tax)}
                    </span>
                  </div>
                </div>
              )}

              {payment?.amount_details?.shipping && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Shipping</span>
                    <span className="font-medium text-gray-900">
                      {formatAmount(payment.amount_details.shipping)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg mb-8">
              <p className="text-sm text-blue-800">
                <strong>Receipt:</strong> Your payment has been processed successfully. A copy of this receipt has been sent to your email.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleShare}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Share Receipt
              </button>

              <a
                href="/dashboard"
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-5 h-5" />
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}