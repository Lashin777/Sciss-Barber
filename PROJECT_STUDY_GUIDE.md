# Sciss' Barber — Developer Study Guide

This guide follows the code that exists in the repository. It explains source behavior; it does not claim the application was run during this audit. Start at `server.js`, then trace a route through its controller, service and model.

## 1. Start with the application entry point

### `server.js`

`startServer()` awaits `connectDB()` from `config/db.js`. If MongoDB connection fails, `connectDB` logs the failure and exits. After the database connects, `server.js` calls `verifyEmailConnection()`; SMTP failure is logged but does not prevent listening. Finally, Express listens on `process.env.PORT`.

### `app.js`

`app.js` loads dotenv, creates Express, sets Pug as the view engine, enables JSON and URL-encoded bodies, serves `public/` and `/uploads`, parses cookies, initializes Passport, then mounts each route module. The routes are mounted directly, so their declared paths are the final URL paths. The not-found and error handlers are registered last.

The current mount sequence is `UserRoute`, `adminRoute`, `serviceRoute`, `BarberUnavailabilityRoute`, `BookingRoute`, `AdminBookingRoute`, `PaymentRoute`, `WalletRoute`, `ShopAvailabilityRoute`. This order matters when paths overlap. Pug templates live under `views/`; static frontend CSS/images are under `public/`.

## 2. MVC and request flow

The application uses an MVC-like separation with service modules between controllers and models:

1. A route in `routes/*.js` matches method/path and attaches middleware.
2. Middleware authenticates, authorizes, validates, or parses uploads.
3. A controller in `controllers/*.js` reads `req`, calls one or more service functions, then returns JSON or calls `res.render(...)`.
4. A service in `services/*.js` implements workflow rules and coordinates Mongoose models or external integrations.
5. A model in `models/*.js` defines the persisted document fields, references, indexes, and validation.

Example customer booking trace:

- `routes/BookingRoute.js`: `POST /api/bookings` applies `protect` and `customerOnly`, then calls `createBookingController`.
- `controllers/BookingController.js`: passes `req.user._id`, service IDs, date and start time to `createBookingService`.
- `services/BookingService.js`: checks services/rules/availability, starts a transaction, assigns barber/token, creates a `Booking` document and attempts the admin notification.
- `models/bookingModel.js`, `models/Service.js`, `models/ShopRules.js`, `models/Barber.js`, `models/counterModel.js`: describe and persist the records used by this flow.

Page routes use the same pattern but the controller usually passes data to a Pug template with `res.render`. Some pages fetch their data from browser JavaScript after the initial HTML response.

## 3. Authentication, JWT and roles

`services/UserService.js` handles password checks and JWT creation. `utils/passwordUtils.js` wraps bcrypt with cost factor 10. `userLogin()` normalizes email, loads a customer account, compares the password, rejects blocked or unverified accounts, and signs a JWT containing user ID, role and `tokenVersion` with a one-day expiry.

`utils/session.js` sets the JWT in an httpOnly `token` cookie. It also defines a separate `admin_token` cookie. Cookie options are `sameSite: 'lax'`, path `/`, one-day max age, and `secure` only when `NODE_ENV === 'production'`.

`middlewares/authMiddleware.js` is the gatekeeper:

- `protect` requires customer cookie `token`, verifies its signature, loads the user without password, checks blocked/deleted status and checks token version. It assigns the user document to `req.user`; failures clear the cookie and respond 401.
- `optionalAuth` permits anonymous requests and sets `req.user = null`. If a valid customer session exists it attaches the user; invalid/non-customer sessions are cleared.
- `customerOnly` checks `req.user.role === 'CUSTOMER'`.
- `loadAdminSession` verifies `admin_token`, reloads the user and checks ADMIN role, status and `tokenVersion`.
- `adminProtect` returns JSON 401 if the admin session is invalid; `adminPageProtect` redirects to `/admin/login`; `adminOnly` checks role.
- `preventCache` sets private no-cache headers on pages that expose account information.

Incrementing `User.tokenVersion` makes already-issued tokens invalid on the next protected request. Password reset/change and logout use this to revoke old sessions. This design stores JWT state in MongoDB only as a token-version number rather than keeping server-side session objects.

## 4. MongoDB and Mongoose models

