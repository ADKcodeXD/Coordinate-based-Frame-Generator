import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type RatioKey = "21:9" | "16:9" | "9:16" | "4:3" | "3:4" | "1:1";
type OutputMode = "percent" | "pixel";
type DragMode = "draw" | "move" | "resize";
type Handle = "nw" | "ne" | "sw" | "se";
type CompositionKey = "none" | "thirds" | "golden" | "perspective" | "parallel" | "horizon";
type TemplateKey = "portrait" | "product" | "dialogue" | "landscape";
type BackgroundAsset = {
  id: number;
  name: string;
  type: "image" | "video";
  url: string;
};

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

const compositionOptions: { key: CompositionKey; label: string }[] = [
  { key: "none", label: "无" },
  { key: "thirds", label: "三分线" },
  { key: "golden", label: "黄金比例" },
  { key: "perspective", label: "透视线" },
  { key: "parallel", label: "平行线" },
  { key: "horizon", label: "地平线" },
];

const templates: Record<TemplateKey, { label: string; rects: Omit<Rect, "id" | "color">[] }> = {
  portrait: {
    label: "人物居中",
    rects: [
      { x: 0.36, y: 0.16, w: 0.28, h: 0.62 },
      { x: 0.12, y: 0.18, w: 0.2, h: 0.36 },
      { x: 0.68, y: 0.18, w: 0.2, h: 0.36 },
    ],
  },
  product: {
    label: "产品展示",
    rects: [
      { x: 0.1, y: 0.18, w: 0.46, h: 0.58 },
      { x: 0.62, y: 0.24, w: 0.28, h: 0.18 },
      { x: 0.62, y: 0.48, w: 0.24, h: 0.12 },
    ],
  },
  dialogue: {
    label: "双人对话",
    rects: [
      { x: 0.1, y: 0.18, w: 0.32, h: 0.56 },
      { x: 0.58, y: 0.18, w: 0.32, h: 0.56 },
    ],
  },
  landscape: {
    label: "风景层次",
    rects: [
      { x: 0.05, y: 0.12, w: 0.9, h: 0.28 },
      { x: 0.08, y: 0.48, w: 0.34, h: 0.34 },
      { x: 0.54, y: 0.52, w: 0.34, h: 0.28 },
    ],
  },
};

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

function rectFromValues(values: number[], canvasWidth: number, canvasHeight: number, id: number, index: number): Rect {
  const [left, top, width, height] = values;
  const isPixel = values.some((value) => Math.abs(value) > 1);

  return normalizeRect({
    id,
    x: isPixel ? left / canvasWidth : left,
    y: isPixel ? top / canvasHeight : top,
    w: isPixel ? width / canvasWidth : width,
    h: isPixel ? height / canvasHeight : height,
    color: palette[index % palette.length],
  });
}

