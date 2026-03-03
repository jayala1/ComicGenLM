import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "../lib/constants";
import { createEmptyProject } from "../lib/schema";

async function importStorageFresh() {
  vi.resetModules();
  return import("../lib/storage");
}

function makeIndexedDbSuccessEnv(initialValue?: unknown): {
  envWindow: {
    indexedDB: { open: (name: string, version?: number) => unknown };
    localStorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };
  };
  createObjectStore: ReturnType<typeof vi.fn>;
} {
  const records = new Map<string, unknown>();

  if (initialValue !== undefined) {
    records.set(STORAGE_KEY, initialValue);
  }

  const createObjectStore = vi.fn();

  const db = {
    objectStoreNames: {
      contains: vi.fn().mockReturnValue(false)
    },
    createObjectStore,
    transaction: vi.fn().mockImplementation((_storeName: string, mode: string) => {
      const tx: {
        objectStore: () => { get: (key: string) => unknown; put: (value: unknown, key: string) => void };
        oncomplete: null | (() => void);
        onerror: null | (() => void);
        onabort: null | (() => void);
        error: Error | null;
      } = {
        objectStore: () => ({
          get: (key: string) => {
            const request: {
              result: unknown;
              error: null;
              onsuccess: null | (() => void);
              onerror: null | (() => void);
            } = {
              result: records.get(key),
              error: null,
              onsuccess: null,
              onerror: null
            };

            queueMicrotask(() => {
              request.onsuccess?.();
            });

            return request;
          },
          put: (value: unknown, key: string) => {
            records.set(key, value);
          }
        }),
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: null
      };

      if (mode === "readwrite") {
        queueMicrotask(() => {
          tx.oncomplete?.();
        });
      }

      return tx;
    })
  };

  const envWindow = {
    indexedDB: {
      open: vi.fn((_name: string, _version?: number) => {
        const request: {
          result: typeof db;
          error: null;
          onsuccess: null | (() => void);
          onerror: null | (() => void);
          onupgradeneeded: null | (() => void);
        } = {
          result: db,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null
        };

        queueMicrotask(() => {
          request.onupgradeneeded?.();
          request.onsuccess?.();
        });

        return request;
      })
    },
    localStorage: {
      getItem: vi.fn(),
      setItem: vi.fn()
    }
  };

  return {
    envWindow,
    createObjectStore
  };
}

describe("storage helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loadProject() returns null when not in browser", async () => {
    vi.unstubAllGlobals();
    const { loadProject } = await importStorageFresh();
    const loaded = await loadProject();
    expect(loaded).toBeNull();
  });

  it("saveProject() does not throw when not in browser", async () => {
    const { saveProject } = await importStorageFresh();
    await expect(saveProject(createEmptyProject())).resolves.toBeUndefined();
  });

  it("loadProject() falls back to localStorage when indexedDB is unavailable", async () => {
    const project = createEmptyProject();
    const getItem = vi.fn().mockReturnValue(JSON.stringify(project));
    const setItem = vi.fn();

    vi.stubGlobal("window", {
      indexedDB: {
        open: () => {
          throw new Error("IndexedDB unavailable");
        }
      },
      localStorage: {
        getItem,
        setItem
      }
    });

    const { loadProject } = await importStorageFresh();
    const loaded = await loadProject();

    expect(loaded?.id).toBe(project.id);
    expect(getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it("saveProject() falls back to localStorage when indexedDB is unavailable", async () => {
    const project = createEmptyProject();
    const setItem = vi.fn();

    vi.stubGlobal("window", {
      indexedDB: {
        open: () => {
          throw new Error("IndexedDB unavailable");
        }
      },
      localStorage: {
        getItem: vi.fn(),
        setItem
      }
    });

    const { saveProject } = await importStorageFresh();
    await saveProject(project);

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String));
  });

  it("saveProject() persists to indexedDB when available", async () => {
    const project = createEmptyProject();
    const { envWindow } = makeIndexedDbSuccessEnv();

    vi.stubGlobal("window", envWindow);

    const { saveProject } = await importStorageFresh();
    await saveProject(project);

    expect(envWindow.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("loadProject() reads valid project from indexedDB", async () => {
    const project = createEmptyProject();
    const { envWindow } = makeIndexedDbSuccessEnv(project);

    vi.stubGlobal("window", envWindow);

    const { loadProject } = await importStorageFresh();
    const loaded = await loadProject();

    expect(loaded?.id).toBe(project.id);
    expect(envWindow.localStorage.getItem).not.toHaveBeenCalled();
  });

  it("saveSnapshot() and restoreSnapshot() work end-to-end", async () => {
    const project = createEmptyProject();
    const { envWindow } = makeIndexedDbSuccessEnv();
    vi.stubGlobal("window", envWindow);

    const { saveSnapshot, loadSnapshots, restoreSnapshot, saveProject } = await importStorageFresh();

    await saveProject(project);
    const snapshot = await saveSnapshot(project, "before-change");

    const snapshots = await loadSnapshots();
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[0]?.id).toBe(snapshot.id);

    const restored = await restoreSnapshot(snapshot.id);
    expect(restored?.id).toBe(project.id);
  });

  it("savePanelTemplate() and loadPanelTemplates() persist templates", async () => {
    const project = createEmptyProject();
    const { envWindow } = makeIndexedDbSuccessEnv();
    vi.stubGlobal("window", envWindow);

    const { savePanelTemplate, loadPanelTemplates } = await importStorageFresh();

    const saved = await savePanelTemplate({
      name: "Two Column Story",
      layout: "two-column",
      frameStyle: project.page.frameStyle,
      panelBoxes: project.page.panelBoxes
    });

    const templates = await loadPanelTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0]?.id).toBe(saved.id);
    expect(templates[0]?.name).toBe("Two Column Story");
    expect(templates[0]?.layout).toBe("two-column");
  });

  it("deletePanelTemplate() removes an existing template", async () => {
    const project = createEmptyProject();
    const { envWindow } = makeIndexedDbSuccessEnv();
    vi.stubGlobal("window", envWindow);

    const { savePanelTemplate, loadPanelTemplates, deletePanelTemplate } = await importStorageFresh();

    const saved = await savePanelTemplate({
      name: "Delete Me",
      layout: "vertical",
      frameStyle: project.page.frameStyle,
      panelBoxes: project.page.panelBoxes
    });

    let templates = await loadPanelTemplates();
    expect(templates.some((template) => template.id === saved.id)).toBe(true);

    await deletePanelTemplate(saved.id);
    templates = await loadPanelTemplates();
    expect(templates.some((template) => template.id === saved.id)).toBe(false);
  });
});
