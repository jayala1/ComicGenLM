import { ComicProject, ensureCurrentProjectSchema, migrateProject } from "./schema";

export type ImportResult =
  | { ok: true; project: ComicProject }
  | { ok: false; error: string };

export function exportProjectToJson(project: ComicProject): string {
  const normalized = ensureCurrentProjectSchema(project);
  return JSON.stringify(normalized, null, 2);
}

export function importProjectFromJson(source: string): ImportResult {
  if (!source.trim()) {
    return {
      ok: false,
      error: "Import file is empty."
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return {
      ok: false,
      error: "Import file is not valid JSON."
    };
  }

  const migrated = migrateProject(parsed);

  if (!migrated) {
    return {
      ok: false,
      error: "JSON does not contain a valid comic project shape."
    };
  }

  return {
    ok: true,
    project: ensureCurrentProjectSchema(migrated)
  };
}
