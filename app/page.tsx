"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PanelList from "../components/PanelList";
import PanelPromptForm from "../components/PanelPromptForm";
import { DEFAULT_MODEL } from "../lib/constants";
import { compressImageDataUrl, fileToDataUrl } from "../lib/image";
import { exportProjectToJson, importProjectFromJson } from "../lib/project-transfer";
import {
  ComicPanel,
  ComicProject,
  StoredImageRef,
  createEmptyProject,
  createPanel,
  ensureCurrentProjectSchema,
  imageRefToUrl,
  reindexPanels
} from "../lib/schema";
import { deleteSnapshot, loadProject, loadSnapshots, restoreSnapshot, saveProject, saveSnapshot } from "../lib/storage";

function withTimestamp<T extends ComicProject>(project: T): T {
  return {
    ...project,
    updatedAt: new Date().toISOString()
  };
}

function buildSeriesBibleText(project: ComicProject): string {
  const bible = project.seriesBible;

  if (!bible) {
    return "";
  }

  const constraints = bible.constraints
    .filter((entry) => entry.trim().length > 0)
    .map((entry) => `- ${entry.trim()}`)
    .join("\n");

  const sections = [
    bible.styleNotes ? `Style notes: ${bible.styleNotes}` : "",
    bible.characterNotes ? `Character notes: ${bible.characterNotes}` : "",
    constraints ? `Constraints:\n${constraints}` : ""
  ].filter(Boolean);

  return sections.join("\n\n");
}

function imageRefValue(image?: StoredImageRef): string | undefined {
  return image ? imageRefToUrl(image) : undefined;
}

const MAX_REFERENCE_IMAGES = 2;
const REFERENCE_BUDGET_CHARS = 2_000_000;

async function prepareReferenceImage(dataUrl: string): Promise<string> {
  const compressed = await compressImageDataUrl(dataUrl, {
    maxWidth: 768,
    maxHeight: 768,
    quality: 0.68
  });

  return compressed;
}

async function buildReferenceImages(input: {
  project: ComicProject;
  selectedPanel: ComicPanel;
  consistencyMode: boolean;
}): Promise<string[]> {
  const { project, selectedPanel, consistencyMode } = input;
  const candidates: string[] = [];

  const addCandidate = (value?: string) => {
    if (value && value.startsWith("data:image/") && !candidates.includes(value)) {
      candidates.push(value);
    }
  };

  const includeCharacterSheet = consistencyMode || selectedPanel.includeCharacterSheetRef;
  if (includeCharacterSheet) {
    addCandidate(imageRefValue(project.characterSheet));
  }

  const includeLastPanel = consistencyMode || selectedPanel.includeLastPanelRef;
  if (includeLastPanel) {
    const previousWithImage = [...project.panels]
      .filter((panel) => panel.index < selectedPanel.index)
      .sort((a, b) => b.index - a.index)
      .find((panel) => panel.image);

    addCandidate(imageRefValue(previousWithImage?.image));
  }

  for (const panelId of selectedPanel.referencePanelIds ?? []) {
    const refPanel = project.panels.find((panel) => panel.id === panelId);
    addCandidate(imageRefValue(refPanel?.image));
  }

  const prepared = await Promise.all(candidates.slice(0, MAX_REFERENCE_IMAGES).map((value) => prepareReferenceImage(value)));

  const budgeted: string[] = [];
  let totalChars = 0;

  for (const ref of prepared) {
    if (totalChars + ref.length > REFERENCE_BUDGET_CHARS) {
      break;
    }

    budgeted.push(ref);
    totalChars += ref.length;
  }

  return budgeted;
}

