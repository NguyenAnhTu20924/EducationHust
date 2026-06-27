import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, RefreshCw, ListChecks } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { LearningPathRoadmap, EmptyBox } from "../components/ModuleLearningViews";
import { SelfAssessmentChecklist } from "../components/SelfAssessmentChecklist";
import { apiCall, getUserProfile } from "../utils/api";
import { toast } from "sonner";

export default function LearningPathPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userProfile = getUserProfile();
  const isTeacher = userProfile?.role === "teacher";
  const userId = userProfile?.id;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiCall(`/modules/${id}`);
      setData(res);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Không thể tải lộ trình");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleGenerate = async () => {
    if (!data?.lessonPlan?.id) {
      toast.error("Bạn cần upload giáo án trước");
      return;
    }
    try {
      setGenerating(true);
      await apiCall("/generate-learning-path", {
        method: "POST",
        body: JSON.stringify({ lessonPlanId: data.lessonPlan.id }),
      });
      toast.success("Đã tạo lộ trình");
      await fetchDetail();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Không thể tạo lộ trình");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveNodeField = async (nodeId: string, field: string, value: string) => {
    try {
      await apiCall(`/learning-path-nodes/${nodeId}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      toast.success("Đã lưu!");
      await fetchDetail();
    } catch (error: any) {
      toast.error(error.message || "Không thể lưu");
    }
  };

  if (loading) return <div className="text-gray-600">Đang tải...</div>;
  if (!data?.module) return <div className="text-gray-600">Không tìm thấy module.</div>;

  const { module, learningPath, learningPathNodes, self_assessment_checklist } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(-1)} className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại tổng quan
        </Button>

        {isTeacher && (
          <Button type="button" onClick={handleGenerate} disabled={generating} className="rounded-xl">
            <RefreshCw className="mr-2 h-4 w-4" />
            {generating ? "Đang tạo..." : learningPath ? "Tạo lại lộ trình" : "Tạo lộ trình"}
          </Button>
        )}
      </div>

      {/* Số học sinh đã hoàn thành */}
      {module.totalStudentsDone !== undefined && (
        <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm">
          <b>Số học sinh đã hoàn thành checklist:</b> {module.totalStudentsDone}
        </div>
      )}

      {/* Learning Path Roadmap */}
      {learningPath ? (
        <LearningPathRoadmap
          learningPath={learningPath}
          learningPathNodes={learningPathNodes || []}
          isTeacher={isTeacher}
          onSaveNodeField={handleSaveNodeField}
        />
      ) : (
        <EmptyBox>Chưa có lộ trình học tập. Giáo viên hãy bấm "Tạo lộ trình".</EmptyBox>
      )}

      {/* Self-Assessment Checklist (chỉ học sinh) */}
      {!isTeacher && userId && module.self_assessment_checklist?.length > 0 && (
        <SelfAssessmentChecklist
          checklist={module.self_assessment_checklist}
          moduleId={module.id}
          studentId={userId}
          onUpdate={() => fetchDetail()}
        />
      )}
    </div>
  );
}