Each file under `models/` exports a Mongoose model. A schema defines fields, required/default values, references and unique constraints. A field with `ref` stores an ObjectId; `.populate()` replaces that identifier with selected fields from its referenced collection when a query requests it.

Important relationship map:

- `Booking.userId` → `User`; `Booking.walkInCustomerId` → `walkInCustomer`.
- `Booking.serviceId` is a legacy/primary service link; `Booking.serviceIds` is the selected service array → `Service`; `Booking.serviceSnapshots` keeps the name, price and duration used at booking time.
- `Booking.barberId` → `Barber`; online bookings have an assigned barber.
- `Service.categoryId` → `ServiceCategory`.
- `Payment.bookingId` → `Booking` (unique payment per booking); `Payment.userId` → `User`.
- `Wallet.userId` → `User` (unique); `WalletTransaction.walletId` → wallet and `referenceId` is used for a related booking.
- `BarberUnavailability.barberId` → `Barber`.
- `ShopRules` contains the shop-wide availability settings; `Counter` stores the booking token sequence.
- `Otp` contains temporary verification/reset state and pending signup information.
- `Referral` links a verified referred customer to a referrer and stores the submitted code snapshot and reward-policy state. A unique `referredUserId` prevents more than one attribution record per customer.

The Wallet model is registered with the lowercase name `'wallet'`, but `WalletTransactionModel.js` declares its wallet reference as `'Wallet'`. Current wallet queries do not populate that field, but a future populate should check this model-name difference.

Mongo sessions and transactions appear in booking creation, OTP account creation, wallet money movement, and booking cancellation/rescheduling. MongoDB transactions require a deployment topology that supports them (normally a replica set).

## 5. Signup, OTP, login and email flows

`UserService.UsersignUp(email, name, password, phone, otpSender)`:

1. Trims and lowercases email, then checks for an existing user.
2. Hashes the password with bcrypt.
3. Calls `otpSender(email, 'EMAIL_VERIFICATION', signupData)` with name, hash and phone.
4. Returns the normalized email. The normal password signup path does not create a `User` yet.

`otpService.generateOtp()` creates a random six-digit OTP record with a 10-minute expiry. Signup OTP records retain the hashed pending signup fields. It sends email through `services/emailService.js`; if sending fails, it removes the newly created OTP. It then removes older unused OTPs for the same address/purpose.

`otpService.verifyOtp()` handles email verification specially: it limits failed attempts and temporarily locks after five incorrect codes. On a correct email verification OTP, it opens a Mongo transaction, marks the OTP used, reads `signupData`, checks for a duplicate email, creates a verified `User`, and deletes the OTP records. Other OTP purposes call `consumeOtp()`, which checks email, purpose, unused state and expiry, then atomically marks it used.

`resendOtp()` requires pending signup data for email verification and then generates a replacement OTP. Email change and password reset use separate purposes. Signup uses `POST /api/user/signup`, `/verify-otp`, and `/resend-otp`.

Google OAuth is configured in `config/passport.js`. The strategy finds an account by Google ID, then by email to link an existing customer, or creates a new verified customer. It rejects blocked/non-customer accounts. `routes/UserRoute.js` declares OAuth start and callback routes; `googleAuthMiddleware.js` and `UserController.googleCallbackController` finish the session.

SMTP is configured in `services/emailService.js` using `EMAIL_USER` and `EMAIL_PASS`. `verifyEmailConnection()` is a startup connectivity check, not proof that all future mail deliveries succeed.

## 6. Booking and dynamic availability

### Slot lookup

`GET /api/bookings/available-slots` is routed by `BookingRoute.js` to `getAvailableSlotsController`. The controller accepts service IDs (comma-separated `serviceIds`, array, or legacy `serviceId`) and a date. `getCustomerAvailableSlotsService()` normalizes/deduplicates IDs, verifies ObjectId format, loads active `Service` documents, sums duration, and calls `getAvailableSlotsService()`.

`getAvailableSlotsService()` reads `ShopRules`, active `Barber` records, existing active bookings, barber unavailability and active shop closures. It:

