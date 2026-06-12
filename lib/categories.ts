export const CATEGORIES = ['Work', 'Dev', 'Social', 'Media', 'News', 'Shopping', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);
}

export const CATEGORY_META: Record<Category, { color: string }> = {
  Work: { color: '#6366f1' }, // indigo
  Dev: { color: '#10b981' }, // emerald
  Social: { color: '#ec4899' }, // pink
  Media: { color: '#f59e0b' }, // amber
  News: { color: '#06b6d4' }, // cyan
  Shopping: { color: '#8b5cf6' }, // violet
  Other: { color: '#94a3b8' }, // slate
};

// Substring rules, first match wins. Order matters: Dev/Work before broader ones.
const RULES: ReadonlyArray<readonly [Category, readonly string[]]> = [
  ['Dev', ['github', 'gitlab', 'stackoverflow', 'npmjs', 'localhost', 'vercel', 'netlify', 'fly.dev', 'codepen', 'developer.mozilla', 'jsfiddle', 'codesandbox', 'readthedocs']],
  ['Work', ['mail.google', 'gmail', 'calendar.google', 'docs.google', 'drive.google', 'sheets.google', 'meet.google', 'notion', 'slack', 'paymo', 'uptimerobot', 'jira', 'atlassian', 'confluence', 'figma', 'linear.app', 'asana', 'trello', 'zoom.us', 'outlook', 'office.com']],
  ['Social', ['twitter', 'x.com', 'facebook', 'instagram', 'reddit', 'linkedin', 'tiktok', 'threads', 'mastodon', 'bsky', 'discord', 'whatsapp', 'telegram', 'snapchat']],
  ['Media', ['youtube', 'netflix', 'spotify', 'twitch', 'hulu', 'disney', 'primevideo', 'soundcloud', 'vimeo', 'music.apple', 'music.youtube']],
  ['News', ['cnn', 'bbc', 'nytimes', 'theguardian', 'reuters', 'bloomberg', 'techcrunch', 'arstechnica', 'news.ycombinator', 'theverge', 'wsj.com', 'apnews']],
  ['Shopping', ['amazon', 'ebay', 'etsy', 'aliexpress', 'walmart', 'bestbuy', 'shopify', 'ikea', 'temu']],
];

/** Resolve a domain to a category: explicit user override first, then default rules. */
export function categorize(domain: string, overrides: Record<string, Category> = {}): Category {
  const override = overrides[domain];
  if (override) return override;
  const d = domain.toLowerCase();
  for (const [category, needles] of RULES) {
    if (needles.some((n) => d.includes(n))) return category;
  }
  return 'Other';
}

export type Productivity = 'productive' | 'distracting' | 'neutral';

export const CATEGORY_PRODUCTIVITY: Record<Category, Productivity> = {
  Work: 'productive',
  Dev: 'productive',
  Social: 'distracting',
  Media: 'distracting',
  News: 'neutral',
  Shopping: 'neutral',
  Other: 'neutral',
};

export interface CategorySlice {
  category: Category;
  seconds: number;
  audioSeconds: number;
}

/** Aggregate per-domain time into per-category slices, sorted by time desc. */
export function groupByCategory(
  domains: Array<{ domain: string; seconds: number; audioSeconds: number }>,
  overrides: Record<string, Category> = {},
): CategorySlice[] {
  const map = new Map<Category, CategorySlice>();
  for (const d of domains) {
    const category = categorize(d.domain, overrides);
    const cur = map.get(category) ?? { category, seconds: 0, audioSeconds: 0 };
    cur.seconds += d.seconds;
    cur.audioSeconds += d.audioSeconds;
    map.set(category, cur);
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds);
}
