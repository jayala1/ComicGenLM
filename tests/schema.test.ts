import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL } from "../lib/constants";
import {
  buildTemplatePanelBoxes,
  createBubble,
  createBubbleStyle,
  createDefaultFrameStyle,
  createEmptyProject,
  createPanel,
  ensurePanelBoxesForIds,
  ensureCurrentProjectSchema,
  imageRefToUrl,
  migrateProject,
  PROJECT_SCHEMA_VERSION,
  reindexPanels
} from "../lib/schema";

describe("schema helpers", () => {
  it("createPanel() uses expected defaults", () => {
    const panel = createPanel(2);

    expect(panel.index).toBe(2);
    expect(panel.model).toBe(DEFAULT_MODEL);
    expect(panel.includeLastPanelRef).toBe(true);
    expect(panel.includeCharacterSheetRef).toBe(true);
    expect(panel.referencePanelIds).toEqual([]);
  });

  it("createBubble() uses expected defaults", () => {
    const bubble = createBubble("p1", 10, 20);

    expect(bubble.panelId).toBe("p1");
    expect(bubble.x).toBe(10);
    expect(bubble.y).toBe(20);
    expect(bubble.width).toBe(180);
    expect(bubble.height).toBe(110);
    expect(bubble.fontSize).toBe(16);
    expect(bubble.style.preset).toBe("oval");
    expect(bubble.style.tail.enabled).toBe(true);
  });

  it("createBubbleStyle() builds style presets", () => {
    const shout = createBubbleStyle("shout");

    expect(shout.preset).toBe("shout");
    expect(shout.borderWidth).toBeGreaterThan(0);
    expect(shout.tail.side).toBe("bottom");
  });

  it("createEmptyProject() creates one panel and vertical page layout", () => {
    const project = createEmptyProject();

    expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(project.panels).toHaveLength(1);
    expect(project.panels[0]?.index).toBe(0);
    expect(project.page.layout).toBe("vertical");
    expect(project.page.width).toBe(980);
  });

  it("reindexPanels() normalizes indexes by order", () => {
    const first = createPanel(99);
    const second = createPanel(88);

    const reindexed = reindexPanels([second, first]);

    expect(reindexed[0]?.index).toBe(0);
    expect(reindexed[1]?.index).toBe(1);
  });

  it("imageRefToUrl() returns correct URL for ref kinds", () => {
    expect(imageRefToUrl(undefined)).toBeUndefined();
    expect(imageRefToUrl({ kind: "dataUrl", dataUrl: "data:image/png;base64,abc" })).toBe(
      "data:image/png;base64,abc"
    );
    expect(imageRefToUrl({ kind: "url", url: "https://example.com/a.png" })).toBe(
      "https://example.com/a.png"
    );
  });

  it("migrateProject() upgrades legacy project shape", () => {
    const legacy = {
      id: "legacy-1",
      panels: [{ id: "p1", index: 0, prompt: "x", model: DEFAULT_MODEL }],
      page: { width: 900, height: 1200, bubbles: [] }
    };

    const migrated = migrateProject(legacy);

    expect(migrated).not.toBeNull();
    expect(migrated?.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(migrated?.panels.length).toBeGreaterThan(0);
    expect(migrated?.page.layout).toBe("vertical");
    expect(migrated?.page.bubbles).toEqual([]);
  });

  it("migrateProject() fills bubble style defaults for legacy bubbles", () => {
    const legacy = {
      id: "legacy-2",
      panels: [{ id: "p1", index: 0, prompt: "x", model: DEFAULT_MODEL }],
      page: {
        width: 900,
        height: 1200,
        bubbles: [{ id: "b1", panelId: "p1", x: 10, y: 10, width: 120, height: 60, text: "Hi" }]
      }
    };

    const migrated = migrateProject(legacy);

    expect(migrated?.page.bubbles[0]?.style.preset).toBe("oval");
    expect(migrated?.page.bubbles[0]?.style.tail.enabled).toBe(true);
  });

  it("ensureCurrentProjectSchema() normalizes missing legacy fields", () => {
    const project = createEmptyProject();
    const broken = {
      ...project,
      // simulate legacy/broken fields
      schemaVersion: 0,
      panels: [{ ...project.panels[0], includeCharacterSheetRef: undefined }]
    } as unknown as typeof project;

    const normalized = ensureCurrentProjectSchema(broken);

    expect(normalized.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(normalized.panels[0]?.includeCharacterSheetRef).toBe(true);
  });

  it("buildTemplatePanelBoxes() creates expected geometry for vertical layout", () => {
    const boxes = buildTemplatePanelBoxes(["p1", "p2"], 980, "vertical", 20);

    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toMatchObject({
      panelId: "p1",
      x: 20,
      width: 940
    });
    expect(boxes[1]?.y).toBeGreaterThan(boxes[0]!.y);
  });

  it("buildTemplatePanelBoxes() supports two-column and three-column layouts", () => {
    const twoColumn = buildTemplatePanelBoxes(["p1", "p2", "p3"], 980, "two-column", 20);
    const threeColumn = buildTemplatePanelBoxes(["p1", "p2", "p3"], 980, "three-column", 20);

    expect(twoColumn).toHaveLength(3);
    expect(twoColumn[0]?.x).not.toBe(twoColumn[1]?.x);

    expect(threeColumn).toHaveLength(3);
    expect(threeColumn[0]?.x).toBeLessThan(threeColumn[1]!.x);
    expect(threeColumn[1]?.x).toBeLessThan(threeColumn[2]!.x);
  });

  it("ensurePanelBoxesForIds() keeps existing boxes and backfills missing ids", () => {
    const frameStyle = createDefaultFrameStyle();
    const page = {
      width: 980,
      height: 1400,
      layout: "vertical" as const,
      frameStyle,
      bubbles: [],
      panelBoxes: [{ panelId: "p1", x: -10, y: -5, width: 90, height: 80 }]
    };

    const synced = ensurePanelBoxesForIds(page, ["p1", "p2"]);

    expect(synced).toHaveLength(2);
    expect(synced[0]).toMatchObject({
      panelId: "p1",
      x: 0,
      y: 0,
      width: 120,
      height: 100
    });
    expect(synced[1]?.panelId).toBe("p2");
    expect(synced[1]?.width).toBeGreaterThanOrEqual(120);
    expect(synced[1]?.height).toBeGreaterThanOrEqual(100);
  });
});
