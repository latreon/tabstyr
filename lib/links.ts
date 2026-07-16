// External links the extension can open in a new tab on explicit user action.
// The extension itself never fetches these — opening one is user-initiated
// navigation, so the "0 bytes leave your device" promise holds. Single source.

export const SITE_URL = 'https://tabstyr.com';

// "Browsing Wrapped" lives on the marketing site: the user exports a backup from
// Settings and drops it there to get a shareable, fully client-side summary.
export const WRAPPED_URL = `${SITE_URL}/wrapped`;

// chrome.runtime.setUninstallURL opens this in the browser (not the extension)
// right before uninstall completes — it's the only way to learn why someone
// left. Routes to the same in-app "share an idea" form the rest of the site
// uses, tagged so responses are distinguishable from general feedback.
export const UNINSTALL_FEEDBACK_URL = `${SITE_URL}/ideas?src=uninstall`;

// Chrome Web Store listing — the /reviews suffix opens straight to the
// "Write a review" tab instead of the general listing page.
export const CHROME_STORE_REVIEW_URL =
  'https://chromewebstore.google.com/detail/tabstyr/mgckngagefippkemgmmccfaaljmgllpa/reviews';

// Full release notes, hosted on the marketing site (ChangelogPage.vue) rather
// than duplicated inside the extension bundle.
export const CHANGELOG_URL = `${SITE_URL}/changelog`;
