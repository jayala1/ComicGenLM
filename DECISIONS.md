# Decisions and assumptions

## 1) Default model

- Chosen default model id: `google/gemini-2.5-flash-image`.
- Reason: aligned with the requirement examples and image-output support in OpenRouter.

## 2) Persistence choice

- Chosen persistence for MVP runtime: IndexedDB primary, localStorage fallback.
- Reason: generated base64 images can exceed localStorage quotas quickly.
- Behavior:
  - load/save attempts IndexedDB first,
  - gracefully falls back to localStorage,
  - catches write failures to prevent runtime crashes.

## 3) Layout defaults

- Chosen page layout: vertical stacked panels (`layout: "vertical"`).
- Default page width/height: `980 x 1400`.
- Editor panel rendering now computes panel height from a 4:3 ratio target to match image generation defaults.
- Panel images render with contain-fit to preserve full image without cropping.

## 4) Consistency mode behavior

- Implemented as a UI toggle on the generation page.
- When enabled, generation automatically includes:
  - character sheet ref (if present), and
  - last generated panel ref (if present).
- Series bible text is appended to the generation prompt when present.

## 5) Reference payload guard

- Server checks total reference payload size (string length proxy) and returns 413 if too large.
- Error text instructs reducing number/size of references.
- Client also applies defensive reduction before request:
  - compresses reference images,
  - limits references sent,
  - applies a client-side total reference budget.

## 6) Model listing

- Implemented optional `/api/models` route.
- Behavior:
  - uses OpenRouter models API when key is present,
  - filters to image-output models,
  - falls back to curated list on failure.

## 7) Consistency vs payload tradeoff

- Consistency mode remains enabled by default for better character/style continuity.
- For reliability, reference selection prioritizes smaller/fewer refs to avoid payload failures.
- Recommended generation sequence:
  - panel 1: prompt (+ optional character sheet),
  - panel 2+: prompt + last panel (add character sheet only when needed).

## 8) Open-source direction assumptions

- Product is planned as open-source and creator-first (no monetization assumptions).
- Near-term roadmap prioritizes editing power, export quality, reliability, and contribution ergonomics.

## 9) Panel layout system decisions (#5)

- Added layout templates in editor and schema model:
  - `vertical`, `two-column`, `three-column`, `cinematic`.
- Added `page.frameStyle` controls and persistence:
  - `borderColor`, `borderWidth`, `borderRadius`, `backgroundColor`, `gutter`.
- Added explicit `page.panelBoxes` model:
  - per-panel `x/y/width/height` coordinates persisted with project.
- Added editor interactions:
  - drag panel frame by handle,
  - resize panel frame by bottom-right handle,
  - snap-to-grid (`10px`) for consistent composition.
- Added reusable panel template persistence in storage:
  - save, load, delete template entries,
  - templates include layout + frame style + panel box geometry,
  - when applying templates to a different panel count, boxes are remapped by visual order with safe fallback generation.
