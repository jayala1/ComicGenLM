import { STORAGE_KEY } from "./constants";
import {
  ComicProject,
  ensureCurrentProjectSchema,
  makeId,
  migrateProject,
  PROJECT_SCHEMA_VERSION
} from "./schema";

const DB_NAME = "comicgen-db";
const DB_VERSION = 1;
const STORE_NAME = "kv";
const SNAPSHOTS_KEY = `${STORAGE_KEY}:snapshots`;
const MAX_SNAPSHOTS = 15;

export type ProjectSnapshot = {
  id: string;
  createdAt: string;
  note?: string;
  project: ComicProject;
};

export type PanelTemplate = {
  id: string;
  name: string;
  createdAt: string;
  layout: ComicProject["page"]["layout"];
  frameStyle: ComicProject["page"]["frameStyle"];
  panelBoxes: ComicProject["page"]["panelBoxes"];
};

const PANEL_TEMPLATES_KEY = `${STORAGE_KEY}:panel-templates`;
const MAX_PANEL_TEMPLATES = 20;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasCurrentSchemaVersion(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return value.schemaVersion === PROJECT_SCHEMA_VERSION;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error("Not in browser environment."));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    });
  }

  return dbPromise;
}

function parseLocalStorageValue(key: string): unknown {
  if (!isBrowser()) {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return undefined;
    }

    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function writeLocalStorageValue(key: string, value: unknown): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Swallow quota/storage exceptions to avoid crashing the UI.
  }
}

function normalizeSnapshot(value: unknown): ProjectSnapshot | null {
  if (!isObject(value)) {
    return null;
  }

  const migrated = migrateProject(value.project);

  if (!migrated) {
    return null;
  }

  return {
    id: typeof value.id === "string" ? value.id : makeId("snapshot"),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    note: typeof value.note === "string" ? value.note : undefined,
    project: migrated
  };
}

function normalizeSnapshots(value: unknown): ProjectSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeSnapshot(entry))
    .filter((entry): entry is ProjectSnapshot => entry !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function normalizeTemplate(value: unknown): PanelTemplate | null {
  if (!isObject(value)) {
    return null;
  }

  const layout = value.layout;
  const normalizedLayout =
    layout === "vertical" || layout === "two-column" || layout === "three-column" || layout === "cinematic"
      ? layout
      : "vertical";

  if (!isObject(value.frameStyle)) {
    return null;
  }

  const frameStyle = value.frameStyle;

  if (!Array.isArray(value.panelBoxes)) {
    return null;
  }

  const panelBoxes = value.panelBoxes
    .filter((entry): entry is Record<string, unknown> => isObject(entry))
    .map((entry) => ({
      panelId: typeof entry.panelId === "string" ? entry.panelId : makeId("panel"),
      x: typeof entry.x === "number" && Number.isFinite(entry.x) ? Math.max(0, entry.x) : 20,
      y: typeof entry.y === "number" && Number.isFinite(entry.y) ? Math.max(0, entry.y) : 20,
      width:
        typeof entry.width === "number" && Number.isFinite(entry.width) ? Math.max(120, entry.width) : 240,
      height:
        typeof entry.height === "number" && Number.isFinite(entry.height) ? Math.max(100, entry.height) : 180
    }));

  return {
    id: typeof value.id === "string" ? value.id : makeId("panel-template"),
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : "Template",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    layout: normalizedLayout,
    frameStyle: {
      borderColor: typeof frameStyle.borderColor === "string" ? frameStyle.borderColor : "#cbd5e1",
      borderWidth:
        typeof frameStyle.borderWidth === "number" && Number.isFinite(frameStyle.borderWidth)
          ? Math.max(1, Math.min(6, frameStyle.borderWidth))
          : 1,
      borderRadius:
        typeof frameStyle.borderRadius === "number" && Number.isFinite(frameStyle.borderRadius)
          ? Math.max(0, Math.min(24, frameStyle.borderRadius))
          : 0,
      backgroundColor: typeof frameStyle.backgroundColor === "string" ? frameStyle.backgroundColor : "#f8fafc",
      gutter:
        typeof frameStyle.gutter === "number" && Number.isFinite(frameStyle.gutter)
          ? Math.max(6, Math.min(80, frameStyle.gutter))
          : 20
    },
    panelBoxes
  };
}

function normalizeTemplates(value: unknown): PanelTemplate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeTemplate(entry))
    .filter((entry): entry is PanelTemplate => entry !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function readFromIndexedDb(key: string): Promise<unknown> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return requestToPromise(store.get(key));
}

