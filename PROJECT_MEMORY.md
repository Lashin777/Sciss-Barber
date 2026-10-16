# Sciss' Barber — Project Memory

Updated: 2026-10-16

Use this file as the handoff note for future work on the Sciss' Barber project. The user prefers frontend/UI work and has asked to be consulted before starting new work. Do not add backend behavior unless the user asks for it.

## UI completed

### Home and public pages
- Landing page with the SCISS' hero, animated logo interaction, light/dark toggle, smooth section navigation, and an animated booking transition.
- About section and separate about page with image gallery/carousel.
- Home service preview and a separate services page with the provided full price list.
- Service pricing is in rupees; D-Tan is listed as “Ask in shop” because its price was unclear in the supplied image.

### Signup and login
- Signup form with browser validation, Google sign-in button, email OTP verification view, and resend OTP control.
- Login form with Google sign-in, blocked-account modal, forgot-password modal, and email OTP/password reset screens.
- Login page has a “Cancel & return home” link.
- Facebook sign-in UI is not present yet. Signup OTP countdown UI is also still pending.

### Profile
- Profile overview and separate edit-profile page.
- Profile preview includes member summary, wallet preview, sample referral code with copy interaction, and a no-upcoming-appointment card.
- The user asked to remove the Personal Information, Password, and Saved Address cards from the profile overview. Keep them removed unless asked otherwise.
- Profile navigation was simplified; HOME and theme controls are grouped at the top.
- Edit page has no sidebar. Personal details, email verification modal, address add/edit/remove UI, and password controls are in the details card. Password is masked by default and expands with a Change Password button.
- “Forgot current password?” opens the existing login reset modal. Cancel from that reset flow returns to the profile password section and reopens its fields.
- Profile and wallet/referral content currently use demo/sample data; there is no live profile, wallet, referral, or booking data connection.

### Booking
- Booking UI uses all 43 services from the services page, grouped by category, with matching prices. Selecting a category reveals its service cards.
- Date selection uses upcoming date tiles plus a calendar input. Time choices are styled chips. The summary updates with the selection.
- Booking is still a frontend preview; confirmation is not connected to a booking backend.

### Admin
- Admin sign-in and forgot-password UI.
- User management page has table UI, search/clear, pagination controls, latest-first display, and block/unblock confirmation UI. Verify API behavior separately before describing it as complete end-to-end.

## Pending / decisions

1. **Service durations:** The price list has no durations. Current booking time chips are the same for every service. Ask the user for actual durations per service or permission to use estimates before making times service-dependent.
2. Add Facebook sign-in UI if requested.
3. Add signup OTP countdown UI if requested.
4. Replace demo profile/wallet/referral data with real account data only after the user authorizes backend integration.
5. Booking confirmation, user bookings, and availability are UI-only until backend work is authorized.

## Key files

- `views/user/home.pug`
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
- `app.js` (Express view routes, including profile routes)

## Local UI workflow

- Templates use Pug and `views/layouts/minimal.pug`.
- After changing utility classes, rebuild CSS with:
  `npx tailwindcss -i ./public/css/input.css -o ./public/css/output.css`
- Pug templates can be compiled with the installed `pug` package.
