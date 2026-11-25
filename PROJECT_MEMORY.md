# Sciss' Barber — Project Memory

## Current audited handoff (2026-11-25)

This section supersedes older status notes below where they conflict. The repository was reviewed at source level. JavaScript syntax, changed Pug templates, and whitespace checks passed; no tests, app server, browser flow, live database, email delivery, Cloudinary upload, or Razorpay transaction was run. Treat code-backed features below as **implemented, runtime verification pending**, unless explicitly called out as incomplete or deferred.

### Current architecture and workflows

- Node.js ES modules, Express 5, Mongoose/MongoDB, Pug, vanilla browser JavaScript, Tailwind CSS. `server.js` connects MongoDB, attempts SMTP verification, then starts `app.js`; `app.js` configures middleware, Pug, static files, Passport and mounts route modules.
- Request flow is route → middleware/validation → controller → service → Mongoose model. API errors end in `middlewares/errorMiddleware.js`; missing routes use `middlewares/notFoundMiddleware.js`.
- Customer auth uses the httpOnly `token` cookie; admin auth uses `admin_token`. JWTs use `JWT_SECRET` and include `tokenVersion`; password changes and logout increment the stored version to invalidate old tokens. Customer/admin roles are checked on protected routes.
- Password signup stores the hashed pending details in an email-verification OTP record, then creates the customer only after a valid `EMAIL_VERIFICATION` OTP. Google OAuth creates or links a verified customer through `config/passport.js`.
- New users receive unique `SB...` referral codes. Optional signup attribution is validated and retained in OTP signup data; a `Referral` relationship is stored atomically only after the referred customer's email OTP succeeds. Existing users receive a code when their profile is rendered.
- Online bookings use multiple service IDs, database-derived combined price/duration, stored per-service snapshots and dynamic slots. Razorpay or wallet payment can settle the advance. Booking cancellation within the allowed time window credits successful advance payments to the wallet. Admin booking management includes walk-in, status, cancel and reschedule operations.
- Shop-wide full-day and time-range closures have protected create/list/reopen APIs, IST calendar integration, booking conflict prevention and shared booking-lock transactions. The admin calendar can close dates, block ranges and reopen closures. Break schedules and special date hours are not configured.
- Wallet balance and transaction history endpoints exist. Wallet transactions are transactional and idempotency is protected by a unique transaction index. Reasons include `BOOKING_PAYMENT`, `BOOKING_REFUND` and `REFERRAL_REWARD`; no customer top-up flow exists.
- Admin revenue, payments, calendar and referrals pages use protected APIs (source implementation; runtime reconciliation pending). A referred customer's first completed booking credits ₹50 to the referrer's wallet in the completion transaction.
- The admin dashboard counts today's bookings by status and reports successful Razorpay and wallet payments using IST day bounds.

### Data relationships to remember

- `Booking.userId → User`; `Booking.walkInCustomerId → walkInCustomer`; `Booking.serviceId` and `serviceIds` → `Service`; `serviceSnapshots` preserves booking-time service name, price and duration; `Booking.barberId → Barber` for online booking. `bookingToken` is unique.
- `Service.categoryId → ServiceCategory`.
- `Payment.bookingId → Booking` (unique); `Payment.userId → User`.
- `User.referredBy → User`; `Referral.referrerId` and `Referral.referredUserId → User` (referred user is unique); a unique wallet ledger entry tracks the ₹50 referral reward.
- `Wallet.userId → User` (unique); `WalletTransaction.walletId → Wallet` and transaction `referenceId` points to the booking for payment/refund. Wallet transaction uniqueness is `(walletId, reason, referenceId)`.
- `BarberUnavailability.barberId → Barber`; `ShopAvailability` stores active shop closures; `Otp` stores temporary OTP and pending signup data; `Counter` issues booking tokens; `ShopRules` stores hours, weekly off, capacity, buffer, advance and booking lock version.
- Review the `WalletTransactionModel` `ref: 'Wallet'` versus `WalletModel` registered model name `'wallet'` if populate is ever introduced. No populate currently appears in wallet transaction reads.
- Signup UI sends an optional `referralCode`; verified attribution is recorded by `ReferralModel`, and the first completed booking issues the configured ₹50 reward to the referrer.

### Important endpoints (mounted as written)

