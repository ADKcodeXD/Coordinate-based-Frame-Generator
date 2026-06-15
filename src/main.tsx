import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type RatioKey = "21:9" | "16:9" | "9:16" | "4:3" | "3:4" | "1:1";
type OutputMode = "percent" | "pixel";
type DragMode = "draw" | "move" | "resize";
type Handle = "nw" | "ne" | "sw" | "se";

type Rect = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
};

type Interaction = {
  mode: DragMode;
  id: number;
  startX: number;
  startY: number;
  base: Rect;
  handle?: Handle;
};

const ratios: Record<RatioKey, [number, number]> = {
  "21:9": [21, 9],
  "16:9": [16, 9],
  "9:16": [9, 16],
  "4:3": [4, 3],
  "3:4": [3, 4],
  "1:1": [1, 1],
};

const palette = ["#0f766e", "#6d28d9", "#be123c", "#2563eb", "#d97706", "#16a34a"];
const minSize = 0.015;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}

function normalizeRect(rect: Rect): Rect {
  const x = rect.w < 0 ? rect.x + rect.w : rect.x;
  const y = rect.h < 0 ? rect.y + rect.h : rect.y;
  const w = Math.abs(rect.w);
  const h = Math.abs(rect.h);
  return {
    ...rect,
    x: clamp(x),
    y: clamp(y),
    w: clamp(w, minSize, 1 - clamp(x)),
    h: clamp(h, minSize, 1 - clamp(y)),
  };
}

function formatRect(rect: Rect, mode: OutputMode, canvasWidth: number, canvasHeight: number) {
  if (mode === "pixel") {
    return `[L=${Math.round(rect.x * canvasWidth)}, T=${Math.round(rect.y * canvasHeight)}, W=${Math.round(
      rect.w * canvasWidth,
    )}, H=${Math.round(rect.h * canvasHeight)}]`;
  }

  return `[L=${round(rect.x, 3)}, T=${round(rect.y, 3)}, W=${round(rect.w, 3)}, H=${round(rect.h, 3)}]`;
}

function pointerToRatio(event: React.PointerEvent<HTMLElement>, element: HTMLElement) {
  const box = element.getBoundingClientRect();
  return {
    x: clamp((event.clientX - box.left) / box.width),
    y: clamp((event.clientY - box.top) / box.height),
  };
}

