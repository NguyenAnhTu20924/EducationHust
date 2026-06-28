import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileQuestion,
  Lightbulb,
  ListChecks,
  Network,
  PenLine,
  Target,
  ChevronRight as ArrowStep,
  MapPin,
  ClipboardCheck,
  BookMarked,
  FlaskConical,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";

// ─── Utilities ────────────────────────────────────────────────────────────────

function asArray(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value ? [value] : [];
  return [value];
}

function textValue(value: any, fallback = "Chưa có thông tin") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

function hasContent(value: any) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

// ─── Formula renderer ─────────────────────────────────────────────────────────

const SYMBOL_MAP: Record<string, string> = {
  "pi": "π", "alpha": "α", "beta": "β", "gamma": "γ",
  "delta": "δ", "Delta": "Δ", "sigma": "σ", "Sigma": "Σ",
  "omega": "ω", "Omega": "Ω", "theta": "θ", "lambda": "λ",
  "mu": "μ", "epsilon": "ε", "phi": "φ",
  "infinity": "∞", "inf": "∞",
  "->": "→", "<->": "↔",
  ">=": "≥", "<=": "≤", "!=": "≠", "~=": "≈", "+-": "±",
  "**": "×", "xx": "×", "//": "÷",
  "sqrt": "√", "sum": "∑", "degree": "°",
};

function replaceSymbols(text: string): string {
  let result = text;
  const keys = Object.keys(SYMBOL_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    result = result.split(key).join(SYMBOL_MAP[key]);
  }
  return result;
}

function tokenizeFormula(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\w+)\^\{([^}]+)\}|(\w+)_\{([^}]+)\}|(\w+)\^(\w+)|(\w+)_(\w+)|([^/\s]+)\/([^/\s]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={`t-${lastIndex}`}>{replaceSymbols(text.slice(lastIndex, match.index))}</span>);
    }
    const k = match.index;
    if (match[1] && match[2]) {
      nodes.push(<span key={k}>{replaceSymbols(match[1])}<sup className="text-[0.65em]">{replaceSymbols(match[2])}</sup></span>);
    } else if (match[3] && match[4]) {
      nodes.push(<span key={k}>{replaceSymbols(match[3])}<sub className="text-[0.65em]">{replaceSymbols(match[4])}</sub></span>);
    } else if (match[5] && match[6]) {
      nodes.push(<span key={k}>{replaceSymbols(match[5])}<sup className="text-[0.65em]">{replaceSymbols(match[6])}</sup></span>);
    } else if (match[7] && match[8]) {
      nodes.push(<span key={k}>{replaceSymbols(match[7])}<sub className="text-[0.65em]">{replaceSymbols(match[8])}</sub></span>);
    } else if (match[9] && match[10]) {
      nodes.push(
        <span key={k} className="inline-flex flex-col items-center align-middle mx-0.5" style={{ lineHeight: 1 }}>
          <span className="border-b border-current px-0.5 text-[0.75em] leading-tight">{replaceSymbols(match[9].trim())}</span>
          <span className="px-0.5 text-[0.75em] leading-tight">{replaceSymbols(match[10].trim())}</span>
        </span>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(<span key={`t-${lastIndex}`}>{replaceSymbols(text.slice(lastIndex))}</span>);
  }
  return nodes.length > 0 ? nodes : [<span key="0">{replaceSymbols(text)}</span>];
}

