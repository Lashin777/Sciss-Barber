# Sciss' Barber — Project Memory

Updated: 2026-10-21

Use this file as the handoff note for future work on the Sciss' Barber project. The user prefers frontend/UI work and has asked to be consulted before starting new work. Do not add backend behavior unless the user asks for it.

When changing code, add a concise `Worked by Codex` attribution comment beside the change, using the appropriate comment syntax for that file type.

## UI completed

### Home and public pages
- Landing page with the SCISS' hero, animated logo interaction, light/dark toggle, smooth section navigation, and an animated booking transition.
- About section and separate about page with image gallery/carousel.
- Home service preview and a separate services page with the provided full price list.
- Service pricing is in rupees; D-Tan is listed as “Ask in shop” because its price was unclear in the supplied image.
- Home checks the customer token before rendering and hides the header/footer Login links for signed-in customers. Profile and Edit Profile redirect signed-out visitors to `/login`.
- Customer logout is a POST to `/api/user/logout`; the home menu, profile, and edit-profile headers submit it. Customer session cookie options and its one-day lifetime are centralized in `utils/session.js`; password and Google login use those options. Expired/invalid, deleted, or blocked sessions are cleared; only customers count as signed in on public pages, and the customer profile API rejects admin roles. Admin still uses the shared `token` cookie; handle admin session separation/logout in the admin-session task.
- Customer session checks passed for backend JS syntax, Pug render and inline-script syntax, signed-in/signed-out home menu rendering, cookie options, logout controller, and customer-only authorization. Live Postman request could not connect to local server (`EPERM`), so HTTP exchange remains unverified.
- User-facing browser pages and `/api/user/...` endpoints live together in `routes/UserRoute.js`; admin pages and `/api/admin/...` endpoints live together in `routes/adminRoute.js`. `app.js` mounts those two routers directly. `PageRoute.js` and `routes/index.js` were removed per the user's direction. Existing API and page URLs are preserved.
- Page response logic lives in `controllers/UserController.js` and `controllers/adminController.js`; the route files now connect URLs/middleware to controller functions.

### Signup and login
- Signup form with browser validation, Google sign-in button, email OTP verification view, and resend OTP control.
- Signup password eye toggle in `views/user/signup.pug` is moved into the dynamically-created `.signup-type-wrap`; keep it there so it overlays the input. Its compact SVG and absolute positioning use inline styles because the served Tailwind output did not contain the newer utility classes. Toggle switches password/text and updates its `aria-label`.
- Login page eye toggles cover the login password and reset password fields. Edit-profile eye toggles cover current, new, and confirmation passwords. The normal profile overview has no password input; passwords are only entered in edit-profile. Keep the compact SVG and inline positioning consistent with signup. These controls are marked `Worked by Codex` in their Pug templates.
- User login rejects `ADMIN` roles; public-page auth recognizes only active `CUSTOMER` accounts. Customer and admin sign-in use separate cookies.
- Login form with Google sign-in, blocked-account modal, forgot-password modal, and email OTP/password reset screens.
- Login page has a “Cancel & return home” link.
- Google-linked users do not see password-change controls in edit-profile; password-reset requests also reject Google-linked accounts and ADMIN roles. The edit page reports that Google manages the password. Local accounts still see the current/new/confirm password fields.
- Facebook sign-in UI is not present yet. Signup OTP countdown UI is also still pending.

### Profile
- Profile overview and separate edit-profile page.
- Profile preview includes member summary, wallet preview, sample referral code with copy interaction, and a no-upcoming-appointment card.
- The user asked to remove the Personal Information, Password, and Saved Address cards from the profile overview. Keep them removed unless asked otherwise.
- Profile navigation was simplified; HOME and theme controls are grouped at the top.
- Edit page has no sidebar. Personal details, email verification modal, and password controls are in the details card. Saved-address management was removed from the UI, API routes, service, and profile model. Password is masked by default and expands with a Change Password button.
- The edit-profile email verification dialog has explicit fixed positioning and automatic margins to center it.
- Edit Profile now sends a real 10-minute email-change OTP to the entered new address. Authenticated customer endpoints in `routes/UserRoute.js` send/resend and verify the code; the email changes in the database only after valid OTP verification. Duplicate and invalid addresses are rejected. This requires the existing `EMAIL_USER` and `EMAIL_PASS` mail configuration.
- Edit-profile Save Changes sends name and phone as JSON to `PATCH /api/user/profile`, and shows the API response. The avatar picker currently previews locally; the API path does not persist uploaded photos.
- “Forgot current password?” opens the existing login reset modal. Cancel from that reset flow returns to the profile password section and reopens its fields.
- Profile and wallet/referral content currently use demo/sample data; there is no live profile, wallet, referral, or booking data connection.

### Booking
- Booking UI uses all 43 services from the services page, grouped by category, with matching prices. Selecting a category reveals its service cards.
- Date selection uses upcoming date tiles plus a calendar input. Time choices are styled chips. The summary updates with the selection.
- Booking is still a frontend preview; confirmation is not connected to a booking backend.

### Admin
- Admin sign-in and forgot-password UI.
- Admin sessions use a separate `admin_token` cookie and POST logout route. Admin APIs verify an active ADMIN account on each request; protected dashboard requests redirect to sign-in when the session is invalid or blocked, and blocked admins cannot sign in. The login response returns the user but not the JWT.
- User management page has table UI, search/clear, pagination controls, latest-first display, and block/unblock confirmation UI. Verify API behavior separately before describing it as complete end-to-end.

## Pending / decisions

1. **Service durations:** The price list has no durations. Current booking time chips are the same for every service. Ask the user for actual durations per service or permission to use estimates before making times service-dependent.
2. Add Facebook sign-in UI if requested.
3. Add signup OTP countdown UI if requested.
4. Replace demo profile/wallet/referral data with real account data only after the user authorizes backend integration.
5. Booking confirmation, user bookings, and availability are UI-only until backend work is authorized.

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
