'use client';

import { RefreshCw, Home } from 'lucide-react';

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="max-w-lg mx-auto px-4 text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-10 h-10 text-yellow-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
          <p className="text-gray-600 mb-6">
            Your payment was not completed. You can try again or contact support if you have questions.
          </p>
          <div className="space-y-3">
            <a
              href="/dashboard"
              className="block w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Back to Dashboard
            </a>
            <a
              href="/pay"
              className="block w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Try Again
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
