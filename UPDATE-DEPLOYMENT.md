# Deploy the login fixes on your existing Render Free service

1. Extract the updated ZIP and open its ra-susu folder.
2. In GitHub Desktop select your existing ra-susu repository and Repository → Show in Finder.
3. Copy the updated project contents into that cloned repository, replacing matching source files and merging folders. Keep the existing .git directory and any private .env files. Do not create an extra ra-susu folder inside the repository.
4. Commit with message: Fix participant login and imported-account guidance. Click Push origin.
5. On your existing Render web service, retain all existing environment variables, including the same DATABASE_URL, DIRECT_URL and AUTH_SECRET. Keep the same Neon database.
6. Set Build Command to:

```bash
npm ci --include=dev && npm run build && npm run db:migrate
```

Keep Start Command as:

```bash
npm start
```

7. Save. If an automatic deployment has not started, select Manual Deploy → Deploy latest commit.
8. Wait for Live. Migration 202611140003_first_login_activation must complete successfully. It adds activatedAt and recognizes previous successful token verification without deleting existing data.
9. Test an already activated participant by leaving the token field blank. For a new approved participant, use the issued token on the first login, sign out, then sign in again with only phone and password.

Do not rerun participant import or admin setup for this update. Your existing admin password and account remain valid. No new environment variables are required. A token reissued or deactivated by the admin intentionally resets activation. Rejected participants cannot sign in.

Changed application files:
- auth.ts
- lib/credentials.ts (new)
- lib/access.ts
- app/actions.ts
- app/login/page.tsx
- components/dashboard.tsx
- prisma/schema.prisma
- prisma/migrations/202611140003_first_login_activation/migration.sql (new)

The updated full project also includes revised tests and documentation. Keep previous migration files; never delete the Neon database to apply this update.

## Login troubleshooting revision

No additional database migration is required beyond the three already included. This revision normalizes copied token/reset-code whitespace and typographic dashes, explains duplicate imported phone registrations, marks password-setup-required participants for the admin, and adds private credential-free rejection categories to Render logs.

Additional changed files in this revision: lib/rules.ts and lib/data.ts, alongside lib/credentials.ts, app/actions.ts, app/login/page.tsx and components/dashboard.tsx. Tests and documentation are updated as well.

A participant imported from the spreadsheet must still set a password through the admin reset-code flow. Approval does not assign a password. Registering an already imported phone is rejected and does not overwrite that account's password. RST codes reset passwords; RAS tokens activate a participant once.

If login still fails after this update, check Render Logs immediately after one attempt. A line beginning [ra-susu][login-rejected] identifies the failed check:

| Category | Meaning / next step |
| --- | --- |
| PHONE_OR_PASSWORD_INCORRECT | Check registered phone; use the admin reset-code flow if the password is unknown. |
| ACCOUNT_NOT_APPROVED | Admin must approve the account. |
| FIRST_LOGIN_TOKEN_REQUIRED | Enter the participant's latest RAS activation token. |
| TOKEN_INVALID_EXPIRED_OR_REVOKED | Verify the complete token and its status in the admin dashboard. |
| ACCOUNT_CHANGED_DURING_LOGIN | An admin/password update overlapped sign-in; retry once with current credentials. |
| INPUT_TOO_LONG | Check for accidentally pasted content in the login fields. |

Logs never include entered phone numbers, passwords or raw tokens. Repeated attempts can also trigger the attempt limiter; wait 15 minutes rather than repeatedly retrying. Existing generic CredentialsSignin messages alone do not identify the cause.
