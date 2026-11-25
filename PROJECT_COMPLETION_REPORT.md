# Sciss' Barber — Project Completion Report

**Audit date:** 2026-11-25  
**Scope:** Source review and implementation updates. No tests, server, browser flows, provider calls, email delivery, or database operations were run. JavaScript syntax, Pug compilation, and whitespace checks passed for the changed sources.

## Project overview

Sciss' Barber is a barbershop website and appointment-management application. Customers can browse services, register or sign in, select services and appointments, pay an advance, manage their profile, and view bookings. Admins can manage customers, services, bookings, walk-ins and calendar operations. The implementation includes Razorpay and a ledger-backed wallet, plus email notifications and OTP workflows.

## Stack and architecture

- Node.js with ES modules; Express 5 handles HTTP routing and middleware.
- MongoDB through Mongoose models and query/session APIs.
- Pug server-rendered pages, vanilla JavaScript in templates, and Tailwind CSS (`public/css/input.css` → `public/css/output.css`).
- Passport Google OAuth, JWTs in role-specific httpOnly cookies, bcrypt password hashing, Nodemailer SMTP, Razorpay SDK and optional Cloudinary image storage.
- `server.js` connects the database and starts the app; `app.js` configures middleware, view engine, static files, Passport and route mounts. Routes delegate to controllers, controllers to services, services to models/integrations.

## Status definitions and evidence

- **COMPLETED** means implementation and the relevant behavior were verified. No end-to-end runtime verification was performed during this audit, so no feature is newly marked COMPLETED.
- **IMPLEMENTED** means the code path is present in the repository; deployment/runtime verification is still needed.
- **PARTIAL** means some screens or code exist, but material integration or functionality is missing.
- **NOT IMPLEMENTED** means no implementation was found in the inspected repository.
- **DEFERRED** means work is intentionally waiting on a policy, backend contract, or external setup.

These statuses are source audit findings, not a claim that the running application was exercised. Earlier `PROJECT_MEMORY.md` notes mention historical checks and mocked service tests; those are not treated as a fresh verification of the current working tree.

## Feature status

