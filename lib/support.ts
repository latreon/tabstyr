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
// Production Polar checkout link (pay-what-you-want tip). Opening it mints a
// short-lived hosted checkout session — no access token, no backend.
const POLAR_CHECKOUT_LINK =
  'https://buy.polar.sh/polar_cl_RkZPHoSH8zAQndHySXwKoDhLRykeX8BuMANlE3FoBSo';

// $5 prefilled (pay-what-you-want); user can adjust at checkout.
export const COFFEE_URL = `${POLAR_CHECKOUT_LINK}?amount=500`;

// Previous Ko-fi link, kept for easy rollback:
// export const COFFEE_URL = 'https://ko-fi.com/latreon';