async function writeToIndexedDb(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.put(value, key);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  });
}

async function readValueWithFallback(key: string): Promise<unknown> {
  if (!isBrowser()) {
    return undefined;
  }

  try {
    const indexedValue = await readFromIndexedDb(key);

    if (indexedValue !== undefined) {
      return indexedValue;
    }
  } catch {
    // fallback to localStorage below
  }

  return parseLocalStorageValue(key);
}

async function writeValueWithFallback(key: string, value: unknown): Promise<void> {
  if (!isBrowser()) {
    return;
  }

  try {
    await writeToIndexedDb(key, value);
    return;
  } catch {
    // fallback to localStorage below
  }

  writeLocalStorageValue(key, value);
}

export async function loadProject(): Promise<ComicProject | null> {
  if (!isBrowser()) {
    return null;
  }

  const raw = await readValueWithFallback(STORAGE_KEY);
  const migrated = migrateProject(raw);

  if (!migrated) {
    return null;
  }

  if (!hasCurrentSchemaVersion(raw)) {
    // Best-effort migration rewrite
    void saveProject(migrated);
  }

  return migrated;
}

export async function saveProject(project: ComicProject): Promise<void> {
  if (!isBrowser()) {
    return;
  }

  const normalized = ensureCurrentProjectSchema(project);
  await writeValueWithFallback(STORAGE_KEY, normalized);
}

export async function loadSnapshots(): Promise<ProjectSnapshot[]> {
  if (!isBrowser()) {
    return [];
  }

  const raw = await readValueWithFallback(SNAPSHOTS_KEY);
  const snapshots = normalizeSnapshots(raw);

  return snapshots.slice(0, MAX_SNAPSHOTS);
}

export async function saveSnapshot(project: ComicProject, note?: string): Promise<ProjectSnapshot> {
  const current = ensureCurrentProjectSchema(project);
  const existing = await loadSnapshots();

  const snapshot: ProjectSnapshot = {
    id: makeId("snapshot"),
    createdAt: new Date().toISOString(),
    note: typeof note === "string" && note.trim() ? note.trim() : undefined,
    project: current
  };

  const next = [snapshot, ...existing].slice(0, MAX_SNAPSHOTS);
  await writeValueWithFallback(SNAPSHOTS_KEY, next);

  return snapshot;
}

export async function restoreSnapshot(snapshotId: string): Promise<ComicProject | null> {
  const snapshots = await loadSnapshots();
  const found = snapshots.find((snapshot) => snapshot.id === snapshotId);

  if (!found) {
    return null;
  }

  const migrated = ensureCurrentProjectSchema(found.project);
  await saveProject(migrated);

  return migrated;
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  const snapshots = await loadSnapshots();
  const next = snapshots.filter((snapshot) => snapshot.id !== snapshotId);

  await writeValueWithFallback(SNAPSHOTS_KEY, next);
}

export async function loadPanelTemplates(): Promise<PanelTemplate[]> {
  if (!isBrowser()) {
    return [];
  }

  const raw = await readValueWithFallback(PANEL_TEMPLATES_KEY);
  const templates = normalizeTemplates(raw);

  return templates.slice(0, MAX_PANEL_TEMPLATES);
}

export async function savePanelTemplate(input: {
  name: string;
  layout: ComicProject["page"]["layout"];
  frameStyle: ComicProject["page"]["frameStyle"];
  panelBoxes: ComicProject["page"]["panelBoxes"];
}): Promise<PanelTemplate> {
  const existing = await loadPanelTemplates();

  const template: PanelTemplate = {
    id: makeId("panel-template"),
    name: input.name.trim() || "Template",
    createdAt: new Date().toISOString(),
    layout: input.layout,
    frameStyle: input.frameStyle,
    panelBoxes: input.panelBoxes
  };

  const next = [template, ...existing].slice(0, MAX_PANEL_TEMPLATES);
  await writeValueWithFallback(PANEL_TEMPLATES_KEY, next);

  return template;
}

export async function deletePanelTemplate(templateId: string): Promise<void> {
  const existing = await loadPanelTemplates();
  const next = existing.filter((template) => template.id !== templateId);
  await writeValueWithFallback(PANEL_TEMPLATES_KEY, next);
}
