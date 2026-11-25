# Sciss' Barber — Correction Register

**Review date:** 2026-11-25  
**Scope:** Source review against `PROJECT_FINAL_CHECKLIST.md`, `PROJECT_COMPLETION_REPORT.md`, and `PROJECT_MEMORY.md`. Tests, server startup, browser workflows, provider calls, email delivery, and database operations were not run.

## Corrected during this review

| Area | Finding | Correction |
|---|---|---|
| Admin password recovery | The service generated `ADMIN_PASSWORD_RESET` OTPs, but the OTP schema enum rejected that purpose. | Added the admin recovery purpose to the OTP schema. |
| Customer management | The customer list included admin accounts, and block/unblock could change any account by ID. | Restricted listing and status changes to `CUSTOMER`; missing/non-customer IDs now return 404. |
| Admin page sessions | Dashboard and services HTML routes used the API guard, returning JSON 401 on expired sessions. | Switched these pages to the admin page guard and disabled caching for the services page. |
| Booking status | Admins could confirm an online booking before payment, which made it ineligible for payment-order creation. | Require a successful payment before moving an online booking to `CONFIRMED`, `ACCEPTED`, or `COMPLETED`. |
| Local profile uploads | Multer wrote to a path relative to the process launch directory, while Express served the project’s uploads directory. | Store local uploads in the project-root `uploads` directory. |
| Barber availability API | The GET route was misspelled as `/unavailablity`, while the documented path is `/unavailability`. | Added the correctly spelled route and retained the old path as an alias. |
| Customer booking details | A malformed booking ID reached Mongoose and was rendered as a server error. | Return the not-found page for malformed IDs. |
| Public OTP resend | The endpoint accepted authenticated-only purposes such as email change and admin recovery. | Limit public resend to signup verification and customer password reset. |

## Open corrections and investigation

| Priority | Area | Remaining work / decision |
|---|---|---|
| High | Request abuse controls | Add rate limits for login, signup, OTP send/resend/verify, and password recovery. Decide on a shared store before production; current email OTP endpoints can still be used to generate repeated customer password-reset emails. |
| Medium | Operational logging | Add structured application logging and define retention/redaction for authentication and payment errors. Winston is listed in the checklist but is not configured. |
| Medium | Availability policy | Define break periods and per-date special hours, then add their data model, admin controls, slot filtering, and calendar display. |
| Medium | Admin navigation | The admin layout links to `/admin/profile`, but no route or view exists. Decide whether this should be a profile page or be removed from navigation. |
| Product decision | Wallet funding | Wallet top-up remains deferred until the shop defines funding, refund, and redemption rules. |
| Product decision | Facebook sign-in | No provider route or UI exists. Confirm whether Facebook sign-in is still required. |
| Before release | External integrations | Verify MongoDB transaction support, SMTP delivery, Google OAuth callback, Razorpay test-mode flows, Cloudinary/local upload behavior, and production cookie/HTTPS settings in a configured environment. |
| Before release | Runtime verification | Perform the separate requested test and browser pass. No tests were run during this source review. |

