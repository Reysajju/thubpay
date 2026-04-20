'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useState, FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

function CheckoutForm({ amountUsd, gradientFrom, gradientTo }: { amountUsd: string, gradientFrom: string, gradientTo: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage('');

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}/success`,
      },
    });

    if (error) {
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
      <PaymentElement options={{ 
        layout: 'tabs',
      }} />
      {errorMessage && <div className="text-red-400 text-sm mt-2">{errorMessage}</div>}
      <button
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className="w-full mt-4 flex items-center justify-center py-4 rounded-2xl text-[#111] font-bold text-lg shadow-xl hover:scale-[1.02] transition-transform disabled:opacity-50"
        style={{ background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)` }}
      >
        {isProcessing ? <Loader2 className="w-6 h-6 animate-spin text-[#111]" /> : `Pay ${amountUsd}`}
      </button>
    </form>
  );
}

export default function StripeCheckoutClient({ clientSecret, amountUsd, gradientFrom, gradientTo }: { clientSecret: string, amountUsd: string, gradientFrom: string, gradientTo: string }) {
  if (!clientSecret) return <div className="text-zinc-500 text-center text-sm p-4 border border-zinc-800 rounded-xl">Payment routing generation failed.</div>;

  return (
    <div className="w-full pt-4">
      <Elements stripe={stripePromise} options={{ 
        clientSecret, 
        appearance: { 
          theme: 'night',
          variables: {
            colorPrimary: gradientFrom,
            colorBackground: '#18181b',
            colorText: '#e4e4e7',
            colorDanger: '#ef4444',
            fontFamily: 'system-ui, sans-serif',
            borderRadius: '12px',
          }
        } 
      }}>
        <CheckoutForm amountUsd={amountUsd} gradientFrom={gradientFrom} gradientTo={gradientTo} />
      </Elements>
    </div>
  );
}