- rejects invalid/past dates and the configured weekly off;
- parses opening/closing times and moves closing to the next day when closing is at/before opening (for example 11:00 to 00:00);
- considers service duration, buffer minutes and maximum concurrent bookings;
- avoids past slots for today, barber overlaps, barber/shop unavailability and shop capacity conflicts;
- returns candidate start/end times; customer slot output groups times and omits individual barber choices.

### Persisting a booking

`createBookingService()` receives customer ID, selected service IDs, date and start time. It starts a Mongoose session transaction, loads shop rules and increments `bookingLockVersion` to serialize competing availability decisions, loads all active selected services, sums price and duration from those database records, creates service snapshots, validates advance amount, and rechecks the requested slot inside the transaction. It chooses an eligible barber, increments `Counter` and creates one `Booking` with a token like `SB-0001`, PENDING status, service IDs, snapshots, aggregate amount/duration, advance and appointment times.

After commit it populates booking details and tries `sendBookingNotification()`. Notification failure is logged; it does not roll back an already saved booking.

`createWalkInBookingService()` is separate: it upserts a `walkInCustomer` by phone, uses one service, computes end time from that service duration, increments the same token counter and persists a completed walk-in booking. It does not use the online payment flow.

### Booking views and cancellation

`getMyBookingsService`, `getBookingDetailsService`, `getBookingHistoryService`, and `getBookingInvoiceService` query a customer's own bookings and populate service/barber/user references as appropriate. New bookings render service snapshots so later catalog edits do not rewrite the receipt. The receipt route renders `views/user/booking-invoice.pug`, omits the payment signature and explicitly states that it is not a GST/tax invoice. Customer and admin cancellation allow only eligible statuses and reject cancellation within three hours of appointment time. If a successful payment exists, each cancellation service credits the paid amount to wallet before setting CANCELLED, inside a transaction.

`ShopAvailabilityRoute.js` exposes admin-only create/list/reopen operations for full-day and time-range closures. Closure creation validates the requested range against shop hours, rejects overlapping active closures and scheduled bookings, and uses the same `ShopRules.bookingLockVersion` write as booking creation to serialize concurrent decisions. Full-day closure intervals follow configured working hours, including overnight hours. Barber-unavailability creation uses that same lock, and rejects overlapping scheduled bookings. Reopening a shop closure sets `isActive` to false. The slot service filters any candidate interval overlapping a closure; the admin month API also returns active closures and barber-specific unavailable periods for the calendar. Runtime concurrency behavior remains pending.

## 7. Payments: Razorpay and wallet

Payment routes in `routes/PaymentRoute.js` are protected customer APIs. `POST /api/payments/create-order` receives the persisted booking ID (and optional service IDs), validates ownership/status and that selected services match the stored booking. `createPaymentOrderService()` uses the stored `advanceAmount`, converts rupees to paise, calls Razorpay `orders.create`, saves a `Payment` record and returns `orderId`, amount, currency and public `keyId`.

After Razorpay checkout, the client sends `razorpay_order_id`, `razorpay_payment_id` and signature to `POST /api/payments/verify`. `verifyPaymentService()` computes an HMAC SHA-256 using `RAZORPAY_KEY_SECRET`, compares it safely, fetches the payment from Razorpay and checks provider order ID, captured status, amount and currency. A database transaction then changes payment to SUCCESS and booking to CONFIRMED.

`POST /api/payments/failed` calls Razorpay to verify that the provider payment really failed before marking payment and booking failed. `POST /api/payments/wallet` passes booking ID to `payWithWalletService()`, which atomically debits wallet advance, persists a WALLET SUCCESS payment and confirms the booking.

Razorpay and wallet flows require Mongo transaction support where shown. A source read cannot establish gateway configuration, provider status, browser checkout, or actual settlement; perform a test-mode manual verification before claiming end-to-end success.

## 8. Wallet ledger and refunds

`WalletService.CreateWalletService(userId, session)` is an atomic `findOneAndUpdate` with `upsert` and `$setOnInsert`; existing balances/fields are not reset. It attaches the optional supplied session. Balance/history APIs use this helper, so reading can create a zero-balance wallet.

