import { isLocalDevHost } from './domain';

export const CATEGORIES = ['Work', 'Dev', 'Finance', 'Social', 'Media', 'News', 'Shopping', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);
}

export const CATEGORY_META: Record<Category, { color: string }> = {
  Work: { color: '#6366f1' }, // indigo
  Dev: { color: '#10b981' }, // emerald
  Finance: { color: '#0d9488' }, // teal
  Social: { color: '#ec4899' }, // pink
  Media: { color: '#f59e0b' }, // amber
  News: { color: '#06b6d4' }, // cyan
  Shopping: { color: '#8b5cf6' }, // violet
  Other: { color: '#94a3b8' }, // slate
};

/** A user-defined rule: any domain containing `pattern` (case-insensitive
 * substring) maps to `category`. Checked before the built-in rules. */
export interface CategoryRule {
  pattern: string;
  category: Category;
}

// Built-in substring rules, first match wins. Order matters: Dev/Work before
// broader buckets. Tokens are kept specific enough (brand or brand+TLD) to avoid
// false matches on unrelated hostnames. Coverage is deliberately international —
// non-US users should not see everything fall into "Other".
const RULES: ReadonlyArray<readonly [Category, readonly string[]]> = [
  ['Dev', [
    'github', 'gitlab', 'bitbucket', 'gitea', 'gitee', 'git.sr.ht', 'sourcehut',
    'codeberg', 'dev.azure', 'launchpad.net',
    'stackoverflow', 'stackexchange', 'serverfault', 'superuser', 'askubuntu',
    'npmjs', 'yarnpkg', 'pypi.org', 'rubygems', 'packagist', 'crates.io',
    'pkg.go.dev', 'mvnrepository', 'nuget.org', 'hub.docker', 'docker.com',
    'localhost', 'vercel', 'netlify', 'fly.dev', 'render.com', 'railway.app',
    'cloudflare', 'digitalocean', 'heroku', 'supabase', 'firebase', 'mongodb',
    'planetscale', 'sentry.io', 'datadoghq', 'grafana', 'circleci', 'jenkins',
    'codepen', 'jsfiddle', 'codesandbox', 'replit', 'stackblitz', 'glitch.com',
    'colab.research', 'jupyter', 'kaggle', 'huggingface', 'paperswithcode',
    'developer.mozilla', 'readthedocs', 'devdocs', 'w3schools', 'freecodecamp',
    'geeksforgeeks', 'leetcode', 'hackerrank', 'codeforces', 'codewars',
    'dev.to', 'hashnode', 'jetbrains', 'postman', 'swagger.io', 'deno.com',
    'terraform', 'kubernetes.io',
  ]],
  ['Work', [
    'mail.google', 'gmail', 'calendar.google', 'docs.google', 'drive.google',
    'sheets.google', 'slides.google', 'meet.google', 'chat.google', 'forms.google',
    'notion', 'slack', 'paymo', 'uptimerobot', 'jira', 'atlassian', 'confluence',
    'figma', 'canva', 'linear.app', 'asana', 'trello', 'height.app', 'shortcut.com',
    'zoom.us', 'outlook', 'office.com', 'office365', 'teams.microsoft', 'teams.live',
    'sharepoint', 'onedrive', 'dropbox', 'box.com', 'webex', 'gotomeeting', 'whereby',
    'basecamp', 'clickup', 'monday.com', 'miro.com', 'mural.co', 'airtable', 'coda.io',
    'wrike', 'smartsheet', 'todoist', 'evernote', 'obsidian', 'loom.com', 'calendly',
    'docusign', 'mail.proton', 'protonmail', 'mail.zoho', 'zoho', 'fastmail',
    'mail.yandex', 'feishu', 'larksuite', 'dingtalk', 'mattermost', 'rocket.chat',
    'workplace.com', 'salesforce', 'hubspot', 'zendesk', 'freshdesk', 'intercom',
    'servicenow', 'workday', 'sap.com', 'oracle.com',
  ]],
  ['Finance', [
    'paypal', 'stripe.com', 'wise.com', 'revolut', 'payoneer', 'squareup',
    'chase.com', 'bankofamerica', 'wellsfargo', 'citibank', 'citi.com', 'capitalone',
    'americanexpress', 'usbank', 'pnc.com', 'tdbank', 'discover.com',
    'hsbc', 'barclays', 'lloydsbank', 'natwest', 'monzo', 'starlingbank',
    'santander', 'bbva', 'caixabank', 'ing.nl', 'rabobank', 'abnamro',
    'deutsche-bank', 'commerzbank', 'sparkasse', 'bnpparibas', 'creditagricole',
    'societegenerale', 'unicredit', 'intesasanpaolo', 'nordea', 'swedbank',
    'dbs.com', 'ocbc', 'uobgroup', 'icbc.com', 'hdfcbank', 'icicibank',
    'onlinesbi', 'axisbank', 'kotak', 'paytm', 'phonepe', 'razorpay',
    'mercadopago', 'nubank', 'itau', 'bradesco', 'sberbank', 'tinkoff',
    'kakaobank', 'mufg', 'mizuhobank', 'smbc',
    'binance', 'coinbase', 'kraken.com', 'crypto.com', 'blockchain.com',
    'etoro', 'robinhood', 'fidelity', 'schwab', 'vanguard', 'interactivebrokers',
    'tradingview', 'mint.intuit', 'ynab.com', 'quickbooks', 'xero.com',
  ]],
  ['Social', [
    'twitter', 'x.com', 'facebook', 'instagram', 'reddit', 'linkedin', 'tiktok',
    'threads', 'mastodon', 'bsky', 'discord', 'whatsapp', 'telegram', 'snapchat',
    'tumblr', 'pinterest', 'quora', 'nextdoor', 'clubhouse', 'xing.com',
    'vk.com', 'vkontakte', 'ok.ru', 'odnoklassniki', 'weibo', 'wechat', 'weixin',
    'douban', 'qzone', 'renren', 'line.me', 'kakao', 'cafe.naver', 'blog.naver',
    'viber', 'signal.org', 'zalo.me', 'truthsocial', 'gettr',
  ]],
  ['Media', [
    'youtube', 'netflix', 'spotify', 'twitch', 'hulu', 'disney', 'primevideo',
    'soundcloud', 'vimeo', 'music.apple', 'tv.apple', 'audible', 'mixcloud',
    'bandcamp', 'deezer', 'tidal.com', 'pandora.com', 'crunchyroll', 'funimation',
    'dailymotion', 'rutube', 'niconico', 'bilibili', 'youku', 'iqiyi', 'v.qq.com',
    'douyin', 'kuaishou', 'afreecatv', 'tv.naver', 'hotstar', 'zee5', 'sonyliv',
    'viki.com', 'hbomax', 'paramountplus', 'peacocktv', 'wetv.vip',
  ]],
  ['News', [
    'cnn', 'bbc', 'nytimes', 'theguardian', 'reuters', 'bloomberg', 'techcrunch',
    'arstechnica', 'news.ycombinator', 'theverge', 'wsj.com', 'apnews', 'npr.org',
    'washingtonpost', 'forbes', 'businessinsider', 'cnbc', 'marketwatch', 'usatoday',
    'economist', 'politico', 'axios.com', 'vox.com', 'aljazeera', 'lemonde',
    'lefigaro', 'spiegel', 'faz.net', 'zeit.de', 'bild.de', 'elpais', 'elmundo',
    'corriere', 'repubblica', 'asahi', 'nikkei', 'yomiuri', 'mainichi', 'japantimes',
    'scmp', 'chinadaily', 'xinhuanet', 'people.com.cn', 'timesofindia', 'thehindu',
    'ndtv', 'indianexpress', 'hindustantimes', 'dawn.com', 'straitstimes',
    'channelnewsasia', 'koreaherald', 'koreatimes', 'globo.com', 'clarin', 'folha',
    'abc.net.au', 'smh.com.au', 'theglobeandmail', 'cbc.ca', 'tass.ru', 'gazeta.ru',
    'lenta.ru', 'rbc.ru',
  ]],
  ['Shopping', [
    'amazon', 'ebay', 'etsy', 'aliexpress', 'walmart', 'bestbuy', 'shopify', 'ikea',
    'temu', 'shein', 'wish.com', 'rakuten', 'mercadolibre', 'mercadolivre', 'jd.com',
    'taobao', 'tmall', 'alibaba', '1688.com', 'pinduoduo', 'flipkart', 'myntra',
    'meesho', 'snapdeal', 'lazada', 'shopee', 'tokopedia', 'bukalapak', 'zalando',
    'otto.de', 'allegro.pl', 'cdiscount', 'fnac', 'bol.com', 'coupang', 'gmarket',
    '11st', 'trendyol', 'hepsiburada', 'noon.com', 'jumia', 'americanas', 'magazineluiza',
    'wildberries', 'ozon', 'target.com', 'costco', 'newegg', 'wayfair', 'asos',
    'zara.com', 'uniqlo', 'nike.com', 'adidas', 'sephora',
  ]],
];