| Feature | Status | Source evidence / gap |
|---|---|---|
| Express app startup and Pug rendering | IMPLEMENTED | `server.js`, `app.js`; no server boot performed. |
| Public home, about and services pages | IMPLEMENTED | `views/user/*`, `UserController`, `ServiceController`; browser rendering not checked. |
| Customer signup, OTP verification and resend | IMPLEMENTED | `UserService.UsersignUp`, `otpService.verifyOtp` and `resendOtp`; email delivery and Mongo transaction not exercised. Optional referral attribution is carried with pending OTP signup data and persisted only after OTP verification. |
| Google OAuth | IMPLEMENTED | `config/passport.js`, `googleAuthMiddleware`, `UserController`; provider credentials/callback and real OAuth not verified. |
| Customer login/logout and session checks | IMPLEMENTED | `UserService.userLogin`, `authMiddleware`, `utils/session.js`; cookies and invalidation not exercised in browser. |
| Forgot/reset password and email change OTP | IMPLEMENTED | `UserService`, `otpService`, validation middleware and `UserRoute`; SMTP and actual OTP cycle pending. |
| Customer profile edits and image upload | IMPLEMENTED | Authenticated self-service updates validate name and Indian mobile numbers; uploads are size-limited, restricted to raster image MIME types, checked against file signatures, and stored under generated local filenames. `UpdateUserProfile`, `uploadMiddleware`, and `cloudinaryService`; Cloudinary/local filesystem behavior not runtime verified. |
| Multiple-service booking and combined duration/price | IMPLEMENTED | `BookingService.getCustomerAvailableSlotsService` and `createBookingService`; real DB availability not exercised. |
| Multiple-service booking snapshots | IMPLEMENTED | `Booking.serviceSnapshots` preserves service name, price and duration; older bookings fall back to populated references. Runtime/database behavior pending. |
| Slot capacity, buffers, shop hours, weekly off, barber unavailability and shop closures | IMPLEMENTED | `BookingService.getAvailableSlotsService` checks shop closures and rechecks inside booking transactions; full runtime concurrency verification pending. |
| Shop closure administration | IMPLEMENTED | Protected create/list/reopen API; closure writes share the booking lock, reject active booking conflicts, validate shop hours and feed customer slot filtering. Admin calendar controls are present; runtime verification pending. |
| Break handling and special date working hours | NOT IMPLEMENTED | `ShopRules` has no break schedule or per-date special-hours contract. These require explicit operating-hour data and admin configuration. |
| Customer booking list, details, cancellation and booking receipt | IMPLEMENTED | `BookingService` and `BookingController`; UI/API end-to-end behavior pending. Receipt is not a GST/tax invoice. |
| Razorpay order, verification and failure handling | IMPLEMENTED | `PaymentService` and `PaymentController`; credentials/provider payment not verified. |
| Wallet balance, history, debit and booking refund credit | IMPLEMENTED | `WalletService`, wallet routes/controllers and payment/admin cancellation services; live transactional deployment not verified. |
| Wallet top-up | DEFERRED | No wallet funding/top-up flow exists. |
| Admin login, logout and user administration | IMPLEMENTED | `adminService`, `adminController`, `adminRoute`; no live admin session verified. |
| Admin dashboard | IMPLEMENTED | `getAdminDashboardData` reports today's appointments by status and successful Razorpay/wallet payments using IST day bounds. Runtime reconciliation pending. |
| Admin booking list/details/status/cancel/reschedule/walk-in | IMPLEMENTED | `AdminBookingService`, `AdminBookingController`, `AdminBookingRoute`; walk-in creation now rechecks slots transactionally and records barber/service snapshots. Manual workflows not run. |
| Admin calendar | IMPLEMENTED | `GET /api/admin/calendar` returns bookings, shop rules, active shop closures and barber unavailability; daily dialog displays working periods and both shop-wide and barber-specific unavailable periods. Runtime timezone/empty states pending. |
| Admin services and barber unavailability management | IMPLEMENTED | `ServiceService` / `BarberUnavailabilityService` and routes; verify against configured data. |
| Admin revenue reporting | IMPLEMENTED | Protected `GET /api/admin/revenue` aggregates successful Payment records, booking status counts, refund credits and daily totals; runtime/database verification is pending. |
| Admin payment management/reporting | IMPLEMENTED | Protected `GET /api/admin/payments` provides paginated payment records, customer/booking context, date/method/status/search filters, and date-range summaries; runtime/database verification is pending. |
| Referral codes and verified-signup tracking | IMPLEMENTED | `User.referralCode`, `User.referredBy`, OTP signup data, and `ReferralModel` persist a code-linked relationship only after verified signup; signup lookup accepts legacy mixed-case codes. Runtime/database verification is pending. |
| Admin referral listing/statistics | IMPLEMENTED | Protected `GET /api/admin/referrals` returns verified signup records and reward-policy states with search/filter/pagination; runtime verification is pending. |
| Referral reward eligibility and processing | IMPLEMENTED | A referred customer's first completed booking atomically credits ₹50 to the referrer's wallet and updates the referral record. Runtime transaction verification pending. |
| Customer-facing booking confirmation/receipt | IMPLEMENTED | Booking detail/history and receipt show stored service snapshots and payment data; live flow remains pending. |
| SMTP booking notifications | IMPLEMENTED | `BookingService` sends an admin notification after booking commit; `server.js` verifies SMTP opportunistically. Delivery not verified. |
| Facebook OAuth | NOT IMPLEMENTED | No route/provider integration found. |
| Deployment configuration and production readiness | PARTIAL | Environment-driven config exists, but deployment, secrets, database topology, provider callbacks and operational logging are not verified. |

## Customer workflow

1. Browse `/`, `/about`, `/services`; public service data is fetched from `GET /api/services`.
2. Register at `/signup` via `POST /api/user/signup`; an `EMAIL_VERIFICATION` OTP is mailed. `POST /api/user/verify-otp` verifies the OTP and creates the customer in a Mongo transaction. Resend uses `POST /api/user/resend-otp`.
3. Sign in at `/login` via `POST /api/user/login`, or use Google OAuth. Successful local login sets the `token` cookie.
4. Choose one or more services at `/booking`; the page requests `GET /api/bookings/available-slots` and posts selected `serviceIds`, date and start time to `POST /api/bookings`.
5. Pay booking advance through Razorpay order creation/verification, or wallet payment. Confirmed bookings appear under profile/history/detail and invoice pages.
6. Profile editing supports name/phone/image updates, email-change OTP, and local password changes. `/wallet` reads wallet balance and transaction history.

Source-flow note: the booking client and API both use combined service IDs; check actual field/date formatting in final browser review. Referral code entry is optional and tracked after successful email verification; the source issues a ₹50 reward when the referred customer completes a booking.

## Admin workflow

1. Admin signs in at `/admin/login` through `/api/admin/login`; middleware checks the separate `admin_token` session and current user role/status.
2. `/admin/dashboard` loads today's appointment summary from `AdminDashboardService`.
3. `/admin/booking` provides searchable/paginated booking management; details load at `/admin/booking/:bookingId`. Existing APIs support status changes, rescheduling, cancellation and walk-in creation.
4. `/admin/calendar` fetches `/api/admin/calendar?month=YYYY-MM`; response contains `bookings`, `closures`, barber `unavailabilities`, and `shopRules`.
5. `/admin/users`, `/admin/services`, and barber unavailability screens manage customer/service/availability data.
6. The calendar API returns bookings, shop rules and active closures; its daily dialog can close a full day, block a time range or reopen a closure.
7. Revenue, payment and referral pages call protected APIs; a referred customer's first completed booking credits ₹50 to the referrer's wallet.

