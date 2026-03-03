import { DEFAULT_MODEL } from "./constants";

export const PROJECT_SCHEMA_VERSION = 2;

const PAGE_PADDING = 20;

export type ComicProject = {
  schemaVersion: number;
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  seriesBible?: SeriesBible;
  characterSheet?: StoredImageRef;
  panels: ComicPanel[];
  page: ComicPage;
};

export type SeriesBible = {
  styleNotes: string;
  characterNotes: string;
  constraints: string[];
};

export type ComicPanel = {
  id: string;
  index: number;
  prompt: string;
  model: string;
  includeLastPanelRef: boolean;
  includeCharacterSheetRef: boolean;
  referencePanelIds?: string[];
  image?: StoredImageRef;
  lastGeneratedAt?: string;
  lastGenMeta?: {
    provider?: string;
    cost?: number;
    requestId?: string;
  };
};

export type StoredImageRef =
  | { kind: "dataUrl"; dataUrl: string }
  | { kind: "url"; url: string };

export type ComicPage = {
  width: number;
  height: number;
  layout: PanelLayoutTemplate;
  frameStyle: PanelFrameStyle;
  panelBoxes: PanelBox[];
  bubbles: Bubble[];
};

export type PanelLayoutTemplate = "vertical" | "two-column" | "three-column" | "cinematic";

export type PanelFrameStyle = {
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  backgroundColor: string;
  gutter: number;
};

export type PanelBox = {
  panelId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Bubble = {
  id: string;
  panelId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize?: number;
  style: BubbleStyle;
};

export type BubbleShapePreset = "oval" | "rectangle" | "thought" | "shout";
export type BubbleTailSide = "left" | "right" | "top" | "bottom";

export type BubbleStyle = {
  preset: BubbleShapePreset;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  tail: {
    enabled: boolean;
    side: BubbleTailSide;
    offset: number;
    size: number;
  };
};

export function makeId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPanel(index: number): ComicPanel {
  return {
    id: makeId("panel"),
    index,
    prompt: "",
    model: DEFAULT_MODEL,
    includeLastPanelRef: true,
    includeCharacterSheetRef: true,
    referencePanelIds: []
  };
}

export function createBubble(panelId: string, x: number, y: number): Bubble {
  return {
    id: makeId("bubble"),
    panelId,
    x,
    y,
    width: 180,
    height: 110,
    text: "New bubble",
    fontSize: 16,
    style: createBubbleStyle("oval")
  };
}

export function createBubbleStyle(preset: BubbleShapePreset = "oval"): BubbleStyle {
  return {
    preset,
    fillColor: "#ffffff",
    borderColor: "#1e293b",
    borderWidth: preset === "thought" ? 2 : 1,
    textColor: "#0f172a",
    tail: {
      enabled: true,
      side: "bottom",
      offset: 50,
      size: 14
    }
  };
}

export function createEmptyProject(): ComicProject {
  const now = new Date().toISOString();
  const pageWidth = 980;
  const initialPanels = [createPanel(0)];

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: makeId("project"),
    title: "",
    createdAt: now,
    updatedAt: now,
    seriesBible: {
      styleNotes: "",
      characterNotes: "",
      constraints: []
    },
    panels: initialPanels,
    page: {
      width: pageWidth,
      height: 1400,
      layout: "vertical",
      frameStyle: createDefaultFrameStyle(),
      panelBoxes: buildTemplatePanelBoxes(
        initialPanels.map((panel) => panel.id),
        pageWidth,
        "vertical",
        createDefaultFrameStyle().gutter
      ),
      bubbles: []
    }
  };
}

export function createDefaultFrameStyle(): PanelFrameStyle {
  return {
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 0,
    backgroundColor: "#f8fafc",
    gutter: 20
  };
}

export function buildTemplatePanelBoxes(
  panelIds: string[],
  pageWidth: number,
  layout: PanelLayoutTemplate,
  gutter: number
): PanelBox[] {
  const safeGutter = Math.max(6, gutter);
  const contentWidth = Math.max(220, pageWidth - PAGE_PADDING * 2);

  if (layout === "cinematic") {
    const height = Math.max(140, Math.round(contentWidth / 2.35));
    return panelIds.map((panelId, index) => ({
      panelId,
      x: PAGE_PADDING,
      y: PAGE_PADDING + index * (height + safeGutter),
      width: contentWidth,
      height
    }));
  }

  if (layout === "two-column") {
    const colWidth = Math.max(120, Math.round((contentWidth - safeGutter) / 2));
    const height = Math.max(120, Math.round((colWidth * 3) / 4));

    return panelIds.map((panelId, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      return {
        panelId,
        x: PAGE_PADDING + col * (colWidth + safeGutter),
        y: PAGE_PADDING + row * (height + safeGutter),
        width: colWidth,
        height
      };
    });
  }

  if (layout === "three-column") {
    const colWidth = Math.max(100, Math.round((contentWidth - safeGutter * 2) / 3));
    const height = Math.max(100, Math.round((colWidth * 3) / 4));

    return panelIds.map((panelId, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      return {
        panelId,
        x: PAGE_PADDING + col * (colWidth + safeGutter),
        y: PAGE_PADDING + row * (height + safeGutter),
        width: colWidth,
        height
      };
    });
  }

  const height = Math.max(180, Math.round((contentWidth * 3) / 4));
  return panelIds.map((panelId, index) => ({
    panelId,
    x: PAGE_PADDING,
    y: PAGE_PADDING + index * (height + safeGutter),
    width: contentWidth,
    height
  }));
}

