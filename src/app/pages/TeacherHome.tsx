import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  GitBranch,
  HelpCircle,
  LayoutDashboard,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { apiCall } from "../utils/api";

interface ModuleItem {
  id: string;
  title: string;
  subject: string;
  progress_stage: string;
  progress_percent: number;
}

// ─── Donut Chart (SVG) ────────────────────────────────────────────────────────

function DonutChart({
  value, total, size = 80, strokeWidth = 10, color,
}: { value: number; total: number; size?: number; strokeWidth?: number; color: string }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? value / total : 0;
  const dash = pct * circ;
  const cx = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

// ─── Horizontal Bar ───────────────────────────────────────────────────────────

function HBar({ label, value, max, color, badge }: {
  label: string; value: number; max: number; color: string; badge?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="group flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-sm text-gray-600">{label}</div>
      <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-6 shrink-0 text-right text-sm font-semibold text-gray-800">{value}</div>
      {badge && (
        <span className="hidden shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 group-hover:inline">
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Mini Funnel (pipeline) ───────────────────────────────────────────────────

function FunnelBar({ label, value, total, color, icon }: {
  label: string; value: number; total: number; color: string; icon: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">
          <span>{icon}</span>{label}
        </span>
        <span className="font-bold text-gray-900">{value}
          <span className="ml-1 text-xs font-normal text-gray-400">({pct}%)</span>
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-3 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Radial progress ring ────────────────────────────────────────────────────

function RadialStat({
  label, value, total, color, icon, bgColor, textColor,
}: {
  label: string; value: number; total: number;
  color: string; icon: React.ReactNode;
  bgColor: string; textColor: string;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
            <p className="mt-1 text-3xl font-black text-gray-950">{value}</p>
            {total > 0 && (
              <p className="mt-0.5 text-xs text-gray-400">/ {total} môn học</p>
            )}
          </div>
          <div className="relative">
            <DonutChart value={value} total={Math.max(total, 1)} size={64} strokeWidth={7} color={color} />
            <div className={`absolute inset-0 flex items-center justify-center`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${bgColor} ${textColor}`}>
                {icon}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-1.5 rounded-full transition-all duration-700"
            style={{ width: `${total > 0 ? (value / total) * 100 : 0}%`, background: color }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stage color map ──────────────────────────────────────────────────────────

const STAGE_LABEL: Record<string, { label: string; color: string; dot: string }> = {
  created:                 { label: "Mới tạo",         color: "bg-gray-200",    dot: "bg-gray-400" },
  lesson_plan_uploaded:    { label: "Có giáo án",       color: "bg-blue-200",    dot: "bg-blue-500" },
  learning_path_generated: { label: "Có lộ trình",      color: "bg-indigo-300",  dot: "bg-indigo-500" },
  mindmap_generated:       { label: "Có mindmap",       color: "bg-violet-300",  dot: "bg-violet-500" },
  question_bank_generated: { label: "Hoàn chỉnh",       color: "bg-emerald-300", dot: "bg-emerald-500" },
};

// ─── Recent modules list ──────────────────────────────────────────────────────

function RecentModules({ modules, navigate }: { modules: ModuleItem[]; navigate: (p: string) => void }) {
  const recent = [...modules]
    .sort((a, b) => (b.progress_percent || 0) - (a.progress_percent || 0))
    .slice(0, 5);

  if (!recent.length) return (
    <p className="py-4 text-center text-sm text-gray-400">Chưa có môn học nào</p>
  );

  return (
    <div className="space-y-2.5">
      {recent.map((m) => {
        const stage = STAGE_LABEL[m.progress_stage] || STAGE_LABEL["created"];
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => navigate(`/teacher/modules/${m.id}`)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-left transition hover:border-violet-200 hover:bg-violet-50"
          >
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${stage.dot}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{m.title}</p>
              <p className="text-xs text-gray-400">{m.subject}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold text-gray-700 ${stage.color}`}>
                {stage.label}
              </span>
              <span className="text-xs font-bold text-gray-500">{m.progress_percent}%</span>
              <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-violet-500 transition" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Stage distribution — horizontal stacked bar ────────────────────────────

function StageDistribution({ modules }: { modules: ModuleItem[] }) {
  const stages = [
    { key: "created",                 label: "Mới tạo",    color: "bg-gray-300" },
    { key: "lesson_plan_uploaded",    label: "Có giáo án", color: "bg-blue-400" },
    { key: "learning_path_generated", label: "Có lộ trình",color: "bg-indigo-400" },
    { key: "mindmap_generated",       label: "Có mindmap", color: "bg-violet-400" },
    { key: "question_bank_generated", label: "Hoàn chỉnh", color: "bg-emerald-500" },
  ];

  const counts = stages.map((s) => ({
    ...s,
    count: modules.filter((m) => m.progress_stage === s.key).length,
  }));

  const total = modules.length;

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
        {counts.map((s) => {
          const pct = total > 0 ? (s.count / total) * 100 : 0;
          if (!pct) return null;
          return (
            <div
              key={s.key}
              className={`h-full transition-all duration-700 ${s.color}`}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${s.count}`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {counts.filter(s => s.count > 0).map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
            {s.label} <span className="font-semibold text-gray-800">({s.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity heatmap (mock weekly) ──────────────────────────────────────────

function ActivityHeatmap({ modules }: { modules: ModuleItem[] }) {
  // Build mock "content completeness" buckets from real data
  const buckets = [
    { range: "0%",    count: modules.filter(m => m.progress_percent === 0).length },
    { range: "25%",   count: modules.filter(m => m.progress_percent > 0 && m.progress_percent <= 25).length },
    { range: "50%",   count: modules.filter(m => m.progress_percent > 25 && m.progress_percent <= 50).length },
    { range: "75%",   count: modules.filter(m => m.progress_percent > 50 && m.progress_percent <= 75).length },
    { range: "100%",  count: modules.filter(m => m.progress_percent > 75).length },
  ];
  const maxBucket = Math.max(1, ...buckets.map(b => b.count));

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Phân bố mức hoàn thiện</p>
      <div className="flex items-end gap-1.5 h-16">
        {buckets.map((b) => {
          const h = Math.max(4, (b.count / maxBucket) * 56);
          const colors = ["bg-gray-200","bg-blue-300","bg-indigo-400","bg-violet-500","bg-emerald-500"];
          const idx = buckets.indexOf(b);
          return (
            <div key={b.range} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-lg transition-all duration-700 ${colors[idx]}`}
                style={{ height: `${h}px` }}
                title={`${b.range}: ${b.count} môn`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        {buckets.map((b) => (
          <div key={b.range} className="flex-1 text-center text-[9px] font-medium text-gray-400">{b.range}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TeacherHome() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall("/modules")
      .then((data) => setModules(data.modules || []))
      .catch(() => setModules([]))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const total = modules.length;
    const completed    = modules.filter((m) => m.progress_percent >= 100).length;
    const withLessonPlan = modules.filter((m) => m.progress_stage !== "created").length;
    const withLearningPath = modules.filter((m) =>
      ["learning_path_generated","mindmap_generated","question_bank_generated"].includes(m.progress_stage)
    ).length;
    const withMindmap  = modules.filter((m) =>
      ["mindmap_generated","question_bank_generated"].includes(m.progress_stage)
    ).length;
    const withQuestions = modules.filter((m) => m.progress_stage === "question_bank_generated").length;

    const bySubject = modules.reduce<Record<string, number>>((acc, item) => {
      acc[item.subject || "Khác"] = (acc[item.subject || "Khác"] || 0) + 1;
      return acc;
    }, {});

    const avgProgress = total > 0
      ? Math.round(modules.reduce((s, m) => s + (m.progress_percent || 0), 0) / total)
      : 0;

    return { total, completed, withLessonPlan, withLearningPath, withMindmap, withQuestions, bySubject, avgProgress };
  }, [modules]);

  const maxSubjectCount = Math.max(1, ...Object.values(stats.bySubject));

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-48 rounded-xl bg-gray-100" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-gray-100" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-950">
            <LayoutDashboard className="h-6 w-6 text-violet-600" />
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Tổng quan tiến độ · {stats.total} môn học · trung bình hoàn thiện {stats.avgProgress}%
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/teacher/modules")}
          className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 transition"
        >
          Xem tất cả <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── 4 KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <RadialStat
          label="Tổng môn học"
          value={stats.total} total={stats.total}
          color="#7c3aed"
          icon={<BookOpenCheck className="h-4 w-4" />}
          bgColor="bg-violet-100" textColor="text-violet-700"
        />
        <RadialStat
          label="Có giáo án"
          value={stats.withLessonPlan} total={stats.total}
          color="#3b82f6"
          icon={<TrendingUp className="h-4 w-4" />}
          bgColor="bg-blue-100" textColor="text-blue-700"
        />
        <RadialStat
          label="Có bộ câu hỏi"
          value={stats.withQuestions} total={stats.total}
          color="#ec4899"
          icon={<HelpCircle className="h-4 w-4" />}
          bgColor="bg-pink-100" textColor="text-pink-700"
        />
        <RadialStat
          label="Hoàn chỉnh"
          value={stats.completed} total={stats.total}
          color="#10b981"
          icon={<CheckCircle2 className="h-4 w-4" />}
          bgColor="bg-emerald-100" textColor="text-emerald-700"
        />
      </div>

      {/* ── Stage bar + activity ────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Stage distribution — full width left */}
        <Card className="rounded-2xl border border-gray-100 shadow-sm lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-950">Tiến độ theo giai đoạn</p>
                <p className="text-xs text-gray-400">Phân bổ {stats.total} môn học theo mức hoàn thiện</p>
              </div>
              <Zap className="h-4 w-4 text-violet-400" />
            </div>
            {stats.total > 0 ? (
              <StageDistribution modules={modules} />
            ) : (
              <p className="py-6 text-center text-sm text-gray-400">Chưa có dữ liệu</p>
            )}
          </CardContent>
        </Card>

        {/* Activity bars */}
        <Card className="rounded-2xl border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-950">Mức hoàn thiện</p>
              <GitBranch className="h-4 w-4 text-violet-400" />
            </div>
            {stats.total > 0 ? (
              <ActivityHeatmap modules={modules} />
            ) : (
              <p className="py-6 text-center text-sm text-gray-400">Chưa có dữ liệu</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Pipeline funnel + Subject breakdown ─────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Content pipeline funnel */}
        <Card className="rounded-2xl border border-gray-100 shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-950">
              <TrendingUp className="h-4 w-4 text-violet-500" />
              Pipeline nội dung
            </CardTitle>
            <p className="text-xs text-gray-400">Số môn có từng loại nội dung</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3.5">
            {stats.total === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">Chưa có dữ liệu</p>
            ) : (
              <>
                <FunnelBar label="Môn học" value={stats.total} total={stats.total} color="bg-violet-500" icon="📚" />
                <FunnelBar label="Giáo án" value={stats.withLessonPlan} total={stats.total} color="bg-blue-500" icon="📄" />
                <FunnelBar label="Lộ trình" value={stats.withLearningPath} total={stats.total} color="bg-indigo-500" icon="🗺️" />
                <FunnelBar label="Mindmap" value={stats.withMindmap} total={stats.total} color="bg-violet-400" icon="🧠" />
                <FunnelBar label="Câu hỏi" value={stats.withQuestions} total={stats.total} color="bg-emerald-500" icon="✅" />
              </>
            )}
          </CardContent>
        </Card>

        {/* Subject breakdown */}
        <Card className="rounded-2xl border border-gray-100 shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-950">
              <Users className="h-4 w-4 text-violet-500" />
              Phân bổ theo môn học
            </CardTitle>
            <p className="text-xs text-gray-400">Số lượng module theo từng môn</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {Object.keys(stats.bySubject).length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">Chưa có dữ liệu</p>
            ) : (
              Object.entries(stats.bySubject)
                .sort((a, b) => b[1] - a[1])
                .map(([subject, count], i) => {
                  const colors = ["bg-violet-500","bg-blue-500","bg-indigo-400","bg-teal-500","bg-emerald-500","bg-pink-500"];
                  return (
                    <HBar
                      key={subject}
                      label={subject}
                      value={count}
                      max={maxSubjectCount}
                      color={colors[i % colors.length]}
                      badge={`${Math.round((count / stats.total) * 100)}%`}
                    />
                  );
                })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent modules ──────────────────────────────────────────────── */}
      <Card className="rounded-2xl border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-950">
              <BookOpenCheck className="h-4 w-4 text-violet-500" />
              Môn học nổi bật
            </CardTitle>
            <button
              type="button"
              onClick={() => navigate("/teacher/modules")}
              className="text-xs font-semibold text-violet-600 hover:underline"
            >
              Xem tất cả →
            </button>
          </div>
          <p className="text-xs text-gray-400">Top 5 môn học theo mức hoàn thiện</p>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <RecentModules modules={modules} navigate={navigate} />
        </CardContent>
      </Card>
    </div>
  );
}