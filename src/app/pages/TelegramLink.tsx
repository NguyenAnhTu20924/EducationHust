import { useEffect, useRef, useState } from "react";
import {
  Send, Link2, Unlink, ExternalLink, CheckCircle2,
  RefreshCw, Copy, Clock, ChevronRight, MessageSquare,
  Upload, Route, HelpCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { apiCall, getUserProfile } from "../utils/api";
import { toast } from "sonner";

interface LinkStatus {
  is_linked: boolean;
  telegram_user_id?: number;
  telegram_username?: string | null;
  telegram_first_name?: string | null;
  linked_at?: string | null;
}
interface LinkCode {
  link_code: string;
  expires_at: string;
  bot_link: string;
}

// ─── Feature cards by role ────────────────────────────────────────────────────
const TEACHER_FEATURES = [
  {
    icon: <Upload className="w-5 h-5" />,
    title: "Upload giáo án",
    cmd: "/upload",
    desc: "Gửi giáo án PDF trực tiếp qua Telegram. Bot sẽ hướng dẫn từng bước.",
    color: "bg-blue-50 border-blue-100 text-blue-800",
    iconColor: "bg-blue-100 text-blue-600",
  },
  {
    icon: <Route className="w-5 h-5" />,
    title: "Tạo lộ trình học",
    cmd: "/learningpath",
    desc: "Chọn giáo án đã upload, bot tự tạo lộ trình học tập chi tiết và gửi lại.",
    color: "bg-violet-50 border-violet-100 text-violet-800",
    iconColor: "bg-violet-100 text-violet-600",
  },
  {
    icon: <MessageSquare className="w-5 h-5" />,
    title: "Menu chính",
    cmd: "/menu",
    desc: "Xem toàn bộ chức năng và hướng dẫn sử dụng bot.",
    color: "bg-gray-50 border-gray-100 text-gray-700",
    iconColor: "bg-gray-100 text-gray-500",
  },
];
const STUDENT_FEATURES = [
  {
    icon: <MessageSquare className="w-5 h-5" />,
    title: "Menu chính",
    cmd: "/menu",
    desc: "Xem thông báo và hướng dẫn từ giáo viên.",
    color: "bg-gray-50 border-gray-100 text-gray-700",
    iconColor: "bg-gray-100 text-gray-500",
  },
];

// ─── Countdown timer ──────────────────────────────────────────────────────────
function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Hết hạn"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const expired = remaining === "Hết hạn";
  return (
    <span className={`font-mono font-semibold ${expired ? "text-red-600" : "text-emerald-700"}`}>
      {remaining}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TelegramLinkPage() {
  const userProfile = getUserProfile();
  const role = userProfile?.role;
  const features = role === "teacher" ? TEACHER_FEATURES : STUDENT_FEATURES;

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [polling, setPolling] = useState(false);

  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [linkData, setLinkData] = useState<LinkCode | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { fetchStatus(); return () => stopPoll(); }, []);

  const fetchStatus = async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const data = await apiCall("/api/telegram/link-status");
      setStatus(data);
      if (data.is_linked) { setLinkData(null); stopPoll(); }
    } catch (e: any) {
      if (!quiet) toast.error(e.message || "Không thể tải trạng thái");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  // Auto-poll after showing link code
  const startPoll = () => {
    if (pollRef.current) return;
    setPolling(true);
    pollRef.current = setInterval(async () => {
      const data = await apiCall("/api/telegram/link-status").catch(() => null);
      if (data?.is_linked) {
        setStatus(data);
        setLinkData(null);
        stopPoll();
        toast.success("Liên kết Telegram thành công! 🎉");
      }
    }, 3000);
  };
  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
  };

  const handleCreateCode = async () => {
    try {
      setCreating(true);
      const data = await apiCall("/api/telegram/create-link-code", { method: "POST" });
      setLinkData(data);
      startPoll();
    } catch (e: any) {
      toast.error(e.message || "Không thể tạo mã liên kết");
    } finally {
      setCreating(false);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm("Bạn có chắc muốn hủy liên kết Telegram không?")) return;
    try {
      setUnlinking(true);
      await apiCall("/api/telegram/unlink", { method: "POST" });
      setStatus({ is_linked: false });
      setLinkData(null);
      toast.success("Đã hủy liên kết Telegram");
    } catch (e: any) {
      toast.error(e.message || "Không thể hủy liên kết");
    } finally {
      setUnlinking(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Đã copy mã liên kết");
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-500">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
      Đang tải...
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#229ED9]/10 flex items-center justify-center shrink-0">
          <Send className="w-6 h-6 text-[#229ED9]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liên kết Telegram</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Kết nối tài khoản để dùng bot Telegram — upload giáo án, tạo lộ trình mà không cần mở web.
          </p>
        </div>
      </div>

      {/* Status card */}
      <Card className={status?.is_linked ? "border-emerald-200" : "border-gray-200"}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Trạng thái liên kết</CardTitle>
            <Badge className={status?.is_linked
              ? "bg-emerald-100 text-emerald-800 border-0"
              : "bg-gray-100 text-gray-600 border-0"}>
              {status?.is_linked ? "Đã liên kết" : "Chưa liên kết"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* ── LINKED ── */}
          {status?.is_linked ? (
            <>
              <div className="flex items-center gap-4 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                <div className="w-12 h-12 rounded-full bg-[#229ED9] flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {(status.telegram_first_name || "T").charAt(0).toUpperCase()}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{status.telegram_first_name || "Không rõ"}</p>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  {status.telegram_username && (
                    <p className="text-sm text-gray-500">@{status.telegram_username}</p>
                  )}
                  {status.linked_at && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Liên kết lúc {new Date(status.linked_at).toLocaleString("vi-VN")}
                    </p>
                  )}
                </div>
              </div>
              <Button type="button" variant="outline" onClick={handleUnlink} disabled={unlinking}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 w-full">
                <Unlink className="w-4 h-4 mr-2" />
                {unlinking ? "Đang hủy..." : "Hủy liên kết"}
              </Button>
            </>

          /* ── NOT LINKED, no code yet ── */
          ) : !linkData ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-600 leading-6">
                Bạn chưa liên kết Telegram. Bấm nút bên dưới để tạo mã liên kết, sau đó mở bot và bấm <b>Start</b>.
              </div>
              <Button type="button" onClick={handleCreateCode} disabled={creating} className="w-full">
                <Link2 className="w-4 h-4 mr-2" />
                {creating ? "Đang tạo mã..." : "Tạo liên kết Telegram"}
              </Button>
            </div>

          /* ── CODE READY ── */
          ) : (
            <div className="space-y-4">
              {/* Waiting indicator */}
              {polling && (
                <div className="flex items-center gap-2 text-sm text-violet-700 bg-violet-50 rounded-xl px-3 py-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Đang chờ bạn bấm Start trong bot...
                </div>
              )}

              {/* Code box */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">Mã liên kết của bạn</p>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-lg font-bold text-blue-800 tracking-widest bg-white px-3 py-1 rounded-lg border border-blue-200">
                        {linkData.link_code}
                      </code>
                      <button type="button" onClick={() => copyCode(linkData.link_code)}
                        className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500 transition-colors" title="Copy">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-blue-600 mb-1">Hết hạn sau</p>
                    <Countdown expiresAt={linkData.expires_at} />
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {[
                  "Bấm nút Mở bot Telegram bên dưới",
                  "Bấm nút START trong Telegram",
                  "Bot sẽ tự động liên kết tài khoản",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    {step}
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <a href={linkData.bot_link} target="_blank" rel="noreferrer" className="flex-1">
                  <Button type="button" className="w-full bg-[#229ED9] hover:bg-[#1a8bc4]">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Mở bot Telegram
                  </Button>
                </a>
                <Button type="button" variant="outline" onClick={handleCreateCode} disabled={creating} className="shrink-0">
                  <RefreshCw className={`w-4 h-4 mr-2 ${creating ? "animate-spin" : ""}`} />
                  Tạo lại mã
                </Button>
              </div>

              <Button type="button" variant="ghost" onClick={() => fetchStatus()} className="w-full text-gray-500">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Tôi đã bấm Start — kiểm tra lại
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Features guide */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-gray-400" />
            Bạn có thể làm gì qua bot?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {features.map((f, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-2xl border p-4 ${f.color}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${f.iconColor}`}>
                {f.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm">{f.title}</p>
                  <code className="font-mono text-xs bg-white/70 px-2 py-0.5 rounded-lg border border-current/20">
                    {f.cmd}
                  </code>
                </div>
                <p className="text-xs leading-5 opacity-80">{f.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 opacity-40 shrink-0 mt-2" />
            </div>
          ))}

          {role === "teacher" && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-800 leading-5">
              <p className="font-semibold mb-1">Hướng dẫn upload giáo án qua bot:</p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Gõ <code className="font-mono bg-white px-1 rounded">/upload</code></li>
                <li>Gửi: <code className="font-mono bg-white px-1 rounded">Tên | Môn | Lớp | Tên bài học</code></li>
                <li>Gửi file PDF giáo án</li>
                <li>Bot tự xử lý và lưu vào hệ thống</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}