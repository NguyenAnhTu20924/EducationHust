import { useEffect, useMemo, useRef, useState } from "react";
import { User, Mail, Shield, Pencil, Check, X, Camera, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { apiCall, getUserProfile, setUserProfile, API_BASE } from "../utils/api";
import { toast } from "sonner";

type LearningPath = { id: string };
type Mindmap = { id: string };
type QuestionBank = {
  id: string;
  questionCount?: number;
  question_count?: number;
  questions?: any[] | { questions?: any[] } | null;
};

function roleLabel(role?: string) {
  if (role === "teacher") return "Giáo viên";
  if (role === "student") return "Học sinh";
  return "Người dùng";
}

export default function StudentProfile() {
  const userProfile = getUserProfile();
  const role = userProfile?.role;

  const [loading, setLoading] = useState(true);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [mindmaps, setMindmaps] = useState<Mindmap[]>([]);
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(userProfile?.name || "");
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(userProfile?.name || "");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(userProfile?.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const [lpRes, mmRes, qbRes] = await Promise.all([
        apiCall("/learning-paths"),
        apiCall("/mindmaps"),
        apiCall("/question-banks"),
      ]);
      setLearningPaths(lpRes.learningPaths || []);
      setMindmaps(mmRes.mindmaps || []);
      setQuestionBanks(qbRes.questionBanks || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const totalQuestions = useMemo(() =>
    questionBanks.reduce((sum, bank) => {
      if (typeof bank.questionCount === "number") return sum + bank.questionCount;
      if (typeof bank.question_count === "number") return sum + bank.question_count;
      if (Array.isArray(bank.questions)) return sum + bank.questions.length;
      if (Array.isArray((bank.questions as any)?.questions)) return sum + (bank.questions as any).questions.length;
      return sum;
    }, 0),
  [questionBanks]);

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) { toast.error("Tên không được để trống"); return; }
    if (trimmed === displayName) { setEditing(false); return; }
    setSaving(true);
    try {
      const res = await apiCall("/profile", { method: "PUT", body: JSON.stringify({ name: trimmed }) });
      const newName = res.user?.name || trimmed;
      setDisplayName(newName);
      const current = getUserProfile();
      if (current) setUserProfile({ ...current, name: newName });
      toast.success("Đã cập nhật tên thành công");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Không thể cập nhật tên");
    } finally { setSaving(false); }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Ảnh tối đa 2MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Vui lòng chọn file ảnh"); return; }

    setUploadingAvatar(true);
    try {
      const token = localStorage.getItem("access_token");
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch(`${API_BASE}/profile/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload thất bại");

      setAvatarUrl(data.avatar_url);
      const current = getUserProfile();
      if (current) setUserProfile({ ...current, avatar_url: data.avatar_url });
      toast.success("Đã cập nhật ảnh đại diện");
    } catch (err: any) {
      toast.error(err.message || "Không thể upload ảnh");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const avatarGradient = role === "teacher" ? "from-violet-500 to-purple-600" : "from-blue-500 to-cyan-500";
  const roleBadge = role === "teacher"
    ? "bg-violet-100 text-violet-800"
    : role === "student"
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-700";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Thông Tin Cá Nhân</h1>
        <p className="text-gray-600 mt-1">Thông tin tài khoản và thống kê học tập của bạn</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Avatar */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center gap-5">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-28 h-28 rounded-full object-cover ring-4 ring-white shadow-lg" />
                ) : (
                  <div className={`w-28 h-28 bg-gradient-to-br ${avatarGradient} rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-lg`}>
                    {displayName?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingAvatar
                    ? <Loader2 className="w-7 h-7 text-white animate-spin" />
                    : <Camera className="w-7 h-7 text-white" />
                  }
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">{displayName}</h3>
                <span className={`inline-block mt-2 rounded-full px-3 py-0.5 text-xs font-semibold ${roleBadge}`}>
                  {roleLabel(role)}
                </span>
              </div>

              <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                {uploadingAvatar
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Đang tải lên...</>
                  : <><Camera className="w-4 h-4 mr-2" />Đổi ảnh đại diện</>
                }
              </Button>
              <p className="text-xs text-gray-400 -mt-2">JPG, PNG — tối đa 2MB</p>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Thông Tin Chi Tiết</CardTitle></CardHeader>
          <CardContent className="divide-y divide-gray-100">
            {/* Name */}
            <div className="flex items-start gap-4 py-5">
              <div className="p-2 rounded-lg bg-gray-50 shrink-0"><User className="w-4 h-4 text-gray-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1">Họ và tên</p>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") { setEditName(displayName); setEditing(false); }
                      }}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveName} disabled={saving} className="h-8 px-2 shrink-0">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditName(displayName); setEditing(false); }} disabled={saving} className="h-8 px-2 shrink-0">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{displayName || "Chưa cập nhật"}</p>
                    <button
                      type="button"
                      onClick={() => { setEditName(displayName); setEditing(true); }}
                      className="p-1 rounded-md text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-4 py-5">
              <div className="p-2 rounded-lg bg-gray-50 shrink-0"><Mail className="w-4 h-4 text-gray-500" /></div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Email</p>
                <p className="font-semibold text-gray-900">{userProfile?.email || "Chưa cập nhật"}</p>
              </div>
            </div>

            {/* Role */}
            <div className="flex items-center gap-4 py-5">
              <div className="p-2 rounded-lg bg-gray-50 shrink-0"><Shield className="w-4 h-4 text-gray-500" /></div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Vai trò</p>
                <p className="font-semibold text-gray-900">{roleLabel(role)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <Card>
        <CardHeader><CardTitle>Thống Kê Học Tập</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <StatItem label="Lộ trình hiện có" value={loading ? "..." : String(learningPaths.length)} color="text-purple-600" bg="bg-purple-50" />
            <StatItem label="Mindmaps hiện có" value={loading ? "..." : String(mindmaps.length)} color="text-pink-600" bg="bg-pink-50" />
            <StatItem label="Câu hỏi hiện có" value={loading ? "..." : String(totalQuestions)} color="text-emerald-600" bg="bg-emerald-50" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatItem({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`flex flex-col items-center justify-center py-8 rounded-2xl ${bg}`}>
      <p className={`text-4xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-600 mt-2 text-center">{label}</p>
    </div>
  );
}