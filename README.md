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
- UI steps (SPA):
  - `src/ui/components/sheets/SheetSyncWizard.tsx` – orchestrates steps and data flow
  - `src/ui/components/steps/AuthStep.tsx` – Google OAuth connect screen
  - `src/ui/components/steps/SourceStep.tsx` – sheet URL input + load
  - `src/ui/components/steps/TabsStep.tsx` – select tabs to work with
  - `src/ui/components/steps/TableStep/TableStep.tsx` – tabs + analyze toggle + data table
  - `src/ui/components/steps/TableStep/DataTable.tsx` – virtualized table with per‑tab selections
  - `src/ui/components/steps/TableStep/AnalyzeToggle.tsx` – toggle analysis mode
  - `src/ui/components/steps/ConfirmScreen.tsx` – final mapping preview and types
- UI primitives (shadcn): `src/ui/components/ui/{button,checkbox,input,table,resizable,tabs,scroll-area}.tsx`
- Styling: Tailwind v4 in `src/ui/index.css` (`@import "tailwindcss"`, `@theme`)
- Shared UI types: `src/ui/types.ts`
- UI libs:
  - `src/ui/lib/log.ts` – UI → worker logging helper
  - `src/ui/lib/oauth.ts` – token/userinfo get/save/clear via clientStorage
  - `src/ui/lib/sheets.ts` – parse sheet URL, fetch metadata/values
  - `src/ui/lib/image.ts` – image fetch handler (Drive API + proxy)
  - `src/ui/lib/infer.ts` – infer field types for confirm screen

Worker utilities (Figma API helpers)
- `src/lib/figma/layers.ts` – `normalizeKey`, `findTagFromName`, `isInstanceNode`, `collectNodesByTag`
- `src/lib/figma/text.ts` – `loadAllFontsInNode`
- `src/lib/figma/colors.ts` – `parseSolidPaintFromColor`
- `src/lib/figma/images.ts` – `toGoogleDriveDownloadUrl`, `createImagePaintFromUrl`, `fetchImageBytesViaUI`
- `src/lib/figma/variants.ts` – `parseVariantAssignments`, `setInstanceVariants`

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
- Network/API access: see `manifest.json` `networkAccess.allowedDomains` (Google APIs, avatars, Drive, proxy).
- OAuth: UI opens browser via `figma.openExternal`, tokens and `userinfo` are stored in `figma.clientStorage`.
- Images: UI fetches bytes (CSP‑safe) via Drive API or proxy `https://google-sheet-sync-api.vercel.app/api/proxy`.

