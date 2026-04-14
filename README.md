# ThubPay Payment Portal

ThubPay is a commercial payment portal for startups and growing teams: hosted checkout, subscriptions, invoices, payment links, workspace analytics, and secure authentication.

This repository is **proprietary** software. It is not an open-source template and is not licensed for redistribution.

## Stack

- **Next.js** (App Router) on the web tier  
- **Supabase** for auth and data  
- **Stripe** for billing and payments  

## Local development

1. Install dependencies: `npm install`  
2. Copy environment variables from your team’s secure store into `.env` / `.env.local` (see `SETUP_GUIDE.md` for variable names only if you have internal access).  
3. Run the dev server: `npm run dev`  

## Deployment

Deploy to your approved hosting environment (e.g. Vercel). Set `NEXT_PUBLIC_SITE_URL` to your production origin and configure Supabase auth redirect URLs to match.

For questions about ThubPay product or access, use your internal contact channel or [thubpay.com](https://thubpay.com).