export function ensurePanelBoxesForIds(page: ComicPage, panelIds: string[]): PanelBox[] {
  const map = new Map(page.panelBoxes.map((box) => [box.panelId, box]));
  const defaults = buildTemplatePanelBoxes(panelIds, page.width, page.layout, page.frameStyle.gutter);

  return panelIds.map((panelId, index) => {
    const existing = map.get(panelId);
    const fallback = defaults[index];

    if (!fallback) {
      return {
        panelId,
        x: PAGE_PADDING,
        y: PAGE_PADDING,
        width: Math.max(200, page.width - PAGE_PADDING * 2),
        height: 220
      };
    }

    if (!existing) {
      return fallback;
    }

    return {
      panelId,
      x: Math.max(0, existing.x),
      y: Math.max(0, existing.y),
      width: Math.max(120, existing.width),
      height: Math.max(100, existing.height)
    };
  });
}

export function reindexPanels(panels: ComicPanel[]): ComicPanel[] {
  return panels.map((panel, index) => ({
    ...panel,
    index
  }));
}

export function imageRefToUrl(image?: StoredImageRef): string | undefined {
  if (!image) {
    return undefined;
  }

  if (image.kind === "dataUrl") {
    return image.dataUrl;
  }

  return image.url;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function migrateStoredImageRef(value: unknown): StoredImageRef | undefined {
  const record = asRecord(value);

  if (record && record.kind === "dataUrl" && typeof record.dataUrl === "string") {
    return { kind: "dataUrl", dataUrl: record.dataUrl };
  }

  if (record && record.kind === "url" && typeof record.url === "string") {
    return { kind: "url", url: record.url };
  }

  if (typeof value === "string") {
    if (value.startsWith("data:image/")) {
      return { kind: "dataUrl", dataUrl: value };
    }

    if (value.startsWith("http://") || value.startsWith("https://")) {
      return { kind: "url", url: value };
    }
  }

  return undefined;
}

function migratePanel(value: unknown, index: number): ComicPanel {
  const record = asRecord(value);

  if (!record) {
    return createPanel(index);
  }

  const image = migrateStoredImageRef(record.image);
  const lastGenMetaRecord = asRecord(record.lastGenMeta);

  return {
    id: asString(record.id, makeId("panel")),
    index,
    prompt: asString(record.prompt),
    model: asString(record.model, DEFAULT_MODEL),
    includeLastPanelRef: asBoolean(record.includeLastPanelRef, true),
    includeCharacterSheetRef: asBoolean(record.includeCharacterSheetRef, true),
    referencePanelIds: asStringArray(record.referencePanelIds),
    image,
    lastGeneratedAt:
      typeof record.lastGeneratedAt === "string" && record.lastGeneratedAt.length > 0
        ? record.lastGeneratedAt
        : undefined,
    lastGenMeta: lastGenMetaRecord
      ? {
          provider: asString(lastGenMetaRecord.provider) || undefined,
          cost:
            typeof lastGenMetaRecord.cost === "number" && Number.isFinite(lastGenMetaRecord.cost)
              ? lastGenMetaRecord.cost
              : undefined,
          requestId: asString(lastGenMetaRecord.requestId) || undefined
        }
      : undefined
  };
}

function migrateBubble(value: unknown, defaultPanelId: string): Bubble | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const styleRecord = asRecord(record.style);
  const tailRecord = asRecord(styleRecord?.tail);

  const rawPreset = asString(styleRecord?.preset, "oval");
  const preset: BubbleShapePreset = ["oval", "rectangle", "thought", "shout"].includes(rawPreset)
    ? (rawPreset as BubbleShapePreset)
    : "oval";

  const rawTailSide = asString(tailRecord?.side, "bottom");
  const tailSide: BubbleTailSide = ["left", "right", "top", "bottom"].includes(rawTailSide)
    ? (rawTailSide as BubbleTailSide)
    : "bottom";

  const defaultStyle = createBubbleStyle(preset);

  return {
    id: asString(record.id, makeId("bubble")),
    panelId: asString(record.panelId, defaultPanelId),
    x: asNumber(record.x, 20),
    y: asNumber(record.y, 20),
    width: Math.max(80, asNumber(record.width, 180)),
    height: Math.max(50, asNumber(record.height, 110)),
    text: asString(record.text, "New bubble"),
    fontSize: Math.max(10, asNumber(record.fontSize, 16)),
    style: {
      preset,
      fillColor: asString(styleRecord?.fillColor, defaultStyle.fillColor),
      borderColor: asString(styleRecord?.borderColor, defaultStyle.borderColor),
      borderWidth: Math.max(1, Math.min(8, asNumber(styleRecord?.borderWidth, defaultStyle.borderWidth))),
      textColor: asString(styleRecord?.textColor, defaultStyle.textColor),
      tail: {
        enabled: asBoolean(tailRecord?.enabled, defaultStyle.tail.enabled),
        side: tailSide,
        offset: Math.max(0, Math.min(100, asNumber(tailRecord?.offset, defaultStyle.tail.offset))),
        size: Math.max(6, Math.min(24, asNumber(tailRecord?.size, defaultStyle.tail.size)))
      }
    }
  };
}