## Authentication and authorization

`middlewares/authMiddleware.js` reads `token` (customer) or `admin_token` (admin), verifies JWT with `JWT_SECRET`, reloads the account, checks status and compares JWT `tokenVersion`. `protect` returns JSON 401 for missing/invalid customer sessions; `optionalAuth` permits public page access and sets `req.user` only for an active customer; `customerOnly` checks the role. `adminProtect` returns JSON 401; `adminPageProtect` redirects invalid admin sessions to `/admin/login`. `adminOnly` adds an explicit admin-role gate. `preventCache` marks private pages non-cacheable.

`utils/session.js` centralizes httpOnly, SameSite=Lax, one-day cookies and `secure` in production. Password reset/change and logout update `tokenVersion` in the relevant flows. Admin and customer cookies are distinct.

## Booking and availability

`BookingService.getCustomerAvailableSlotsService` normalizes selected service IDs, loads active services, sums their durations and asks `getAvailableSlotsService` for candidate times. The slot service loads `ShopRules`, rejects past dates/weekly off days, accounts for midnight closing by moving closing to the next day when it is not later than opening, applies buffer minutes and capacity, and filters barber bookings, barber unavailability and shop closures. `createBookingService` repeats availability validation inside a Mongo session transaction, increments a shared shop rule lock version, sums service prices/durations from active database records, stores service snapshots, chooses a barber with earliest idle time, allocates a token through `Counter`, and persists a `PENDING` booking. It then attempts an admin email notification; notification failure is logged without undoing the saved booking.

Shop closure create/reopen operations and barber-unavailability creation increment `ShopRules.bookingLockVersion` in a Mongo transaction. Closure creation checks overlapping closures and active bookings; unavailability creation checks overlapping unavailability and barber bookings. These writes serialize against customer booking creation and admin rescheduling. Full-day closure intervals use configured hours, including overnight hours; time-range closures must fit those hours. The admin calendar returns closures and draws available, booked and closed periods. Runtime concurrency and timezone behavior still need verification.

## Payment and wallet

`PaymentService.createPaymentOrderService` loads the customer's pending/failed booking, checks requested services match persisted services, creates a Razorpay order for `advanceAmount` converted to paise, and writes or updates `Payment`. `verifyPaymentService` checks HMAC signature and fetches the Razorpay payment to confirm order, captured status, amount and currency; in a Mongo transaction it marks Payment `SUCCESS` and Booking `CONFIRMED`. `markPaymentFailedService` fetches the provider state and only marks failure after confirming it. `payWithWalletService` runs wallet debit, payment record and booking confirmation in a Mongo transaction.

`WalletService.CreateWalletService` uses atomic `findOneAndUpdate` upsert with `$setOnInsert` and optional session. `creditWalletService` accepts `BOOKING_REFUND` and `REFERRAL_REWARD`; `debitWalletService` only accepts `BOOKING_PAYMENT`. `executeWalletTransaction` reuses the caller session or opens its own transaction. Both methods check for an existing reason/reference transaction, update balance, and create a ledger entry including `balanceAfter`; the unique ledger index provides a second idempotency guard. Admin/customer cancellation services credit successful advances to wallet when their cancellation rules allow. No customer wallet top-up endpoint exists.

## Profile, dashboard, referrals and invoices

Profile and user data are centered on `User`; profile images use `uploadMiddleware.js`, optionally invoking Cloudinary and falling back to local upload storage. Admin dashboard metrics count bookings for the current IST day and sum successful payment records, separating Razorpay and wallet amounts.

Booking receipts render a customer-owned booking with stored service snapshots and payment details, omit the payment signature, and state that the document is not a GST/tax invoice. Referral codes and verified-signup relationships are persisted; the referred customer's first completed booking atomically credits ₹50 to the referrer. Revenue and payment pages consume protected admin APIs; reconcile outputs against stored records before treating them as runtime verified.

## Database models and relationships

