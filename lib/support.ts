// Support button ("Buy me a coffee"), rendered in the popup footer and the
// dashboard header. Clicking it opens this URL in a new tab — user-initiated
// navigation only; the extension itself never makes a network request (keeps the
// "0 bytes leave your device" promise). Single source of truth.
//
// Polar pay-what-you-want tip. `?amount` prefills the value in cents ($5 = 500);
// the user can still change it at checkout. Opening a Polar Checkout Link spins
// up a short-lived hosted checkout — no access token and no backend required.
// NEVER bundle the Polar access token in the extension; the SDK/`checkouts.create`
// flow is server-only and would leak the secret.
//
// Polar checkout link read from build-time env (WXT_POLAR_CHECKOUT_URL in .env,
// which is gitignored — see .env.example). Keeps the URL out of source. It is a
// PUBLIC checkout URL (it ships in the built extension), so this is for config
// hygiene, not secrecy. Opening it mints a short-lived hosted checkout — no
// access token, no backend.
const POLAR_CHECKOUT_LINK = (import.meta.env.WXT_POLAR_CHECKOUT_URL || '') as string;

// $5 prefilled (pay-what-you-want); user can adjust at checkout. Empty when
// unconfigured — the popup + dashboard hide the support button in that case.
export const COFFEE_URL = POLAR_CHECKOUT_LINK ? `${POLAR_CHECKOUT_LINK}?amount=500` : '';
