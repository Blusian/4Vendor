# 4Vendor

Bright, polished marketing site for **4Vendor**, a SaaS product for TCG vendors who need trustworthy numbers across transactions, inventory, fees, taxes, cost basis, profit, exports, and reporting.

## Stack

- Next.js App Router
- React 19
- TypeScript
- CSS via `app/globals.css`
- Google fonts through `next/font`

## What is included

- A responsive landing page in [app/page.tsx](c:\Users\Andy Mach\source\repos\4Vendor\app\page.tsx)
- A bright visual system with soft cards, airy spacing, and subtle motion in [app/globals.css](c:\Users\Andy Mach\source\repos\4Vendor\app\globals.css)
- Updated app metadata and typography in [app/layout.tsx](c:\Users\Andy Mach\source\repos\4Vendor\app\layout.tsx)
- Supabase ledger migrations, typed database contracts, and posting RPC wrappers in [supabase](c:\Users\Andy Mach\source\repos\4Vendor\supabase) and [utils/supabase](c:\Users\Andy Mach\source\repos\4Vendor\utils\supabase)
- Repository basics: `README.md`, `LICENSE`, and `.gitignore`

## Running locally

```powershell
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Notes

- The page was designed to feel bright, bubbly, modern, and trustworthy rather than dark or finance-coded.
- The homepage now includes a collectible-themed market carousel with sample Pokemon and sports card movers.
- The copy is grounded in the PRD themes: inspectable math, logged inventory movement, visible fee handling, and bookkeeping-friendly exports.
- The backend foundation now models vendors, inventory lots, transaction posting, FIFO cost basis, audit events, reconciliation views, and typed Supabase RPC contracts.

## Customization

- Replace the sample market movers in [app/page.tsx](c:\Users\Andy Mach\source\repos\4Vendor\app\page.tsx) with the specific cards your friend wants featured.
- Swap the sample transaction rows and mock data for production screenshots once the product UI exists.
