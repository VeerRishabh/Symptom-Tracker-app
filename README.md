# Kindly symptom tracker

A daily symptom check-in app with an account and cloud sync, so your entries
follow you across your phone, tablet, and laptop.

## What's included

- Email/password accounts (Supabase Auth)
- Entries stored in a Postgres database, scoped to your account with Row
  Level Security (only you can ever read or write your own rows)
- 30-second daily check-in with a 1-5 severity scale
- Quick tags for common factors (sleep, stress, food, cycle, medication...)
- Optional sleep, movement, and free-text notes
- Seven-day symptom rhythm chart
- Early pattern cards using simple correlation and group averages
- JSON export

This is a prototype, not a medical device. Insights are directional and
should not be used for diagnosis or treatment decisions.

## 1. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) and create a free account and
   a new project.
2. In the dashboard, open **SQL Editor -> New query**, paste in the contents
   of `supabase-schema.sql` from this folder, and run it. This creates the
   `entries` table and locks it down so each user can only see their own
   data.
3. Open **Project Settings -> API**. Copy the **Project URL** and the
   **anon public** key.
4. Open `config.js` in this folder and paste those two values in:

   ```js
   window.SUPABASE_URL = "https://xxxxx.supabase.co";
   window.SUPABASE_ANON_KEY = "eyJ...";
   ```

   The anon key is safe to ship in client-side code — access is controlled
   by the database policies, not by keeping this key secret.

5. (Optional) By default Supabase requires email confirmation before a new
   account can sign in. For quick personal testing you can turn this off
   under **Authentication -> Providers -> Email -> Confirm email**. For
   anything beyond personal use, leave email confirmation on.

## 2. Run it locally

Because this app loads Supabase over `https://`, most browsers want it
served over `http://` rather than opened as a bare `file://` path. The
simplest way:

```bash
cd kindly
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## 3. Deploy it so you can reach it from any device

Any static hosting service works, since this is plain HTML/CSS/JS. Two easy
free options:

**Netlify (drag and drop)**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag this whole folder onto the page
3. You'll get a live URL immediately (you can add a custom domain later)

**Vercel**
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import this folder as a project (no build command needed — it's a
   static site)
3. Deploy

Once it's live at a URL, open that URL on any device and sign in with the
same account — your check-ins will be there.

## Notes on going further

- **Password resets / magic links**: Supabase Auth supports these out of
  the box if you want to add them later (`supabase.auth.resetPasswordForEmail`,
  `signInWithOtp`).
- **Editing/deleting past entries**: not wired up in the UI yet, but the
  `entries` table supports it — the check-in form already upserts by date,
  so re-visiting `#check-in` on a past day would just need a date picker.
- **Custom domain**: both Netlify and Vercel let you attach your own domain
  for free.