function migrateSeriesBible(value: unknown): SeriesBible {
  const record = asRecord(value);

  if (!record) {
    return {
      styleNotes: "",
      characterNotes: "",
      constraints: []
    };
  }

  return {
    styleNotes: asString(record.styleNotes),
    characterNotes: asString(record.characterNotes),
    constraints: asStringArray(record.constraints)
  };
}

function migratePage(value: unknown, fallbackPanelId: string): ComicPage {
  const record = asRecord(value);
  const fallbackPanelIds = [fallbackPanelId];
  const rawLayout = asString(record?.layout, "vertical");
  const layout: PanelLayoutTemplate =
    rawLayout === "vertical" ||
    rawLayout === "two-column" ||
    rawLayout === "three-column" ||
    rawLayout === "cinematic"
      ? rawLayout
      : "vertical";

  const frameRecord = asRecord(record?.frameStyle);
  const frameStyle: PanelFrameStyle = {
    borderColor: asString(frameRecord?.borderColor, "#cbd5e1"),
    borderWidth: Math.max(1, Math.min(6, asNumber(frameRecord?.borderWidth, 1))),
    borderRadius: Math.max(0, Math.min(24, asNumber(frameRecord?.borderRadius, 0))),
    backgroundColor: asString(frameRecord?.backgroundColor, "#f8fafc"),
    gutter: Math.max(6, Math.min(80, asNumber(frameRecord?.gutter, 20)))
  };

  const width = Math.max(240, asNumber(record?.width, 980));
  const height = Math.max(240, asNumber(record?.height, 1400));

  if (!record) {
    const boxes = buildTemplatePanelBoxes(fallbackPanelIds, width, layout, frameStyle.gutter);
    return {
      width,
      height,
      layout,
      frameStyle,
      panelBoxes: boxes,
      bubbles: []
    };
  }

  const bubbles = Array.isArray(record.bubbles)
    ? record.bubbles
        .map((bubble) => migrateBubble(bubble, fallbackPanelId))
        .filter((bubble): bubble is Bubble => bubble !== null)
    : [];

  const boxes = Array.isArray(record.panelBoxes)
    ? record.panelBoxes
        .map((entry) => {
          const box = asRecord(entry);
          if (!box) {
            return null;
          }

          return {
            panelId: asString(box.panelId, fallbackPanelId),
            x: Math.max(0, asNumber(box.x, 0)),
            y: Math.max(0, asNumber(box.y, 0)),
            width: Math.max(120, asNumber(box.width, 180)),
            height: Math.max(100, asNumber(box.height, 120))
          } as PanelBox;
        })
        .filter((entry): entry is PanelBox => entry !== null)
    : buildTemplatePanelBoxes(fallbackPanelIds, width, layout, frameStyle.gutter);

  return {
    width,
    height,
    layout,
    frameStyle,
    panelBoxes: boxes,
    bubbles
  };
}

export function migrateProject(raw: unknown): ComicProject | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const now = new Date().toISOString();
  const rawPanels = Array.isArray(record.panels) ? record.panels : [];
  const migratedPanels = reindexPanels(rawPanels.map((panel, index) => migratePanel(panel, index)));
  const panels = migratedPanels.length > 0 ? migratedPanels : [createPanel(0)];
  const panelIds = panels.map((panel) => panel.id);
  const firstPanelId = panelIds[0] ?? makeId("panel");
  const migratedPage = migratePage(record.page, firstPanelId);
  const syncedPage = {
    ...migratedPage,
    panelBoxes: ensurePanelBoxesForIds(migratedPage, panelIds)
  };

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: asString(record.id, makeId("project")),
    title: asString(record.title),
    createdAt: asString(record.createdAt, now),
    updatedAt: asString(record.updatedAt, now),
    seriesBible: migrateSeriesBible(record.seriesBible),
    characterSheet: migrateStoredImageRef(record.characterSheet),
    panels,
    page: syncedPage
  };
}

export function ensureCurrentProjectSchema(project: ComicProject): ComicProject {
  const migrated = migrateProject(project);
  return migrated ?? createEmptyProject();
}
