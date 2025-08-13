Google Sheet Sync – Figma Plugin (React + Vite + shadcn/ui + Tailwind v4)

Commands

```bash
npm install
npm run dev   # watch build (ui then code)
npm run build # production build to dist/
```

Paths
- Worker: `src/code.ts` → `dist/code.js`
- UI: `src/ui.html` + `src/ui/main.tsx` → `dist/ui.html`
- Manifest: `manifest.json` → points to `dist/code.js` and `dist/ui.html`

shadcn/ui
- Config: `components.json` (keep if you plan to add more components)
- Example: `src/ui/components/ui/button.tsx`

Docs: Tailwind v4 setup uses `@import "tailwindcss"` and `@theme` in CSS.
Ref: https://ui.shadcn.com/docs/installation

