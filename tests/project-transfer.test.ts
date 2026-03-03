import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../lib/schema";
import { exportProjectToJson, importProjectFromJson } from "../lib/project-transfer";

describe("project transfer helpers", () => {
  it("exports and imports a project round-trip", () => {
    const project = createEmptyProject();
    project.title = "Transfer Test";

    const json = exportProjectToJson(project);
    const imported = importProjectFromJson(json);

    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.project.title).toBe("Transfer Test");
      expect(imported.project.panels.length).toBeGreaterThan(0);
    }
  });

  it("rejects invalid json", () => {
    const imported = importProjectFromJson("not-json");

    expect(imported.ok).toBe(false);
    if (!imported.ok) {
      expect(imported.error).toContain("not valid JSON");
    }
  });

  it("rejects empty input", () => {
    const imported = importProjectFromJson("   ");

    expect(imported.ok).toBe(false);
    if (!imported.ok) {
      expect(imported.error).toContain("empty");
    }
  });
});