`executeWalletTransaction()` reuses a caller-provided session or creates its own session and transaction. `debitWalletService()` only permits reason `BOOKING_PAYMENT`, checks an existing `(wallet, type, reason, reference)` transaction and sufficient balance, subtracts funds, saves the wallet and inserts a ledger row with `balanceAfter`. `creditWalletService()` accepts `BOOKING_REFUND` and `REFERRAL_REWARD`. Referral reward issuance is part of the transaction that marks a referred customer's first completed booking and credits ₹50 to the referrer's wallet. Database uniqueness protects against duplicate ledger writes. No route for wallet funding/top-up exists.

Wallet pages call root-level `GET /balance` and `GET /transactions`. These routes require customer cookies and return balance or transaction arrays in JSON.

## 9. Admin functionality

Admin HTTP pages/APIs are in `routes/adminRoute.js` and `routes/AdminBookingRoute.js`; controllers in `adminController.js` and `AdminBookingController.js`; shared logic lives in `adminService.js`, `AdminDashboardService.js` and `AdminBookingService.js`.

- Admin auth checks role/status on every protected request. `utils/seedAdmin.js` is a helper for creating an admin; inspect its exact behavior before running it.
- User management lists/searches/paginates customers and supports block/unblock. Blocking is represented on `User.status` and invalidates active sessions through token version behavior in the service.
- Booking management queries related customer, service and barber documents, applies paging/status/search filters, supports allowed status transitions, cancellation/refund and availability-aware rescheduling.
- Walk-in route is `POST /api/admin/bookings/walk-in`; dashboard entry navigates into the admin booking interface.
- `AdminDashboardService.getAdminDashboardData()` fetches bookings for the India-local day and returns appointment display rows, status counts, and successful Razorpay/wallet payment totals.
- `getAdminCalendarBookings(month)` returns a selected month’s booking details, shop rules and active shop closures. `/api/admin/calendar` exposes it as JSON. The calendar displays a daily timeline and provides controls to close a day, block a time range, and reopen active closures.
- `/admin/revenue` renders `views/admin/revenue.pug`; its browser script calls protected `GET /api/admin/revenue`. Query parameters are optional `from` and `to` (`YYYY-MM-DD`, interpreted in `Asia/Kolkata`), `page`, `limit` (10/25/50), `search` (booking token/customer name/email/phone) and `method` (`RAZORPAY`/`WALLET`). The API returns a selected-period summary, independent today/week-to-date/month-to-date successful payment totals, daily successful payment sums, and paginated payment records. Summary and chart use successful `Payment` documents; pending/failed records appear only in the table. Refund total sums `WalletTransaction` CREDIT records with reason `BOOKING_REFUND` and remains separate from gross payment revenue. Booking counts filter `Booking.createdAt` by range and group each booking's present status, because no status-history model exists.
- `/admin/payments` renders `views/admin/payments.pug`; its browser script calls protected `GET /api/admin/payments`. Query parameters are optional `from`/`to` dates, `page`, `limit` (10/25/50), `search` (payment/booking ID, booking token or customer name/email/phone), `method` and `status`. Date ranges filter payment `createdAt` in Asia/Kolkata; the summary reflects the date range, while method/status/search narrow the record list. Records sort newest-first and include only payment fields plus safe customer and booking details; Razorpay signatures and provider IDs are omitted. Summary totals distinguish all recorded amounts from successful amounts and group counts/amounts by method.
- `/admin/referrals` renders the referral management page and consumes the same protected `GET /api/admin/referrals` endpoint described above.

## 10. Referral tracking and reward boundary

`User.referralCode` is generated for new users and indexed unique; `User.referredBy` stores the referring user ID. Legacy users receive a code when the profile controller calls `ensureUserReferralCode()`.

The signup form already sends `referralCode`. `UserService.UsersignUp()` validates a supplied code against an active, verified customer and stores the normalized code/referrer ID in OTP `signupData`. Resend uses that stored data. When `otpService.verifyOtp()` successfully verifies the email, it creates the customer and one `Referral` document in the same Mongo transaction. Invalid codes and same-email/phone self-referrals are rejected. Google OAuth remains independent and new OAuth users receive their own code, but OAuth does not collect an attribution code.

`GET /api/admin/referrals` is an admin-only read API for tracked verified signups; it supports status filtering, customer/code search and pagination. Signup normalizes referral codes and matches legacy mixed-case values; OTP verification rechecks the same active referrer. On the referred customer's first transition to `COMPLETED`, `rewardReferralOnFirstBookingService()` credits ₹50 to the referrer through the wallet ledger and changes the referral to `REWARDED`, inside the same Mongo transaction. Runtime transaction verification remains pending.

