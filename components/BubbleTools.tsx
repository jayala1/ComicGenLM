"use client";

import { useEffect, useMemo, useState } from "react";
import { Bubble, BubbleShapePreset, BubbleTailSide, ComicPanel, createBubbleStyle } from "../lib/schema";

type BubbleToolsProps = {
  panelsWithImage: ComicPanel[];
  bubbles: Bubble[];
  selectedBubbleId: string | null;
  onSelectBubble: (bubbleId: string | null) => void;
  onAddBubble: (panelId: string) => void;
  onUpdateBubble: (bubble: Bubble) => void;
  onDeleteBubble: (bubbleId: string) => void;
};

export default function BubbleTools({
  panelsWithImage,
  bubbles,
  selectedBubbleId,
  onSelectBubble,
  onAddBubble,
  onUpdateBubble,
  onDeleteBubble
}: BubbleToolsProps) {
  const [selectedPanelForNewBubble, setSelectedPanelForNewBubble] = useState<string>(panelsWithImage[0]?.id ?? "");

  useEffect(() => {
    if (!selectedPanelForNewBubble && panelsWithImage[0]?.id) {
      setSelectedPanelForNewBubble(panelsWithImage[0].id);
    }
  }, [panelsWithImage, selectedPanelForNewBubble]);

  const selectedBubble = useMemo(
    () => bubbles.find((bubble) => bubble.id === selectedBubbleId) ?? null,
    [bubbles, selectedBubbleId]
  );

  const setPreset = (bubble: Bubble, preset: BubbleShapePreset) => {
    const base = createBubbleStyle(preset);
    onUpdateBubble({
      ...bubble,
      style: {
        ...bubble.style,
        ...base,
        tail: {
          ...base.tail,
          ...bubble.style.tail
        },
        preset
      }
    });
  };

  return (
    <div className="card stack">
      <strong>Bubble tools</strong>

      <div className="field">
        <label htmlFor="bubble-panel">Add bubble to panel</label>
        <select
          id="bubble-panel"
          value={selectedPanelForNewBubble}
          onChange={(event) => setSelectedPanelForNewBubble(event.target.value)}
          disabled={panelsWithImage.length === 0}
        >
          {panelsWithImage.map((panel) => (
            <option key={panel.id} value={panel.id}>
              Panel {panel.index + 1}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="button"
        onClick={() => selectedPanelForNewBubble && onAddBubble(selectedPanelForNewBubble)}
        disabled={!selectedPanelForNewBubble}
      >
        Add bubble
      </button>

      <div className="stack">
        <strong style={{ fontSize: 14 }}>Existing bubbles</strong>
        {bubbles.length === 0 && <span style={{ fontSize: 13 }}>No bubbles yet.</span>}
        {bubbles.map((bubble, i) => (
          <button
            key={bubble.id}
            type="button"
            className="button secondary"
            onClick={() => onSelectBubble(bubble.id)}
            style={{
              textAlign: "left",
              borderColor: selectedBubbleId === bubble.id ? "#0f172a" : "#cbd5e1",
              background: selectedBubbleId === bubble.id ? "#e2e8f0" : "#fff"
            }}
          >
            Bubble {i + 1} (Panel {panelsWithImage.find((panel) => panel.id === bubble.panelId)?.index ?? 0 + 1})
          </button>
        ))}
      </div>

      {selectedBubble && (
        <div className="stack" style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
          <strong style={{ fontSize: 14 }}>Selected bubble</strong>

          <div className="field">
            <label htmlFor="bubble-text">Text</label>
            <textarea
              id="bubble-text"
              rows={4}
              value={selectedBubble.text}
              onChange={(event) => onUpdateBubble({ ...selectedBubble, text: event.target.value })}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <div className="field">
              <label htmlFor="bubble-preset">Preset</label>
              <select
                id="bubble-preset"
                value={selectedBubble.style.preset}
                onChange={(event) => setPreset(selectedBubble, event.target.value as BubbleShapePreset)}
              >
                <option value="oval">Oval</option>
                <option value="rectangle">Rectangle</option>
                <option value="thought">Thought</option>
                <option value="shout">Shout</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="bubble-width">Width</label>
              <input
                id="bubble-width"
                type="number"
                min={80}
                value={selectedBubble.width}
                onChange={(event) =>
                  onUpdateBubble({ ...selectedBubble, width: Math.max(80, Number(event.target.value) || 80) })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="bubble-height">Height</label>
              <input
                id="bubble-height"
                type="number"
                min={50}
                value={selectedBubble.height}
                onChange={(event) =>
                  onUpdateBubble({ ...selectedBubble, height: Math.max(50, Number(event.target.value) || 50) })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="bubble-font">Font size</label>
              <input
                id="bubble-font"
                type="number"
                min={10}
                value={selectedBubble.fontSize ?? 16}
                onChange={(event) =>
                  onUpdateBubble({ ...selectedBubble, fontSize: Math.max(10, Number(event.target.value) || 16) })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="bubble-fill">Fill color</label>
              <input
                id="bubble-fill"
                type="color"
                value={selectedBubble.style.fillColor}
                onChange={(event) =>
                  onUpdateBubble({ ...selectedBubble, style: { ...selectedBubble.style, fillColor: event.target.value } })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="bubble-border">Border color</label>
              <input
                id="bubble-border"
                type="color"
                value={selectedBubble.style.borderColor}
                onChange={(event) =>
                  onUpdateBubble({
                    ...selectedBubble,
                    style: { ...selectedBubble.style, borderColor: event.target.value }
                  })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="bubble-text-color">Text color</label>
              <input
                id="bubble-text-color"
                type="color"
                value={selectedBubble.style.textColor}
                onChange={(event) =>
                  onUpdateBubble({ ...selectedBubble, style: { ...selectedBubble.style, textColor: event.target.value } })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="bubble-border-width">Border width</label>
              <input
                id="bubble-border-width"
                type="number"
                min={1}
                max={8}
                value={selectedBubble.style.borderWidth}
                onChange={(event) =>
                  onUpdateBubble({
                    ...selectedBubble,
                    style: {
                      ...selectedBubble.style,
                      borderWidth: Math.max(1, Math.min(8, Number(event.target.value) || 1))
                    }
                  })
                }
              />
            </div>
          </div>

          <div className="card" style={{ padding: 10 }}>
            <strong style={{ fontSize: 13 }}>Tail</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedBubble.style.tail.enabled}
                  onChange={(event) =>
                    onUpdateBubble({
                      ...selectedBubble,
                      style: {
                        ...selectedBubble.style,
                        tail: { ...selectedBubble.style.tail, enabled: event.target.checked }
                      }
                    })
                  }
                />
                Tail enabled
              </label>

              <div className="field">
                <label htmlFor="bubble-tail-side">Tail side</label>
                <select
                  id="bubble-tail-side"
                  value={selectedBubble.style.tail.side}
                  onChange={(event) =>
                    onUpdateBubble({
                      ...selectedBubble,
                      style: {
                        ...selectedBubble.style,
                        tail: { ...selectedBubble.style.tail, side: event.target.value as BubbleTailSide }
                      }
                    })
                  }
                >
                  <option value="bottom">Bottom</option>
                  <option value="top">Top</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="bubble-tail-offset">Tail offset (%)</label>
                <input
                  id="bubble-tail-offset"
                  type="number"
                  min={0}
                  max={100}
                  value={selectedBubble.style.tail.offset}
                  onChange={(event) =>
                    onUpdateBubble({
                      ...selectedBubble,
                      style: {
                        ...selectedBubble.style,
                        tail: {
                          ...selectedBubble.style.tail,
                          offset: Math.max(0, Math.min(100, Number(event.target.value) || 0))
                        }
                      }
                    })
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="bubble-tail-size">Tail size</label>
                <input
                  id="bubble-tail-size"
                  type="number"
                  min={6}
                  max={24}
                  value={selectedBubble.style.tail.size}
                  onChange={(event) =>
                    onUpdateBubble({
                      ...selectedBubble,
                      style: {
                        ...selectedBubble.style,
                        tail: {
                          ...selectedBubble.style.tail,
                          size: Math.max(6, Math.min(24, Number(event.target.value) || 6))
                        }
                      }
                    })
                  }
                />
              </div>
            </div>
          </div>

          <button type="button" className="button secondary" onClick={() => onDeleteBubble(selectedBubble.id)}>
            Delete bubble
          </button>
        </div>
      )}
    </div>
  );
}
