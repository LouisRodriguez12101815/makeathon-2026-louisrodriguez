# FeeShield — LATAM Fee Radar
FeeShield is a lightweight contract-audit console for LATAM payment processing. It helps teams sanity-check whether a quoted processor fee (percentage + settlement delay) is above baseline market rates, and generates a copy/paste negotiation script.
Core flows are designed to work even when Supabase/Figma are not configured (safe fallback), but you can connect both for live logging and design token sync.
## What it does
- Audit a quoted processor rate vs baseline public rates (dLocal, Ebanx, Mercado Pago, Stripe LATAM)
- Flag gouging / warning / fair pricing
- Generate a negotiation email script with the computed overage
- Optional: sync title + brand color from a Figma file
- Optional: log audits to Supabase (fallback to in-memory list when Supabase isn’t configured)
## Quick demo flow
1. Unlock the console (lead gate)
2. Click Demo Mode to prefill a realistic example
3. Click Audit Contract
4. Copy the negotiation script
## Local development
Install and run:
- npm install
- npm run dev
Build + lint:
- npm run lint
- npm run build
## Environment variables
Create `.env.local` (recommended: copy `.env.example`).
- FIGMA_ACCESS_TOKEN
- FIGMA_FILE_KEY
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
## Supabase setup (optional but recommended)
Run the SQL in `supabase-schema.sql` in your Supabase project to create:
- checkout_templates
- transactions
- payment_gateways
Note: for hackathon simplicity, RLS is disabled in that script.
## Hackathon submission checklist
- Deployed URL (Vercel): https://makeathon-2026-louisrodriguez.vercel.app
- Source repo URL (GitHub): https://github.com/LouisRodriguez12101815/makeathon-2026-louisrodriguez
- Demo video (YouTube): https://youtu.be/ANryI-RTDHk
- Screenshot(s): dashboard + audit result state
