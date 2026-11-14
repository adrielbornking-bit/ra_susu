# Verification record

Validated on 14 November 2026. These checks establish the tested behavior of this source; they do not certify an external deployment or guarantee absence of defects.

| Check | Result |
| --- | --- |
| Next.js 15 optimized production build | Passed |
| Strict TypeScript check | Passed |
| Business-rule unit tests | 31 passed |
| Isolated PostgreSQL integration tests, with production HTTP authentication | 23 passed |
| SQL migrations on an empty PostgreSQL database | All three migrations applied |
| Spreadsheet records | 11 validated rows, 11 distinct normalized phones, no rejected rows |
| Report output | CSV, XLSX and PDF responses generated successfully |
| Runtime dependency audit | Zero known vulnerabilities reported by `npm audit --omit=dev` |
| Desktop browser visual review | Landing page and sample dashboard inspected; light/dark mode checked |

## What the tests cover

- Ghana phone normalization and malformed input rejection.
- Registration password confirmation, required fields and pending status.
- Payment amount boundaries, two-decimal precision and unsupported network rejection.
- Multi-slot requirements and correct allocation of verified credit across owned slots.
- CSV formula-prefix neutralization and quote escaping.
- Inserting all spreadsheet members as pending without fabricating kin phone numbers.
- Admin notification after a new registration.
- Denial of private access for pending or revoked sessions.
- Refusal to approve incomplete imported records.
- Admin approval, slot assignment and movement; occupied-slot deletion rejection.
- Hash-only token storage and revocation on reissue.
- Participant denial of administrator mutations and pages.
- Payment claims stored pending, duplicate transaction rejection and daily GH₵110 total enforcement.
- Single payment-confirmation transition and correct verified balance.
- Generation of CSV, Excel and PDF from ledger records.
- Admin-mediated password reset, password hashing and single-use reset-code consumption.
- Session invalidation following password changes.
- Rejection of unauthenticated reminder-job requests and deduplication of repeated scheduled jobs.
- Database constraints for payment bounds and a single super admin.
- Real Auth.js CSRF flow, rejection of an incorrect verification token, successful phone/password/token sign-in, admin username sign-in and protected dashboard rendering in the compiled production app.
- Suspension releases slots and revokes tokens while preserving the payment ledger.

## Checks requiring your deployment

The build was not deployed to a real Render account or connected to your Neon production database. Live wallet transfers are performed by participants through their mobile money network, outside this application; this app provides manual verification records. SMTP/SMS/WhatsApp delivery was not sent because no live provider credentials were supplied. Configure and test those services using the README.

Browser visual review used the desktop viewport. Responsive CSS and a touch/keyboard slot assignment form are implemented; physical-phone browser behavior still requires acceptance testing on your devices. Drag-and-drop, provider delivery, production cron timing and backup restore should be checked after setup. Slot-board updates use 20-second polling.

Email, SMS and WhatsApp notifications depend on provider configuration. Failed delivery attempts are visible in PostgreSQL’s `Delivery` records; there is no delivery-provider administration console in this version. The administrative Failed Payments metric represents manually rejected claims, since the app does not receive automated wallet failures.

The project intentionally requires deployment configuration, a securely generated admin password, and completion of missing participant kin phone details before those participants can be approved. No production secrets or default shared participant passwords are distributed.

## First-login activation update

Tokens are consumed atomically on first successful sign-in. Activation persists in the database, independent of cookies or browser storage. Existing approved members with a previously used, non-revoked token are activated by the migration. No passwords, participants, slots or payment records are removed. Admin token reissue/deactivation clears activation and invalidates sessions; rejection also clears activation. Password recovery preserves activation.

Additional coverage: first-login token omission, wrong token, wrong password, valid activation, subsequent token-free login, expiry after activation, reissue forcing activation again, revocation, and expired/revoked/used activation-code rejection. The production HTTP test covers first activation and a second cookie-independent sign-in without a token.

## Participant login review

Confirmed the existing first-activation path works with matching approved account, password and latest valid token. No single live-account cause can be established from the generic CredentialsSignin log alone. The review fixed copied-code formatting rejection and unclear imported-registration guidance; private rejection categories now distinguish the failing check. Newly added tests cover the complete imported-account password reset → approval → activation → later password-only sign-in path, duplicated registration without password overwrite, code formatting from messages, and rejection-log redaction. Total: 54 tests (31 unit tests and 23 PostgreSQL integration tests).
