import { useState } from "react";
import { Checkbox } from "../components/ui/checkbox";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { apiCall } from "../utils/api";

interface ChecklistItem {
  criteria: string;
  bloom_level: string;
  done: boolean;
}

interface Props {
  checklist: ChecklistItem[];
  moduleId: string;
  studentId: string;
  onUpdate?: () => void;
}

export function SelfAssessmentChecklist({ checklist, moduleId, studentId, onUpdate }: Props) {
  const [items, setItems] = useState(checklist);

  const toggleItem = (index: number) => {
    const newItems = [...items];
    newItems[index].done = !newItems[index].done;
    setItems(newItems);
  };

  const handleSave = async () => {
    try {
      await apiCall(`/modules/${moduleId}/self-assessment`, {
        method: "POST",
        body: JSON.stringify({ studentId, checklist: items }),
      });
      toast.success("Đã lưu checklist!");
      onUpdate?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lưu checklist thất bại");
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xl font-bold text-gray-950">Checklist tự đánh giá</h3>
      <p className="text-sm text-gray-600">
        Tích chọn những mục bạn đã hoàn thành trước khi vào lớp
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-3 rounded-xl border border-gray-200 p-4">
            <Checkbox checked={item.done} onCheckedChange={() => toggleItem(index)} />
            <div>
              <p className="font-semibold text-gray-900">{item.criteria}</p>
              <p className="text-xs text-gray-500">Mức độ: {item.bloom_level}</p>
            </div>
          </div>
        ))}
      </div>
      <Button onClick={handleSave} className="mt-4 rounded-xl">
        Lưu checklist
      </Button>
    </div>
  );
}