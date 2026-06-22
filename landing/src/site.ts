// Fill these in once the extension is live. Until then they point at the store
// homepages so nothing 404s. Search the repo for these names to update in one place.
export const LINKS = {
  chrome: 'https://chromewebstore.google.com/', // ← replace with your CWS listing URL
  edge: 'https://microsoftedge.microsoft.com/addons', // ← replace with Edge listing
  firefox: 'https://addons.mozilla.org/firefox/', // ← replace with AMO listing
  privacy: '#/privacy', // in-app privacy page (PrivacyPage.vue)
  // Community / source. Discussions must be enabled on the repo
  // (Settings → Features → Discussions) or that link 404s.
  github: 'https://github.com/latreon/tabstyr',
  issues: 'https://github.com/latreon/tabstyr/issues',
  discussions: 'https://github.com/latreon/tabstyr/discussions',
  coffee: 'https://www.buymeacoffee.com/latreon',
};

// The person behind the project — shown in the footer. Handle only by default.
export const AUTHOR = { name: 'latreon', url: 'https://github.com/latreon' };

export const STATS = [
  { value: '0', unit: 'bytes', label: 'leave your device' },
  { value: '90', unit: 'days', label: 'of history, auto-pruned' },
  { value: '11', unit: 'languages', label: 'out of the box' },
  { value: '100', unit: '%', label: 'local & open by design' },
];
