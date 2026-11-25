# Sciss' Barber — Final Submission Checklist

**Audit date:** 2026-11-25  
**Verification performed for this checklist:** source review plus JavaScript syntax, Pug compilation, and whitespace checks. No tests, server, browser flows, provider, email, or live database were exercised.

Status definitions:

- **Verified complete:** observed working in the current intended environment.
- **Implemented, verification pending:** source implementation exists, but current runtime behavior has not been demonstrated.
- **Incomplete:** required implementation or integration is absent/partial.
- **Deferred:** intentionally awaiting policy or external implementation/configuration.

No feature is marked “Verified complete” based only on code presence.

## Application and infrastructure

- [ ] **Implemented, verification pending** — Express startup, Pug engine, static files and route mounting (`server.js`, `app.js`). Boot against configured environment.
- [ ] **Implemented, verification pending** — MongoDB connection (`config/db.js`). Verify connection and transaction-capable topology.
- [ ] **Implemented, verification pending** — Global API/page error and 404 responses. Exercise actual API and page errors.
- [ ] **Implemented, verification pending** — `.env.example` lists required variables and `TZ=Asia/Calcutta`; copy to a private local `.env` and configure real values.
- [ ] **Implemented, verification pending** — Baseline security headers and Express fingerprint removal are configured in `app.js`; verify them through HTTP responses.
- [ ] **Incomplete** — No rate limiter or Winston structured logger is configured. Add a shared-store rate limit and structured logging before production.
- [ ] **Implemented, verification pending** — Seed data helpers for categories, barbers and shop rules; inspect/apply to a development database as needed.

## Customer identity and profile

- [ ] **Implemented, verification pending** — Signup validation, OTP generation/resend, account creation only after email verification.
- [ ] **Implemented, verification pending** — Customer password login/logout and protected routes.
- [ ] **Implemented, verification pending** — Google OAuth registration/link/login. Verify callback URL and provider credentials.
- [ ] **Implemented, verification pending** — Forgot/reset password and email-change OTP flows.
- [ ] **Implemented, verification pending** — Profile name/phone/image updates and password change.
- [ ] **Implemented, verification pending** — Profile photo Cloudinary upload and local fallback with a 2 MB limit, raster MIME allowlist, file-signature checks and generated local filenames; verify actual upload, preview and cleanup in deployment.
- [ ] **Implemented, verification pending** — Referral codes are generated uniquely, signup code is retained through OTP, and attribution is stored after email verification; verify with a development database.
- [ ] **Not implemented** — Facebook sign-in (no route/provider implementation found).

## Booking and availability

- [ ] **Implemented, verification pending** — Customer service catalog and multi-service selection.
- [ ] **Implemented, verification pending** — Combined price/duration and dynamic slot lookup.
- [ ] **Implemented, verification pending** — Booking records preserve each selected service's name, price and duration snapshots; old records use populated service references as fallback.
- [ ] **Implemented, verification pending** — Shop opening/closing, midnight close, weekly off, capacity, buffer, barber availability and active shop closures.
- [ ] **Implemented, verification pending** — Admin full-day/time-range shop closure, overlap and working-hours validation (including overnight hours), booking conflict prevention, reopen, and calendar visibility.
- [ ] **Implemented, verification pending** — Admin barber unavailability checks existing bookings and uses the shared transaction lock to avoid concurrent booking conflicts.
- [ ] **Incomplete** — Break periods and per-date special working hours have no data model or admin configuration contract.
- [ ] **Implemented, verification pending** — Transactional booking creation, duplicate-slot protection and booking token allocation.
- [ ] **Implemented, verification pending** — Customer booking history/list/detail and booking receipt display/print behavior; receipt is not a GST/tax invoice.
- [ ] **Implemented, verification pending** — Customer cancellation cutoff and payment refund to wallet.
- [ ] **Implemented, verification pending** — Admin walk-in creation and display.
- [ ] **Implemented, verification pending** — Admin status transitions, cancellation, rescheduling and booking detail views.
- [ ] **Implemented, verification pending** — Admin monthly calendar API includes bookings, shop closures, barber unavailability and shop rules; confirm timezones, no-booking days and boundary rendering.
- [ ] **Implemented, verification pending** — Admin booking notification email. Confirm SMTP recipient and delivered message.

