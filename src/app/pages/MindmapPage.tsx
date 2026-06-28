import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Network, RefreshCw, LayoutGrid } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { MindmapCanvas } from "../components/MindmapCanvas";
import { EmptyBox } from "../components/ModuleLearningViews";
import { apiCall, getUserProfile } from "../utils/api";
import { toast } from "sonner";

export default function MindmapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userProfile = getUserProfile();
  const isTeacher = userProfile?.role === "teacher";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [mindmapVersion, setMindmapVersion] = useState(0);

  const fetchDetail = async () => {
    if (!id) return;
    try {
      const res = await apiCall(`/modules/${id}`);
      setData(res);
    } catch (error: any) {
      toast.error(error.message || "Không thể tải mindmap");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [id]);

  const handleGenerate = async () => {
    if (!data?.lessonPlan?.id) {
      toast.error("Bạn cần upload giáo án trước");
      return;
    }
    try {
      setGenerating(true);
      toast.info("Đang tạo mindmap, vui lòng chờ...");
      await apiCall("/generate-mindmap", {
        method: "POST",
        body: JSON.stringify({ lessonPlanId: data.lessonPlan.id }),
      });
      toast.success("Đã tạo mindmap thành công!");
      await fetchDetail();
      setMindmapVersion(v => v + 1);
    } catch (error: any) {
      toast.error(error.message || "Không thể tạo mindmap");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveMindmapChanges = async (updatedData: any) => {
    try {
      await apiCall(`/mindmaps/${data.mindmap.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content_json: updatedData }),
      });
      toast.success("Đã lưu thay đổi!");
      await fetchDetail();
      setMindmapVersion(v => v + 1);
    } catch (error: any) {
      toast.error(error.message || "Không thể lưu");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Đang tải...
      </div>
    );
  }

  if (!data?.module) {
    return <div className="text-gray-600">Không tìm thấy module.</div>;
  }

  const { module, mindmap } = data;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-6 -my-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)} className="rounded-xl shrink-0">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Quay lại
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                <Network className="w-3.5 h-3.5 text-violet-700" />
              </div>
              <span className="font-bold text-gray-900 text-sm truncate">{module.title}</span>
              <Badge variant="outline" className="rounded-full text-xs shrink-0">
                {module.subject} • Lớp {module.grade}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 ml-8">{module.lesson_title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mindmap && (
            <Badge className="rounded-full bg-emerald-100 text-emerald-800 border-0 text-xs">
              Đã tạo
            </Badge>
          )}
          {isTeacher && (
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={generating || !data?.lessonPlan}
              className="rounded-xl"
            >
              {generating ? (
                <><RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />Đang tạo...</>
              ) : mindmap ? (
                <><RefreshCw className="mr-1.5 h-4 w-4" />Tạo lại</>
              ) : (
                <><LayoutGrid className="mr-1.5 h-4 w-4" />Tạo mindmap</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-hidden">
        {mindmap ? (
          <MindmapCanvas
            key={mindmapVersion}
            mindmapRaw={mindmap}
            onSaveChanges={isTeacher ? handleSaveMindmapChanges : undefined}
          />
        ) : (
          <div className="flex items-center justify-center h-full p-8">
            <EmptyBox>
              {isTeacher
                ? "Chưa có mindmap. Bấm \"Tạo mindmap\" ở trên để tạo sơ đồ tư duy từ giáo án."
                : "Giáo viên chưa tạo mindmap cho bài học này."}
            </EmptyBox>
          </div>
        )}
      </div>
    </div>
  );
}