export default function HomePage() {
  const [project, setProject] = useState<ComicProject | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string>("");
  const [availableModels, setAvailableModels] = useState<string[]>([DEFAULT_MODEL]);
  const [consistencyMode, setConsistencyMode] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [snapshots, setSnapshots] = useState<
    { id: string; createdAt: string; note?: string }[]
  >([]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const loaded = await loadProject();

      if (!mounted) {
        return;
      }

      if (loaded) {
        const current = ensureCurrentProjectSchema(loaded);
        setProject(current);
        setSelectedPanelId(current.panels[0]?.id ?? "");
      } else {
        const empty = createEmptyProject();
        await saveProject(empty);
        if (!mounted) {
          return;
        }
        setProject(empty);
        setSelectedPanelId(empty.panels[0]?.id ?? "");
      }

      const loadedSnapshots = await loadSnapshots();
      if (mounted) {
        setSnapshots(loadedSnapshots.map(({ id, createdAt, note }) => ({ id, createdAt, note })));
      }
    }

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!project) {
      return;
    }

    void saveProject(project);
  }, [project]);

  useEffect(() => {
    async function getModels() {
      try {
        const response = await fetch("/api/models", { method: "GET" });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { models?: string[] };

        if (Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models);
        }
      } catch {
        // fallback list remains in state
      }
    }

    getModels();
  }, []);

  const selectedPanel = useMemo(
    () => project?.panels.find((panel) => panel.id === selectedPanelId) ?? null,
    [project, selectedPanelId]
  );

  const previousPanels = useMemo(() => {
    if (!project || !selectedPanel) {
      return [];
    }

    return project.panels.filter((panel) => panel.index < selectedPanel.index);
  }, [project, selectedPanel]);

  const patchProject = (updater: (current: ComicProject) => ComicProject) => {
    setProject((current) => {
      if (!current) {
        return current;
      }

      return withTimestamp(updater(current));
    });
  };

  const refreshSnapshots = async () => {
    const loadedSnapshots = await loadSnapshots();
    setSnapshots(loadedSnapshots.map(({ id, createdAt, note }) => ({ id, createdAt, note })));
  };

  const onExportProject = () => {
    if (!project) {
      return;
    }

    const json = exportProjectToJson(project);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(project.title || "comic-project").trim().replace(/\s+/g, "-").toLowerCase() || "comic-project"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onImportProject = async (file?: File) => {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const result = importProjectFromJson(text);

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setProject(result.project);
      setSelectedPanelId(result.project.panels[0]?.id ?? "");
      await saveProject(result.project);
      setStatusMessage("Project imported successfully.");
      setErrorMessage("");
      await refreshSnapshots();
    } catch {
      setErrorMessage("Failed to import project file.");
    }
  };

  const onCreateSnapshot = async () => {
    if (!project) {
      return;
    }

    await saveSnapshot(project, "Manual snapshot");
    await refreshSnapshots();
    setStatusMessage("Snapshot saved.");
  };

  const onRestoreSnapshot = async (snapshotId: string) => {
    const restored = await restoreSnapshot(snapshotId);

    if (!restored) {
      setErrorMessage("Snapshot not found.");
      return;
    }

    setProject(restored);
    setSelectedPanelId(restored.panels[0]?.id ?? "");
    setStatusMessage("Snapshot restored.");
    setErrorMessage("");
  };

  const onDeleteSnapshot = async (snapshotId: string) => {
    await deleteSnapshot(snapshotId);
    await refreshSnapshots();
  };

  const patchPanel = (patch: Partial<ComicPanel>) => {
    if (!selectedPanel) {
      return;
    }

    patchProject((current) => ({
      ...current,
      panels: current.panels.map((panel) =>
        panel.id === selectedPanel.id
          ? {
              ...panel,
              ...patch
            }
          : panel
      )
    }));
  };

  const onAddPanel = () => {
    if (!project) {
      return;
    }

    const panel = createPanel(project.panels.length);

    patchProject((current) => ({
      ...current,
      panels: reindexPanels([...current.panels, panel])
    }));

    setSelectedPanelId(panel.id);
  };

  const onCharacterSheetUpload = async (file?: File) => {
    if (!file) {
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      const compressedDataUrl = await compressImageDataUrl(dataUrl, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.72
      });
      patchProject((current) => ({
        ...current,
        characterSheet: {
          kind: "dataUrl",
          dataUrl: compressedDataUrl
        }
      }));
    } catch {
      setErrorMessage("Failed to read character sheet image.");
    }
  };

  const onGenerate = async () => {
    if (!project || !selectedPanel) {
      return;
    }

    const rawPrompt = selectedPanel.prompt.trim();

    if (!rawPrompt) {
      setErrorMessage("Panel prompt is required.");
      return;
    }

    setErrorMessage("");
    setStatusMessage("");
    setIsGenerating(true);

    try {
      const references = await buildReferenceImages({ project, selectedPanel, consistencyMode });

      const seriesBibleText = buildSeriesBibleText(project);
      const prompt = seriesBibleText
        ? `${rawPrompt}\n\nSeries bible guidance:\n${seriesBibleText}`
        : rawPrompt;

      const response = await fetch("/api/panel/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selectedPanel.model || DEFAULT_MODEL,
          prompt,
          referenceImageUrls: references.slice(0, 4),
          imageConfig: {
            aspect_ratio: "4:3",
            image_size: "1K"
          }
        })
      });

      const payload = (await response.json()) as {
        imageDataUrl?: string;
        text?: string;
        error?: string;
      };

      if (!response.ok || !payload.imageDataUrl) {
        throw new Error(payload.error || "Image generation failed.");
      }

      patchProject((current) => ({
        ...current,
        panels: current.panels.map((panel) => {
          if (panel.id !== selectedPanel.id) {
            return panel;
          }

          return {
            ...panel,
            image: {
              kind: "dataUrl",
              dataUrl: payload.imageDataUrl as string
            },
            lastGeneratedAt: new Date().toISOString(),
            lastGenMeta: {
              provider: "openrouter"
            }
          };
        })
      }));

      setStatusMessage("Panel image generated successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate image.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!project || !selectedPanel) {
    return <main className="page-shell">Loading project...</main>;
  }

  return (
    <main className="page-shell stack">
      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 26 }}>ComicGen MVP</h1>
          <Link className="button secondary" href="/editor">
            Edit page
          </Link>
        </div>

        <div className="field">
          <label htmlFor="project-title">Project title</label>
          <input
            id="project-title"
            value={project.title ?? ""}
            onChange={(event) => patchProject((current) => ({ ...current, title: event.target.value }))}
            placeholder="Optional title"
          />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={consistencyMode}
            onChange={(event) => setConsistencyMode(event.target.checked)}
          />
          Consistency Mode (always include character sheet + last panel, and append series bible)
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="button secondary" onClick={onExportProject}>
            Export project JSON
          </button>
          <label className="button secondary" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
            Import project JSON
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(event) => void onImportProject(event.target.files?.[0])}
            />
          </label>
          <button type="button" className="button secondary" onClick={() => void onCreateSnapshot()}>
            Save snapshot
          </button>
        </div>

        <div className="card stack" style={{ padding: 12 }}>
          <strong>Snapshots</strong>
          {snapshots.length === 0 && <span style={{ fontSize: 13 }}>No snapshots yet.</span>}
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 8
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{snapshot.note || "Snapshot"}</span>
                <span style={{ fontSize: 12, opacity: 0.75 }}>{new Date(snapshot.createdAt).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="button secondary" onClick={() => void onRestoreSnapshot(snapshot.id)}>
                  Restore
                </button>
                <button type="button" className="button secondary" onClick={() => void onDeleteSnapshot(snapshot.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-main">
        <div className="stack">
          <PanelList
            panels={project.panels}
            selectedPanelId={selectedPanelId}
            onSelectPanel={setSelectedPanelId}
            onAddPanel={onAddPanel}
          />

          <div className="card stack">
            <strong>Series bible</strong>

            <div className="field">
              <label htmlFor="style-notes">Style notes</label>
              <textarea
                id="style-notes"
                rows={3}
                value={project.seriesBible?.styleNotes ?? ""}
                onChange={(event) =>
                  patchProject((current) => ({
                    ...current,
                    seriesBible: {
                      styleNotes: event.target.value,
                      characterNotes: current.seriesBible?.characterNotes ?? "",
                      constraints: current.seriesBible?.constraints ?? []
                    }
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="character-notes">Character notes</label>
              <textarea
                id="character-notes"
                rows={3}
                value={project.seriesBible?.characterNotes ?? ""}
                onChange={(event) =>
                  patchProject((current) => ({
                    ...current,
                    seriesBible: {
                      styleNotes: current.seriesBible?.styleNotes ?? "",
                      characterNotes: event.target.value,
                      constraints: current.seriesBible?.constraints ?? []
                    }
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="constraints">Constraints (one per line)</label>
              <textarea
                id="constraints"
                rows={4}
                value={(project.seriesBible?.constraints ?? []).join("\n")}
                onChange={(event) =>
                  patchProject((current) => ({
                    ...current,
                    seriesBible: {
                      styleNotes: current.seriesBible?.styleNotes ?? "",
                      characterNotes: current.seriesBible?.characterNotes ?? "",
                      constraints: event.target.value.split("\n")
                    }
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="character-sheet">Character sheet image</label>
              <input
                id="character-sheet"
                type="file"
                accept="image/*"
                onChange={(event) => onCharacterSheetUpload(event.target.files?.[0])}
              />
              {project.characterSheet && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageRefToUrl(project.characterSheet)}
                  alt="Character sheet"
                  className="panel-preview"
                  style={{ maxHeight: 180 }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0, fontSize: 20 }}>Panel {selectedPanel.index + 1}</h2>

          <PanelPromptForm
            panel={selectedPanel}
            availableModels={availableModels}
            previousPanels={previousPanels}
            canUseCharacterSheet={Boolean(project.characterSheet)}
            consistencyMode={consistencyMode}
            isGenerating={isGenerating}
            onPanelChange={patchPanel}
            onGenerate={onGenerate}
          />

          {errorMessage && <div className="status error">{errorMessage}</div>}
          {statusMessage && <div className="status ok">{statusMessage}</div>}

          <div className="stack">
            <strong>Preview</strong>
            {selectedPanel.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageRefToUrl(selectedPanel.image)}
                alt={`Panel ${selectedPanel.index + 1} preview`}
                className="panel-preview"
              />
            ) : (
              <div className="card" style={{ background: "#f8fafc", color: "#334155" }}>
                No generated image for this panel yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