## Payments and wallet

- [ ] **Implemented, verification pending** — Razorpay order uses persisted booking advance; test order creation in provider test mode.
- [ ] **Implemented, verification pending** — Razorpay signature and provider-side payment verification; test success, failure and cancellation behavior.
- [ ] **Implemented, verification pending** — Wallet balance/history display from `GET /balance` and `GET /transactions`.
- [ ] **Implemented, verification pending** — Wallet booking debit, payment record and booking confirmation transaction.
- [ ] **Implemented, verification pending** — Successful paid booking cancellation credits a wallet refund with ledger record.
- [ ] **Deferred** — Customer wallet top-up/funding is not available.
- [ ] **Implemented, verification pending** — A referred customer's first completed booking atomically credits ₹50 to the referrer's wallet; confirm behavior against a transaction-capable development database.
- [ ] **Implemented, verification pending** — Revenue API and page integration are present; reconcile totals and date boundaries against a populated development database.
- [ ] **Implemented, verification pending** — Admin payment API and page integration are present; reconcile status counts, amounts, joins and date filters against a populated development database.
- [ ] **Implemented, verification pending** — Admin dashboard counts today's bookings by status and reports successful Razorpay/wallet payments separately using IST day bounds.

## Admin and management

- [ ] **Implemented, verification pending** — Admin login/logout, password reset, role authorization and blocked-account behavior.
- [ ] **Implemented, verification pending** — Customer list/search/pagination/details/block/unblock.
- [ ] **Implemented, verification pending** — Service/category admin workflows and barber unavailability APIs.
- [ ] **Implemented, verification pending** — Admin dashboard daily appointment data.
- [ ] **Implemented, verification pending** — Revenue management page calls the protected revenue report API and renders summaries, chart and payment records.
- [ ] **Implemented, verification pending** — Payments page filters and paginates API-backed payment records with customer/booking context; verify all statuses including `CREATING`.
- [ ] **Implemented, verification pending** — Admin referral page reads tracked signups and summary/filter/pagination data from its protected API.

## Before final submission

- [ ] Configure all required secrets in local `.env` only; confirm `.env` stays ignored and never include real values in evidence.
- [ ] Use a non-production MongoDB database that supports transactions; apply intended seed data.
- [ ] Manually verify signup → email OTP → login and Google OAuth.
- [ ] Manually verify profile/email/password/image workflows.
- [ ] Manually verify multi-service slot search, snapshot rendering, customer and walk-in booking creation, closures, barber unavailability, and midnight/weekly-off/capacity boundaries.
- [ ] Verify Razorpay test checkout and server-side verify/failure paths.
- [ ] Verify wallet balance, insufficient funds, debit, cancellation refund and ledger balance-after values.
- [ ] Verify customer history/detail/receipt, including print layout and payment status.
- [ ] Verify admin login, walk-in, booking status/cancel/reschedule, calendar timezone and empty states.
- [ ] Verify referral attribution and the ₹50 first-completed-booking wallet reward, including duplicate completion callbacks.
- [ ] Run the project's intended tests and record results during a separate verification pass. Tests were not run for this documentation task.
- [ ] Review production secrets, OAuth callback, HTTPS/secure cookies, SMTP delivery, upload storage and error disclosure.

## Readiness decision

**Ready for a code walkthrough and source-based review. Not ready to claim end-to-end verified.** Payment, email, OAuth, image hosting, database transactions and complete booking journeys still need environment-backed verification. Rate limiting, Winston logging, break schedules and special date hours remain incomplete; wallet top-up remains deferred.
