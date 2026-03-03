"use client";

import { ComicPanel } from "../lib/schema";

type PanelPromptFormProps = {
  panel: ComicPanel;
  availableModels: string[];
  previousPanels: ComicPanel[];
  canUseCharacterSheet: boolean;
  consistencyMode: boolean;
  isGenerating: boolean;
  onPanelChange: (patch: Partial<ComicPanel>) => void;
  onGenerate: () => void;
};

export default function PanelPromptForm({
  panel,
  availableModels,
  previousPanels,
  canUseCharacterSheet,
  consistencyMode,
  isGenerating,
  onPanelChange,
  onGenerate
}: PanelPromptFormProps) {
  const selectedManualRefs = panel.referencePanelIds ?? [];

  const toggleReferencePanel = (panelId: string) => {
    const current = new Set(selectedManualRefs);

    if (current.has(panelId)) {
      current.delete(panelId);
    } else {
      current.add(panelId);
    }

    onPanelChange({ referencePanelIds: Array.from(current) });
  };

  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="prompt">Panel prompt</label>
        <textarea
          id="prompt"
          rows={8}
          value={panel.prompt}
          onChange={(event) => onPanelChange({ prompt: event.target.value })}
          placeholder="Describe what happens in this panel..."
        />
      </div>

      <div className="field">
        <label htmlFor="model">Model</label>
        <input
          id="model"
          list="model-options"
          value={panel.model}
          onChange={(event) => onPanelChange({ model: event.target.value })}
        />
        <datalist id="model-options">
          {availableModels.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={panel.includeLastPanelRef}
            onChange={(event) => onPanelChange({ includeLastPanelRef: event.target.checked })}
          />
          Include last panel ref
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={panel.includeCharacterSheetRef}
            disabled={!canUseCharacterSheet}
            onChange={(event) => onPanelChange({ includeCharacterSheetRef: event.target.checked })}
          />
          Include character sheet ref
        </label>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <strong style={{ fontSize: 14 }}>Manual refs from previous panels</strong>
        <div className="stack" style={{ marginTop: 8 }}>
          {previousPanels.length === 0 && <span style={{ fontSize: 13 }}>No previous panels available yet.</span>}
          {previousPanels.map((previous) => (
            <label
              key={previous.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
            >
              <span>
                Panel {previous.index + 1} {previous.image ? "(has image)" : "(no image)"}
              </span>
              <input
                type="checkbox"
                checked={selectedManualRefs.includes(previous.id)}
                onChange={() => toggleReferencePanel(previous.id)}
              />
            </label>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Consistency mode is <strong>{consistencyMode ? "ON" : "OFF"}</strong>.
      </div>

      <button type="button" className="button" onClick={onGenerate} disabled={isGenerating || !panel.prompt.trim()}>
        {isGenerating ? "Generating..." : "Generate panel"}
      </button>
    </div>
  );
}