## 11. Pug and frontend JavaScript

Pug files are under `views/`. Layouts (`views/layouts/minimal.pug`, `views/admin/admin-layout.pug`) provide shared document structure/navigation. A controller sends values such as `title`, `user`, `booking` or `dashboard` to `res.render('user/booking', data)`. Pug interpolates those locals into HTML on the server.

Many views also include vanilla JavaScript to call APIs with `fetch`, update slot/service/booking UI, submit forms, and show loading/error states. For example, customer booking page reads service data and available slots, posts booking details, then coordinates payment; wallet page requests `/balance` and `/transactions`; admin calendar calls `/api/admin/calendar`. Route protection still happens server-side even when a page can render for an anonymous user.

`public/css/input.css` is the Tailwind source; `public/css/output.css` is the generated stylesheet served from `public/`. Rebuild with `npm run dev:css` while developing CSS. Do not assume the generated CSS includes classes from every current template without checking build/runtime styling.

## 12. Error handling and validation

`middlewares/validation.js` exports request validators used by route declarations. Services/controllers also validate important IDs, states, prices, times and business constraints. `utils/AppError.js` provides an error carrying `statusCode`.

Controllers either return JSON directly or pass an error to `next(error)`. `errorMiddleware.js` logs the stack, returns `{success:false,message}` JSON for `/api/` requests, hides internal messages in production, and renders `errors/500` for page requests. `notFoundMiddleware.js` returns JSON 404 for missing API URLs and renders `errors/404` for pages (with an admin-page flag when the path starts `/admin`).

There is not one universal controller error convention: some controllers catch errors and return 400/500 JSON themselves, while others forward to middleware. When debugging, follow the specific controller and route to determine the actual status/body.

## 13. Configuration, environment and local setup

`dotenv/config` loads `.env` in `app.js`, `server.js` and config modules. Never commit `.env` or paste its values into documentation. The current `.env.example` documents only optional Cloudinary settings and `SHOP_ADMIN_EMAIL`; the runtime code also expects these keys:

| Variable | Used for |
|---|---|
| `MONGO_URI` | MongoDB connection. |
| `PORT` | HTTP listener port. |
| `JWT_SECRET` | Customer/admin JWT signing and verification. |
| `EMAIL_USER`, `EMAIL_PASS` | SMTP credentials for OTP and notification email. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google OAuth provider. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay client/order/signature verification. |
| `NODE_ENV` | Production error disclosure and secure cookie flag. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Optional profile image hosting. |
| `SHOP_ADMIN_EMAIL` | Optional booking notification recipient override. |

The full setup procedure and seed helpers are in `README.md`. Mongo transactions require a compatible deployment. SMTP and third-party integrations need their own real provider configuration before functional verification.

## 14. Suggested reading order

1. `server.js` → `app.js` → `config/db.js`.
2. `routes/UserRoute.js` → `middlewares/authMiddleware.js` → `controllers/UserController.js` → `services/UserService.js` → `services/otpService.js` → `models/UserModel.js` (actual path casing: `models/userModel.js`).
3. `routes/BookingRoute.js` → `BookingController.js` → `BookingService.js` → `bookingModel.js`, `ShopRules.js`, `Service.js`, `Barber.js`, `BarberUnavailabilityModel.js`, `Counter.js`.
4. `PaymentRoute.js` → `PaymentController.js` → `PaymentService.js` → `PaymentModel.js` and `WalletService.js`.
5. `WalletRoute.js` → `WalletController.js` → `WalletService.js` → wallet models.
6. `adminRoute.js` / `AdminBookingRoute.js` → controllers → `AdminDashboardService.js` / `AdminBookingService.js` → admin templates.
7. `views/` templates and their inline scripts; then `public/css/input.css` and `output.css`.
8. `middlewares/validation.js`, `errorMiddleware.js`, `notFoundMiddleware.js`, and `utils/AppError.js` for cross-cutting behavior.

For this documentation pass, tests were not run. Existing test filenames in `tests/` indicate areas of intended coverage, not proof that the current working tree passes.
