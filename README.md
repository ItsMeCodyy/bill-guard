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
- local-first storage — no account required

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

Bills are stored in your browser's `localStorage`. Export your data before clearing your browser or switching devices. This is **not** cloud sync and does not send reminders. Free trial dates are only shown in the app.

No bank connections or real payments are made. This tool does not automatically detect or cancel subscriptions.

## structure

```text
bill-guard/
├── assets/
│   └── favicon.svg
├── js/
│   ├── app.js
│   ├── bills.js
│   └── icons.js
├── index.html
├── styles.css
└── README.md
```

## next

Cloud accounts, scheduled email reminders, multi-currency handling, and consent-based financial integrations are future additions.

---

built to keep the small charges from becoming big surprises.
