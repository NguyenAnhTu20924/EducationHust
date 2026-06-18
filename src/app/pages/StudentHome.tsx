import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BookOpenCheck, Clock, CheckCircle2, Trophy, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { apiCall } from "../utils/api";

interface ModuleItem {
  id: string;
  title: string;
  subject: string;
  progress_percent: number;
}

interface QuizAssignment {
  id: string;
  title: string;
  deadline: string | null;
  time_limit_minutes: number | null;
  total_points: number;
  status: string;
  created_at: string;
}

function formatDate(v?: string | null) {
  if (!v) return null;
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

export default function StudentHome() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiCall("/modules").then((data) => setModules(data.modules || [])).catch(() => {}),
      apiCall("/quiz-assignments").then((data) => setQuizzes(data.assignments || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const completed = modules.filter((m) => m.progress_percent >= 100).length;
  const inProgress = modules.filter((m) => m.progress_percent > 0 && m.progress_percent < 100).length;

  const pendingQuizzes = quizzes.filter((q) => q.status === "active" && !isOverdue(q.deadline));
  const overdueQuizzes = quizzes.filter((q) => isOverdue(q.deadline));

  const bySubject = useMemo(() => {
    return modules.reduce<Record<string, number>>((acc, item) => {
      acc[item.subject || "Khác"] = (acc[item.subject || "Khác"] || 0) + 1;
      return acc;
    }, {});
  }, [modules]);
  const maxSubjectCount = Math.max(1, ...Object.values(bySubject));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Trang Chủ</h1>
        <p className="mt-1 text-gray-600">Tổng quan môn học và bài thi được giao</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard icon={<BookOpenCheck className="h-8 w-8 text-purple-600" />} title="Môn học được giao" value={loading ? "..." : String(modules.length)} bgColor="bg-purple-50" />
        <StatCard icon={<Clock className="h-8 w-8 text-blue-600" />} title="Đang học" value={loading ? "..." : String(inProgress)} bgColor="bg-blue-50" />
        <StatCard icon={<CheckCircle2 className="h-8 w-8 text-green-600" />} title="Hoàn thành" value={loading ? "..." : String(completed)} bgColor="bg-green-50" />
      </div>

      {/* Bài thi chờ làm */}
      {(pendingQuizzes.length > 0 || overdueQuizzes.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Bài thi được giao</h2>

          {overdueQuizzes.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Bạn có {overdueQuizzes.length} bài thi đã quá hạn
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {[...pendingQuizzes, ...overdueQuizzes].map((quiz) => {
              const overdue = isOverdue(quiz.deadline);
              return (
                <Card key={quiz.id} className={`overflow-hidden rounded-2xl border ${overdue ? "border-red-200" : "border-violet-200"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Trophy className={`h-4 w-4 shrink-0 ${overdue ? "text-red-400" : "text-violet-500"}`} />
                          <span className="font-semibold text-gray-900 text-sm">{quiz.title}</span>
                          {overdue && <Badge variant="outline" className="rounded-full text-xs border-red-200 text-red-600">Quá hạn</Badge>}
                        </div>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          <p>{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} phút` : "Không giới hạn thời gian"} • {quiz.total_points} điểm</p>
                          {quiz.deadline && <p>Hạn: {formatDate(quiz.deadline)}</p>}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={overdue ? "outline" : "default"}
                        onClick={() => navigate(`/student/quiz/${quiz.id}`)}
                        className="rounded-xl shrink-0"
                      >
                        {overdue ? "Làm trễ" : "Làm bài"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Môn học theo môn</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(bySubject).length === 0 ? (
            <p className="text-sm text-gray-500">Bạn chưa được giao môn học nào</p>
          ) : Object.entries(bySubject).map(([subject, count]) => (
            <div key={subject}>
              <div className="mb-1 flex justify-between text-sm"><span>{subject}</span><span>{count}</span></div>
              <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-purple-600" style={{ width: `${(count / maxSubjectCount) * 100}%` }} /></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, title, value, bgColor }: { icon: React.ReactNode; title: string; value: string; bgColor: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`rounded-lg p-3 ${bgColor}`}>{icon}</div>
          <div><p className="text-sm text-gray-600">{title}</p><p className="text-2xl font-bold text-gray-900">{value}</p></div>
        </div>
      </CardContent>
    </Card>
  );
}