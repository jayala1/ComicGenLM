"use client";

import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import BubbleTools from "./BubbleTools";
import {
  Bubble,
  ComicProject,
  PanelBox,
  PanelLayoutTemplate,
  buildTemplatePanelBoxes,
  createBubble,
  ensurePanelBoxesForIds,
  imageRefToUrl
} from "../lib/schema";
import { deletePanelTemplate, loadPanelTemplates, PanelTemplate, savePanelTemplate } from "../lib/storage";
import { slugify } from "../lib/image";

type CanvasEditorProps = {
  project: ComicProject;
  onProjectChange: (project: ComicProject) => void;
};

type BubbleDragState = {
  bubbleId: string;
  offsetX: number;
  offsetY: number;
};

type PanelDragState = {
  panelId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type PanelResizeState = {
  panelId: string;
  startX: number;
  startY: number;
  originWidth: number;
  originHeight: number;
};

const PANEL_PADDING = 20;
const SNAP_GRID = 10;
const MIN_PANEL_WIDTH = 120;
const MIN_PANEL_HEIGHT = 100;

function snapToGrid(value: number): number {
  return Math.round(value / SNAP_GRID) * SNAP_GRID;
}

function clampPanelBox(box: PanelBox, pageWidth: number): PanelBox {
  const x = Math.max(0, Math.min(box.x, Math.max(0, pageWidth - MIN_PANEL_WIDTH)));
  const y = Math.max(0, box.y);
  const width = Math.max(MIN_PANEL_WIDTH, Math.min(box.width, Math.max(MIN_PANEL_WIDTH, pageWidth - x)));
  const height = Math.max(MIN_PANEL_HEIGHT, box.height);

  return {
    ...box,
    x,
    y,
    width,
    height
  };
}

function remapTemplatePanelBoxes(
  template: PanelTemplate,
  panelIds: string[],
  pageWidth: number,
  layout: PanelLayoutTemplate,
  gutter: number
): PanelBox[] {
  const fallback = buildTemplatePanelBoxes(panelIds, pageWidth, layout, gutter);

  if (template.panelBoxes.length === 0) {
    return fallback;
  }

  const sorted = [...template.panelBoxes].sort((a, b) => {
    if (a.y !== b.y) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  return panelIds.map((panelId, index) => {
    const fromTemplate = sorted[index] ?? fallback[index];
    if (!fromTemplate) {
      return {
        panelId,
        x: PANEL_PADDING,
        y: PANEL_PADDING,
        width: Math.max(MIN_PANEL_WIDTH, pageWidth - PANEL_PADDING * 2),
        height: 220
      };
    }

    return clampPanelBox(
      {
        panelId,
        x: snapToGrid(fromTemplate.x),
        y: snapToGrid(fromTemplate.y),
        width: snapToGrid(fromTemplate.width),
        height: snapToGrid(fromTemplate.height)
      },
      pageWidth
    );
  });
}

function bubbleBorderRadius(preset: Bubble["style"]["preset"]): string {
  if (preset === "rectangle") {
    return "12px";
  }

  if (preset === "shout") {
    return "24px";
  }

  return "999px";
}

function bubbleClipPath(preset: Bubble["style"]["preset"]): string | undefined {
  if (preset === "thought") {
    return "polygon(8% 54%, 4% 44%, 6% 33%, 14% 25%, 13% 15%, 21% 9%, 33% 10%, 40% 4%, 52% 3%, 60% 9%, 72% 8%, 80% 14%, 87% 23%, 95% 27%, 98% 38%, 96% 50%, 99% 60%, 95% 71%, 87% 76%, 84% 86%, 73% 91%, 61% 90%, 52% 96%, 39% 94%, 31% 89%, 19% 90%, 11% 84%, 8% 74%, 3% 66%)";
  }

  if (preset === "shout") {
    return "polygon(50% 0%, 60% 20%, 82% 8%, 76% 30%, 100% 36%, 78% 50%, 94% 72%, 68% 70%, 62% 100%, 50% 78%, 38% 100%, 32% 70%, 6% 72%, 22% 50%, 0% 36%, 24% 30%, 18% 8%, 40% 20%)";
  }

  return undefined;
}

function thoughtTailStyles(bubble: Bubble): React.CSSProperties[] {
  const size = bubble.style.tail.size;
  const offset = bubble.style.tail.offset;
  const borderWidth = bubble.style.borderWidth;

  const common: React.CSSProperties = {
    position: "absolute",
    borderRadius: "999px",
    background: bubble.style.fillColor,
    border: `${borderWidth}px solid ${bubble.style.borderColor}`,
    pointerEvents: "none"
  };

  if (bubble.style.tail.side === "bottom") {
    return [
      {
        ...common,
        width: size,
        height: size * 0.8,
        left: `calc(${offset}% - ${Math.round(size * 0.5)}px)`,
        bottom: -Math.round(size * 0.9)
      },
      {
        ...common,
        width: size * 0.62,
        height: size * 0.52,
        left: `calc(${offset}% + ${Math.round(size * 0.35)}px)`,
        bottom: -Math.round(size * 1.9)
      }
    ];
  }

  if (bubble.style.tail.side === "top") {
    return [
      {
        ...common,
        width: size,
        height: size * 0.8,
        left: `calc(${offset}% - ${Math.round(size * 0.5)}px)`,
        top: -Math.round(size * 0.9)
      },
      {
        ...common,
        width: size * 0.62,
        height: size * 0.52,
        left: `calc(${offset}% + ${Math.round(size * 0.35)}px)`,
        top: -Math.round(size * 1.9)
      }
    ];
  }

  if (bubble.style.tail.side === "left") {
    return [
      {
        ...common,
        width: size * 0.8,
        height: size,
        left: -Math.round(size * 0.9),
        top: `calc(${offset}% - ${Math.round(size * 0.5)}px)`
      },
      {
        ...common,
        width: size * 0.52,
        height: size * 0.62,
        left: -Math.round(size * 1.9),
        top: `calc(${offset}% + ${Math.round(size * 0.35)}px)`
      }
    ];
  }

  return [
    {
      ...common,
      width: size * 0.8,
      height: size,
      right: -Math.round(size * 0.9),
      top: `calc(${offset}% - ${Math.round(size * 0.5)}px)`
    },
    {
      ...common,
      width: size * 0.52,
      height: size * 0.62,
      right: -Math.round(size * 1.9),
      top: `calc(${offset}% + ${Math.round(size * 0.35)}px)`
    }
  ];
}

function tailStyle(bubble: Bubble): React.CSSProperties | null {
  if (!bubble.style.tail.enabled) {
    return null;
  }

  const size = bubble.style.tail.size;
  const offsetPercent = bubble.style.tail.offset;

  const base: React.CSSProperties = {
    position: "absolute",
    width: 0,
    height: 0,
    pointerEvents: "none"
  };

  if (bubble.style.tail.side === "bottom") {
    return {
      ...base,
      left: `${offsetPercent}%`,
      bottom: -size,
      transform: "translateX(-50%)",
      borderLeft: `${size}px solid transparent`,
      borderRight: `${size}px solid transparent`,
      borderTop: `${size}px solid ${bubble.style.fillColor}`
    };
  }

  if (bubble.style.tail.side === "top") {
    return {
      ...base,
      left: `${offsetPercent}%`,
      top: -size,
      transform: "translateX(-50%)",
      borderLeft: `${size}px solid transparent`,
      borderRight: `${size}px solid transparent`,
      borderBottom: `${size}px solid ${bubble.style.fillColor}`
    };
  }

  if (bubble.style.tail.side === "left") {
    return {
      ...base,
      left: -size,
      top: `${offsetPercent}%`,
      transform: "translateY(-50%)",
      borderTop: `${size}px solid transparent`,
      borderBottom: `${size}px solid transparent`,
      borderRight: `${size}px solid ${bubble.style.fillColor}`
    };
  }

  return {
    ...base,
    right: -size,
    top: `${offsetPercent}%`,
    transform: "translateY(-50%)",
    borderTop: `${size}px solid transparent`,
    borderBottom: `${size}px solid transparent`,
    borderLeft: `${size}px solid ${bubble.style.fillColor}`
  };
}

export default function CanvasEditor({ project, onProjectChange }: CanvasEditorProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [bubbleDragState, setBubbleDragState] = useState<BubbleDragState | null>(null);
  const [panelDragState, setPanelDragState] = useState<PanelDragState | null>(null);
  const [panelResizeState, setPanelResizeState] = useState<PanelResizeState | null>(null);
  const [exportError, setExportError] = useState<string>("");
  const [panelTemplates, setPanelTemplates] = useState<PanelTemplate[]>([]);
  const [templateName, setTemplateName] = useState<string>("");
  const [templateStatus, setTemplateStatus] = useState<string>("");

  const orderedPanels = useMemo(() => [...project.panels].sort((a, b) => a.index - b.index), [project.panels]);
  const panelIds = useMemo(() => orderedPanels.map((panel) => panel.id), [orderedPanels]);
  const panelBoxes = useMemo(() => ensurePanelBoxesForIds(project.page, panelIds), [project.page, panelIds]);

  const boardHeight = useMemo(() => {
    const maxPanelBottom = panelBoxes.reduce((maxBottom, box) => Math.max(maxBottom, box.y + box.height), PANEL_PADDING);
    return Math.max(project.page.height, maxPanelBottom + PANEL_PADDING);
  }, [panelBoxes, project.page.height]);

  useEffect(() => {
    let mounted = true;

    async function initTemplates() {
      const loaded = await loadPanelTemplates();
      if (mounted) {
        setPanelTemplates(loaded);
      }
    }

    void initTemplates();

    return () => {
      mounted = false;
    };
  }, []);

  const patchPage = (updater: (page: ComicProject["page"]) => ComicProject["page"]) => {
    const nextPage = updater(project.page);
    const synced = {
      ...nextPage,
      panelBoxes: ensurePanelBoxesForIds(nextPage, panelIds)
    };

    onProjectChange({
      ...project,
      updatedAt: new Date().toISOString(),
      page: synced
    });
  };

  const updatePanelBoxes = (updater: (boxes: PanelBox[]) => PanelBox[]) => {
    patchPage((page) => ({
      ...page,
      panelBoxes: updater(ensurePanelBoxesForIds(page, panelIds))
    }));
  };

  const updateBubbles = (nextBubbles: Bubble[]) => {
    patchPage((page) => ({
      ...page,
      bubbles: nextBubbles
    }));
  };

  const clampBubble = (bubble: Bubble): Bubble => {
    const maxX = Math.max(0, project.page.width - bubble.width);
    const maxY = Math.max(0, boardHeight - bubble.height);

    return {
      ...bubble,
      x: Math.min(Math.max(0, bubble.x), maxX),
      y: Math.min(Math.max(0, bubble.y), maxY)
    };
  };

  const applyLayoutTemplate = (layout: PanelLayoutTemplate) => {
    patchPage((page) => ({
      ...page,
      layout,
      panelBoxes: buildTemplatePanelBoxes(panelIds, page.width, layout, page.frameStyle.gutter)
    }));
  };

  const onFrameStyleChange = <K extends keyof ComicProject["page"]["frameStyle"]>(
    key: K,
    value: ComicProject["page"]["frameStyle"][K]
  ) => {
    patchPage((page) => {
      const frameStyle = {
        ...page.frameStyle,
        [key]: value
      };

      const shouldRelayout = key === "gutter";

      return {
        ...page,
        frameStyle,
        panelBoxes: shouldRelayout
          ? buildTemplatePanelBoxes(panelIds, page.width, page.layout, frameStyle.gutter)
          : ensurePanelBoxesForIds({ ...page, frameStyle }, panelIds)
      };
    });
  };

  const refreshTemplates = async () => {
    const loaded = await loadPanelTemplates();
    setPanelTemplates(loaded);
  };

  const onSaveTemplate = async () => {
    try {
      await savePanelTemplate({
        name: templateName.trim() || `Template ${panelTemplates.length + 1}`,
        layout: project.page.layout,
        frameStyle: project.page.frameStyle,
        panelBoxes
      });
      setTemplateName("");
      setTemplateStatus("Template saved.");
      await refreshTemplates();
    } catch {
      setTemplateStatus("Failed to save template.");
    }
  };

  const onApplyTemplate = (template: PanelTemplate) => {
    patchPage((page) => {
      const panelBoxesFromTemplate = remapTemplatePanelBoxes(
        template,
        panelIds,
        page.width,
        template.layout,
        template.frameStyle.gutter
      );

      return {
        ...page,
        layout: template.layout,
        frameStyle: { ...template.frameStyle },
        panelBoxes: panelBoxesFromTemplate
      };
    });
    setTemplateStatus(`Applied template: ${template.name}`);
  };

  const onDeleteTemplate = async (templateId: string) => {
    await deletePanelTemplate(templateId);
    await refreshTemplates();
    setTemplateStatus("Template deleted.");
  };

  const onBoardMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (panelDragState) {
      const deltaX = event.clientX - panelDragState.startX;
      const deltaY = event.clientY - panelDragState.startY;

      updatePanelBoxes((boxes) =>
        boxes.map((box) => {
          if (box.panelId !== panelDragState.panelId) {
            return box;
          }

          return clampPanelBox(
            {
              ...box,
              x: snapToGrid(panelDragState.originX + deltaX),
              y: snapToGrid(panelDragState.originY + deltaY)
            },
            project.page.width
          );
        })
      );
      return;
    }

    if (panelResizeState) {
      const deltaX = event.clientX - panelResizeState.startX;
      const deltaY = event.clientY - panelResizeState.startY;

      updatePanelBoxes((boxes) =>
        boxes.map((box) => {
          if (box.panelId !== panelResizeState.panelId) {
            return box;
          }

          return clampPanelBox(
            {
              ...box,
              width: snapToGrid(panelResizeState.originWidth + deltaX),
              height: snapToGrid(panelResizeState.originHeight + deltaY)
            },
            project.page.width
          );
        })
      );
      return;
    }

    if (!bubbleDragState || !boardRef.current) {
      return;
    }

    const rect = boardRef.current.getBoundingClientRect();
    const rawX = event.clientX - rect.left - bubbleDragState.offsetX;
    const rawY = event.clientY - rect.top - bubbleDragState.offsetY;

    updateBubbles(
      project.page.bubbles.map((bubble) => {
        if (bubble.id !== bubbleDragState.bubbleId) {
          return bubble;
        }

        return clampBubble({ ...bubble, x: rawX, y: rawY });
      })
    );
  };

  const onBoardMouseUp = () => {
    setBubbleDragState(null);
    setPanelDragState(null);
    setPanelResizeState(null);
  };

  const addBubble = (panelId: string) => {
    const bounds = panelBoxes.find((entry) => entry.panelId === panelId);
    const x = bounds ? bounds.x + 18 : PANEL_PADDING + 10;
    const y = bounds ? bounds.y + 18 : PANEL_PADDING + 10;
    const next = clampBubble(createBubble(panelId, x, y));
    updateBubbles([...project.page.bubbles, next]);
    setSelectedBubbleId(next.id);
  };

  const updateBubble = (nextBubble: Bubble) => {
    updateBubbles(
      project.page.bubbles.map((bubble) =>
        bubble.id === nextBubble.id ? clampBubble({ ...bubble, ...nextBubble }) : bubble
      )
    );
  };

  const deleteBubble = (bubbleId: string) => {
    updateBubbles(project.page.bubbles.filter((bubble) => bubble.id !== bubbleId));
    if (selectedBubbleId === bubbleId) {
      setSelectedBubbleId(null);
    }
  };

  const exportToPng = async () => {
    if (!boardRef.current) {
      return;
    }

    try {
      setExportError("");
      const pngUrl = await toPng(boardRef.current, {
        pixelRatio: 2,
        cacheBust: true
      });
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `${slugify(project.title || "comic-page")}.png`;
      link.click();
    } catch {
      setExportError("Failed to export PNG. Try again after all images are loaded.");
    }
  };

  return (
    <div className="stack">
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
        <div className="stack">
          <div className="card stack">
            <strong>Panel layout and frame controls</strong>

            <div className="field">
              <label htmlFor="panel-layout-template">Layout template</label>
              <select
                id="panel-layout-template"
                value={project.page.layout}
                onChange={(event) => applyLayoutTemplate(event.target.value as PanelLayoutTemplate)}
              >
                <option value="vertical">Vertical stack</option>
                <option value="two-column">Two column</option>
                <option value="three-column">Three column</option>
                <option value="cinematic">Cinematic strips</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <div className="field">
                <label htmlFor="frame-border-color">Border color</label>
                <input
                  id="frame-border-color"
                  type="color"
                  value={project.page.frameStyle.borderColor}
                  onChange={(event) => onFrameStyleChange("borderColor", event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="frame-background-color">Panel background</label>
                <input
                  id="frame-background-color"
                  type="color"
                  value={project.page.frameStyle.backgroundColor}
                  onChange={(event) => onFrameStyleChange("backgroundColor", event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="frame-border-width">Border width</label>
                <input
                  id="frame-border-width"
                  type="number"
                  min={1}
                  max={6}
                  value={project.page.frameStyle.borderWidth}
                  onChange={(event) =>
                    onFrameStyleChange("borderWidth", Math.max(1, Math.min(6, Number(event.target.value) || 1)))
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="frame-border-radius">Border radius</label>
                <input
                  id="frame-border-radius"
                  type="number"
                  min={0}
                  max={24}
                  value={project.page.frameStyle.borderRadius}
                  onChange={(event) =>
                    onFrameStyleChange("borderRadius", Math.max(0, Math.min(24, Number(event.target.value) || 0)))
                  }
                />
              </div>

              <div className="field" style={{ gridColumn: "1 / span 2" }}>
                <label htmlFor="frame-gutter">Gutter</label>
                <input
                  id="frame-gutter"
                  type="number"
                  min={6}
                  max={80}
                  value={project.page.frameStyle.gutter}
                  onChange={(event) =>
                    onFrameStyleChange("gutter", Math.max(6, Math.min(80, Number(event.target.value) || 20)))
                  }
                />
              </div>
            </div>

            <div className="card stack" style={{ padding: 10 }}>
              <strong style={{ fontSize: 13 }}>Panel templates</strong>

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Template name"
                />
                <button type="button" className="button secondary" onClick={() => void onSaveTemplate()}>
                  Save
                </button>
              </div>

              {templateStatus ? <span style={{ fontSize: 12, opacity: 0.8 }}>{templateStatus}</span> : null}

              <div className="stack" style={{ maxHeight: 200, overflow: "auto" }}>
                {panelTemplates.length === 0 ? <span style={{ fontSize: 13 }}>No templates saved yet.</span> : null}
                {panelTemplates.map((template) => (
                  <div
                    key={template.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: 8
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <strong style={{ fontSize: 13 }}>{template.name}</strong>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>{template.layout}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="button secondary" onClick={() => onApplyTemplate(template)}>
                        Apply
                      </button>
                      <button type="button" className="button secondary" onClick={() => void onDeleteTemplate(template.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <BubbleTools
            panelsWithImage={orderedPanels}
            bubbles={project.page.bubbles}
            selectedBubbleId={selectedBubbleId}
            onSelectBubble={setSelectedBubbleId}
            onAddBubble={addBubble}
            onUpdateBubble={updateBubble}
            onDeleteBubble={deleteBubble}
          />
        </div>

        <div className="card stack">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>
              Page canvas ({project.page.width} × {boardHeight}) • snap {SNAP_GRID}px
            </strong>
            <button type="button" className="button" onClick={exportToPng}>
              Export PNG
            </button>
          </div>

          {exportError && <div className="status error">{exportError}</div>}

          <div style={{ overflow: "auto", border: "1px solid #cbd5e1", borderRadius: 10, background: "#e2e8f0", padding: 8 }}>
            <div
              ref={boardRef}
              onMouseMove={onBoardMouseMove}
              onMouseUp={onBoardMouseUp}
              onMouseLeave={onBoardMouseUp}
              style={{
                position: "relative",
                width: project.page.width,
                height: boardHeight,
                background: "#ffffff",
                margin: "0 auto",
                border: "1px solid #e2e8f0",
                userSelect: bubbleDragState || panelDragState || panelResizeState ? "none" : "auto"
              }}
            >
              {panelBoxes.map((bounds) => {
                const panel = orderedPanels.find((item) => item.id === bounds.panelId);
                const src = imageRefToUrl(panel?.image);

                return (
                  <div
                    key={bounds.panelId}
                    style={{
                      position: "absolute",
                      left: bounds.x,
                      top: bounds.y,
                      width: bounds.width,
                      height: bounds.height,
                      border: `${project.page.frameStyle.borderWidth}px solid ${project.page.frameStyle.borderColor}`,
                      borderRadius: project.page.frameStyle.borderRadius,
                      background: project.page.frameStyle.backgroundColor,
                      overflow: "hidden",
                      zIndex: 1
                    }}
                  >
                    <div
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setPanelDragState({
                          panelId: bounds.panelId,
                          startX: event.clientX,
                          startY: event.clientY,
                          originX: bounds.x,
                          originY: bounds.y
                        });
                      }}
                      title="Drag panel"
                      style={{
                        position: "absolute",
                        left: 6,
                        top: 6,
                        zIndex: 5,
                        borderRadius: 6,
                        border: "1px solid #94a3b8",
                        background: "rgba(255,255,255,0.9)",
                        padding: "2px 6px",
                        fontSize: 12,
                        cursor: "move",
                        userSelect: "none"
                      }}
                    >
                      Panel {panel ? panel.index + 1 : "?"}
                    </div>

                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={`Panel ${panel ? panel.index + 1 : ""}`}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        draggable={false}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#475569",
                          fontSize: 13,
                          textAlign: "center",
                          padding: 12
                        }}
                      >
                        Panel {panel ? panel.index + 1 : "?"} has no image yet.
                      </div>
                    )}

                    <div
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setPanelResizeState({
                          panelId: bounds.panelId,
                          startX: event.clientX,
                          startY: event.clientY,
                          originWidth: bounds.width,
                          originHeight: bounds.height
                        });
                      }}
                      title="Resize panel"
                      style={{
                        position: "absolute",
                        right: 4,
                        bottom: 4,
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: "1px solid #94a3b8",
                        background: "rgba(255,255,255,0.95)",
                        cursor: "se-resize",
                        zIndex: 5
                      }}
                    />
                  </div>
                );
              })}

              {project.page.bubbles.map((bubble) => {
                const isSelected = bubble.id === selectedBubbleId;
                const clipPath = bubbleClipPath(bubble.style.preset);
                const tail = bubble.style.preset === "thought" ? null : tailStyle(bubble);
                const thoughtTails =
                  bubble.style.preset === "thought" && bubble.style.tail.enabled ? thoughtTailStyles(bubble) : [];
                return (
                  <div
                    key={bubble.id}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();

                      const target = event.currentTarget.getBoundingClientRect();
                      const offsetX = event.clientX - target.left;
                      const offsetY = event.clientY - target.top;

                      setSelectedBubbleId(bubble.id);
                      setBubbleDragState({ bubbleId: bubble.id, offsetX, offsetY });
                    }}
                    style={{
                      position: "absolute",
                      left: bubble.x,
                      top: bubble.y,
                      width: bubble.width,
                      height: bubble.height,
                      cursor: "grab",
                      overflow: "visible",
                      zIndex: 20
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: bubbleBorderRadius(bubble.style.preset),
                        background: bubble.style.fillColor,
                        border: `${isSelected ? Math.max(2, bubble.style.borderWidth) : bubble.style.borderWidth}px solid ${
                          isSelected ? "#0f172a" : bubble.style.borderColor
                        }`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        padding: 12,
                        overflow: "hidden",
                        fontSize: bubble.fontSize ?? 16,
                        lineHeight: 1.2,
                        color: bubble.style.textColor,
                        clipPath
                      }}
                    >
                      {bubble.text || "..."}
                    </div>
                    {tail ? <div style={tail} /> : null}
                    {thoughtTails.map((style, index) => (
                      <div key={`${bubble.id}-thought-tail-${index}`} style={style} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
