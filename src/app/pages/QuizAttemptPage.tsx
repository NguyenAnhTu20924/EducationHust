import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { apiCall } from "../utils/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizQuestion {
  id: string;
  order_no: number;
  question_type: "mcq" | "true_false";
  question_text: string;
  options: string[] | null;
  points: number;
}

interface QuizAssignment {
  id: string;
  title: string;
  deadline: string | null;
  time_limit_minutes: number | null;
  total_points: number;
  questions: QuizQuestion[];
}

interface AttemptResult {
  score: number;
  total_points: number;
  percent: number;
  answers: {
    question_id: string;
    question_text: string;
    your_answer: string;
    correct_answer: string;
    is_correct: boolean;
    explanation: string | null;
    points: number;
    earned: number;
  }[];
}

// ─── Timer ────────────────────────────────────────────────────────────────────

function useCountdown(totalSeconds: number | null, onExpire: () => void) {
  const [remaining, setRemaining] = useState<number | null>(totalSeconds);
  const expired = useRef(false);

  useEffect(() => {
    if (totalSeconds === null) return;
    setRemaining(totalSeconds);
    expired.current = false;

    const tick = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(tick);
          if (!expired.current) { expired.current = true; onExpire(); }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [totalSeconds]);

  return remaining;
}

function TimerDisplay({ remaining }: { remaining: number | null }) {
  if (remaining === null) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isLow = remaining < 120;

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold tabular-nums ${
      isLow ? "border-red-200 bg-red-50 text-red-700 animate-pulse" : "border-gray-200 bg-white text-gray-700"
    }`}>
      <Clock className="h-4 w-4" />
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </div>
  );
}

// ─── Result Screen ────────────────────────────────────────────────────────────

function ResultScreen({ result, onBack }: { result: AttemptResult; onBack: () => void }) {
  const [showDetail, setShowDetail] = useState(false);
  const grade = result.percent >= 80 ? "Giỏi" : result.percent >= 65 ? "Khá" : result.percent >= 50 ? "Trung bình" : "Chưa đạt";
  const gradeColor = result.percent >= 80 ? "text-emerald-600" : result.percent >= 65 ? "text-blue-600" : result.percent >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card className="overflow-hidden rounded-3xl border-2 border-violet-500">
        <CardContent className="p-8 text-center">
          <Trophy className="mx-auto h-14 w-14 text-amber-400 mb-4" />
          <h1 className="text-3xl font-bold text-gray-950">Đã nộp bài!</h1>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="text-5xl font-black text-gray-950">{result.score}</span>
            <span className="text-2xl text-gray-400">/ {result.total_points}</span>
          </div>
          <div className="mt-2">
            <span className={`text-2xl font-bold ${gradeColor}`}>{result.percent}% — {grade}</span>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="text-2xl font-black text-emerald-700">{result.answers.filter((a) => a.is_correct).length}</div>
              <div className="text-emerald-600">Câu đúng</div>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 p-3">
              <div className="text-2xl font-black text-red-600">{result.answers.filter((a) => !a.is_correct).length}</div>
              <div className="text-red-500">Câu sai</div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="text-2xl font-black text-gray-700">{result.answers.length}</div>
              <div className="text-gray-500">Tổng câu</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack} className="rounded-xl flex-1">
          Về trang chủ
        </Button>
        <Button type="button" onClick={() => setShowDetail((v) => !v)} className="rounded-xl flex-1">
          {showDetail ? "Ẩn" : "Xem"} đáp án chi tiết
        </Button>
      </div>

      {showDetail && (
        <div className="space-y-3">
          {result.answers.map((a, i) => (
            <Card key={a.question_id} className={`overflow-hidden rounded-2xl border ${a.is_correct ? "border-emerald-200" : "border-red-200"}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {a.is_correct
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    : <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Câu {i + 1}: {a.question_text}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>
                        <span className="text-gray-500">Bạn chọn: </span>
                        <span className={a.is_correct ? "font-semibold text-emerald-700" : "font-semibold text-red-600"}>
                          {a.your_answer || "Chưa trả lời"}
                        </span>
                      </p>
                      {!a.is_correct && (
                        <p>
                          <span className="text-gray-500">Đáp án đúng: </span>
                          <span className="font-semibold text-emerald-700">{a.correct_answer}</span>
                        </p>
                      )}
                    </div>
                    {a.explanation && (
                      <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50 p-2 text-xs text-amber-800">
                        <b>Giải thích:</b> {a.explanation}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={`shrink-0 rounded-full ${a.is_correct ? "border-emerald-200 text-emerald-700" : "border-red-200 text-red-500"}`}>
                    {a.earned}/{a.points}đ
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuizAttemptPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<QuizAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [started, setStarted] = useState(false);
  const submitRef = useRef(false);

  useEffect(() => {
    if (!assignmentId) return;
    apiCall(`/quiz-assignments/${assignmentId}`)
      .then((d) => setQuiz(d.assignment))
      .catch((e: any) => toast.error(e.message || "Không thể tải bài thi"))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  async function handleSubmit(forced = false) {
    if (submitRef.current) return;
    if (!forced) {
      const unanswered = (quiz?.questions || []).filter((q) => !answers[q.id]).length;
      if (unanswered > 0 && !confirm(`Bạn còn ${unanswered} câu chưa trả lời. Nộp bài?`)) return;
    }
    submitRef.current = true;
    setSubmitting(true);
    try {
      const res = await apiCall(`/quiz-assignments/${assignmentId}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      setResult(res.result);
    } catch (e: any) {
      toast.error(e.message || "Không thể nộp bài");
      submitRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  const remaining = useCountdown(
    started && quiz?.time_limit_minutes ? quiz.time_limit_minutes * 60 : null,
    () => { toast.error("Hết giờ! Bài thi đã tự động nộp."); handleSubmit(true); }
  );

  if (loading) return <div className="text-gray-600">Đang tải bài thi...</div>;
  if (!quiz) return <div className="text-gray-600">Không tìm thấy bài thi.</div>;

  if (result) return <ResultScreen result={result} onBack={() => navigate(-1)} />;

  const questions = quiz.questions;
  const currentQ = questions[currentIdx];
  const answered = Object.keys(answers).length;
  const letters = ["A", "B", "C", "D", "E"];

  // Start screen
  if (!started) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <Card className="overflow-hidden rounded-3xl border-2 border-violet-500">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100">
              <Trophy className="h-8 w-8 text-violet-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-950">{quiz.title}</h1>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="font-bold text-gray-900">{questions.length}</div>
                <div className="text-gray-500">Câu hỏi</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="font-bold text-gray-900">{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} phút` : "Không giới hạn"}</div>
                <div className="text-gray-500">Thời gian</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="font-bold text-gray-900">{quiz.total_points}</div>
                <div className="text-gray-500">Tổng điểm</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="font-bold text-gray-900">{quiz.deadline ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(quiz.deadline)) : "Không"}</div>
                <div className="text-gray-500">Hạn nộp</div>
              </div>
            </div>
            {quiz.deadline && new Date(quiz.deadline) < new Date() && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Bài thi đã quá hạn. Bạn vẫn có thể làm nhưng kết quả sẽ được ghi nhận là nộp trễ.
              </div>
            )}
            <Button type="button" onClick={() => setStarted(true)} className="w-full rounded-xl">
              Bắt đầu làm bài
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-bold text-gray-900 text-lg leading-tight">{quiz.title}</h1>
          <p className="text-xs text-gray-500">{answered}/{questions.length} câu đã trả lời</p>
        </div>
        <div className="flex items-center gap-2">
          <TimerDisplay remaining={remaining} />
          <Button type="button" onClick={() => handleSubmit()} disabled={submitting} className="rounded-xl">
            <Send className="mr-2 h-4 w-4" />
            {submitting ? "Đang nộp..." : "Nộp bài"}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-300"
          style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }}
        />
      </div>

      {/* Question navigator */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setCurrentIdx(i)}
            className={`h-8 w-8 rounded-lg text-xs font-semibold transition ${
              i === currentIdx
                ? "bg-violet-600 text-white ring-2 ring-violet-600 ring-offset-1"
                : answers[q.id]
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Current question */}
      {currentQ && (
        <Card className="overflow-hidden rounded-3xl border-2 border-violet-200">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700">
                    {currentIdx + 1}
                  </span>
                  <Badge variant="outline" className="rounded-full text-xs">
                    {currentQ.points} điểm
                  </Badge>
                </div>
                <p className="text-base font-medium text-gray-900 leading-7">{currentQ.question_text}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {currentQ.question_type === "mcq" && (currentQ.options || []).map((opt, i) => {
                const letter = letters[i];
                const selected = answers[currentQ.id] === letter;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [currentQ.id]: letter }))}
                    className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm transition ${
                      selected
                        ? "border-violet-500 bg-violet-50 text-violet-900 font-medium"
                        : "border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50"
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      selected ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600"
                    }`}>
                      {letter}
                    </span>
                    <span>{opt}</span>
                    {selected && <CheckCircle2 className="ml-auto h-4 w-4 text-violet-600 shrink-0" />}
                  </button>
                );
              })}

              {currentQ.question_type === "true_false" && ["Đúng", "Sai"].map((val) => {
                const selected = answers[currentQ.id] === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))}
                    className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-sm font-medium transition ${
                      selected
                        ? "border-violet-500 bg-violet-50 text-violet-900"
                        : "border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50"
                    }`}
                  >
                    {selected && <CheckCircle2 className="h-4 w-4 text-violet-600" />}
                    {val}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="rounded-xl"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />Câu trước
        </Button>

        <span className="text-sm text-gray-500">{currentIdx + 1} / {questions.length}</span>

        <Button
          type="button"
          variant={currentIdx === questions.length - 1 ? "default" : "outline"}
          onClick={() => currentIdx === questions.length - 1 ? handleSubmit() : setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
          disabled={submitting}
          className="rounded-xl"
        >
          {currentIdx === questions.length - 1 ? (
            <><Send className="mr-1 h-4 w-4" />Nộp bài</>
          ) : (
            <>Câu tiếp<ChevronRight className="ml-1 h-4 w-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
}