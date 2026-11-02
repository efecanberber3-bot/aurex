# AUREX — Fitness Management Platform

AUREX is a responsive personal-training management interface built with Vite, vanilla JavaScript and Supabase. The interface can be built and displayed before Supabase is configured; authentication and data operations become active after the Supabase setup.

## Project structure

```text
AUREX/
├── .github/workflows/deploy.yml
├── public/.nojekyll
├── src/
│   ├── services/
│   ├── styles/
│   ├── utils/
│   └── main.js
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── README.md
└── vite.config.js
```

## 1. Run locally (interface preview)

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

The sign-in screen will appear even when Supabase is not configured. Login and registration require Supabase and will be enabled after setup.

## 2. GitHub Pages deployment

1. Upload the **contents** of this `AUREX` folder to the root of the GitHub repository named `aurex` (do not upload an extra nested `AUREX` folder). Include the hidden `.github` directory.
2. Commit the files to the `main` branch.
3. Open repository **Settings → Pages → Build and deployment**. Set **Source** to **GitHub Actions**.
4. Open **Actions** and wait for **Build and deploy AUREX** to finish successfully.
5. Open `https://efecanberber3-bot.github.io/aurex/` and hard-refresh once.

The workflow builds the Vite app into `dist/` and publishes that folder. Do not select `Deploy from a branch` for this workflow.

## 3. Supabase setup — later

Create a Supabase project, then run `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL Editor. For local development, copy `.env.example` to `.env.local` and add the project URL and publishable/anon key. Never put a service-role key in frontend code or GitHub.

To enable authentication on GitHub Pages later, add repository Actions secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then add the GitHub Pages URL to Supabase Auth URL Configuration. Update the workflow build step to pass those secrets as environment variables, or configure the workflow to do so before enabling sign-in.

## Security note

This is a development foundation, not a production-ready client-data system. Review RLS policies, consent, KVKK requirements and minor-safety processes before entering real client data. Never use a service-role key in the browser.