- Auth/profile: `/api/user/signup`, `/api/user/verify-otp`, `/api/user/resend-otp`, `/api/user/login`, `/api/user/logout`, `/api/user/forget-password`, `/api/user/reset-password`, `/api/user/profile`, `/api/user/password`, `/api/user/email-change/request`, `/api/user/email-change/verify`; Google OAuth at `/api/user/auth/google` and callback.
- Customer pages: `/`, `/login`, `/signup`, `/about`, `/services`, `/profile`, `/wallet`, `/profile/edit`, `/booking`, `/bookings/history`, `/bookings/:bookingId`.
- Booking: `GET /api/bookings/available-slots`, `POST /api/bookings`, `GET /api/bookings/my-bookings`, `GET /api/bookings/history`, `GET /api/bookings/:bookingId`, `PATCH /api/bookings/:bookingId/cancel`, invoice page `GET /bookings/:bookingId/invoice`.
- Payment: `POST /api/payments/create-order`, `/api/payments/verify`, `/api/payments/failed`, `/api/payments/wallet`.
- Wallet: `GET /balance`, `GET /transactions` (these paths are mounted at the root by `app.js`, not under `/api`).
- Admin pages: `/admin/login`, `/admin/dashboard`, `/admin/calendar`, `/admin/booking`, `/admin/booking/:bookingId`, `/admin/services`, `/admin/users`, `/admin/users/:id`, `/admin/revenue`, `/admin/payments`, `/admin/referrals`.
- Admin APIs include `/api/admin/login`, `/api/admin/logout`, password reset, user list/details/block/unblock, booking status/cancel/reschedule/details/walk-in, calendar data at `/api/admin/calendar`, shop closures at `/api/admin/shop-availability`, revenue at `/api/admin/revenue`, payment reports at `/api/admin/payments`, referral listing/statistics at `/api/admin/referrals`, services and barber unavailability.

### Known gaps and setup notes

- `.env.example` lists runtime variables and `TZ=Asia/Calcutta`; copy it to a private local `.env` and keep actual credentials out of documentation and source control.
- Google OAuth requires provider callback configuration matching `GOOGLE_CALLBACK_URL`. SMTP startup verification logs an error and continues, but OTP email features will not work until configured.
- Multi-document booking/OTP/wallet transactions require MongoDB transaction support (normally a replica set or compatible managed cluster).
- Cloudinary is optional; image uploads fall back to local upload storage when unset. Verify cleanup/hosting behavior in the deployment environment.
- Revenue, payment and referral reporting have `GET /api/admin/revenue`, `GET /api/admin/payments` and `GET /api/admin/referrals`; verify summaries, filters and joins against actual records. Wallet top-up remains absent.
- The admin calendar API returns bookings, shop hours/week-off and active closures. Verify midnight closing, timezone boundaries and closure behavior in a running deployment.
- Baseline HTTP security headers are set. Shared-store rate limiting and Winston structured logging are not configured. Break schedules and special date hours need a defined data contract.
- Use `npm ci`, create a local `.env` from the variable list in `README.md`, seed shop rules/categories/barbers as appropriate (`scripts/seedShopRules.js`, `scripts/seedCategories.js`, `scripts/seedBarbers.js`; admin helper `utils/seedAdmin.js`), then `npm run dev`. The seed helpers are scripts/helpers; inspect each before use in a real DB.
- Tests exist under `tests/`; they were intentionally not run for the documentation task. Historical notes below mention earlier checks and should be interpreted as historical evidence only, not a current full-system verification.

### Documentation set

- `PROJECT_COMPLETION_REPORT.md`: module-by-module implementation and confidence/status.
- `PROJECT_STUDY_GUIDE.md`: source-led walkthrough and key function responsibilities.
- `PROJECT_FINAL_CHECKLIST.md`: remaining verification before submission.
- `README.md`: setup, environment variables, directory map and security notes.

Updated: 2026-11-25

Use this file as the handoff note for future work on the Sciss' Barber project. The user often prefers frontend/UI work and has asked to be consulted before starting unrelated new work. The current backlog request explicitly authorizes the listed backend work.

When changing code, add a concise `Worked by Codex` attribution comment beside the change, using the appropriate comment syntax for that file type.

## Earlier project notes (historical; superseded where they conflict with the audit above)

The following notes are preserved from prior handoffs. They record earlier requests and checks, but may describe an earlier code state. Use the current audit section above as the source of truth for present status.

## UI completed (historical notes)

### Home and public pages
- Landing page with the SCISS' hero, animated logo interaction, light/dark toggle, smooth section navigation, and an animated booking transition.
- About section and separate about page with image gallery/carousel.
- Home service preview and a separate services page with the provided full price list.
- Service pricing is in rupees; D-Tan is listed as “Ask in shop” because its price was unclear in the supplied image.
- Home checks the customer token before rendering and hides the header/footer Login links for signed-in customers. Profile and Edit Profile redirect signed-out visitors to `/login`.
- Customer logout is a POST to `/api/user/logout`; the home menu, profile, and edit-profile headers submit it. Customer session cookie options and its one-day lifetime are centralized in `utils/session.js`; password and Google login use those options. Expired/invalid, deleted, or blocked sessions are cleared; only customers count as signed in on public pages, and the customer profile API rejects admin roles. Admin sessions use a separate `admin_token` cookie and POST logout route.
- Customer session checks passed for backend JS syntax, Pug render and inline-script syntax, signed-in/signed-out home menu rendering, cookie options, logout controller, and customer-only authorization. Live Postman request could not connect to local server (`EPERM`), so HTTP exchange remains unverified.
- User-facing browser pages and `/api/user/...` endpoints live together in `routes/UserRoute.js`; admin pages and `/api/admin/...` endpoints live together in `routes/adminRoute.js`. `app.js` mounts those two routers directly. `PageRoute.js` and `routes/index.js` were removed per the user's direction. Existing API and page URLs are preserved.
- Page response logic lives in `controllers/UserController.js` and `controllers/adminController.js`; the route files now connect URLs/middleware to controller functions.