function parsePromptRects(prompt: string, canvasWidth: number, canvasHeight: number) {
  const rects: Rect[] = [];
  const usedRanges: [number, number][] = [];
  const keyedChunkPattern = /[\[{(][^\]})]*(?:\b|["'])(?:l|left|t|top|w|width|h|height)(?:\b|["'])\s*[:=][^\]})]*[\]})]|[^\n;；]*(?:\b|["'])(?:l|left|t|top|w|width|h|height)(?:\b|["'])\s*[:=][^\n;；]*/gi;
  const keyValuePattern = /(?:\b|["'])(l|left|t|top|w|width|h|height)(?:\b|["'])\s*[:=]\s*(-?\d*\.?\d+)/gi;
  let match: RegExpExecArray | null;

  while ((match = keyedChunkPattern.exec(prompt))) {
    const values: Partial<Record<"l" | "t" | "w" | "h", number>> = {};
    let keyMatch: RegExpExecArray | null;
    keyValuePattern.lastIndex = 0;

    while ((keyMatch = keyValuePattern.exec(match[0]))) {
      const key = keyMatch[1].toLowerCase();
      const target = key === "left" ? "l" : key === "top" ? "t" : key === "width" ? "w" : key === "height" ? "h" : key;
      values[target as "l" | "t" | "w" | "h"] = Number(keyMatch[2]);
    }

    if (values.l === undefined || values.t === undefined || values.w === undefined || values.h === undefined) {
      continue;
    }

    rects.push(
      rectFromValues([values.l, values.t, values.w, values.h], canvasWidth, canvasHeight, Date.now() + rects.length, rects.length),
    );
    usedRanges.push([match.index, match.index + match[0].length]);
  }

  const arrayPattern = /[\[(]\s*(-?\d*\.?\d+)\s*[,，]\s*(-?\d*\.?\d+)\s*[,，]\s*(-?\d*\.?\d+)\s*[,，]\s*(-?\d*\.?\d+)\s*[\])]/g;
  while ((match = arrayPattern.exec(prompt))) {
    const overlapsKeyMatch = usedRanges.some(([start, end]) => match!.index >= start && match!.index <= end);
    if (overlapsKeyMatch) continue;
    const values = match.slice(1, 5).map(Number);
    rects.push(rectFromValues(values, canvasWidth, canvasHeight, Date.now() + rects.length, rects.length));
  }

  return rects;
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
  const [composition, setComposition] = React.useState<CompositionKey>("thirds");
  const [background, setBackground] = React.useState<BackgroundAsset | null>(null);
  const [promptText, setPromptText] = React.useState("");
  const [parseMessage, setParseMessage] = React.useState("");
  const [rects, setRects] = React.useState<Rect[]>([
    { id: 1, x: 0.12, y: 0.14, w: 0.24, h: 0.34, color: palette[0] },
    { id: 2, x: 0.52, y: 0.24, w: 0.25, h: 0.44, color: palette[1] },
  ]);
  const [activeId, setActiveId] = React.useState(2);
  const [copied, setCopied] = React.useState<string | null>(null);
  const interaction = React.useRef<Interaction | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [rw, rh] = ratios[ratio];
  const activeRect = rects.find((rect) => rect.id === activeId);
  const allOutput = rects.map((rect) => formatRect(rect, mode, canvasWidth, canvasHeight)).join("\n");
  const canvasMaxWidth = `min(100%, 940px, calc((100vh - 190px) * ${rw / rh}))`;

  function snapValue(value: number) {
    return snap ? Math.round(value * 100) / 100 : value;
  }

  function updateRect(id: number, next: Rect) {
    setRects((items) => items.map((item) => (item.id === id ? normalizeRect(next) : item)));
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1200);
  }

  function duplicateRect(rect: Rect) {
    const next = normalizeRect({
      ...rect,
      id: Date.now(),
      x: rect.x + 0.03 > 1 - rect.w ? Math.max(0, rect.x - 0.03) : rect.x + 0.03,
      y: rect.y + 0.03 > 1 - rect.h ? Math.max(0, rect.y - 0.03) : rect.y + 0.03,
      color: palette[rects.length % palette.length],
    });
    setRects((items) => [...items, next]);
    setActiveId(next.id);
  }

  function removeRect(id: number) {
    setRects((items) => {
      const next = items.filter((item) => item.id !== id);
      if (activeId === id) setActiveId(next.at(-1)?.id ?? 0);
      return next;
    });
  }

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable === true;
      if (isTyping) return;

      if ((event.key === "Delete" || event.key === "Backspace") && activeId) {
        event.preventDefault();
        removeRect(activeId);
      }

      if (event.key === "Escape") {
        setActiveId(0);
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && activeRect) {
        event.preventDefault();
        duplicateRect(activeRect);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeId, activeRect, canvasHeight, canvasWidth, mode, rects]);

  React.useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
        ?.getAsFile();

      if (!file) return;
      event.preventDefault();
      applyBackgroundFile(file);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

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

  function applyBackgroundFile(file: File) {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return;

    const next: BackgroundAsset = {
      id: Date.now(),
      name: file.name || (file.type.startsWith("image/") ? "clipboard-image" : "video"),
      type: file.type.startsWith("video/") ? "video" : "image",
      url: URL.createObjectURL(file),
    };

    setBackground((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return next;
    });
  }

  function onBackgroundUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) applyBackgroundFile(file);
    event.target.value = "";
  }

  function removeBackground() {
    setBackground((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  function extractRectsFromPrompt(replace = false) {
    const parsed = parsePromptRects(promptText, canvasWidth, canvasHeight);

    if (!parsed.length) {
      setParseMessage("没有识别到坐标框");
      return;
    }

    const offsetRects = parsed.map((rect, index) => ({
      ...rect,
      id: Date.now() + index,
      color: palette[(replace ? index : rects.length + index) % palette.length],
    }));
    setRects((items) => (replace ? offsetRects : [...items, ...offsetRects]));
    setActiveId(offsetRects[0]?.id ?? 0);
    setParseMessage(`正则提取成功：${offsetRects.length} 个坐标框`);
  }

  function applyTemplate(key: TemplateKey) {
    const nextRects = templates[key].rects.map((rect, index) => ({
      ...rect,
      id: Date.now() + index,
      color: palette[index % palette.length],
    }));
    setRects(nextRects);
    setActiveId(nextRects[0]?.id ?? 0);
  }

  function renderCompositionGuides() {
    if (composition === "none") return null;

    if (composition === "thirds") {
      return (
        <>
          {[33.333, 66.667].map((pos) => (
            <React.Fragment key={pos}>
              <div className="guide line vertical" style={{ left: `${pos}%` }} />
              <div className="guide line horizontal" style={{ top: `${pos}%` }} />
            </React.Fragment>
          ))}
        </>
      );
    }

    if (composition === "golden") {
      return (
        <>
          {[38.2, 61.8].map((pos) => (
            <React.Fragment key={pos}>
              <div className="guide line golden vertical" style={{ left: `${pos}%` }} />
              <div className="guide line golden horizontal" style={{ top: `${pos}%` }} />
            </React.Fragment>
          ))}
        </>
      );
    }

    if (composition === "perspective") {
      return (
        <>
          <div className="guide perspective from-top-left" />
          <div className="guide perspective from-top-right" />
          <div className="guide perspective from-bottom-left" />
          <div className="guide perspective from-bottom-right" />
          <div className="guide focus-dot" />
        </>
      );
    }

    if (composition === "parallel") {
      return (
        <>
          {[-34, -17, 0, 17, 34].map((offset) => (
            <div key={offset} className="guide parallel" style={{ left: `${50 + offset}%` }} />
          ))}
        </>
      );
    }

    return (
      <>
        <div className="guide line horizon-main horizontal" style={{ top: "50%" }} />
        <div className="guide line horizon-soft horizontal" style={{ top: "42%" }} />
        <div className="guide line horizon-soft horizontal" style={{ top: "58%" }} />
      </>
    );
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

          <label className="field">
            <span>构图辅助线</span>
            <div className="segmented composition-grid">
              {compositionOptions.map((item) => (
                <button key={item.key} className={composition === item.key ? "active" : ""} onClick={() => setComposition(item.key)}>
                  {item.label}
                </button>
              ))}
            </div>
          </label>

          <label className="field">
            <span>模板</span>
            <div className="template-grid">
              {(Object.keys(templates) as TemplateKey[]).map((key) => (
                <button key={key} className="template-button" onClick={() => applyTemplate(key)}>
                  {templates[key].label}
                </button>
              ))}
            </div>
          </label>

          <label className="field prompt-field">
            <span>提示词坐标提取</span>
            <textarea
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              rows={6}
              placeholder="粘贴整段提示词，工具会用内置正则提取 L/T/W/H、left/top/width/height 或四数字坐标。"
            />
          </label>

          <div className="prompt-actions">
            <button className="button ghost" onClick={() => extractRectsFromPrompt(false)} disabled={!promptText.trim()}>
              追加提取
            </button>
            <button className="button primary" onClick={() => extractRectsFromPrompt(true)} disabled={!promptText.trim()}>
              替换画布
            </button>
          </div>
          {parseMessage && <div className="parse-message">{parseMessage}</div>}

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
              <span className="muted">拖动画框定位，拖拽边角缩放。Ctrl+D 复制选中框，Ctrl+V 粘贴背景图片，Delete 删除，Esc 取消选中。</span>
              <strong>{canvasWidth} x {canvasHeight}</strong>
            </div>
            <span className="coordinate-tip">L / T / W / H</span>
          </div>

          <div className="stage-outer">
            <div
              ref={canvasRef}
              className="canvas"
              style={{ aspectRatio: `${rw} / ${rh}`, width: canvasMaxWidth }}
              onPointerDown={startDraw}
              onPointerMove={onPointerMove}
              onPointerUp={endInteraction}
              onPointerCancel={endInteraction}
            >
              {background && (
                <div className="background-layer">
                  {background.type === "image" ? (
                    <img src={background.url} alt={background.name} />
                  ) : (
                    <video src={background.url} muted loop autoPlay playsInline />
                  )}
                </div>
              )}
              <div className="axis x-axis">x</div>
              <div className="axis y-axis">y</div>
              <div className="composition-layer" aria-hidden="true">
                {renderCompositionGuides()}
              </div>
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

          <div className="background-toolbar">
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={onBackgroundUpload} />
            <button className="button primary" onClick={() => fileInputRef.current?.click()}>
              上传背景
            </button>
            <button className="button ghost" onClick={removeBackground} disabled={!background}>
              清除背景
            </button>
            <span className="muted">{background ? background.name : "也可以直接 Ctrl+V 粘贴剪贴板图片"}</span>
          </div>
        </section>

        <aside className="panel output-panel">
          <div className="panel-title">
            <span>坐标输出</span>
            <span className="pill">{rects.length} 个框</span>
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
                    {copied === String(rect.id) ? "✓" : "复制"}
                  </button>
                  <button className="icon-button danger" onClick={() => removeRect(rect.id)}>删</button>
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
