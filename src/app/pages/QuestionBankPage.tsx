import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit2,
  HelpCircle,
  Play,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  XCircle,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { apiCall, getUserProfile } from "../utils/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionItem {
  id: string;
  order_no: number;
  question_type: "mcq" | "true_false";
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string | null;
  bloom_level: string | null;
  points?: number;
}

interface QuizAssignment {
  id: string;
  title: string;
  deadline: string | null;
  time_limit_minutes: number | null;
  total_points: number;
  status: string;
  created_at: string;
  assigned_student_ids: string[];
}

interface MyAttempt {
  id: string;
  assignment_id: string;
  assignment_title: string;
  score: number;
  total_points: number;
  percent: number;
  submitted_at: string;
  graded_answers_json: GradedAnswer[];
  time_limit_minutes: number | null;
  deadline: string | null;
}

interface GradedAnswer {
  question_id: string;
  question_text: string;
  your_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string | null;
  points: number;
  earned: number;
}

interface AttemptResult {
  student_id: string;
  student_name: string;
  score: number;
  total_points: number;
  submitted_at: string;
  percent: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(v?: string | null) {
  if (!v) return "Không giới hạn";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(v));
  } catch { return v; }
}

function isOverdue(deadline: string | null) {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

function gradeLabel(percent: number) {
  if (percent >= 85) return { text: "Giỏi", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (percent >= 70) return { text: "Khá", color: "text-blue-700 bg-blue-50 border-blue-200" };
  if (percent >= 50) return { text: "Trung bình", color: "text-amber-700 bg-amber-50 border-amber-200" };
  return { text: "Chưa đạt", color: "text-red-700 bg-red-50 border-red-200" };
}

// ─── ════════════════════════════════════════════════════════════════════════ ──
//     STUDENT VIEW — Bài thi của học sinh
// ─── ════════════════════════════════════════════════════════════════════════ ──

// Xem chi tiết 1 bài đã làm
function AttemptDetailModal({
  attempt,
  open,
  onClose,
}: {
  attempt: MyAttempt | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!attempt) return null;
  const grade = gradeLabel(attempt.percent);
  const correct = attempt.graded_answers_json.filter(a => a.is_correct).length;
  const total = attempt.graded_answers_json.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Kết quả: {attempt.assignment_title}
          </DialogTitle>
        </DialogHeader>

        {/* Score summary */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-center">
              <div className="text-4xl font-black text-gray-950">{attempt.score}</div>
              <div className="text-xs text-gray-400">/ {attempt.total_points} điểm</div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-3 rounded-full transition-all ${attempt.percent >= 70 ? "bg-emerald-500" : attempt.percent >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${attempt.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{correct}/{total} câu đúng</span>
                <span>{attempt.percent}%</span>
              </div>
            </div>
            <div className={`rounded-xl border px-3 py-1.5 text-sm font-bold ${grade.color}`}>
              {grade.text}
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-400">Nộp lúc: {formatDate(attempt.submitted_at)}</div>
        </div>

        {/* Answers detail */}
        <div className="space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Chi tiết từng câu</p>
          {attempt.graded_answers_json.map((a, i) => (
            <div
              key={a.question_id}
              className={`rounded-2xl border p-4 ${a.is_correct ? "border-emerald-100 bg-emerald-50/50" : "border-red-100 bg-red-50/50"}`}
            >
              <div className="flex items-start gap-3">
                {a.is_correct
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    <span className="mr-1.5 text-gray-400">Câu {i + 1}.</span>
                    {a.question_text}
                  </p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>
                      <span className="text-gray-400">Bạn chọn: </span>
                      <span className={`font-semibold ${a.is_correct ? "text-emerald-700" : "text-red-600"}`}>
                        {a.your_answer || "Chưa trả lời"}
                      </span>
                    </p>
                    {!a.is_correct && (
                      <p>
                        <span className="text-gray-400">Đáp án đúng: </span>
                        <span className="font-semibold text-emerald-700">{a.correct_answer}</span>
                      </p>
                    )}
                  </div>
                  {a.explanation && (
                    <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      💡 {a.explanation}
                    </div>
                  )}
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${a.is_correct ? "border-emerald-200 text-emerald-700" : "border-red-200 text-red-500"}`}>
                  {a.earned}/{a.points}đ
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={onClose} className="rounded-xl">Đóng</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Danh sách bài thi + lịch sử của học sinh
function StudentQuizView({ moduleId, navigate }: { moduleId: string; navigate: (p: string) => void }) {
  const [assignments, setAssignments] = useState<QuizAssignment[]>([]);
  const [myAttempts, setMyAttempts] = useState<MyAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewAttempt, setViewAttempt] = useState<MyAttempt | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      apiCall(`/quiz-assignments?moduleId=${moduleId}`),
      apiCall(`/my-quiz-attempts?moduleId=${moduleId}`),
    ])
      .then(([asgn, hist]) => {
        setAssignments(asgn.assignments || []);
        setMyAttempts(hist.attempts || []);
      })
      .catch(() => toast.error("Không thể tải dữ liệu bài thi"))
      .finally(() => setLoading(false));
  }, [moduleId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );
  }

  // Map attempt by assignment_id for quick lookup
  const attemptMap = Object.fromEntries(myAttempts.map(a => [a.assignment_id, a]));

  // Pending = assigned but not yet submitted
  const pending = assignments.filter(a => !attemptMap[a.id]);
  const done = assignments.filter(a => !!attemptMap[a.id]);

  function openDetail(attempt: MyAttempt) {
    setViewAttempt(attempt);
    setDetailOpen(true);
  }

  return (
    <>
      <AttemptDetailModal
        attempt={viewAttempt}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

      {/* Pending quizzes */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-violet-600" />
          <h2 className="text-base font-bold text-gray-950">Bài thi chờ làm</h2>
          {pending.length > 0 && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
            <p className="text-sm text-gray-500">Bạn đã làm hết tất cả bài thi 🎉</p>
          </div>
        ) : (
          pending.map(a => {
            const overdue = isOverdue(a.deadline);
            return (
              <Card key={a.id} className={`overflow-hidden rounded-2xl border ${overdue ? "border-red-200" : "border-violet-200"} shadow-sm`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-bold text-gray-900">{a.title}</p>
                        {overdue && (
                          <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                            <AlertCircle className="h-3 w-3" />Quá hạn
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {a.time_limit_minutes ? `${a.time_limit_minutes} phút` : "Không giới hạn"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy className="h-3 w-3" />{a.total_points} điểm
                        </span>
                        {a.deadline && (
                          <span>Hạn: {formatDate(a.deadline)}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => navigate(`/student/quiz/${a.id}`)}
                      className="shrink-0 rounded-xl"
                    >
                      <Play className="mr-1.5 h-3.5 w-3.5" />Làm bài
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* History */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gray-500" />
          <h2 className="text-base font-bold text-gray-950">Lịch sử bài đã làm</h2>
          {done.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
              {done.length}
            </span>
          )}
        </div>

        {done.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-400">Chưa có bài thi nào được hoàn thành</p>
          </div>
        ) : (
          done.map(a => {
            const attempt = attemptMap[a.id];
            const grade = gradeLabel(attempt.percent);
            return (
              <Card key={a.id} className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    {/* Score ring */}
                    <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border-2 ${attempt.percent >= 70 ? "border-emerald-200 bg-emerald-50" : attempt.percent >= 50 ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
                      <span className={`text-lg font-black ${attempt.percent >= 70 ? "text-emerald-700" : attempt.percent >= 50 ? "text-amber-700" : "text-red-600"}`}>
                        {attempt.percent}
                      </span>
                      <span className="text-[9px] text-gray-400">%</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{a.title}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span>{attempt.score}/{attempt.total_points} điểm</span>
                        <span>·</span>
                        <span>{attempt.graded_answers_json.filter(x => x.is_correct).length}/{attempt.graded_answers_json.length} câu đúng</span>
                        <span>·</span>
                        <span>Nộp {formatDate(attempt.submitted_at)}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-1.5 rounded-full ${attempt.percent >= 70 ? "bg-emerald-500" : attempt.percent >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${attempt.percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${grade.color}`}>
                        {grade.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => openDetail(attempt)}
                        className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline"
                      >
                        Xem chi tiết <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}

// ─── ════════════════════════════════════════════════════════════════════════ ──
//     TEACHER COMPONENTS (giữ nguyên)
// ─── ════════════════════════════════════════════════════════════════════════ ──

function EditQuestionDialog({
  question, open, onOpenChange, onSave,
}: {
  question: QuestionItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (q: QuestionItem) => void;
}) {
  const [form, setForm] = useState<QuestionItem | null>(null);

  useEffect(() => {
    if (question) setForm({ ...question, options: question.options ? [...question.options] : ["", "", "", ""] });
  }, [question]);

  if (!form) return null;
  const isMcq = form.question_type === "mcq";

  function updateOption(i: number, val: string) {
    setForm(f => {
      if (!f) return f;
      const opts = [...(f.options || ["", "", "", ""])];
      opts[i] = val;
      return { ...f, options: opts };
    });
  }

  function handleSave() {
    if (!form.question_text.trim()) { toast.error("Vui lòng nhập nội dung câu hỏi"); return; }
    if (!form.correct_answer.trim()) { toast.error("Vui lòng nhập đáp án đúng"); return; }
    onSave(form);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-4 w-4 text-violet-600" />
            {form.id.startsWith("new_") ? "Thêm câu hỏi mới" : `Chỉnh sửa câu ${form.order_no}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nội dung câu hỏi</Label>
            <textarea className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              rows={3} value={form.question_text}
              onChange={e => setForm({ ...form, question_text: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Loại câu hỏi</Label>
              <Select value={form.question_type} onValueChange={v => setForm({ ...form, question_type: v as "mcq" | "true_false" })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Trắc nghiệm</SelectItem>
                  <SelectItem value="true_false">Đúng / Sai</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Điểm câu này</Label>
              <Input type="number" min={0} max={100} value={form.points ?? 1}
                onChange={e => setForm({ ...form, points: Number(e.target.value) })} className="rounded-xl" />
            </div>
          </div>
          {isMcq && (
            <div className="space-y-2">
              <Label>Các đáp án (A, B, C, D)</Label>
              <div className="space-y-2">
                {(form.options || ["", "", "", ""]).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 text-center text-sm font-semibold text-gray-500">{String.fromCharCode(65 + i)}</span>
                    <Input value={opt} onChange={e => updateOption(i, e.target.value)}
                      className="rounded-xl" placeholder={`Đáp án ${String.fromCharCode(65 + i)}`} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>{isMcq ? "Đáp án đúng (A/B/C/D)" : "Đáp án đúng (Đúng/Sai)"}</Label>
            {isMcq ? (
              <Select value={form.correct_answer} onValueChange={v => setForm({ ...form, correct_answer: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{["A","B","C","D"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Select value={form.correct_answer} onValueChange={v => setForm({ ...form, correct_answer: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Đúng">Đúng</SelectItem>
                  <SelectItem value="Sai">Sai</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Giải thích (tuỳ chọn)</Label>
            <textarea className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              rows={2} value={form.explanation || ""}
              onChange={e => setForm({ ...form, explanation: e.target.value })}
              placeholder="Giải thích đáp án cho học sinh..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Hủy</Button>
          <Button type="button" onClick={handleSave} className="rounded-xl">
            <Save className="mr-2 h-4 w-4" />Lưu thay đổi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignQuizDialog({
  open, onOpenChange, moduleId, questionBankId, questions, onSuccess,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  moduleId: string; questionBankId: string;
  questions: QuestionItem[]; onSuccess: () => void;
}) {
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [timeLimit, setTimeLimit] = useState("30");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const totalPoints = useMemo(() => questions.reduce((s, q) => s + (q.points ?? 1), 0), [questions]);

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    apiCall("/students")
      .then(d => setStudents(d.students || []))
      .catch(() => toast.error("Không thể tải danh sách học sinh"))
      .finally(() => setFetching(false));
  }, [open]);

  async function handleAssign() {
    if (!title.trim()) { toast.error("Vui lòng nhập tên bài thi"); return; }
    if (!selectedIds.length) { toast.error("Vui lòng chọn ít nhất 1 học sinh"); return; }
    setLoading(true);
    try {
      await apiCall("/quiz-assignments", {
        method: "POST",
        body: JSON.stringify({ moduleId, questionBankId, title, assignedStudentIds: selectedIds, deadline: deadline || null, timeLimitMinutes: Number(timeLimit) || null, totalPoints }),
      });
      toast.success("Đã giao bài thi!");
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || "Không thể giao bài thi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-violet-600" />Giao bài thi cho học sinh
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-sm text-violet-800">
            <b>{questions.length} câu hỏi</b> — Tổng điểm: <b>{totalPoints} điểm</b>
          </div>
          <div className="space-y-2">
            <Label>Tên bài thi *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl" placeholder="VD: Kiểm tra 15 phút – Chương 1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Hạn nộp</Label>
              <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Thời gian làm (phút)</Label>
              <Select value={timeLimit} onValueChange={setTimeLimit}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["10","15","20","30","45","60","90","120"].map(v => <SelectItem key={v} value={v}>{v} phút</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Chọn học sinh *</Label>
            {fetching ? <p className="text-sm text-gray-500">Đang tải...</p> : students.length === 0 ? (
              <p className="text-sm text-gray-500">Chưa có học sinh nào trong hệ thống</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2">
                <button type="button"
                  onClick={() => setSelectedIds(selectedIds.length === students.length ? [] : students.map(s => s.id))}
                  className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-violet-700 hover:bg-violet-50">
                  {selectedIds.length === students.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                </button>
                {students.map(s => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50">
                    <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => setSelectedIds(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])} className="h-4 w-4 accent-violet-600" />
                    <span className="text-sm text-gray-700">{s.full_name || s.id}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedIds.length > 0 && <p className="text-xs text-gray-500">Đã chọn {selectedIds.length} học sinh</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="rounded-xl">Hủy</Button>
          <Button type="button" onClick={handleAssign} disabled={loading} className="rounded-xl">
            <Send className="mr-2 h-4 w-4" />{loading ? "Đang giao..." : "Giao bài thi"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuestionCard({ q, index, onEdit, onDelete }: {
  q: QuestionItem; index: number;
  onEdit: (q: QuestionItem) => void; onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const opts = q.options || [];
  const letters = ["A", "B", "C", "D", "E"];

  return (
    <Card className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <CardContent className="p-0">
        <div className="flex cursor-pointer items-start gap-3 p-4" onClick={() => setExpanded(v => !v)}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{index + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-6">{q.question_text}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full text-xs">{q.question_type === "mcq" ? "Trắc nghiệm" : "Đúng/Sai"}</Badge>
              {q.bloom_level && <Badge variant="outline" className="rounded-full text-xs text-blue-700 border-blue-200 bg-blue-50">{q.bloom_level}</Badge>}
              <Badge variant="outline" className="rounded-full text-xs text-emerald-700 border-emerald-200 bg-emerald-50">{q.points ?? 1} điểm</Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={e => { e.stopPropagation(); onEdit(q); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Edit2 className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={e => { e.stopPropagation(); onDelete(q.id); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </div>
        {expanded && (
          <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
            {q.question_type === "mcq" && opts.length > 0 && (
              <div className="space-y-2">
                {opts.map((opt, i) => {
                  const letter = letters[i];
                  const isCorrect = q.correct_answer === letter;
                  return (
                    <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${isCorrect ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-gray-100 bg-gray-50 text-gray-700"}`}>
                      <span className={`shrink-0 font-semibold ${isCorrect ? "text-emerald-700" : "text-gray-500"}`}>{letter}.</span>
                      <span>{opt}</span>
                      {isCorrect && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-600" />}
                    </div>
                  );
                })}
              </div>
            )}
            {q.question_type === "true_false" && (
              <div className="flex gap-2">
                {["Đúng", "Sai"].map(val => (
                  <div key={val} className={`rounded-xl border px-4 py-2 text-sm font-medium ${q.correct_answer === val ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-gray-100 bg-gray-50 text-gray-500"}`}>
                    {q.correct_answer === val && "✓ "}{val}
                  </div>
                ))}
              </div>
            )}
            {q.explanation && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Giải thích</p>
                <p className="text-sm text-amber-900">{q.explanation}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResultsTab({ moduleId }: { moduleId: string }) {
  const [assignments, setAssignments] = useState<QuizAssignment[]>([]);
  const [results, setResults] = useState<Record<string, AttemptResult[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiCall(`/quiz-assignments?moduleId=${moduleId}`)
      .then(d => setAssignments(d.assignments || []))
      .catch(() => toast.error("Không thể tải danh sách bài thi"))
      .finally(() => setLoading(false));
  }, [moduleId]);

  async function loadResults(assignmentId: string) {
    if (results[assignmentId]) { setExpanded(assignmentId); return; }
    try {
      const d = await apiCall(`/quiz-assignments/${assignmentId}/results`);
      setResults(prev => ({ ...prev, [assignmentId]: d.results || [] }));
      setExpanded(assignmentId);
    } catch (e: any) { toast.error(e.message || "Không thể tải kết quả"); }
  }

  if (loading) return <p className="text-sm text-gray-500">Đang tải...</p>;
  if (!assignments.length) return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <Trophy className="mx-auto h-10 w-10 text-gray-300 mb-3" />
      <p className="text-sm text-gray-500">Chưa có bài thi nào được giao</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {assignments.map(a => (
        <Card key={a.id} className="overflow-hidden rounded-2xl border border-gray-200">
          <CardContent className="p-0">
            <div className="flex cursor-pointer items-center justify-between gap-3 p-4 hover:bg-gray-50"
              onClick={() => expanded === a.id ? setExpanded(null) : loadResults(a.id)}>
              <div>
                <p className="font-semibold text-gray-900">{a.title}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{a.time_limit_minutes ? `${a.time_limit_minutes} phút` : "Không giới hạn"}</span>
                  <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />{a.total_points} điểm</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{a.assigned_student_ids?.length || 0} học sinh</span>
                  <span>Hạn: {formatDate(a.deadline)}</span>
                </div>
              </div>
              {expanded === a.id ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
            </div>
            {expanded === a.id && (
              <div className="border-t border-gray-100 p-4">
                {!(results[a.id] || []).length ? (
                  <p className="text-sm text-gray-500">Chưa có học sinh nào nộp bài</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="pb-2 font-semibold">Học sinh</th>
                        <th className="pb-2 font-semibold">Điểm</th>
                        <th className="pb-2 font-semibold">%</th>
                        <th className="pb-2 font-semibold">Nộp lúc</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {results[a.id].map(r => (
                          <tr key={r.student_id} className="hover:bg-gray-50">
                            <td className="py-2.5 font-medium text-gray-800">{r.student_name}</td>
                            <td className="py-2.5">{r.score}/{r.total_points}</td>
                            <td className="py-2.5"><span className={`font-semibold ${r.percent >= 80 ? "text-emerald-600" : r.percent >= 50 ? "text-amber-600" : "text-red-500"}`}>{r.percent}%</span></td>
                            <td className="py-2.5 text-gray-500">{formatDate(r.submitted_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuestionBankPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userProfile = getUserProfile();
  const isTeacher = userProfile?.role === "teacher";
  const rolePath = isTeacher ? "teacher" : "student";

  const [data, setData] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"questions" | "results">("questions");
  const [editQuestion, setEditQuestion] = useState<QuestionItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const fetchDetail = async () => {
    if (!id) return;
    try {
      const res = await apiCall(`/modules/${id}`);
      setData(res);
      // Chỉ load questions cho teacher
      if (userProfile?.role === "teacher") {
        const items: QuestionItem[] = (res.questionItems || []).map((q: any) => ({ ...q, points: q.points ?? 1 }));
        setQuestions(items);
      }
    } catch (err: any) {
      toast.error(err.message || "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [id]);

  function handleSaveQuestion(updated: QuestionItem) {
    setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
    setHasUnsaved(true);
    toast.success("Đã cập nhật câu hỏi");
  }

  function handleSaveNewQuestion(q: QuestionItem) {
    if (q.id.startsWith("new_")) setQuestions(prev => [...prev, q]);
    else setQuestions(prev => prev.map(x => x.id === q.id ? q : x));
    setHasUnsaved(true);
  }

  function handleDeleteQuestion(qid: string) {
    if (!confirm("Xóa câu hỏi này?")) return;
    setQuestions(prev => prev.filter(q => q.id !== qid).map((q, i) => ({ ...q, order_no: i + 1 })));
    setHasUnsaved(true);
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      await apiCall("/question-items/bulk-update", {
        method: "POST",
        body: JSON.stringify({ moduleId: id, questions }),
      });
      setHasUnsaved(false);
      toast.success("Đã lưu tất cả thay đổi!");
    } catch (e: any) {
      toast.error(e.message || "Không thể lưu thay đổi");
    } finally {
      setSaving(false);
    }
  }

  const questionBankId = data?.questionBank?.id || data?.questionItems?.[0]?.question_bank_id;
  const totalPoints = useMemo(() => questions.reduce((s, q) => s + (q.points ?? 1), 0), [questions]);

  if (loading) return <div className="text-gray-600">Đang tải...</div>;
  if (!data?.module) return <div className="text-gray-600">Không tìm thấy module.</div>;

  const { module } = data;

  // ── STUDENT VIEW ──────────────────────────────────────────────────────────
  if (!isTeacher) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Header */}
        <Button type="button" variant="outline" onClick={() => navigate(`/student/modules/${id}`)} className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" />Quay lại tổng quan
        </Button>

        {/* Banner */}
        <Card className="overflow-hidden rounded-3xl border-2 border-violet-500 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-violet-50 via-white to-blue-50 px-7 py-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full bg-white">
                  <Trophy className="mr-1 h-3 w-3" />Bài thi của tôi
                </Badge>
              </div>
              <h1 className="mt-4 text-2xl font-bold text-gray-950">{module.title}</h1>
              <p className="mt-1 text-sm text-gray-600">{module.subject} • Lớp {module.grade} • {module.lesson_title}</p>
            </div>
          </CardContent>
        </Card>

        {/* Student quiz list */}
        {id && <StudentQuizView moduleId={id} navigate={navigate} />}
      </div>
    );
  }

  // ── TEACHER VIEW ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <EditQuestionDialog
        question={editQuestion} open={editOpen} onOpenChange={setEditOpen}
        onSave={editQuestion?.id.startsWith("new_") ? handleSaveNewQuestion : handleSaveQuestion}
      />
      {questionBankId && id && (
        <AssignQuizDialog
          open={assignOpen} onOpenChange={setAssignOpen}
          moduleId={id} questionBankId={questionBankId}
          questions={questions} onSuccess={fetchDetail}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(`/teacher/modules/${id}`)} className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" />Quay lại tổng quan
        </Button>
        <div className="flex flex-wrap gap-2">
          {hasUnsaved && (
            <Button type="button" onClick={handleSaveAll} disabled={saving} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              <Save className="mr-2 h-4 w-4" />{saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          )}
          {questions.length > 0 && (
            <Button type="button" onClick={() => setAssignOpen(true)} className="rounded-xl">
              <Send className="mr-2 h-4 w-4" />Giao bài thi
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden rounded-3xl border-2 border-violet-500 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-violet-50 via-white to-blue-50 px-7 py-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full bg-white">
                <HelpCircle className="mr-1 h-3 w-3" />Ngân hàng câu hỏi
              </Badge>
              <Badge variant="outline" className="rounded-full bg-white">{questions.length} câu hỏi</Badge>
              <Badge variant="outline" className="rounded-full bg-white">{totalPoints} điểm tổng</Badge>
            </div>
            <h1 className="mt-4 text-3xl font-bold text-gray-950">{module.title}</h1>
            <p className="mt-2 text-sm text-gray-600">{module.subject} • Lớp {module.grade} • {module.lesson_title}</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1 w-fit">
        {(["questions", "results"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "questions" ? "Câu hỏi" : "Kết quả bài thi"}
          </button>
        ))}
      </div>

      {tab === "questions" ? (
        <div className="space-y-3">
          {!questions.length ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <Sparkles className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">Chưa có câu hỏi. Hãy quay lại tổng quan và bấm "Tạo câu hỏi".</p>
            </div>
          ) : (
            <>
              {hasUnsaved && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Bạn có thay đổi chưa được lưu. Hãy bấm <b>"Lưu thay đổi"</b>.
                </div>
              )}
              {questions.map((q, i) => (
                <QuestionCard key={q.id} q={q} index={i}
                  onEdit={q => { setEditQuestion(q); setEditOpen(true); }}
                  onDelete={handleDeleteQuestion} />
              ))}
            </>
          )}
          <button type="button"
            onClick={() => { setEditQuestion({ id: `new_${Date.now()}`, order_no: questions.length + 1, question_type: "mcq", question_text: "", options: ["","","",""], correct_answer: "A", explanation: "", bloom_level: null, points: 1 }); setEditOpen(true); }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50 py-4 text-sm font-medium text-violet-700 hover:border-violet-400 hover:bg-violet-100 transition">
            <Plus className="h-4 w-4" />Thêm câu hỏi mới
          </button>
        </div>
      ) : (
        id && <ResultsTab moduleId={id} />
      )}
    </div>
  );
}