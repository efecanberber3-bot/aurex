# AUREX — Fitness Management Platform

AUREX is a responsive personal-training management web app built with Vite, vanilla JavaScript and Supabase.

## Features in this V1 scaffold

- Email/password authentication
- Trainer and client role-based routing
- Trainer dashboard
- Client creation and profile overview
- Workout program creation
- Session scheduling
- Client portal
- Supabase PostgreSQL schema and Row Level Security policies
- GitHub Pages deployment workflow
- Responsive premium dark / charcoal / gold interface

> This is a working V1 foundation, not a finished production SaaS. Complete the setup and security checks below before using real client data.

## Requirements

- Node.js 22+
- npm
- Supabase project
- GitHub repository

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set the values in `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Then run:

```bash
npm run dev
```

Build check:

```bash
npm run build
```

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/migrations/0001_initial_schema.sql`.
4. Confirm RLS is enabled on every public table.
5. Add your own trainer account using Supabase Auth sign-up.
6. Promote that account to trainer from the SQL Editor using its verified Auth UUID:

```sql
update public.profiles
set role = 'trainer'
where id = 'YOUR_AUTH_USER_UUID';
```

Never expose the Supabase service-role key in frontend code or GitHub Pages.

### Link a client login to a trainer-created client record

V1 flow:
1. Trainer creates a client record from the trainer panel.
2. Client creates their own account from the sign-up screen.
3. Verify the client email.
4. As the trainer, link the client account to the correct record using a trusted SQL Editor session:

```sql
update public.clients
set auth_user_id = 'CLIENT_AUTH_USER_UUID'
where id = 'CLIENT_RECORD_UUID'
  and trainer_id = 'TRAINER_AUTH_USER_UUID';
```

Do not let clients choose or update their own `auth_user_id`. Do not expose this operation in the browser.

## GitHub Pages deployment

1. Push these files to the root of your GitHub repository named `aurex`.
2. In repository Settings → Secrets and variables → Actions, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. In Settings → Pages, choose GitHub Actions as the build/deployment source.
4. Push to `main`.
5. Add the published GitHub Pages URL and local development URL to Supabase Auth URL Configuration (Site URL / Redirect URLs).

The Vite base path is configured for `/aurex/`, matching `https://efecanberber3-bot.github.io/aurex/`. If the repository name changes, update `vite.config.js`.

## Important security notes

- New signups are always assigned the `client` role by a database trigger.
- Trainer role promotion is a trusted administrator action, not a browser action.
- RLS policies protect row-level access; do not rely on frontend route hiding.
- Coach notes are trainer-only.
- Guardian consent records are trainer-only in this V1.
- Keep real health, body measurement, and minor-related information to the minimum necessary.
- Obtain appropriate guardian consent and complete privacy/KVKK review before collecting minors' personal data.
- Test with separate trainer and client accounts before entering real information.
- Do not use production data in development or screenshots.

## Current V1 limitations

- Program creation currently saves the program header; the exercise-builder UI is the next module.
- Client account linking is a trusted admin operation in this starter version.
- Password reset, invitation emails, audit logging, data export/deletion workflows and automated tests should be added before a public launch.
- The initial schema is a foundation and should be reviewed against the gym's operational and legal requirements.

## Project structure

```text
public/
src/
  services/
  styles/
  utils/
supabase/
  migrations/
.github/workflows/
```

Built by EB Digital Studio.