function FormulaDisplay({ formula, className = "" }: { formula: string; className?: string }) {
  if (!formula) return null;
  const hasMath = /[\^_]|\b(pi|alpha|beta|gamma|Delta|sigma|sqrt|infinity|theta|phi|mu|omega)\b|>=|<=|!=|->|\+-|\//.test(formula);
  if (!hasMath) {
    return <span className={`font-mono font-bold text-blue-950 ${className}`}>{formula}</span>;
  }
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-0.5 font-mono font-bold text-blue-950 ${className}`}>
      {tokenizeFormula(formula)}
    </span>
  );
}

// ─── Edit icon SVG ────────────────────────────────────────────────────────────

function EditIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

// ─── Editable text ────────────────────────────────────────────────────────────

function EditableText({
  value,
  onChange,
  multiline = true,
  className = "",
}: {
  value: string;
  onChange?: (v: string) => void;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!onChange) {
    return <p className={`text-sm leading-7 text-gray-700 ${className}`}>{value}</p>;
  }

  if (editing) {
    return (
      <div className="space-y-2">
        {multiline ? (
          <textarea
            autoFocus
            className="w-full rounded-xl border border-violet-300 p-2.5 text-sm text-gray-700 outline-none focus:border-violet-500 resize-none leading-7"
            rows={4}
            value={draft}
            onChange={e => setDraft(e.target.value)}
          />
        ) : (
          <input
            autoFocus
            className="w-full rounded-xl border border-violet-300 px-2.5 py-2 text-sm text-gray-700 outline-none focus:border-violet-500"
            value={draft}
            onChange={e => setDraft(e.target.value)}
          />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => { onChange(draft); setEditing(false); }}
            className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-700 transition">
            Lưu
          </button>
          <button type="button" onClick={() => { setDraft(value); setEditing(false); }}
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">
            Hủy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <p className={`text-sm leading-7 text-gray-700 ${className}`}>{value}</p>
      <button type="button" onClick={() => { setDraft(value); setEditing(true); }}
        className="absolute -right-1 -top-1 hidden group-hover:flex items-center gap-1 rounded-lg bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-400 hover:text-violet-600 shadow-sm transition">
        <EditIcon /> Sửa
      </button>
    </div>
  );
}

// ─── Editable list ────────────────────────────────────────────────────────────

function EditableList({
  items,
  onChange,
  color = "bg-gray-400",
}: {
  items: any[];
  onChange?: (items: string[]) => void;
  color?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(items.map(i => textValue(i, "")).join("\n"));

  if (!onChange) {
    return <BulletList items={items} color={color} />;
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] text-gray-400">Mỗi dòng là một ý — Enter để xuống dòng mới</p>
        <textarea
          autoFocus
          className="w-full rounded-xl border border-violet-300 p-2.5 text-sm text-gray-700 outline-none focus:border-violet-500 resize-none leading-7"
          rows={Math.max(3, items.length + 1)}
          value={draft}
          onChange={e => setDraft(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="button"
            onClick={() => {
              const newItems = draft.split("\n").map(s => s.trim()).filter(Boolean);
              onChange(newItems);
              setEditing(false);
            }}
            className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-700 transition">
            Lưu
          </button>
          <button type="button"
            onClick={() => { setDraft(items.map(i => textValue(i, "")).join("\n")); setEditing(false); }}
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">
            Hủy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <BulletList items={items} color={color} />
      <button type="button"
        onClick={() => { setDraft(items.map(i => textValue(i, "")).join("\n")); setEditing(true); }}
        className="absolute -right-1 -top-1 hidden group-hover:flex items-center gap-1 rounded-lg bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-400 hover:text-violet-600 shadow-sm transition">
        <EditIcon /> Sửa
      </button>
    </div>
  );
}

// ─── Step UI labels ───────────────────────────────────────────────────────────

const STEP_UI_LABELS: Record<number, { title: string; short: string }> = {
  1: { title: "Ôn lại kiến thức cũ", short: "Nhắc điều cần nhớ" },
  2: { title: "Nắm cấu trúc bài", short: "Đọc lướt nội dung chính" },
  3: { title: "Học kiến thức mới", short: "Hiểu khái niệm và công thức" },
  4: { title: "Phân tích ví dụ", short: "Xem công thức, đồ thị, ví dụ" },
  5: { title: "Luyện tập cơ bản", short: "Làm bài tập đơn giản" },
  6: { title: "Vận dụng kiến thức", short: "Liên hệ bài tập và thực tế" },
  7: { title: "Tự kiểm tra", short: "Chốt lại điều đã hiểu" },
};

function getStepTitle(stepNo: number, rawTitle?: string) {
  return STEP_UI_LABELS[stepNo]?.title || rawTitle || `Bước ${stepNo}`;
}

function getStepShort(stepNo: number, rawShort?: string) {
  return STEP_UI_LABELS[stepNo]?.short || rawShort || "Hoạt động học tập";
}

function getBloomLabel(value?: string) {
  if (!value) return "";
  const n = value.toLowerCase().trim();
  if (n.includes("remember")) return "Nhận biết";
  if (n.includes("understand")) return "Thông hiểu";
  if (n.includes("apply")) return "Vận dụng";
  if (n.includes("analyze")) return "Phân tích";
  if (n.includes("evaluate")) return "Đánh giá";
  if (n.includes("create")) return "Sáng tạo";
  return value;
}

function getDifficultyLabel(value?: string) {
  if (!value) return "";
  const n = value.toLowerCase().trim();
  if (n === "basic") return "Cơ bản";
  if (n === "medium") return "Trung bình";
  if (n === "advanced") return "Nâng cao";
  return value;
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

function getLearningPathData(learningPath: any) {
  if (Array.isArray(learningPath)) {
    return learningPath?.[0]?.learningPath || learningPath?.[0] || {};
  }
  return (
    learningPath?.learningPath ||
    learningPath?.content_json?.learningPath ||
    learningPath?.content_json ||
    learningPath ||
    {}
  );
}

function getLearningNodes(learningPath: any, learningPathNodes: any[]) {
  const root = getLearningPathData(learningPath);
  const sourceNodes =
    learningPathNodes?.length
      ? learningPathNodes
      : root?.timeline_nodes ||
        root?.learningPath?.timeline_nodes ||
        learningPath?.timeline_nodes ||
        learningPath?.content_json?.timeline_nodes ||
        learningPath?.content_json?.learningPath?.timeline_nodes ||
        [];
  return [...sourceNodes].sort((a: any, b: any) => {
    return Number(a.step_no || a.step || 0) - Number(b.step_no || b.step || 0);
  });
}

// ─── Shared small components ──────────────────────────────────────────────────

export function EmptyBox({ children }: { children: ReactNode }) {
  return (
    <Card className="rounded-3xl border-dashed border-gray-300 bg-gray-50">
      <CardContent className="flex flex-col items-center justify-center p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-400 ring-1 ring-gray-200">
          <BookOpen className="h-7 w-7" />
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-600">{children}</p>
      </CardContent>
    </Card>
  );
}

function SimpleList({ items }: { items: any[] }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-sm leading-6 text-gray-700">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
          <span>{textValue(item, "")}</span>
        </li>
      ))}
    </ul>
  );
}

function DetailBlock({
  icon, title, children, colorClass = "bg-gray-50 border-gray-200",
}: {
  icon: ReactNode; title: string; children: ReactNode; colorClass?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${colorClass}`}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-700">{icon}</div>
        <h4 className="text-sm font-bold text-gray-950">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function FormulaCard({ formula }: { formula: any }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
      <div className="font-mono text-base font-bold text-blue-950">
        <FormulaDisplay formula={formula?.formula || textValue(formula)} className="text-base" />
      </div>
      {formula?.meaning ? (
        <p className="mt-2 text-sm leading-6 text-blue-950/80">{formula.meaning}</p>
      ) : null}
      {Array.isArray(formula?.variables) && formula.variables.length ? (
        <div className="mt-3 space-y-1.5">
          {formula.variables.map((item: any, index: number) => (
            <div key={index} className="rounded-xl bg-white/70 px-3 py-2 text-sm text-blue-950">
              <b>{item.symbol}</b>: {item.meaning}{item.unit ? ` (${item.unit})` : ""}
            </div>
          ))}
        </div>
      ) : null}
      {formula?.when_to_use ? (
        <p className="mt-3 text-sm leading-6 text-blue-950/80"><b>Khi dùng:</b> {formula.when_to_use}</p>
      ) : null}
    </div>
  );
}