| Model | Purpose and relationships |
|---|---|
| `User` | Customer/admin identity, unique normalized email, role/status, password/provider IDs, profile, verification and token version. |
| `ServiceCategory` | Unique service category name. |
| `Service` | Price, duration, active state; references category. |
| `Booking` | Customer or walk-in appointment, service references and booking-time service snapshots, barber, times, token, price/duration/advance and status. |
| `Payment` | Unique booking payment, customer, Razorpay IDs, method, amount/currency/status. |
| `Wallet` | Unique customer balance and currency. |
| `WalletTransaction` | Credit/debit ledger and balance-after snapshot, wallet and booking reference, unique idempotency key. |
| `Referral` | Referrer, referred customer, referral-code snapshot, reward-policy status, and optional reward transaction reference. One tracked referral per referred customer. |
| `Barber` | Active staff member. |
| `BarberUnavailability` | Barber and unavailable time range. |
| `ShopRules` | Hours, weekly off, capacity, buffer, advance and booking lock. |
| `ShopAvailability` | Shop-wide full-day or time-range closure, reason and active/reopened state. |
| `Counter` | Sequence used for human-readable booking tokens. |
| `Otp` | Email/purpose OTP expiry, attempts/lock and pending signup fields. |
| `walkInCustomer` | Name/phone record for admin walk-in bookings. |

## API route index

All route files are mounted directly in `app.js`; paths below are literal paths, not prefixed router mounts.

### Customer and public

| Method and path | Purpose |
|---|---|
| `POST /api/user/signup` | Start signup and send email OTP. |
| `POST /api/user/verify-otp` | Verify email OTP and create customer. |
| `POST /api/user/resend-otp` | Resend an OTP for its purpose. |
| `POST /api/user/login`, `POST /api/user/logout` | Customer session start/end. |
| `POST /api/user/forget-password`, `PATCH /api/user/reset-password` | Password reset request/finish. |
| `PATCH /api/user/profile`, `PATCH /api/user/password` | Profile/password update. |
| `POST /api/user/email-change/request`, `POST /api/user/email-change/verify` | Email change OTP. |
| `GET /api/user/auth/google`, callback path | Google OAuth. |
| `GET /api/services`, `GET /api/services/:id`, `GET /api/services/category/:categoryId` | Public service catalog. |
| `GET /api/bookings/available-slots` | Available customer appointment periods. |
| `POST /api/bookings` | Create online booking. |
| `GET /api/bookings/my-bookings`, `/api/bookings/history`, `/api/bookings/:bookingId` | Customer bookings. |
| `PATCH /api/bookings/:bookingId/cancel` | Cancel eligible customer booking. |
| `POST /api/payments/create-order`, `/verify`, `/failed`, `/wallet` | Create/verify/fail Razorpay or pay wallet advance. Full paths share `/api/payments`. |
| `GET /balance`, `GET /transactions` | Customer wallet balance and ledger. These are root-level paths. |

### Admin

| Method and path | Purpose |
|---|---|
| `POST /api/admin/login`, `/logout`, `/forget-password`, `PATCH /api/admin/reset-password` | Admin authentication/password reset. |
| `GET /api/admin/getUser`, `GET /api/admin/users/:id`, `PATCH /api/admin/users/:id/block`, `/unblock` | User management. |
| `GET /api/admin/calendar` | Calendar bookings and shop rules. |
| `POST /api/admin/shop-availability`, `GET /api/admin/shop-availability`, `PATCH /api/admin/shop-availability/:id/reopen` | Admin shop closure create/list/reopen operations. |
| `GET /api/admin/bookings/:bookingId`, `PATCH .../:bookingId/status`, `/cancel`, `/reschedule`, `POST /api/admin/bookings/walk-in` | Admin booking operations. |
| `GET /api/admin/revenue` | Revenue totals, booking counts, refund totals, daily totals and paginated payment records; accepts `from`, `to`, `page`, `limit`, `search` and `method`. |
| `GET /api/admin/payments` | Payment summaries and paginated records with customer and booking context; accepts `from`, `to`, `page`, `limit`, `search`, `method` and `status`. |
| `GET /api/admin/referrals` | Referral summary and paginated verified-signup records; accepts `page`, `limit`, `search` and reward `status`. |
| `POST /api/admin/services`, `PUT/DELETE /api/admin/services/:id` | Service management. |
| `POST /api/admin/barber/unavailability`, `GET /api/admin/barber/unavailablity` | Barber schedule unavailability (GET path spelling is literal). |

`/admin/revenue`, `/admin/payments`, `/admin/referrals`, and `/admin/calendar` consume their corresponding protected APIs. The calendar uses the shop closure API. Referral rewards are source-implemented at ₹50 after the first completed booking; runtime transaction verification remains pending.

## Verification and handover conclusion

This repository is **ready for a source-based final review, but not yet verified as a complete running system**. Before a confident final submission, configure local dependencies/secrets and MongoDB transaction support, run the full customer/admin workflows manually against a non-production environment, verify OTP email and OAuth callbacks, test Razorpay in test mode, test Cloudinary or local upload behavior, and verify wallet refund semantics and reporting figures against persisted records. The source sets the referral reward to ₹50; verify that behavior in a transaction-capable development database. Do not describe external or end-to-end behavior as verified until observed.
