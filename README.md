# billguard

see what's coming. never get surprised by a bill again.

billguard is a clean, simple subscription and recurring-bill tracker. know how much you spend, what renews next, and when a free trial becomes a paid subscription.

## features

- track monthly, weekly, and yearly subscriptions
- upcoming charges and free trial dates
- monthly and annual spending estimates
- monthly calendar with scheduled charges
- category breakdown and insights
- search, edit, pause, and delete bills
- light and dark mode
- JSON backup and restore
- guest mode with local storage (no account required)
- email sign-up and login with Supabase
- private cross-device cloud sync for signed-in users
- optional import of locally saved bills into an account

## run locally

This version uses plain HTML, CSS, and JavaScript modules. No build step or dependencies.

```bash
git clone https://github.com/ItsMeCodyy/bill-guard.git
cd bill-guard
python3 -m http.server 8000
```

Then open [localhost:8000](http://localhost:8000).

You can also deploy the repo as a **static site** on Vercel, Netlify, or GitHub Pages. Set no build command; serve the repository root.

## how it works

Each subscription has an amount, billing cycle, next charge date, category, and status. The dashboard calculates monthly equivalents and shows charges in the next 30 days. The calendar shows recurring charges based on each bill's date.

Guest bills are stored in browser `localStorage`. Signed-in users store bills in Supabase under per-user row-level security. The app offers to copy existing guest bills into an account on sign-in. If cloud access fails, cloud edits are blocked rather than silently saved locally. Export backups before clearing your browser. Reminder emails are not implemented yet.

No bank connections or real payments are made. This tool does not automatically detect or cancel subscriptions.

## structure

```text
bill-guard/
├── assets/
│   └── favicon.svg
├── js/
│   ├── app.js
│   ├── bills.js
│   ├── cloud.js
│   └── icons.js
├── index.html
├── styles.css
└── README.md
```

## next

Scheduled email reminders, multi-currency conversion, and consent-based financial integrations are future additions.\n\n## supabase setup\n\nProject: `zvskbtdhsgwizchjmrpw` (US East). Configure **Authentication → URL Configuration** to set the Site URL to your deployed site and add the exact production and local development redirect URLs (such as `http://localhost:8000/**`). Email confirmation is normally required for sign-up. Configure custom SMTP for production use and review rate limits.\n\n`js/cloud.js` contains only a public publishable key; never add a service-role or secret key to the website. Supabase JS is pinned and loaded via esm.sh. The `public.bills` table has row-level security and owner-only read/write policies.\n\nNo bank connection, payment handling, or automated cancellation is included.

---

built to keep the small charges from becoming big surprises.
