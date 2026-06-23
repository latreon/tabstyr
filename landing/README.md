# TabStyr — landing page

Standalone marketing site for the TabStyr extension. Vue 3 + Vite + TypeScript,
plain CSS design tokens, scroll-reveal via IntersectionObserver. No Tailwind, no
animation library.

## Develop
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/  (static, deploy anywhere)
npm run preview
```

## Before launch
Edit `src/site.ts` → paste the real store listing URLs (`chrome`, `edge`,
`firefox`), then flip the matching `STORE_LIVE` flag to `true` (until then the
CTAs render a non-clickable "coming soon" state). `SITE_URL` is the public origin
used for the absolute social/SEO URLs in `index.html`, `robots.txt`, and
`sitemap.xml` — update all four if you deploy under a different origin. Privacy
and Ideas are SPA routes (`/privacy`, `/ideas`), not separate HTML files.

## Deploy
`dist/` is fully static. Drop it on Vercel / Netlify / Cloudflare Pages / GitHub
Pages. `base: '/tabstyr/'` in vite.config.ts targets the GitHub Pages project path;
change it (and `SITE_URL`) for a root-domain or other-subpath deploy. The build
copies `index.html` to `404.html` so deep links to SPA routes resolve on static hosts.

Screenshots live in `src/assets/` (imported + hashed by Vite). `public/shots/` is
kept for the absolute social `og:image`; `public/robots.txt` + `public/sitemap.xml`
are copied to the deploy root.
