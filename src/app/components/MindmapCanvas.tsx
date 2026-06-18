import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import {
  ZoomIn, ZoomOut, Maximize2, RotateCcw, ChevronRight,
  BookOpen, FlaskConical, Lightbulb, List, Star, Atom,
  PenLine, BarChart2, FileText, X
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MindmapNode {
  id: string;
  title: string;
  detail?: string;
  children?: MindmapNode[];
}

interface MindmapBranch {
  id: string;
  title: string;
  color: string;
  icon?: string;
  children?: MindmapNode[];
}

interface MindmapData {
  title?: string;
  central_topic?: string;
  summary?: string;
  branches?: MindmapBranch[];
  // legacy fallback
  nodes?: any[];
  children?: any[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"
];

function normalizeColor(color?: string, fallback = "#6366f1") {
  if (!color) return fallback;
  const value = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return fallback;
}

function normalizeMindmap(raw: any): MindmapData {
  const src = raw?.content_json || raw?.mindmap || raw?.chapter_structure || raw;
  if (src?.branches) {
    return {
      ...src,
      branches: src.branches.map((branch: any, index: number) => ({
        ...branch,
        id: branch.id || `b${index}`,
        title: branch.title || branch.label || branch.name || `Nhánh ${index + 1}`,
        color: normalizeColor(branch.color, DEFAULT_COLORS[index % DEFAULT_COLORS.length]),
        children: (branch.children || []).map((child: any, childIndex: number) => ({
          ...child,
          id: child.id || `b${index}c${childIndex}`,
          title: child.title || child.label || child.name || `Ý ${childIndex + 1}`,
          detail: child.detail || child.description || child.summary || "",
          children: (child.children || []).map((leaf: any, leafIndex: number) => ({
            ...leaf,
            id: leaf.id || `b${index}c${childIndex}l${leafIndex}`,
            title: leaf.title || leaf.label || leaf.name || `Chi tiết ${leafIndex + 1}`,
            detail: leaf.detail || leaf.description || leaf.summary || "",
          }))
        }))
      }))
    };
  }

  // Try to convert legacy nodes/children format
  const legacyNodes = src?.nodes || src?.children || [];
  if (legacyNodes.length > 0) {
    return {
      title: src?.title || "Mindmap",
      central_topic: src?.title || "Bài học",
      summary: src?.summary || "",
      branches: legacyNodes.map((n: any, i: number) => ({
        id: n.id || `b${i}`,
        title: n.title || n.label || n.name || n.topic || n.main_idea || `Nhánh ${i+1}`,
        color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
        icon: "book",
        children: (n.children || n.subtopics || n.branches || n.items || []).map((c: any, j: number) => ({
          id: c.id || `b${i}c${j}`,
          title: c.title || c.label || c.name || `Ý ${j+1}`,
          detail: c.description || c.detail || c.summary || "",
          children: (c.children || []).map((l: any, k: number) => ({
            id: l.id || `b${i}c${j}l${k}`,
            title: l.title || l.label || l.name || `Chi tiết ${k+1}`,
            detail: l.detail || l.description || l.summary || "",
          }))
        }))
      }))
    };
  }
  return { title: "Mindmap", central_topic: "Bài học", summary: "", branches: [] };
}

const ICON_MAP: Record<string, ReactNode> = {
  book: <BookOpen className="w-3.5 h-3.5" />,
  formula: <FlaskConical className="w-3.5 h-3.5" />,
  example: <Lightbulb className="w-3.5 h-3.5" />,
  concept: <Star className="w-3.5 h-3.5" />,
  theory: <Atom className="w-3.5 h-3.5" />,
  practice: <PenLine className="w-3.5 h-3.5" />,
  diagram: <BarChart2 className="w-3.5 h-3.5" />,
  list: <List className="w-3.5 h-3.5" />,
  star: <Star className="w-3.5 h-3.5" />,
  atom: <Atom className="w-3.5 h-3.5" />,
};

function getIcon(icon?: string) {
  return ICON_MAP[icon || "book"] || <FileText className="w-3.5 h-3.5" />;
}

function hexToRgb(hex?: string) {
  const safeHex = normalizeColor(hex);
  const r = parseInt(safeHex.slice(1, 3), 16);
  const g = parseInt(safeHex.slice(3, 5), 16);
  const b = parseInt(safeHex.slice(5, 7), 16);
  return { r, g, b };
}

function shortLabel(label: string, maxLength: number) {
  if (!label) return "";
  return label.length > maxLength ? `${label.slice(0, maxLength).trim()}…` : label;
}

function estimateWidth(label: string, type: "center" | "branch" | "child" | "leaf") {
  const length = label?.length || 0;
  if (type === "center") return Math.min(230, Math.max(150, 90 + length * 7));
  if (type === "branch") return Math.min(205, Math.max(135, 78 + length * 6.5));
  if (type === "child") return Math.min(190, Math.max(125, 76 + length * 6));
  return Math.min(180, Math.max(100, 66 + length * 5.6));
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  node, color, onClose
}: {
  node: MindmapNode | MindmapBranch;
  color: string;
  onClose: () => void;
}) {
  const rgb = hexToRgb(color);
  const children = (node as any).children || [];

  return (
    <div
      className="absolute right-4 top-4 z-30 w-80 rounded-2xl shadow-2xl overflow-hidden"
      style={{ background: "white", border: `1.5px solid ${color}30` }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between gap-3 p-4"
        style={{ background: `rgba(${rgb.r},${rgb.g},${rgb.b},0.08)` }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white"
            style={{ background: color }}
          >
            {getIcon((node as MindmapBranch).icon)}
          </div>
          <h3 className="font-bold text-gray-900 text-sm leading-snug">{node.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-black/10 text-gray-500 shrink-0 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 max-h-[420px] overflow-y-auto space-y-3">
        {(node as MindmapNode).detail && (
          <p className="text-sm leading-6 text-gray-700">{(node as MindmapNode).detail}</p>
        )}

        {children.length > 0 && (
          <div className="space-y-2">
            {children.map((child: MindmapNode, i: number) => (
              <div
                key={child.id || i}
                className="rounded-xl p-3"
                style={{ background: `rgba(${rgb.r},${rgb.g},${rgb.b},0.06)`, border: `1px solid rgba(${rgb.r},${rgb.g},${rgb.b},0.15)` }}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{child.title}</p>
                    {child.detail && (
                      <p className="mt-1 text-xs leading-5 text-gray-600">{child.detail}</p>
                    )}
                    {child.children && child.children.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {child.children.map((leaf, j) => (
                          <div key={leaf.id || j} className="flex items-center gap-1.5">
                            <ChevronRight className="w-3 h-3 shrink-0" style={{ color }} />
                            <span className="text-xs text-gray-600">{leaf.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {children.length === 0 && !(node as MindmapNode).detail && (
          <p className="text-sm text-gray-500 text-center py-4">Không có chi tiết</p>
        )}
      </div>
    </div>
  );
}

// ─── SVG Mindmap Canvas ───────────────────────────────────────────────────────

interface NodePos {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
  type: "center" | "branch" | "child" | "leaf";
  icon?: string;
  detail?: string;
  childCount?: number;
  parentId?: string;
  branchColor?: string;
  side?: 1 | -1;
  branchIndex?: number;
  childIndex?: number;
  leafIndex?: number;
  data?: MindmapNode | MindmapBranch;
}

interface LayoutBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

interface MindmapLayout {
  nodes: NodePos[];
  edges: {from: string; to: string; color: string}[];
  bounds: LayoutBounds;
  center: { x: number; y: number };
}

function measureChildBlock(child: MindmapNode) {
  const leafCount = child.children?.length || 0;
  return Math.max(62, leafCount > 0 ? leafCount * 30 + 16 : 54);
}

function measureBranchBlock(branch: MindmapBranch) {
  const children = branch.children || [];
  if (children.length === 0) return 96;
  const childrenHeight = children.reduce((sum, child) => sum + measureChildBlock(child), 0);
  return Math.max(110, childrenHeight + (children.length - 1) * 24);
}

function buildLayout(data: MindmapData): MindmapLayout {
  const nodes: NodePos[] = [];
  const edges: {from: string; to: string; color: string}[] = [];
  const center = { x: 0, y: 0 };

  const centerLabel = data.central_topic || data.title || "Bài học";
  nodes.push({
    id: "center",
    x: center.x,
    y: center.y,
    w: estimateWidth(centerLabel, "center"),
    h: 58,
    label: centerLabel,
    color: "#1e1b4b",
    type: "center"
  });

  const branches = data.branches || [];
  if (branches.length === 0) {
    return { nodes, edges, bounds: getBounds(nodes), center };
  }

  const indexedBranches = branches.map((branch, index) => ({
    branch: {
      ...branch,
      color: normalizeColor(branch.color, DEFAULT_COLORS[index % DEFAULT_COLORS.length])
    },
    index,
    blockHeight: measureBranchBlock(branch)
  }));

  const rightSide = indexedBranches.filter((_, index) => index % 2 === 0);
  const leftSide = indexedBranches.filter((_, index) => index % 2 === 1);

  const BRANCH_X = 270;
  const CHILD_X = 485;
  const LEAF_X = 670;
  const BRANCH_GAP = 42;
  const CHILD_GAP = 24;
  const LEAF_GAP = 30;

  function placeSide(items: typeof indexedBranches, side: 1 | -1) {
    if (items.length === 0) return;

    const totalHeight = items.reduce((sum, item) => sum + item.blockHeight, 0) + (items.length - 1) * BRANCH_GAP;
    let cursorY = -totalHeight / 2;

    items.forEach(({ branch, index: branchIndex, blockHeight }) => {
      const branchId = `branch-${branchIndex}`;
      const branchY = cursorY + blockHeight / 2;
      const branchColor = normalizeColor(branch.color, DEFAULT_COLORS[branchIndex % DEFAULT_COLORS.length]);

      nodes.push({
        id: branchId,
        x: side * BRANCH_X,
        y: branchY,
        w: estimateWidth(branch.title, "branch"),
        h: 46,
        label: branch.title,
        color: branchColor,
        type: "branch",
        icon: branch.icon,
        childCount: branch.children?.length || 0,
        branchColor,
        side,
        branchIndex,
        data: branch
      });
      edges.push({ from: "center", to: branchId, color: branchColor });

      const children = branch.children || [];
      if (children.length > 0) {
        const childBlocks = children.map(measureChildBlock);
        const childTotalHeight = childBlocks.reduce((sum, value) => sum + value, 0) + (children.length - 1) * CHILD_GAP;
        let childCursorY = branchY - childTotalHeight / 2;

        children.forEach((child, childIndex) => {
          const childId = `${branchId}-child-${childIndex}`;
          const childBlock = childBlocks[childIndex];
          const childY = childCursorY + childBlock / 2;

          nodes.push({
            id: childId,
            x: side * CHILD_X,
            y: childY,
            w: estimateWidth(child.title, "child"),
            h: 38,
            label: child.title,
            color: branchColor,
            type: "child",
            detail: child.detail,
            childCount: child.children?.length || 0,
            parentId: branchId,
            branchColor,
            side,
            branchIndex,
            childIndex,
            data: child
          });
          edges.push({ from: branchId, to: childId, color: branchColor });

          const leaves = child.children || [];
          if (leaves.length > 0) {
            const leafStartY = childY - ((leaves.length - 1) * LEAF_GAP) / 2;

            leaves.forEach((leaf, leafIndex) => {
              const leafId = `${childId}-leaf-${leafIndex}`;
              nodes.push({
                id: leafId,
                x: side * LEAF_X,
                y: leafStartY + leafIndex * LEAF_GAP,
                w: estimateWidth(leaf.title, "leaf"),
                h: 28,
                label: leaf.title,
                color: branchColor,
                type: "leaf",
                parentId: childId,
                branchColor,
                side,
                branchIndex,
                childIndex,
                leafIndex,
                data: leaf
              });
              edges.push({ from: childId, to: leafId, color: branchColor });
            });
          }

          childCursorY += childBlock + CHILD_GAP;
        });
      }

      cursorY += blockHeight + BRANCH_GAP;
    });
  }

  placeSide(rightSide, 1);
  placeSide(leftSide, -1);

  return { nodes, edges, bounds: getBounds(nodes), center };
}

function getBounds(nodes: NodePos[]): LayoutBounds {
  const PADDING_X = 150;
  const PADDING_Y = 110;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const halfW = node.w / 2;
    const halfH = node.h / 2;
    minX = Math.min(minX, node.x - halfW);
    maxX = Math.max(maxX, node.x + halfW);
    minY = Math.min(minY, node.y - halfH);
    maxY = Math.max(maxY, node.y + halfH);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { minX: -500, minY: -300, width: 1000, height: 600 };
  }

  return {
    minX: minX - PADDING_X,
    minY: minY - PADDING_Y,
    width: Math.max(900, maxX - minX + PADDING_X * 2),
    height: Math.max(560, maxY - minY + PADDING_Y * 2),
  };
}

// ─── Main Canvas Component ────────────────────────────────────────────────────

export function MindmapCanvas({ mindmapRaw }: { mindmapRaw: any }) {
  const data = useMemo(() => normalizeMindmap(mindmapRaw), [mindmapRaw]);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<{ node: NodePos; branch: MindmapBranch | null } | null>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });

  const { nodes, edges, bounds, center } = useMemo(() => buildLayout(data), [data]);

  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`;
  const panSvgX = size.w > 0 ? pan.x * bounds.width / size.w : 0;
  const panSvgY = size.h > 0 ? pan.y * bounds.height / size.h : 0;
  const contentTransform = `translate(${panSvgX} ${panSvgY}) translate(${center.x} ${center.y}) scale(${zoom}) translate(${-center.x} ${-center.y})`;

  // Fit to container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Reset viewport when another mindmap is loaded
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelected(null);
  }, [mindmapRaw]);

  // Pan handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest("[data-node]")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const onMouseUp = useCallback(() => setIsDragging(false), []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.35, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  function handleReset() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelected(null);
  }

  function handleNodeClick(node: NodePos) {
    if (node.type === "center") { setSelected(null); return; }
    const branch = typeof node.branchIndex === "number" ? data.branches?.[node.branchIndex] || null : null;
    setSelected({ node, branch });
  }

  // Find full node data for detail panel
  function getFullNode(nodePos: NodePos): MindmapNode | MindmapBranch {
    return nodePos.data || { id: nodePos.id, title: nodePos.label };
  }

  // Curved edge path between two nodes
  function edgePath(from: NodePos, to: NodePos) {
    const dx = to.x - from.x;
    const curve = Math.min(120, Math.max(60, Math.abs(dx) * 0.45));
    const direction = dx >= 0 ? 1 : -1;
    return `M ${from.x} ${from.y} C ${from.x + direction * curve} ${from.y}, ${to.x - direction * curve} ${to.y}, ${to.x} ${to.y}`;
  }

  return (
    <div className="relative flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-800 truncate">{data.title || "Sơ đồ tư duy"}</span>
          {data.branches && <span className="text-xs text-gray-400 ml-1 shrink-0">• {data.branches.length} nhánh chính</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setZoom(z => Math.min(3, z + 0.15))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors" title="Phóng to">
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom(z => Math.max(0.35, z - 0.15))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors" title="Thu nhỏ">
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button type="button" onClick={handleReset}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors" title="Đặt lại">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button type="button" onClick={handleReset}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors" title="Xem toàn bộ">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-[#fafafa]"
        style={{
          backgroundImage: "radial-gradient(circle, #e2e8f0 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="block select-none"
        >
          <g transform={contentTransform} style={{ transition: isDragging ? "none" : "transform 0.12s ease" }}>
            {/* Edges */}
            {edges.map((edge, i) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              const rgb = hexToRgb(edge.color);
              const isSelected = selected?.node.id === toNode.id || selected?.node.id === fromNode.id;
              return (
                <path
                  key={`${edge.from}-${edge.to}-${i}`}
                  d={edgePath(fromNode, toNode)}
                  fill="none"
                  stroke={`rgba(${rgb.r},${rgb.g},${rgb.b},${isSelected ? 0.85 : 0.3})`}
                  strokeWidth={isSelected ? 3 : 1.7}
                  strokeLinecap="round"
                  style={{ transition: "all 0.2s ease" }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = selected?.node.id === node.id;
              const rgb = hexToRgb(node.color);
              const hw = node.w / 2;
              const hh = node.h / 2;

              if (node.type === "center") {
                return (
                  <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                    <ellipse rx={hw + 10} ry={hh + 10} fill="#1e1b4b" opacity={0.06} cy={5} />
                    <rect x={-hw} y={-hh} width={node.w} height={node.h} rx={17}
                      fill="#1e1b4b" />
                    <text x={0} y={5} textAnchor="middle" dominantBaseline="middle"
                      fill="white" fontSize={13} fontWeight="700"
                      style={{ fontFamily: "system-ui, sans-serif" }}>
                      {shortLabel(node.label, 24)}
                    </text>
                    <title>{node.label}</title>
                  </g>
                );
              }

              if (node.type === "branch") {
                const bg = isSelected ? node.color : `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`;
                const textColor = isSelected ? "white" : node.color;
                return (
                  <g key={node.id} data-node="1" transform={`translate(${node.x},${node.y})`} style={{ cursor: "pointer" }}
                    onClick={() => handleNodeClick(node)}>
                    <rect x={-hw - 5} y={-hh - 5} width={node.w + 10} height={node.h + 10} rx={16}
                      fill={node.color} opacity={0.12} />
                    <rect x={-hw} y={-hh} width={node.w} height={node.h} rx={13}
                      fill={bg}
                      stroke={node.color}
                      strokeWidth={isSelected ? 2.4 : 1.6}
                      style={{ transition: "all 0.2s ease" }}
                    />
                    <text x={0} y={2} textAnchor="middle" dominantBaseline="middle"
                      fill={textColor} fontSize={11.5} fontWeight="700"
                      style={{ fontFamily: "system-ui, sans-serif", transition: "all 0.2s ease" }}>
                      {shortLabel(node.label, 22)}
                    </text>
                    {node.childCount && node.childCount > 0 ? (
                      <g transform={`translate(${hw - 10},${-hh + 10})`}>
                        <circle r={7} fill={node.color} />
                        <text y={1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={7.5} fontWeight="700">
                          {node.childCount}
                        </text>
                      </g>
                    ) : null}
                    <title>{node.label}</title>
                  </g>
                );
              }

              if (node.type === "child") {
                return (
                  <g key={node.id} data-node="1" transform={`translate(${node.x},${node.y})`} style={{ cursor: "pointer" }}
                    onClick={() => handleNodeClick(node)}>
                    <rect
                      x={-hw} y={-hh}
                      width={node.w} height={node.h} rx={11}
                      fill={isSelected ? node.color : "white"}
                      stroke={node.color}
                      strokeWidth={isSelected ? 2.2 : 1.2}
                      strokeOpacity={isSelected ? 1 : 0.55}
                      style={{ transition: "all 0.2s ease" }}
                    />
                    <text x={0} y={1} textAnchor="middle" dominantBaseline="middle"
                      fill={isSelected ? "white" : "#374151"} fontSize={10.5} fontWeight="600"
                      style={{ fontFamily: "system-ui, sans-serif", transition: "all 0.2s ease" }}>
                      {shortLabel(node.label, 26)}
                    </text>
                    {node.childCount && node.childCount > 0 ? (
                      <g transform={`translate(${hw - 8},${-hh + 8})`}>
                        <circle r={6.5} fill={node.color} />
                        <text y={1} textAnchor="middle" dominantBaseline="middle"
                          fill="white" fontSize={7} fontWeight="700">
                          {node.childCount}
                        </text>
                      </g>
                    ) : null}
                    <title>{node.label}</title>
                  </g>
                );
              }

              // leaf
              return (
                <g key={node.id} data-node="1" transform={`translate(${node.x},${node.y})`} style={{ cursor: "pointer" }}
                  onClick={() => handleNodeClick(node)}>
                  <rect
                    x={-hw} y={-hh}
                    width={node.w} height={node.h} rx={9}
                    fill={isSelected ? node.color : "white"}
                    stroke={node.color}
                    strokeWidth={isSelected ? 2 : 1}
                    strokeOpacity={isSelected ? 1 : 0.42}
                    style={{ transition: "all 0.2s ease" }}
                  />
                  <circle cx={-hw + 12} cy={0} r={4}
                    fill={isSelected ? "white" : node.color} fillOpacity={isSelected ? 0.9 : 0.65} />
                  <text x={4} y={1} textAnchor="middle" dominantBaseline="middle"
                    fill={isSelected ? "white" : "#6b7280"} fontSize={9.5} fontWeight="500"
                    style={{ fontFamily: "system-ui, sans-serif" }}>
                    {shortLabel(node.label, 23)}
                  </text>
                  <title>{node.label}</title>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            node={getFullNode(selected.node)}
            color={selected.node.color}
            onClose={() => setSelected(null)}
          />
        )}

        {/* Legend hint */}
        {!selected && (
          <div className="absolute bottom-3 left-3 text-xs text-gray-400 bg-white/80 rounded-xl px-3 py-2 pointer-events-none">
            Cuộn để zoom • Kéo để di chuyển • Bấm nhánh để xem chi tiết
          </div>
        )}
      </div>

      {/* Summary bar */}
      {data.summary && (
        <div className="px-4 py-2.5 bg-violet-50 border-t border-violet-100 text-xs text-violet-800 leading-5">
          <span className="font-semibold">Tóm tắt: </span>{data.summary}
        </div>
      )}

      {/* Branch legend */}
      {data.branches && data.branches.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-2.5 bg-white border-t border-gray-100">
          {data.branches.map((b, index) => {
            const color = normalizeColor(b.color, DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
            return (
              <button
                key={`legend-${index}-${b.id || b.title}`}
                type="button"
                onClick={() => {
                  const node = nodes.find(n => n.type === "branch" && n.branchIndex === index);
                  if (node) handleNodeClick(node);
                }}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all hover:opacity-80"
                style={{
                  background: `${color}18`,
                  border: `1px solid ${color}40`,
                  color
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                {b.title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