function PracticeTaskCard({ task }: { task: any }) {
  if (!hasContent(task)) return null;
  if (typeof task === "string") {
    return (
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <h4 className="text-sm font-bold text-blue-950">Bài tập nhỏ</h4>
        <p className="mt-2 text-sm leading-7 text-blue-950/80">{task}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-bold text-blue-950">Bài tập nhỏ</h4>
        {task?.difficulty ? (
          <Badge variant="outline" className="rounded-full bg-white text-xs text-blue-800">
            {getDifficultyLabel(task.difficulty)}
          </Badge>
        ) : null}
      </div>
      {task?.task ? (
        <p className="mt-2 text-sm leading-7 text-blue-950/80">{task.task}</p>
      ) : (
        <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-7 text-blue-950/80">
          {textValue(task)}
        </pre>
      )}
      {task?.expected_answer_format ? (
        <p className="mt-3 text-sm leading-7 text-blue-950/80">
          <b>Cách trả lời:</b> {task.expected_answer_format}
        </p>
      ) : null}
    </div>
  );
}

// ─── Prerequisite & Objectives ────────────────────────────────────────────────

function PrerequisiteView({ items }: { items: any[] }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={index} className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="font-bold text-amber-950">{item?.knowledge_item || textValue(item)}</p>
          {item?.why_needed ? (
            <p className="mt-2 text-sm leading-6 text-amber-950/80"><b>Vì sao cần:</b> {item.why_needed}</p>
          ) : null}
          {item?.student_action ? (
            <p className="mt-1 text-sm leading-6 text-amber-950/80"><b>Em cần làm:</b> {item.student_action}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LearningObjectivesView({ objectives }: { objectives: any }) {
  if (!objectives || typeof objectives !== "object") return null;
  const order: [string, string][] = [
    ["remember", "Nhận biết"], ["understand", "Thông hiểu"], ["apply", "Vận dụng"],
    ["analyze", "Phân tích"], ["evaluate", "Đánh giá"], ["create", "Sáng tạo"],
  ];
  const available = order.filter(([key]) => asArray(objectives[key]).length > 0);
  if (!available.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {available.map(([key, label]) => (
        <div key={key} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="font-bold text-gray-950">{label}</p>
          <div className="mt-2"><SimpleList items={asArray(objectives[key])} /></div>
        </div>
      ))}
    </div>
  );
}

// ─── STEP CONFIG ──────────────────────────────────────────────────────────────

const STEP_CONFIG: Record<number, {
  color: string; bg: string; border: string; dot: string; icon: string; accent: string;
}> = {
  1: { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-400",   icon: "🔁", accent: "bg-amber-100" },
  2: { color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-400",    icon: "📖", accent: "bg-blue-100" },
  3: { color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200",  dot: "bg-violet-400",  icon: "💡", accent: "bg-violet-100" },
  4: { color: "text-indigo-700",  bg: "bg-indigo-50",  border: "border-indigo-200",  dot: "bg-indigo-400",  icon: "🔍", accent: "bg-indigo-100" },
  5: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-400", icon: "✏️", accent: "bg-emerald-100" },
  6: { color: "text-teal-700",    bg: "bg-teal-50",    border: "border-teal-200",    dot: "bg-teal-400",    icon: "🚀", accent: "bg-teal-100" },
  7: { color: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200",    dot: "bg-rose-400",    icon: "✅", accent: "bg-rose-100" },
};

function getStepConfig(stepNo: number) {
  return STEP_CONFIG[stepNo] || STEP_CONFIG[3];
}

function StepSection({
  emoji, title, children, variant = "default",
}: {
  emoji: string; title: string; children: ReactNode;
  variant?: "default" | "blue" | "green" | "red" | "amber" | "violet";
}) {
  const styles: Record<string, string> = {
    default: "border-gray-100 bg-gray-50/80",
    blue:    "border-blue-100 bg-blue-50/60",
    green:   "border-emerald-100 bg-emerald-50/60",
    red:     "border-red-100 bg-red-50/60",
    amber:   "border-amber-100 bg-amber-50/60",
    violet:  "border-violet-100 bg-violet-50/60",
  };
  return (
    <div className={`rounded-2xl border p-4 ${styles[variant]}`}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-base leading-none">{emoji}</span>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function BulletList({ items, color = "bg-gray-400" }: { items: any[]; color?: string }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-6 text-gray-700">
          <span className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
          <span>{textValue(item, "")}</span>
        </li>
      ))}
    </ul>
  );
}

function ProgressBar({ nodes, activeStep, onSelect }: {
  nodes: any[]; activeStep: number; onSelect: (n: number) => void;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 py-3 backdrop-blur-md bg-white/90 border-b border-gray-100">
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {nodes.map((node: any, idx: number) => {
          const stepNo = Number(node.step_no || node.step || idx + 1);
          const isActive = stepNo === activeStep;
          const isDone = stepNo < activeStep;
          const cfg = getStepConfig(stepNo);
          return (
            <button key={stepNo} type="button" onClick={() => onSelect(stepNo)}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-all
                ${isActive ? `${cfg.bg} ${cfg.border} border` : isDone ? "opacity-60 hover:opacity-80" : "hover:bg-gray-50"}`}>
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-all
                ${isActive ? `${cfg.color} ${cfg.accent}` : isDone ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                {isDone ? "✓" : stepNo}
              </div>
              <span className={`text-[9px] font-semibold leading-tight text-center max-w-[56px] hidden sm:block
                ${isActive ? cfg.color : "text-gray-400"}`}>
                {getStepTitle(stepNo, node?.title).split(" ").slice(0, 2).join(" ")}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 h-1 w-full rounded-full bg-gray-100">
        <div className="h-1 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
          style={{ width: `${nodes.length > 1 ? ((activeStep - 1) / (nodes.length - 1)) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

// ─── LEARNING PATH ROADMAP ────────────────────────────────────────────────────

export function LearningPathRoadmap({
  learningPath,
  learningPathNodes,
  isTeacher = false,
  onSaveNodeField,
}: {
  learningPath: any;
  learningPathNodes: any[];
  isTeacher?: boolean;
  onSaveNodeField?: (nodeId: string, field: string, value: string) => void;
}) {
  const root = useMemo(() => getLearningPathData(learningPath), [learningPath]);
  const nodes = useMemo(
    () => getLearningNodes(learningPath, learningPathNodes),
    [learningPath, learningPathNodes],
  );

  const firstStep = nodes[0] ? Number(nodes[0].step_no || nodes[0].step || 1) : 1;
  const [activeStep, setActiveStep] = useState<number>(firstStep);
  const [showOverview, setShowOverview] = useState(false);

  const activeNode = nodes.find((node: any, idx: number) => {
    const s = Number(node.step_no || node.step || idx + 1);
    return s === activeStep;
  }) || nodes[0];

  if (!nodes.length) {
    return <EmptyBox>Không tìm thấy các bước chi tiết của lộ trình.</EmptyBox>;
  }

  const activeStepNo = Number(activeNode?.step_no || activeNode?.step || 1);
  const cfg = getStepConfig(activeStepNo);

  const goal         = activeNode?.learning_goal || activeNode?.goal;
  const description  = activeNode?.description || activeNode?.short_description;
  const readItems    = asArray(activeNode?.what_to_read);
  const doItems      = asArray(activeNode?.what_to_do);
  const writeItems   = asArray(activeNode?.what_to_write);
  const keyContent   = asArray(activeNode?.key_content);
  const formulas     = asArray(activeNode?.formulas);
  const guiding      = asArray(activeNode?.guiding_questions);
  const mistakes     = asArray(activeNode?.common_mistakes);
  const expected     = asArray(activeNode?.expected_output);
  const practiceTask = activeNode?.practice_task;
  const miniExample  = activeNode?.mini_example;
  const checkpoint   = activeNode?.checkpoint_question;
  const mastery      = activeNode?.mastery_check;
  const supportTip   = activeNode?.support_tip;

  const overview                = root?.overview;
  const learningObjectives      = root?.learning_objectives || {};
  const prerequisiteKnowledge   = asArray(root?.prerequisite_knowledge);
  const finalOutputs            = asArray(root?.final_outputs);
  const selfAssessmentChecklist = asArray(root?.self_assessment_checklist);
  const questionsForTeacher     = asArray(root?.questions_for_teacher);
  const noteForStudent          = root?.note_for_student;
  const totalMinutes            = root?.estimated_total_minutes;

  const prevStep = activeStep > firstStep ? activeStep - 1 : null;
  const nextStep = activeStep < nodes.length ? activeStep + 1 : null;

  // text field
  const editable = (field: string) =>
    isTeacher && onSaveNodeField
      ? (v: string) => onSaveNodeField(activeNode?.id, field, v)
      : undefined;

  // list field — chuyển array thành JSON string khi lưu
  const editableList = (field: string) =>
    isTeacher && onSaveNodeField
      ? (v: string[]) => onSaveNodeField(activeNode?.id, field, JSON.stringify(v))
      : undefined;

  return (
    <div className="space-y-0">

      {/* ── HEADER CARD ── */}
      <Card className="rounded-3xl rounded-b-none border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-gray-950">
                <ListChecks className="h-5 w-5 text-violet-600" />
                Lộ trình học bài
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {nodes.length} bước · Đi từng bước một để không bỏ sót kiến thức
              </p>
            </div>
            <div className="flex items-center gap-2">
              {totalMinutes && (
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
                  <Clock className="h-3.5 w-3.5 text-violet-500" />{totalMinutes} phút
                </div>
              )}
              {(overview || prerequisiteKnowledge.length || finalOutputs.length) && (
                <button type="button" onClick={() => setShowOverview(v => !v)}
                  className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 transition">
                  <Target className="h-3.5 w-3.5" />
                  {showOverview ? "Ẩn tổng quan" : "Xem tổng quan"}
                  {showOverview ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          </div>

          {showOverview && (
            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              {overview && <p className="text-sm leading-7 text-gray-600">{overview}</p>}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {prerequisiteKnowledge.length > 0 && (
                  <StepSection emoji="⚡" title="Cần biết trước" variant="amber">
                    <BulletList items={prerequisiteKnowledge.map((i: any) => i?.knowledge_item || i)} color="bg-amber-400" />
                  </StepSection>
                )}
                {finalOutputs.length > 0 && (
                  <StepSection emoji="🎯" title="Sản phẩm cần đạt" variant="green">
                    <BulletList items={finalOutputs} color="bg-emerald-400" />
                  </StepSection>
                )}
                {noteForStudent && (
                  <StepSection emoji="📌" title="Lưu ý" variant="violet">
                    <p className="text-sm leading-6 text-gray-700">{noteForStudent}</p>
                  </StepSection>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── STICKY STEP NAVIGATOR ── */}
      <Card className="rounded-none border-x border-gray-200 bg-white shadow-none">
        <CardContent className="p-0">
          <ProgressBar nodes={nodes} activeStep={activeStep} onSelect={setActiveStep} />
        </CardContent>
      </Card>

      {/* ── STEP DETAIL ── */}
      <Card className="rounded-3xl rounded-t-none border border-t-0 border-gray-200 bg-white shadow-sm">
        <CardContent className="p-5 md:p-7">

          {/* Step title row */}
          <div className={`-mx-5 -mt-5 md:-mx-7 md:-mt-7 mb-6 rounded-t-3xl px-5 py-5 md:px-7 ${cfg.bg} border-b ${cfg.border}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm bg-white">
                  {cfg.icon}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.color} ${cfg.accent}`}>
                      Bước {activeStepNo}
                    </span>
                    {activeNode?.bloom_level && (
                      <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {getBloomLabel(activeNode.bloom_level)}
                      </span>
                    )}
                    {activeNode?.estimated_minutes && (
                      <span className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        <Clock className="h-3 w-3" />{activeNode.estimated_minutes} phút
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-gray-950 leading-tight">
                    {getStepTitle(activeStepNo, activeNode?.title)}
                  </h2>
                  <p className={`text-sm font-medium mt-0.5 ${cfg.color}`}>
                    {getStepShort(activeStepNo, activeNode?.short_label)}
                  </p>
                </div>
              </div>
            </div>
            {description && (
              <div className="mt-3">
                <EditableText value={textValue(description)} onChange={editable("description")} />
              </div>
            )}
          </div>

          {/* Goal + key content */}
          {(hasContent(goal) || keyContent.length > 0) && (
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              {hasContent(goal) && (
                <StepSection emoji="🎯" title="Mục tiêu bước này" variant="violet">
                  <EditableText value={textValue(goal)} onChange={editable("learning_goal")} />
                </StepSection>
              )}
              {keyContent.length > 0 && (
                <StepSection emoji="📚" title="Kiến thức trọng tâm" variant="blue">
                  <EditableList items={keyContent} color="bg-blue-400" onChange={editableList("key_content")} />
                </StepSection>
              )}
            </div>
          )}

          {/* Read / Do / Write */}
          {(readItems.length > 0 || doItems.length > 0 || writeItems.length > 0) && (
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              {readItems.length > 0 && (
                <StepSection emoji="📖" title="Em cần đọc / xem">
                  <EditableList items={readItems} onChange={editableList("what_to_read")} />
                </StepSection>
              )}
              {doItems.length > 0 && (
                <StepSection emoji="✏️" title="Em cần làm" variant="green">
                  <EditableList items={doItems} color="bg-emerald-400" onChange={editableList("what_to_do")} />
                </StepSection>
              )}
              {writeItems.length > 0 && (
                <StepSection emoji="📝" title="Em cần ghi lại" variant="amber">
                  <EditableList items={writeItems} color="bg-amber-400" onChange={editableList("what_to_write")} />
                </StepSection>
              )}
            </div>
          )}

          {/* Guiding questions */}
          {guiding.length > 0 && (
            <div className="mb-4">
              <StepSection emoji="💬" title="Câu hỏi gợi ý để suy nghĩ" variant="violet">
                <EditableList items={guiding} color="bg-violet-400" onChange={editableList("guiding_questions")} />
              </StepSection>
            </div>
          )}

          {/* Formulas */}
          {formulas.length > 0 && (
            <div className="mb-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-base">🔢</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700">Công thức cần nhớ</h4>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {formulas.map((formula: any, i: number) => (
                    <div key={i} className="rounded-xl border border-blue-200 bg-white p-3">
                      <div className="text-sm">
                        <FormulaDisplay formula={formula?.formula || textValue(formula)} className="text-sm" />
                      </div>
                      {formula?.meaning && (
                        <p className="mt-1 text-xs leading-5 text-blue-700/80">{formula.meaning}</p>
                      )}
                      {Array.isArray(formula?.variables) && formula.variables.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {formula.variables.map((v: any, j: number) => (
                            <div key={j} className="rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-800">
                              <b>{v.symbol}</b>: {v.meaning}{v.unit ? ` (${v.unit})` : ""}
                            </div>
                          ))}
                        </div>
                      )}
                      {formula?.when_to_use && (
                        <p className="mt-2 text-xs text-blue-600"><b>Khi dùng:</b> {formula.when_to_use}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mini example */}
          {miniExample && (
            <div className="mb-4">
              <StepSection emoji="🌟" title="Ví dụ dễ hiểu" variant="amber">
                <EditableText value={textValue(miniExample)} onChange={editable("mini_example")} />
              </StepSection>
            </div>
          )}

          {/* Practice task */}
          {hasContent(practiceTask) && (
            <div className="mb-4">
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🖊️</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700">Bài tập nhỏ</h4>
                  </div>
                  {typeof practiceTask === "object" && practiceTask?.difficulty && (
                    <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {getDifficultyLabel(practiceTask.difficulty)}
                    </span>
                  )}
                </div>
                <EditableText
                  value={typeof practiceTask === "string" ? practiceTask : practiceTask?.task || textValue(practiceTask)}
                  onChange={editable("practice_task")}
                  className="font-medium"
                />
                {typeof practiceTask === "object" && practiceTask?.expected_answer_format && (
                  <p className="mt-2 text-xs text-indigo-600">
                    <b>Cách trả lời:</b> {practiceTask.expected_answer_format}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Mistakes + Expected + Mastery + Support */}
          {(mistakes.length > 0 || expected.length > 0 || hasContent(mastery) || hasContent(supportTip) || hasContent(checkpoint)) && (
            <div className="grid gap-3 md:grid-cols-2">
              {mistakes.length > 0 && (
                <StepSection emoji="⚠️" title="Lỗi dễ mắc phải" variant="red">
                  <EditableList items={mistakes} color="bg-red-400" onChange={editableList("common_mistakes")} />
                </StepSection>
              )}
              {expected.length > 0 && (
                <StepSection emoji="🏆" title="Kết quả cần đạt" variant="green">
                  <EditableList items={expected} color="bg-emerald-400" onChange={editableList("expected_output")} />
                </StepSection>
              )}
              {hasContent(mastery) && (
                <StepSection emoji="💎" title="Dấu hiệu đã hiểu bài" variant="green">
                  <EditableText value={textValue(mastery)} onChange={editable("mastery_check")} />
                </StepSection>
              )}
              {hasContent(supportTip) && (
                <StepSection emoji="🤝" title="Gợi ý khi gặp khó khăn" variant="amber">
                  <EditableText value={textValue(supportTip)} onChange={editable("support_tip")} />
                </StepSection>
              )}
              {hasContent(checkpoint) && (
                <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-4 md:col-span-2`}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-base">🧪</span>
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>Tự kiểm tra nhanh</h4>
                  </div>
                  <EditableText value={textValue(checkpoint)} onChange={editable("checkpoint_question")} className="font-medium" />
                </div>
              )}
            </div>
          )}

          {/* Prev / Next */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-gray-100 pt-5">
            <button type="button" disabled={!prevStep} onClick={() => prevStep && setActiveStep(prevStep)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition
                ${prevStep ? "border-gray-200 text-gray-700 hover:bg-gray-50" : "border-transparent text-gray-300 cursor-not-allowed"}`}>
              <ChevronDown className="h-4 w-4 rotate-90" />
              {prevStep ? `Bước ${prevStep}` : "Đầu tiên"}
            </button>
            <div className="text-xs font-medium text-gray-400">{activeStep} / {nodes.length}</div>
            <button type="button" disabled={!nextStep} onClick={() => nextStep && setActiveStep(nextStep)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition
                ${nextStep ? `${cfg.border} ${cfg.bg} ${cfg.color} hover:opacity-90` : "border-transparent text-gray-300 cursor-not-allowed"}`}>
              {nextStep ? `Bước ${nextStep}` : "Xong rồi 🎉"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── CHECKLIST ── */}
      {selfAssessmentChecklist.length > 0 && (
        <Card className="mt-4 rounded-3xl border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-5 md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-violet-600" />
              <div>
                <h2 className="text-base font-bold text-gray-950">Checklist tự đánh giá</h2>
                <p className="text-xs text-gray-500">Tự check trước khi vào lớp để biết mình đã sẵn sàng chưa</p>
              </div>
            </div>
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {selfAssessmentChecklist.map((item: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3.5">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-violet-200">
                    <CheckCircle2 className="h-3 w-3 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm leading-6 text-gray-800 font-medium">{item?.criteria || textValue(item)}</p>
                    {item?.bloom_level && (
                      <span className="text-[10px] text-gray-400">{getBloomLabel(item.bloom_level)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── MỤC TIÊU + CÂU HỎI ── */}
      {(hasContent(learningObjectives) || questionsForTeacher.length > 0) && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {hasContent(learningObjectives) && (
            <Card className="rounded-3xl border border-gray-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-950">
                  <Target className="h-4 w-4 text-violet-600" />Mục tiêu học tập
                </h3>
                <LearningObjectivesView objectives={learningObjectives} />
              </CardContent>
            </Card>
          )}
          {questionsForTeacher.length > 0 && (
            <Card className="rounded-3xl border border-gray-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-950">
                  <FileQuestion className="h-4 w-4 text-violet-600" />Câu hỏi chuẩn bị cho thầy/cô
                </h3>
                <BulletList items={questionsForTeacher} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MINDMAP ──────────────────────────────────────────────────────────────────

function getMindmapTitle(mindmap: any) {
  return (
    mindmap?.title ||
    mindmap?.content_json?.title ||
    mindmap?.content_json?.mindmap?.title ||
    "Mindmap bài học"
  );
}

function getMindmapNodes(mindmap: any) {
  const content = mindmap?.content_json || mindmap?.mindmap || mindmap;
  return (
    content?.nodes || content?.branches ||
    content?.mindmap?.nodes || content?.mindmap?.branches ||
    content?.children || []
  );
}

function MindmapBranch({ node, level = 0 }: { node: any; level?: number }) {
  const [open, setOpen] = useState(true);
  const title = node?.title || node?.label || node?.name || node?.topic || node?.main_idea || textValue(node, "Ý chính");
  const children = node?.children || node?.subtopics || node?.branches || node?.items || node?.details || [];
  const hasChildren = Array.isArray(children) && children.length > 0;

  return (
    <div className={`${level > 0 ? "ml-4 border-l border-violet-100 pl-4" : ""}`}>
      <div className="my-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <button type="button" onClick={() => setOpen(prev => !prev)} className="flex w-full items-start gap-3 text-left">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            {hasChildren
              ? open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
              : <Network className="h-3.5 w-3.5" />}
          </div>
          <div>
            <p className="font-bold text-gray-950">{title}</p>
            {node?.description || node?.summary || node?.content ? (
              <p className="mt-1 text-sm leading-6 text-gray-600">{node.description || node.summary || node.content}</p>
            ) : null}
          </div>
        </button>
      </div>
      {open && hasChildren ? (
        <div>
          {children.map((child: any, index: number) => (
            <MindmapBranch key={index} node={child} level={level + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function InteractiveMindmap({ mindmap }: { mindmap: any }) {
  const title = getMindmapTitle(mindmap);
  const nodes = getMindmapNodes(mindmap);
  const contentText = mindmap?.content_text;

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border border-violet-100 bg-violet-50 shadow-sm">
        <CardContent className="p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-violet-950">
            <Network className="h-5 w-5" />{title}
          </h2>
          <p className="mt-2 text-sm leading-7 text-violet-950/80">
            Sơ đồ tư duy được tách sang trang riêng để dễ theo dõi các nhánh kiến thức.
          </p>
        </CardContent>
      </Card>

      {Array.isArray(nodes) && nodes.length ? (
        <Card className="rounded-3xl border border-gray-200 bg-gray-50 shadow-sm">
          <CardContent className="p-5">
            <div className="rounded-3xl bg-white p-5">
              {nodes.map((node: any, index: number) => <MindmapBranch key={index} node={node} />)}
            </div>
          </CardContent>
        </Card>
      ) : contentText ? (
        <Card className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-gray-800">{contentText}</pre>
          </CardContent>
        </Card>
      ) : (
        <EmptyBox>Mindmap đã được tạo nhưng chưa có cấu trúc node phù hợp để hiển thị.</EmptyBox>
      )}
    </div>
  );
}

// ─── QUESTION BANK ────────────────────────────────────────────────────────────

function normalizeQuestion(question: any, index: number) {
  const content = question?.content_json || question?.question_json || question;
  return {
    id: question?.id || index,
    order: question?.order_no || question?.question_no || index + 1,
    type: question?.question_type || content?.type || content?.question_type || "Câu hỏi",
    difficulty: question?.difficulty || content?.difficulty || "Chưa phân loại",
    bloomLevel: question?.bloom_level || content?.bloom_level || "",
    question:
      question?.question_text || question?.content ||
      content?.question || content?.question_text || content?.content ||
      "Chưa có nội dung câu hỏi",
    options: content?.options || question?.options || content?.choices || question?.choices || [],
    answer:
      question?.correct_answer || question?.answer ||
      content?.correct_answer || content?.answer || content?.correctOption || "",
    explanation: question?.explanation || content?.explanation || content?.solution || "",
  };
}

export function QuestionBankView({ questions }: { questions: any[] }) {
  const [filter, setFilter] = useState("all");

  const normalized = useMemo(() => questions.map((q, i) => normalizeQuestion(q, i)), [questions]);

  const levels = useMemo(() => {
    const values = normalized.map(q => q.difficulty || q.bloomLevel).filter(Boolean).map(v => String(v));
    return ["all", ...Array.from(new Set(values))];
  }, [normalized]);

  const filtered = useMemo(() => {
    if (filter === "all") return normalized;
    return normalized.filter(q => q.difficulty === filter || q.bloomLevel === filter);
  }, [filter, normalized]);

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-950">Danh sách câu hỏi</h2>
              <p className="mt-1 text-sm text-gray-600">Có {normalized.length} câu hỏi. Lọc theo mức độ để xem dễ hơn.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {levels.map(level => (
                <button key={level} type="button" onClick={() => setFilter(level)}
                  className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                    filter === level
                      ? "border-violet-500 bg-violet-600 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-violet-300"
                  }`}>
                  {level === "all" ? "Tất cả" : level}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filtered.map(question => (
          <Card key={question.id} className="rounded-3xl border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-violet-600 text-xs">Câu {question.order}</Badge>
                  <Badge variant="outline" className="rounded-full text-xs">{question.type}</Badge>
                  {question.difficulty && <Badge variant="outline" className="rounded-full text-xs">{question.difficulty}</Badge>}
                  {question.bloomLevel && <Badge variant="outline" className="rounded-full text-xs">{question.bloomLevel}</Badge>}
                </div>
              </div>
              <h3 className="mt-4 text-base font-bold leading-8 text-gray-950">{question.question}</h3>
              {Array.isArray(question.options) && question.options.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {question.options.map((option: any, index: number) => (
                    <div key={index} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                      {typeof option === "string" ? option : textValue(option, "")}
                    </div>
                  ))}
                </div>
              ) : null}
              {question.answer && (
                <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-sm font-bold text-emerald-950">Đáp án</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-emerald-950/80">{textValue(question.answer, "")}</p>
                </div>
              )}
              {question.explanation && (
                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-bold text-blue-950">Giải thích</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-blue-950/80">{textValue(question.explanation, "")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}