function App() {
  const [ratio, setRatio] = React.useState<RatioKey>("16:9");
  const [mode, setMode] = React.useState<OutputMode>("percent");
  const [canvasWidth, setCanvasWidth] = React.useState(1920);
  const [canvasHeight, setCanvasHeight] = React.useState(1080);
  const [snap, setSnap] = React.useState(false);
  const [rects, setRects] = React.useState<Rect[]>([
    { id: 1, x: 0.12, y: 0.14, w: 0.24, h: 0.34, color: palette[0] },
    { id: 2, x: 0.52, y: 0.24, w: 0.25, h: 0.44, color: palette[1] },
  ]);
  const [activeId, setActiveId] = React.useState(2);
  const [copied, setCopied] = React.useState<string | null>(null);
  const interaction = React.useRef<Interaction | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);

  const [rw, rh] = ratios[ratio];
  const activeRect = rects.find((rect) => rect.id === activeId) ?? rects[0];
  const allOutput = rects.map((rect) => formatRect(rect, mode, canvasWidth, canvasHeight)).join("\n");

  function snapValue(value: number) {
    return snap ? Math.round(value * 100) / 100 : value;
  }

  function updateRect(id: number, next: Rect) {
    setRects((items) => items.map((item) => (item.id === id ? normalizeRect(next) : item)));
  }

  function startDraw(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const point = pointerToRatio(event, event.currentTarget);
    const id = Date.now();
    const rect = { id, x: point.x, y: point.y, w: minSize, h: minSize, color: palette[rects.length % palette.length] };
    interaction.current = { mode: "draw", id, startX: point.x, startY: point.y, base: rect };
    setRects((items) => [...items, rect]);
    setActiveId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startMove(event: React.PointerEvent<HTMLDivElement>, rect: Rect) {
    event.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = pointerToRatio(event, canvas);
    interaction.current = { mode: "move", id: rect.id, startX: point.x, startY: point.y, base: rect };
    setActiveId(rect.id);
    canvas.setPointerCapture(event.pointerId);
  }

  function startResize(event: React.PointerEvent<HTMLButtonElement>, rect: Rect, handle: Handle) {
    event.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = pointerToRatio(event, canvas);
    interaction.current = { mode: "resize", id: rect.id, startX: point.x, startY: point.y, base: rect, handle };
    setActiveId(rect.id);
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const current = interaction.current;
    if (!current) return;
    const point = pointerToRatio(event, event.currentTarget);
    const dx = point.x - current.startX;
    const dy = point.y - current.startY;
    const base = current.base;

    if (current.mode === "draw") {
      updateRect(current.id, { ...base, w: snapValue(point.x - base.x), h: snapValue(point.y - base.y) });
      return;
    }

    if (current.mode === "move") {
      updateRect(current.id, {
        ...base,
        x: snapValue(clamp(base.x + dx, 0, 1 - base.w)),
        y: snapValue(clamp(base.y + dy, 0, 1 - base.h)),
      });
      return;
    }

    const next = { ...base };
    if (current.handle?.includes("e")) next.w = snapValue(base.w + dx);
    if (current.handle?.includes("s")) next.h = snapValue(base.h + dy);
    if (current.handle?.includes("w")) {
      next.x = snapValue(base.x + dx);
      next.w = snapValue(base.w - dx);
    }
    if (current.handle?.includes("n")) {
      next.y = snapValue(base.y + dy);
      next.h = snapValue(base.h - dy);
    }
    updateRect(current.id, next);
  }

  function endInteraction() {
    interaction.current = null;
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1200);
  }

  function removeRect(id: number) {
    setRects((items) => items.filter((item) => item.id !== id));
    if (activeId === id) setActiveId(rects.find((rect) => rect.id !== id)?.id ?? 0);
  }

  function clearRects() {
    setRects([]);
    setActiveId(0);
  }

  function syncHeight(width: number, key = ratio) {
    const [nextW, nextH] = ratios[key];
    return Math.round((width * nextH) / nextW);
  }

  function applyRatio(nextRatio: RatioKey) {
    setRatio(nextRatio);
    setCanvasHeight(syncHeight(canvasWidth, nextRatio));
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">RectCanvas</p>
          <h1>坐标画框生成器</h1>
        </div>
        <div className="actions">
          <button className="button ghost" onClick={clearRects}>清空</button>
          <button className="button primary" onClick={() => copyText(allOutput, "all")} disabled={!rects.length}>
            {copied === "all" ? "已复制" : "复制全部"}
          </button>
        </div>
      </section>

      <section className="workspace">
        <aside className="panel controls-panel">
          <div className="panel-title">
            <span>画布设置</span>
            <span className="pill">{ratio}</span>
          </div>

          <label className="field">
            <span>比例</span>
            <div className="segmented ratio-grid">
              {(Object.keys(ratios) as RatioKey[]).map((item) => (
                <button key={item} className={ratio === item ? "active" : ""} onClick={() => applyRatio(item)}>
                  {item}
                </button>
              ))}
            </div>
          </label>

          <label className="field">
            <span>输出格式</span>
            <div className="segmented">
              <button className={mode === "percent" ? "active" : ""} onClick={() => setMode("percent")}>
                百分比
              </button>
              <button className={mode === "pixel" ? "active" : ""} onClick={() => setMode("pixel")}>
                像素
              </button>
            </div>
          </label>

          <div className="field-row">
            <label className="field">
              <span>宽度 px</span>
              <input
                type="number"
                min="1"
                value={canvasWidth}
                onChange={(event) => {
                  const width = Number(event.target.value) || 1;
                  setCanvasWidth(width);
                  setCanvasHeight(syncHeight(width));
                }}
              />
            </label>
            <label className="field">
              <span>高度 px</span>
              <input
                type="number"
                min="1"
                value={canvasHeight}
                onChange={(event) => setCanvasHeight(Number(event.target.value) || 1)}
              />
            </label>
          </div>

          <label className="toggle">
            <input type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} />
            <span>吸附到 1% 网格</span>
          </label>

          {activeRect && (
            <div className="active-readout">
              <span className="muted">当前选中</span>
              <strong>{formatRect(activeRect, mode, canvasWidth, canvasHeight)}</strong>
            </div>
          )}
        </aside>

        <section className="stage-wrap">
          <div className="stage-header">
            <div>
              <span className="muted">拖动画框定位，拖拽边角缩放</span>
              <strong>{canvasWidth} x {canvasHeight}</strong>
            </div>
            <span className="coordinate-tip">L / T / W / H</span>
          </div>

          <div className="stage-outer">
            <div
              ref={canvasRef}
              className="canvas"
              style={{ aspectRatio: `${rw} / ${rh}` }}
              onPointerDown={startDraw}
              onPointerMove={onPointerMove}
              onPointerUp={endInteraction}
              onPointerCancel={endInteraction}
            >
              <div className="axis x-axis">x</div>
              <div className="axis y-axis">y</div>
              {rects.map((rect, index) => (
                <div
                  key={rect.id}
                  className={`rect ${activeId === rect.id ? "selected" : ""}`}
                  style={{
                    left: `${rect.x * 100}%`,
                    top: `${rect.y * 100}%`,
                    width: `${rect.w * 100}%`,
                    height: `${rect.h * 100}%`,
                    borderColor: rect.color,
                    color: rect.color,
                    backgroundColor: `${rect.color}18`,
                  }}
                  onPointerDown={(event) => startMove(event, rect)}
                >
                  <span className="rect-label" style={{ backgroundColor: rect.color }}>{index}</span>
                  {(["nw", "ne", "sw", "se"] as Handle[]).map((handle) => (
                    <button
                      key={handle}
                      className={`handle ${handle}`}
                      aria-label={`${handle} resize`}
                      onPointerDown={(event) => startResize(event, rect, handle)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="panel output-panel">
          <div className="panel-title">
            <span>坐标输出</span>
            <span className="pill">{mode === "percent" ? "比例" : "像素"}</span>
          </div>

          <div className="output-list">
            {rects.length === 0 && <div className="empty">在画布上拖拽即可创建第一个框。</div>}
            {rects.map((rect, index) => {
              const text = formatRect(rect, mode, canvasWidth, canvasHeight);
              return (
                <article className={`output-item ${activeId === rect.id ? "active-output" : ""}`} key={rect.id}>
                  <button className="swatch" style={{ backgroundColor: rect.color }} onClick={() => setActiveId(rect.id)}>
                    {index}
                  </button>
                  <code>{text}</code>
                  <button className="icon-button" onClick={() => copyText(text, String(rect.id))}>
                    {copied === String(rect.id) ? "✓" : "⧉"}
                  </button>
                  <button className="icon-button danger" onClick={() => removeRect(rect.id)}>×</button>
                </article>
              );
            })}
          </div>

          <label className="field">
            <span>批量文本</span>
            <textarea value={allOutput} readOnly rows={8} />
          </label>
        </aside>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
