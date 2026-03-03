"use client";

import { ComicPanel } from "../lib/schema";

type PanelListProps = {
  panels: ComicPanel[];
  selectedPanelId?: string;
  onSelectPanel: (panelId: string) => void;
  onAddPanel: () => void;
};

export default function PanelList({
  panels,
  selectedPanelId,
  onSelectPanel,
  onAddPanel
}: PanelListProps) {
  return (
    <div className="card stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Panels</strong>
        <button type="button" className="button" onClick={onAddPanel}>
          Add panel
        </button>
      </div>

      <div className="stack">
        {panels.map((panel) => {
          const isSelected = panel.id === selectedPanelId;

          return (
            <button
              key={panel.id}
              type="button"
              className="button secondary"
              onClick={() => onSelectPanel(panel.id)}
              style={{
                textAlign: "left",
                borderColor: isSelected ? "#0f172a" : "#cbd5e1",
                background: isSelected ? "#e2e8f0" : "#ffffff"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span>Panel {panel.index + 1}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{panel.image ? "Image ✓" : "No image"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