### Signup and login
- Signup form with browser validation, Google sign-in button, email OTP verification view, and resend OTP control.
- Signup password eye toggle in `views/user/signup.pug` uses the compact SVG and inline positioning consistent with login; it switches password/text and updates its `aria-label`.
- Login page eye toggles cover the login password and reset password fields. Edit-profile eye toggles cover current, new, and confirmation passwords. The normal profile overview has no password input; passwords are only entered in edit-profile. Keep the compact SVG and inline positioning consistent with signup. These controls are marked `Worked by Codex` in their Pug templates.
- User login rejects `ADMIN` roles; public-page auth recognizes only active `CUSTOMER` accounts. Customer and admin sign-in use separate cookies.
- Login form with Google sign-in, blocked-account modal, forgot-password modal, and email OTP/password reset screens.
- Login page has a “Cancel & return home” link.
- Google-linked users do not see password-change controls in edit-profile; password-reset requests also reject Google-linked accounts and ADMIN roles. The edit page reports that Google manages the password. Local accounts still see the current/new/confirm password fields.
- Signup OTP verification and resend countdown UI are implemented. Facebook sign-in UI is not present.

### Profile
- Profile overview and separate edit-profile page.
- Profile displays live customer booking data. Wallet credits remain inactive pending reward and redemption rules.
- The user asked to remove the Personal Information, Password, and Saved Address cards from the profile overview. Keep them removed unless asked otherwise.
- Profile navigation was simplified; HOME and theme controls are grouped at the top.
- Edit page has no sidebar. Personal details, email verification modal, and password controls are in the details card. Saved-address management was removed from the UI, API routes, service, and profile model. Password is masked by default and expands with a Change Password button.
- The edit-profile email verification dialog has explicit fixed positioning and automatic margins to center it.
- Edit Profile now sends a real 10-minute email-change OTP to the entered new address. Authenticated customer endpoints in `routes/UserRoute.js` send/resend and verify the code; the email changes in the database only after valid OTP verification. Duplicate and invalid addresses are rejected. This requires the existing `EMAIL_USER` and `EMAIL_PASS` mail configuration.
- Edit-profile Save Changes sends name and phone plus an optional profile image to `PATCH /api/user/profile`, and shows the API response. Profile images upload to Cloudinary when configured, remove the previous app-owned Cloudinary profile image after a successful replacement, and use local disk storage as a fallback. Live Cloudinary upload and cleanup remain unverified until credentials are configured.
- “Forgot current password?” opens the existing login reset modal. Cancel from that reset flow returns to the profile password section and reopens its fields.
- Wallet balance and ledger behavior are not implemented.

### Booking
- Booking UI uses active services from the backend and supports selecting multiple services. Availability uses the combined duration and price; booking creation, advance payment, OTP-based registration, and payment verification are connected.
- Customers can view upcoming and past appointments, cancel eligible bookings, and view invoices. Invoice payment display uses persisted successful payment records.
- Unit-level flow coverage verifies signup/OTP/login, multi-service booking, notification message generation, payment verification, and admin completion using mocked persistence and Razorpay.

### Admin
- Admin sign-in and forgot-password UI.
- Admin sessions use a separate `admin_token` cookie and POST logout route. Admin APIs verify an active ADMIN account on each request; protected dashboard requests redirect to sign-in when the session is invalid or blocked, and blocked admins cannot sign in. The login response returns the user but not the JWT.
- User management page has table UI, search/clear, pagination controls, latest-first display, and block/unblock confirmation UI. Verify API behavior separately before describing it as complete end-to-end.
- Admin monthly calendar is connected to existing bookings, with confirm, complete, cancel, and reschedule actions; rescheduling checks current shop availability.

## Pending / decisions

1. **Wallet policy:** Need the shop's booking credit and redemption limits before implementing money movement. Do not invent these values.
2. **Cloudinary:** Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to local `.env` to verify a real upload. Do not expose credentials in chat.
3. **End-to-end verification:** Local HTTP/browser and remote database access have not been available; current flow coverage is service-level with mocked external systems. Do not claim live DB, email delivery, or Razorpay charges were verified.
4. Facebook sign-in UI remains absent and was not part of the current backlog.

## Key files

- `views/user/home.pug`
- `routes/UserRoute.js` and `routes/adminRoute.js` (API routes)
- `utils/session.js` (customer session cookie helpers)
- `views/user/services.pug`
- `views/user/booking.pug`
- `views/user/signup.pug`
- `views/user/login.pug`
- `views/user/profile.pug`
- `views/user/profile-edit.pug`
- `views/admin/login.pug`
- `views/admin/users.pug`
- `public/css/input.css` (source CSS)
- `public/css/output.css` (generated Tailwind CSS)
- `app.js` (Express middleware and user/admin router mounting)

## Local UI workflow

- Templates use Pug and `views/layouts/minimal.pug`.
- After changing utility classes, rebuild CSS with:
  `npx tailwindcss -i ./public/css/input.css -o ./public/css/output.css`
- Pug templates can be compiled with the installed `pug` package.
