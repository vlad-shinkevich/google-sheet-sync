Google Sheet Sync – Figma Plugin (React + Vite + shadcn/ui + Tailwind v4)

Install & scripts

```bash
npm install
npm run dev   # watch build (ui then code)
npm run build # production build → dist/
```

Structure
- Worker: `src/code.ts` → `dist/code.js`
- UI entry: `src/ui/ui.html` + React app `src/ui/main.tsx` → `dist/src/ui/ui.html`
- Manifest: `manifest.json` → points to `dist/code.js` and `dist/src/ui/ui.html`
- UI components:
  - Table demo with selection + Shift‑range + virtualization: `src/ui/components/data-table-demo.tsx`
  - shadcn primitives: `src/ui/components/ui/{button,checkbox,input,table}.tsx`
  - Resize handle (shadcn‑style): `src/ui/components/ui/resizable.tsx`
  - Tabs wrapper: `src/ui/components/ui/tabs.tsx`
  - ScrollArea wrapper: `src/ui/components/ui/scroll-area.tsx`
  - Vertical scroll affordance arrows: `src/ui/components/vertical-scroll-affordance.tsx`
- Styling: Tailwind v4 in `src/ui/index.css` (`@import "tailwindcss"`, `@theme`)

Figma window sizing
- Initial size: set in `src/code.ts` via `figma.showUI(uiHtml, { width, height })`
- Runtime resize: plugin UI sends `{ type: 'resize', width, height }`, worker handles `figma.ui.resize(...)`
- UI has a small fixed handle in the bottom‑right corner for drag‑resize

shadcn/ui CLI
- `components.json` is configured; add components with:
```bash
npx shadcn@latest add button
```

Notes
- Tailwind v4 requires `@tailwindcss/postcss` (configured in `postcss.config.js`).
- Network/API access: `manifest.json` whitelists `https://www.googleapis.com`, `https://sheets.googleapis.com`, and backend `https://google-sheet-sync-api.vercel.app`.
- OAuth: UI opens browser via `figma.openExternal`, tokens are stored in `figma.clientStorage`.

