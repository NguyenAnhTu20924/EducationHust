import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BookOpenCheck, Plus, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { apiCall, getUserProfile } from "../utils/api";
import { toast } from "sonner";

interface ModuleItem {
  id: string;
  title: string;
  subject: string;
  grade: string;
  book_set?: string | null;
  lesson_title: string;
  progress_stage: string;
  progress_percent: number;
  created_at: string;
}

const SUBJECT_OPTIONS = [
  "Toán Học",
  "Vật Lý",
  "Hóa Học",
  "Sinh Học",
  "Văn Học",
  "Tiếng Anh",
  "Lịch Sử",
  "Địa Lý",
  "Giáo Dục Công Dân",
];

const GRADE_OPTIONS = ["10", "11", "12"];

const stageLabel: Record<string, string> = {
  draft: "Chưa upload giáo án",
  lesson_plan_uploaded: "Đã upload giáo án",
  learning_path_generated: "Đã tạo lộ trình",
  mindmap_generated: "Đã tạo mindmap",
  question_bank_generated: "Đã tạo câu hỏi",
  completed: "Hoàn thành",
};

export default function Modules() {
  const userProfile = getUserProfile();
  const isTeacher = userProfile?.role === "teacher";
  const rolePath = isTeacher ? "teacher" : "student";

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [bookSet, setBookSet] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchModules();
  }, []);

  const filteredModules = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return modules;

    return modules.filter((item) =>
      [item.title, item.subject, item.grade, item.book_set, item.lesson_title]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [modules, search]);

  const fetchModules = async () => {
    try {
      const data = await apiCall("/modules");
      setModules(data.modules || []);
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải danh sách môn học");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setSubject("");
    setGrade("");
    setBookSet("");
    setLessonTitle("");
    setDescription("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject) {
      toast.error("Vui lòng chọn môn học");
      return;
    }

    if (!grade) {
      toast.error("Vui lòng chọn lớp");
      return;
    }

    try {
      await apiCall("/modules", {
        method: "POST",
        body: JSON.stringify({
          title,
          subject,
          grade,
          bookSet,
          lessonTitle,
          description,
        }),
      });

      toast.success("Đã tạo môn học");
      setOpen(false);
      resetForm();
      fetchModules();
    } catch (error: any) {
      toast.error(error.message || "Không thể tạo môn học");
    }
  };

  const renderProgressSteps = (percent: number) => {
    const steps = [
      { label: "Giáo án", value: 25 },
      { label: "Lộ trình", value: 50 },
      { label: "Mindmap", value: 75 },
      { label: "Câu hỏi", value: 100 },
    ];

    return (
      <div className="grid grid-cols-4 gap-2 pt-3">
        {steps.map((step) => {
          const active = percent >= step.value;

          return (
            <div key={step.label} className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  active ? "bg-violet-600" : "bg-gray-300"
                }`}
              />
              <span
                className={`text-xs ${
                  active ? "font-medium text-gray-900" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Môn học</h1>
          <p className="mt-1 text-gray-600">
            Quản lý giáo án, lộ trình, mindmap và câu hỏi theo từng bài học.
          </p>
        </div>

        {isTeacher && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Tạo môn học
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Tạo khối môn học mới</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tên hiển thị</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="VD: Lý 11 - Dao động điều hòa"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Môn</Label>
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn môn" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBJECT_OPTIONS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Lớp</Label>
                    <Select value={grade} onValueChange={setGrade}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn lớp" />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADE_OPTIONS.map((item) => (
                          <SelectItem key={item} value={item}>
                            Lớp {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Bộ sách</Label>
                  <Input
                    value={bookSet}
                    onChange={(e) => setBookSet(e.target.value)}
                    placeholder="VD: Kết nối tri thức"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tên bài học</Label>
                  <Input
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    placeholder="VD: Dao động điều hòa"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mô tả</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ghi chú ngắn cho bài học này"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Hủy
                  </Button>
                  <Button type="submit">Tạo</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Tìm theo môn, lớp, bài học..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-600">Đang tải...</div>
      ) : filteredModules.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpenCheck className="mx-auto mb-4 h-14 w-14 text-gray-400" />
            <h3 className="text-xl font-semibold">Chưa có môn học nào</h3>
            <p className="mt-2 text-gray-600">
              {isTeacher
                ? "Hãy tạo khối môn học đầu tiên để bắt đầu pipeline."
                : "Bạn chưa được giao môn học nào."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredModules.map((item) => (
            <Link key={item.id} to={`/${rolePath}/modules/${item.id}`}>
              <Card className="border border-gray-200 transition hover:border-violet-300 hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-xl font-semibold text-gray-900">
                        {item.title}
                      </h3>

                      <p className="mt-1 text-sm text-gray-600">
                        {item.subject} • Lớp {item.grade}
                        {item.book_set ? ` • ${item.book_set}` : ""}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Bài học: {item.lesson_title}
                      </p>
                    </div>

                    <div className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                      {stageLabel[item.progress_stage] || item.progress_stage}
                    </div>
                  </div>

                  <div className="mt-5 h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-violet-600"
                      style={{ width: `${item.progress_percent || 0}%` }}
                    />
                  </div>

                  {renderProgressSteps(item.progress_percent || 0)}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}