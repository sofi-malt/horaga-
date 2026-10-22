# Hiraga Restaurant Digital Menu

Customers scan a QR code and see the menu. The restaurant admin signs in at `/admin` to manage dishes, categories, pictures, prices and availability. English and Amharic are supported.

Built with Next.js, Supabase (database, login, picture storage) and deployed on Vercel.

## 1. Set up Supabase (free)

1. Create a project at https://supabase.com.
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it. This creates the tables, the `menu` picture bucket and the security rules.
   (Already ran an older `schema.sql`? Run only `supabase/update-1.sql` once instead.)
3. Open **Authentication > Users > Add user** and create the admin account (email and password).
4. Open **Authentication > Sign In / Providers** and turn off **Allow new users to sign up**, so only your admin can edit the menu.
5. Open **Project Settings > API** and copy the **Project URL** and the **anon public** key.

## 2. Run it on your computer (optional)

```
npm install
cp .env.example .env.local     # then paste your URL and key into .env.local
npm run dev
```

Open http://localhost:3000 (menu) and http://localhost:3000/admin (admin).

## 3. Put it on GitHub

1. Create a new repository named `hiraga-menu` on https://github.com.
2. In this folder:
```
git init
git add .
git commit -m "Hiraga menu"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/hiraga-menu.git
git push -u origin main
```

## 4. Deploy on Vercel (free)

1. Sign in at https://vercel.com with GitHub and click **Add New > Project**.
2. Import `hiraga-menu`.
3. Under **Environment Variables** add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**. Every later `git push` redeploys automatically.

## 5. QR codes

1. Open `https://YOUR-SITE.vercel.app/admin` and sign in.
2. Use the **QR code** section. Leave the table empty for one general QR, or type a table number for a table-specific one (the menu then shows "Table 5").
3. Download the PNG and print it. If you later add your own domain in Vercel, create the QR codes again from the new address.

## Admin features

- Dishes: picture, price, English and Amharic text, tags (Fasting, Vegetarian, Spicy, Chef's special), Today's special, sold out, reorder with the arrows.
- Restaurant info: tagline, opening hours, address, phone, map and social links (shown at the bottom of the menu).
- QR: general or per-table QR, PNG download, and a printable Hiraga table card.
- Backup: one click downloads all menu data as a JSON file.

## Notes

- Change the currency text (`ETB` / `ብር`) in `app/page.js` and `app/admin/page.js`.
- Colors are in `app/globals.css` (`:root` at the top).
- Pictures are shrunk to 900px in the browser before upload to keep the menu fast on mobile data.
