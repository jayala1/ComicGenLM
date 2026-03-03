# ComicGen MVP

ComicGen is an open-source Next.js app for generating consistent multi-panel comics with OpenRouter image-capable models, then arranging generated panels and speech bubbles in a page editor.

## Current MVP capabilities

- Project + panel workflow with prompt and references
  - include previous panel reference
  - include character sheet reference
  - select manual references from earlier panels
- Consistency Mode
  - auto-includes character sheet (if present)
  - auto-includes last generated panel (if present)
  - appends series bible guidance to generation prompt
- Server-side image generation via [`/api/panel/generate`](app/api/panel/generate/route.ts)
  - multimodal message parts (`text` + `image_url`)
  - uses `modalities: ["image", "text"]`
  - robust auth/rate-limit/payload/upstream error mapping
- Optional model discovery via [`/api/models`](app/api/models/route.ts)
- Page editor
  - layout templates: vertical, two-column, three-column, cinematic strips
  - frame style controls: border color/width/radius, background, gutter
  - draggable + resizable panel boxes with snap grid
  - reusable panel template save/load/delete
  - speech bubble add/select/drag/edit/resize/delete
  - PNG export
- Persistence
  - IndexedDB primary storage
  - localStorage fallback for environments where IndexedDB is unavailable

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Add your OpenRouter key in `.env.local`:

```env
OPENROUTER_API_KEY=your_key_here
```

## Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Build and lint

```bash
npm run build
npm run lint
```

## Testing and quality gates (Completed #9)

The testing foundation and quality gates are now implemented.

- Test runner + coverage:
  - [`scripts.test`](package.json:10)
  - [`scripts.test:watch`](package.json:11)
  - [`scripts.test:coverage`](package.json:12)
  - [`scripts.test:e2e`](package.json:13)
  - [`scripts.test:e2e:ui`](package.json:14)
  - config in [`vitest.config.ts`](vitest.config.ts)
- E2E config in [`playwright.config.ts`](playwright.config.ts)
- Coverage thresholds are enforced in [`vitest.config.ts`](vitest.config.ts).
- CI workflow added in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) to run tests, coverage, build, and lint on push/PR.
- CI also runs E2E smoke tests with Playwright Chromium.
- Current implemented test suites:
  - [`tests/schema.test.ts`](tests/schema.test.ts)
  - [`tests/image.test.ts`](tests/image.test.ts)
  - [`tests/storage.test.ts`](tests/storage.test.ts)
  - [`tests/panel-generate-route.test.ts`](tests/panel-generate-route.test.ts)
  - [`tests/models-route.test.ts`](tests/models-route.test.ts)
  - [`tests/e2e/comic-smoke.spec.ts`](tests/e2e/comic-smoke.spec.ts)

Run full local verification:

```bash
npm run test
npm run test:coverage
npm run test:e2e
npm run build
npm run lint
```

## Project structure

```text
app/
  api/
    models/route.ts
    panel/generate/route.ts
  editor/page.tsx
  globals.css
  layout.tsx
  page.tsx
components/
  BubbleTools.tsx
  CanvasEditor.tsx
  PanelList.tsx
  PanelPromptForm.tsx
lib/
  constants.ts
  image.ts
  openrouter.ts
  schema.ts
  storage.ts
DECISIONS.md
README.md
```

## Suggested usage flow

1. Set project title and create panel prompts.
2. Upload character sheet and add series bible notes (optional).
3. Generate panel 1 with prompt (and optionally character sheet).
4. Generate panel 2+ with last-panel reference for consistency.
5. Open editor and place bubbles.
6. Export final page as PNG.

## Notes on large reference payloads (413)

If you hit a “reference images too large” error:

- Use fewer references for that generation.
- Prefer character sheet + last panel only.
- Avoid selecting many manual references at once.

The client now compresses references and enforces a reference budget before sending generation requests.

## Production-readiness roadmap (open-source focused)

### 1) Reliability and data integrity

- ✅ Project schema versioning + migration normalization.
- ✅ Autosave snapshots and restore points (manual save/restore/delete UI).
- ✅ Import/export project JSON with migration-aware validation.
- Add structured telemetry for API failures (privacy-safe, opt-in).

### 2) Image and asset pipeline

- Move image storage to object URLs or remote object storage for scale.
- Add background image optimization pipeline and deduping.
- Add retry and fallback model strategy for generation failures.

### 3) Editor UX quality

- Add zoom/pan, rulers, snapping, alignment guides.
- Add undo/redo history stack.
- Add keyboard shortcuts and multi-select transforms.

### 4) Bubble style system (requested)

- ✅ Bubble style presets: oval, rectangle, thought, shout.
- ✅ Tail controls: enabled toggle, side, offset, size.
- ✅ Color and border controls (fill, border color/width, text color).
- Add advanced typography controls: font family, weight, stroke, outline, spacing.
- Add style tokens + reusable named presets per project.

### 5) Panel layout and panel-box system (requested)

- ✅ Add layout templates: vertical, two-column, three-column, cinematic strips.
- ✅ Add per-panel frame styling: border thickness, rounded corners, gutters, panel background.
- ✅ Add draggable/resizable panel boxes with snap grid.
- ✅ Add template save/load/delete for reusable page compositions.

### 6) Output and sharing

- Add PDF export (single page and multi-page).
- Add print presets (bleed/safe margins, DPI guidance).
- Add export options: PNG quality, transparent background, bundle export.

### 7) Accessibility and onboarding

- Improve ARIA labels, keyboard-only editor operations, contrast checks.
- Add onboarding checklist + example starter projects.
- Add inline help for prompt engineering and consistency best practices.

### 8) Security and operations

- Add API rate limiting and abuse protections on server routes.
- Add strict request/response validation and payload sanitation.
- Add CI checks (typecheck, lint, tests, build) with PR templates.

### 9) Testing and quality gates

- ✅ Unit tests for schema, storage, and image utility logic.
- ✅ API route tests with mocked upstream behavior.
- ✅ CI quality gate for tests/coverage/build/lint.
- ✅ E2E smoke test for generate → editor → export flow.

### 10) Open-source project health

- Add CONTRIBUTING.md, issue templates, and coding standards.
- Add architecture docs and extension guides for plugins/styles/templates.
- Add semantic versioning and changelog release process.