/** Apply user rules (substring, case-insensitive, first match). */
function matchUserRule(domain: string, rules: readonly CategoryRule[]): Category | undefined {
  for (const r of rules) {
    const p = r.pattern.trim().toLowerCase();
    if (p && domain.includes(p)) return r.category;
  }
  return undefined;
}

/**
 * Resolve a domain to a category. Precedence:
 *   1. explicit per-domain override (exact match)
 *   2. user-defined substring rules (in order)
 *   3. built-in rules
 *   4. "Other"
 */
export function categorize(
  domain: string,
  overrides: Record<string, Category> = {},
  rules: readonly CategoryRule[] = [],
): Category {
  const override = overrides[domain];
  if (override) return override;
  const d = domain.toLowerCase();
  const userMatch = matchUserRule(d, rules);
  if (userMatch) return userMatch;
  // Local-dev hosts (localhost / bare IPv4) are dev work — group them under Dev
  // instead of letting each raw IP fall through to "Other".
  if (isLocalDevHost(d)) return 'Dev';
  for (const [category, needles] of RULES) {
    if (needles.some((n) => domainMatches(d, n))) return category;
  }
  return 'Other';
}

/**
 * Match a built-in needle against a hostname on LABEL boundaries, not raw
 * substring. A needle (a brand label like `amazon` or a partial host like
 * `x.com`) matches only when it aligns to dot-delimited boundaries — so
 * `x.com` matches `x.com` and `mobile.x.com` but not `notx.com`, and `amazon`
 * matches `amazon.com`/`music.amazon.com` but not `myamazon-clone.com`.
 */
