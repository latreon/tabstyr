// External links the extension can open in a new tab on explicit user action.
// The extension itself never fetches these — opening one is user-initiated
// navigation, so the "0 bytes leave your device" promise holds. Single source.

export const SITE_URL = 'https://tabstyr.com';

// "Browsing Wrapped" lives on the marketing site: the user exports a backup from
// Settings and drops it there to get a shareable, fully client-side summary.
export const WRAPPED_URL = `${SITE_URL}/wrapped`;
