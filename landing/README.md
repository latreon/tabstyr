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
Edit `src/site.ts` → set the real store URLs (`chrome`, `edge`, `firefox`) and
`privacy` (host `privacy.html` or point at your GitHub Pages URL).

## Deploy
`dist/` is fully static. Drop it on Vercel / Netlify / Cloudflare Pages / GitHub
Pages. `base: './'` in vite.config.ts so it works under a subpath too.

Screenshots live in `src/assets/` (imported + hashed by Vite). `public/shots/` is
kept only for the social `og:image`.
