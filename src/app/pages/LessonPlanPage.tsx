import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Download, Eye, FileText, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { EmptyBox } from "../components/ModuleLearningViews";
import { apiCall, getUserProfile, supabase } from "../utils/api";
import { toast } from "sonner";

const LESSON_PLAN_BUCKET = "make-f5d1386a-lesson-plans";

function sanitizeFileName(name: string) {
  const lastDotIndex = name.lastIndexOf(".");
  const ext = lastDotIndex !== -1 ? name.slice(lastDotIndex).toLowerCase() : "";
  const base = lastDotIndex !== -1 ? name.slice(0, lastDotIndex) : name;
  const safeBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${Date.now()}_${safeBase || "file"}${ext}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(value));
  } catch { return value; }
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-gray-950">{value || "Chưa có"}</p>
    </div>
  );
}

// Lấy signed URL trực tiếp từ Supabase Storage (client-side)
async function getSignedUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(LESSON_PLAN_BUCKET)
    .createSignedUrl(filePath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function isPdf(fileName?: string | null) {
  return fileName?.toLowerCase().endsWith(".pdf");
}

export default function LessonPlanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userProfile = getUserProfile();
  const isTeacher = userProfile?.role === "teacher";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  const fetchDetail = async () => {
    if (!id) return;
    try {
      const res = await apiCall(`/modules/${id}`);
      setData(res);
      // Lấy signed URL nếu có file_path
      if (res?.lessonPlan?.file_path) {
        setLoadingUrl(true);
        const url = await getSignedUrl(res.lessonPlan.file_path);
        setFileUrl(url);
        setLoadingUrl(false);
      }
    } catch (error: any) {
      toast.error(error.message || "Không thể tải giáo án");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [id]);

  const handleUploadLessonPlan = async () => {
    if (!uploadFile) { toast.error("Vui lòng chọn file giáo án"); return; }
    if (!data?.module) { toast.error("Không tìm thấy module"); return; }

    try {
      setUploading(true);
      const storagePath = `${data.module.id}/${sanitizeFileName(uploadFile.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(LESSON_PLAN_BUCKET)
        .upload(storagePath, uploadFile, {
          contentType: uploadFile.type || "application/octet-stream",
          upsert: false,
        });
      if (uploadError) throw new Error(uploadError.message);

      const module = data.module;
      await apiCall("/lesson-plans", {
        method: "POST",
        body: JSON.stringify({
          moduleId: module.id,
          title: module.title,
          subject: module.subject,
          grade: module.grade,
          lessonTitle: module.lesson_title,
          bookSet: module.book_set,
          description: module.description,
          fileName: uploadFile.name,
          filePath: storagePath,
          extractedText: null,
        }),
      });
      toast.success("Đã upload giáo án");
      setUploadFile(null);
      setUploadOpen(false);
      await fetchDetail();
    } catch (error: any) {
      toast.error(error.message || "Upload giáo án thất bại");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="text-gray-600">Đang tải...</div>;
  if (!data?.module) return <div className="text-gray-600">Không tìm thấy module.</div>;

  const { module, lessonPlan } = data;
  const pdf = isPdf(lessonPlan?.file_name);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload giáo án</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>File giáo án</Label>
              <Input type="file" accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              <p className="text-xs text-gray-500">Hỗ trợ PDF, DOC, DOCX, TXT.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>Hủy</Button>
              <Button type="button" onClick={handleUploadLessonPlan} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Đang upload..." : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(-1)} className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" />Quay lại tổng quan
        </Button>
        {isTeacher && (
          <Button type="button" onClick={() => setUploadOpen(true)} className="rounded-xl">
            <Upload className="mr-2 h-4 w-4" />
            {lessonPlan ? "Thay giáo án" : "Upload giáo án"}
          </Button>
        )}
      </div>

      {/* Banner */}
      <Card className="overflow-hidden rounded-3xl border-2 border-violet-500 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-violet-50 via-white to-blue-50 px-7 py-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full bg-white">
                <FileText className="mr-1 h-3 w-3" />Giáo án gốc
              </Badge>
              <Badge variant="outline" className="rounded-full bg-white">
                {lessonPlan ? "Đã upload" : "Chưa upload"}
              </Badge>
            </div>
            <h1 className="mt-4 text-3xl font-bold text-gray-950">{module.title}</h1>
            <p className="mt-2 text-sm text-gray-600">
              {module.subject} • Lớp {module.grade} • Bài học: {module.lesson_title}
            </p>
          </div>
        </CardContent>
      </Card>

      {lessonPlan ? (
        <div className="space-y-5">
          {/* Metadata */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoRow label="Tên file" value={lessonPlan.file_name} />
            <InfoRow label="Ngày upload" value={formatDate(lessonPlan.created_at)} />
            <InfoRow label="Trạng thái" value={lessonPlan.status || "Đã upload"} />
            <InfoRow label="Nội dung trích xuất" value={lessonPlan.extracted_text ? "Đã có" : "Chưa có"} />
          </div>

          {/* File viewer */}
          <Card className="rounded-3xl border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-gray-950">Xem giáo án</h2>
                  <p className="mt-1 text-sm text-gray-500">{lessonPlan.file_name}</p>
                </div>
                {fileUrl && (
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={lessonPlan.file_name}>
                    <Button type="button" variant="outline" className="rounded-xl">
                      <Download className="mr-2 h-4 w-4" />Tải về
                    </Button>
                  </a>
                )}
              </div>

              {loadingUrl ? (
                <div className="flex h-24 items-center justify-center text-sm text-gray-400">
                  Đang tải file...
                </div>
              ) : fileUrl ? (
                pdf ? (
                  // PDF: nhúng iframe xem trực tiếp
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50" style={{ height: "80vh" }}>
                    <iframe
                      src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                      className="h-full w-full"
                      title="Giáo án PDF"
                    />
                  </div>
                ) : (
                  // Không phải PDF: hiện link tải + extracted text
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 space-y-3">
                    <div className="flex items-center gap-2 text-amber-800">
                      <Eye className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        File {lessonPlan.file_name?.split(".").pop()?.toUpperCase()} không xem trực tiếp được trong trình duyệt.
                      </span>
                    </div>
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={lessonPlan.file_name}>
                      <Button type="button" className="rounded-xl">
                        <Download className="mr-2 h-4 w-4" />Tải về để xem
                      </Button>
                    </a>
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                  Không thể tải file. Vui lòng thử lại hoặc upload lại giáo án.
                </div>
              )}

              {/* Extracted text (nếu có) */}
              {lessonPlan.extracted_text && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Nội dung trích xuất</h3>
                  <div className="max-h-64 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-gray-700">
                      {lessonPlan.extracted_text}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyBox>
          Module này chưa có giáo án. Giáo viên hãy upload file giáo án trước, sau đó mới tạo lộ trình học tập, mindmap và ngân hàng câu hỏi.
        </EmptyBox>
      )}
    </div>
  );
}