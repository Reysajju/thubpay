'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'What is ThubPay and how is it different from Stripe or PayPal?',
    a: 'ThubPay is not a payment gateway itself — it\'s a payment management platform that lets you connect your own gateways. Think of it as the control panel that sits above Stripe, PayPal, Square, Razorpay, and others. You bring your existing gateway API keys, and ThubPay unifies invoicing, subscriptions, analytics, and client management into one workspace.'
  },
  {
    q: 'Do I need a Stripe account to use ThubPay?',
    a: 'No. ThubPay supports 6+ payment gateways including Stripe, PayPal, Square, Razorpay, Braintree, and Adyen. You can use whichever gateway is available in your country and best suited for your business. You can also mix gateways and assign a different one per invoice.'
  },
  {
    q: 'How are my API keys and credentials stored?',
    a: 'All gateway API keys and credentials are encrypted with AES-256-GCM before being stored in our database. The encryption key is never stored alongside the data. Your raw API keys are never visible in any ThubPay interface after being saved — they are masked with ●●●●●● for security.'
  },
  {
    q: 'Can clients pay without leaving my website?',
    a: 'Yes. ThubPay uses embedded Stripe Elements for card payments, meaning the payment form loads directly on your branded ThubPay invoice page. Clients never get redirected to stripe.com or any third-party checkout page. The experience is fully white-labeled with your brand colors and logo.'
  },
  {
    q: 'What information does ThubPay collect from my clients during payment?',
    a: 'ThubPay optionally collects name, email address, and billing address from clients during checkout. This data is encrypted with AES-256-GCM and stored securely in your workspace. Card numbers and CVV codes are never stored — they are handled entirely by Stripe\'s PCI-compliant vault.'
  },
  {
    q: 'Is ThubPay suitable for international founders?',
    a: 'Absolutely. ThubPay was built with international founders in mind. Authors and creators in regions where Stripe is unavailable can use PayPal, Razorpay, or Braintree instead. Gateways are interchangeable — you assign whichever one works for each client\'s region.'
  },
  {
    q: 'What happens if a client pays offline (bank transfer, wire, etc.)?',
    a: 'ThubPay supports manual invoice completion. You can mark any pending invoice as "Paid Manually" from the dashboard. The invoice gets timestamped, tagged as "completed manually," and the payment is recorded in your revenue analytics — all without any gateway involvement.'
  },
  {
    q: 'Can I set a monthly revenue goal?',
    a: 'Yes. The dashboard includes a Monthly Target widget. Click it to enter your goal in USD, and the dashboard displays a real-time gold progress bar showing how close your current revenue is to that target. It resets by month and updates instantly as invoices are paid.'
  },
  {
    q: 'What does the free plan include?',
    a: 'The free plan gives you full access to the ThubPay workspace: unlimited invoices, 1 brand, client management, gateway integration (you bring your own keys), and the full analytics dashboard. The Premium plan at $19.99/month unlocks multiple brands, advanced reporting, priority support, and higher limits.'
  },
  {
    q: 'How do I get support?',
    a: 'You can reach our team at support@thubpay.com. We also have an AI assistant built into the dashboard (powered by Zhipu GLM-4 Flash) that can answer platform questions instantly. For enterprise or sales inquiries, use the Contact Us page.'
  }
];

export default function FAQsPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="bg-thubpay-obsidian min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-grid pt-20 pb-16 sm:pt-28 sm:pb-24 border-b border-thubpay-border">
        <div className="absolute inset-0 pointer-events-none">
          <div className="glow-orb w-72 h-72 -top-16 -left-16" style={{ background: 'rgba(201,168,108,0.16)' }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-thubpay-gold/30 bg-thubpay-gold/8 text-thubpay-gold text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-thubpay-gold animate-pulse" />
            Frequently Asked Questions
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4 leading-tight">
            Everything you <span className="gradient-text">need to know</span>
          </h1>
          <p className="text-zinc-400 text-lg">
            Common questions from startup founders about ThubPay's multi-gateway payment platform.
          </p>
          <p className="text-sm text-zinc-500 mt-3">
            Still have questions? Email us at{' '}
            <a href="mailto:support@thubpay.com" className="text-thubpay-gold hover:underline">
              support@thubpay.com
            </a>
          </p>
        </div>
      </section>

      {/* Accordion */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="glass-card rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-start justify-between gap-4 p-5 sm:p-6 text-left"
                aria-expanded={open === i}
              >
                <span className="font-semibold text-white text-sm sm:text-base leading-relaxed">
                  {faq.q}
                </span>
                <ChevronDown
                  className={`w-5 h-5 shrink-0 text-thubpay-gold transition-transform duration-300 mt-0.5 ${open === i ? 'rotate-180' : ''}`}
                />
              </button>
              {open === i && (
                <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-zinc-400 text-sm leading-relaxed border-t border-thubpay-border pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA at bottom */}
        <div className="mt-16 text-center glass-card rounded-3xl p-10">
          <h2 className="text-2xl font-bold text-white mb-2">Still have questions?</h2>
          <p className="text-zinc-400 mb-6 text-sm">Our team responds within 24 hours on business days.</p>
          <a
            href="mailto:support@thubpay.com"
            className="btn-gradient inline-flex items-center justify-center px-8 py-3 rounded-xl font-semibold text-[#111]"
          >
            Email support@thubpay.com
          </a>
        </div>
      </section>
    </div>
  );
}
