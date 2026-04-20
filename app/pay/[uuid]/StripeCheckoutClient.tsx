'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useState, FormEvent, useTransition } from 'react';
import { Loader2, ShieldCheck, Mail, User, MapPin } from 'lucide-react';
import { savePaymentSubmission } from '../../dashboard/actions';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface CheckoutFormProps {
  amountUsd: string;
  gradientFrom: string;
  gradientTo: string;
  invoiceId: string;
  initialName?: string;
  paymentIntentId: string;
}

function CheckoutForm({ amountUsd, gradientFrom, gradientTo, invoiceId, initialName, paymentIntentId }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Identity State
  const [name, setName] = useState(initialName || '');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage('');

    // Pre-flight validation & Identity Save
    try {
      const subResult = await savePaymentSubmission({
        invoiceId,
        paymentIntentId,
        name: name.trim(),
        email: email.trim(),
        address: address.trim()
      });

      if (!subResult.success) {
        console.warn('Identity data failed to sync, but continuing payment...', subResult.error);
      }
    } catch (err) {
      console.error('Submission error:', err);
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname.replace(invoiceId, 'success')}?payment_intent=${paymentIntentId}`,
      },
    });

    if (error) {
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
      
      {/* Identity Capture Section */}
      <div className="space-y-4 pt-1 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-thubpay-gold" />
            <h3 className="text-sm font-semibold text-white">Billing Identity (Optional)</h3>
        </div>
        
        <div className="space-y-3">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-thubpay-gold/50 transition-colors"
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-thubpay-gold/50 transition-colors"
            />
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Billing Address (City, State, Zip)"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-thubpay-gold/50 transition-colors"
            />
          </div>
        </div>
        <p className="text-[10px] text-zinc-500 font-medium">Your information is encrypted securely at rest.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Card Details</h3>
        <PaymentElement options={{ 
            layout: 'tabs',
        }} />
      </div>
      
      {errorMessage && <div className="text-red-400 text-sm mt-2">{errorMessage}</div>}
      
      <button
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className="w-full mt-2 flex items-center justify-center py-4 rounded-2xl text-[#111] font-bold text-lg shadow-xl hover:scale-[1.02] transition-transform disabled:opacity-50"
        style={{ background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)` }}
      >
        {isProcessing ? <Loader2 className="w-6 h-6 animate-spin text-[#111]" /> : `Pay ${amountUsd}`}
      </button>
    </form>
  );
}

export default function StripeCheckoutClient({ 
  clientSecret, 
  amountUsd, 
  gradientFrom, 
  gradientTo,
  invoiceId,
  initialName,
  paymentIntentId
}: { 
  clientSecret: string;
  amountUsd: string;
  gradientFrom: string;
  gradientTo: string;
  invoiceId: string;
  initialName?: string;
  paymentIntentId: string;
}) {
  if (!clientSecret) return <div className="text-zinc-500 text-center text-sm p-4 border border-zinc-800 rounded-xl">Payment routing generation failed.</div>;

  return (
    <div className="w-full py-4 relative z-10">
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
        <CheckoutForm 
          amountUsd={amountUsd} 
          gradientFrom={gradientFrom} 
          gradientTo={gradientTo} 
          invoiceId={invoiceId} 
          initialName={initialName}
          paymentIntentId={paymentIntentId}
        />
      </Elements>
    </div>
  );
}