function domainMatches(domain: string, needle: string): boolean {
  return (
    domain === needle ||
    domain.startsWith(`${needle}.`) || // needle is the leading label(s)
    domain.endsWith(`.${needle}`) || // needle is the trailing label(s)
    domain.includes(`.${needle}.`) // needle sits between boundaries
  );
}

/**
 * A categorizer bound to a fixed (overrides, rules) set with a per-domain cache.
 * Aggregations run categorize() once per stats row, but the same ~dozens of
 * domains repeat across hundreds/thousands of rows — caching collapses the work
 * to one categorize() call per distinct domain. Build one per aggregation pass.
 */
export function makeCategorizer(
  overrides: Record<string, Category> = {},
  rules: readonly CategoryRule[] = [],
): (domain: string) => Category {
  const cache = new Map<string, Category>();
  return (domain: string): Category => {
    const hit = cache.get(domain);
    if (hit !== undefined) return hit;
    const c = categorize(domain, overrides, rules);
    cache.set(domain, c);
    return c;
  };
}

export type Productivity = 'productive' | 'distracting' | 'neutral';

export const CATEGORY_PRODUCTIVITY: Record<Category, Productivity> = {
  Work: 'productive',
  Dev: 'productive',
  Finance: 'neutral',
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
  rules: readonly CategoryRule[] = [],
): CategorySlice[] {
  const map = new Map<Category, CategorySlice>();
  for (const d of domains) {
    const category = categorize(d.domain, overrides, rules);
    const cur = map.get(category) ?? { category, seconds: 0, audioSeconds: 0 };
    cur.seconds += d.seconds;
    cur.audioSeconds += d.audioSeconds;
    map.set(category, cur);
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds);
}
