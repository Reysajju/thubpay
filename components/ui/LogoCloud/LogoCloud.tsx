const PARTNERS = [
  {
    name: 'Stripe',
    href: 'https://stripe.com',
    color: '#635BFF',
    initial: 'S'
  },
  {
    name: 'PayPal',
    href: 'https://paypal.com',
    color: '#003087',
    initial: 'P'
  },
  {
    name: 'Square',
    href: 'https://squareup.com',
    color: '#3E4348',
    initial: 'Sq'
  },
  {
    name: 'Adyen',
    href: 'https://adyen.com',
    color: '#0ABF53',
    initial: 'A'
  },
  {
    name: 'Razorpay',
    href: 'https://razorpay.com',
    color: '#3395FF',
    initial: 'R'
  },
  {
    name: 'Supabase',
    href: 'https://supabase.io',
    color: '#3ECF8E',
    initial: 'DB'
  }
];

export default function LogoCloud() {
  return (
    <div className="border-t border-thubpay-border bg-thubpay-dark py-14">
      <p className="text-xs uppercase text-zinc-500 text-center font-semibold tracking-[0.3em] mb-8">
        Powered by the world's leading payment infrastructure
      </p>
      <div className="flex flex-wrap justify-center items-center gap-4 max-w-3xl mx-auto px-6">
        {PARTNERS.map((partner) => (
          <a
            key={partner.name}
            href={partner.href}
            aria-label={partner.name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-thubpay-border bg-thubpay-surface hover:border-thubpay-gold/50 hover:bg-thubpay-elevated transition-all duration-200 group"
          >
            <span
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: partner.color }}
            >
              {partner.initial}
            </span>
            <span className="text-sm font-medium text-zinc-400 group-hover:text-white transition-colors">
              {partner.name}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
