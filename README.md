# Hiraga Restaurant Digital Hotel & Kitchen System

A complete end-to-end digital restaurant management platform:
1. **Customer Digital Ordering & Live Tracking** (`/`): Browse categories, search, customize dishes with cooking notes, add to cart, and checkout with table number. Pay by Cash or digital transfer (Telebirr / CBE / Bank) with transaction code/link and receipt screenshot upload. Live step-by-step order tracker with real-time updates.
2. **Cashier Desk & POS** (`/cashier`): Audio alerts for incoming orders, pending payment proof verification (preview transaction links & zoomable screenshot lightbox), 1-click confirmation to kitchen, rejection with reasons, thermal receipt/bill printing, and walk-in order POS creation.
3. **Kitchen Display System - KDS** (`/kitchen`): Built for kitchen screens and tablets with bold table numbers, elapsed timers (< 10m green, 10-20m warning, > 20m urgent alert), interactive dish checklists, chef acceptance ("Start Cooking"), and "Plated & Ready" alerts.
4. **Admin Dashboard** (`/admin`): Manage dishes, categories, images, prices, tags, payment accounts (Telebirr & CBE numbers), QR code table generator, and backups.

---

## System Workflow

```
[Customer on Phone]
       │
       ▼ Scans QR Code at Table (e.g. ?table=4)
Selects Dishes + Notes ➔ Submits Order
       │
       ├─ Cash Payment ───────────────┐
       └─ Telebirr / CBE Transfer     │
          (Submits Txn Link/Photo)    │
                                      ▼
                             [Cashier Desk /cashier]
                                      │
                      Verifies Txn Link & Screenshot
                                      │
                         [Confirm & Send to Kitchen]
                                      │
                                      ▼
                            [Kitchen Display /kitchen]
                                      │
                        Chef clicks "Start Cooking"
                                      │
                       Chef clicks "Plated & Ready"
                                      │
                                      ▼
                        Customer & Waiter Notified!
                                      │
                         Food Served & Completed
```

---

## 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql` (or `supabase/orders.sql` if updating an existing database), and click **Run**.
   - This creates:
     - `categories`, `items`, `settings`, and `orders` tables.
     - `menu` and `receipts` storage buckets for dish pictures and payment receipt screenshots.
     - Real-time event publications and security policies.
3. Open **Project Settings > API** and copy:
   - **Project URL**
   - **anon public** key
4. Put them in your `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Open **Authentication > Users > Add user** and create accounts with email and password:
   - **Admin Account**: for `/admin` (menu & restaurant management)
   - **Cashier Account**: for `/cashier` (order & payment verification)
   - **Head Chef Account**: for `/kitchen` (Kitchen Display System)
6. Open **Authentication > Sign In / Providers** and turn off **Allow new users to sign up**, so only staff you invite can log in.

---

## 2. Run Locally

```bash
npm install
npm run dev
```

Open:
- **Customer Menu & Ordering**: [http://localhost:3000](http://localhost:3000)
- **Table 5 Test Menu**: [http://localhost:3000?table=5](http://localhost:3000?table=5)
- **Cashier Station**: [http://localhost:3000/cashier](http://localhost:3000/cashier)
- **Kitchen Display (KDS)**: [http://localhost:3000/kitchen](http://localhost:3000/kitchen)
- **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 3. Deployment on Vercel

1. Push your repository to GitHub.
2. Sign in to [Vercel](https://vercel.com) and click **Add New > Project**.
3. Import the repository.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**.

---

## Features Summary

- **Customer Ordering**:
  - English and Amharic language toggle.
  - Table number auto-detection from QR code.
  - Cart with item notes (e.g. "no onion", "extra spicy").
  - Digital payment support: customer gets restaurant's Telebirr & CBE numbers with 1-click copy.
  - Proof submission: transaction reference code/link and photo/screenshot upload.
  - Live order tracking timeline: Submitted ➔ Confirmed ➔ Cooking ➔ Ready ➔ Completed.

- **Cashier Station**:
  - Live order feed with audio chimes.
  - Image lightbox to inspect transaction receipts.
  - 1-click "Confirm Payment & Send to Kitchen".
  - Reject order with customer notice.
  - Printable guest bill / receipt formatted for thermal printers.
  - Walk-in / phone order POS entry.

- **Kitchen KDS**:
  - Touchscreen-friendly dark theme.
  - Bold Table numbers and Order IDs.
  - Elapsed ticket time counter with color alerts.
  - Interactive dish strike-through checklist.
  - "Accept & Start Cooking" and "Plated & Ready" actions.
