import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2,
  FileText, HelpCircle, ListChecks, Network,
  Send, Sparkles, Trash2, Trophy, Upload,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { apiCall, getUserProfile, supabase } from "../utils/api";
import { toast } from "sonner";

const LESSON_PLAN_BUCKET = "make-f5d1386a-lesson-plans";
type ContentStatus = "locked" | "ready" | "created" | "loading";
type StudentOption = { id: string; full_name?: string | null; name?: string | null; role?: string | null };

function sanitizeFileName(name: string) {
  const lastDotIndex = name.lastIndexOf(".");
  const ext = lastDotIndex !== -1 ? name.slice(lastDotIndex).toLowerCase() : "";
  const base = lastDotIndex !== -1 ? name.slice(0, lastDotIndex) : name;
  const safeBase = base.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/_+/g,"_").replace(/^_+|_+$/g,"");
  return `${Date.now()}_${safeBase||"file"}${ext}`;
}

function formatDate(v?: string|null) {
  if(!v) return "Chưa có";
  try { return new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v)); } catch { return v; }
}

function StatusBadge({status}:{status:ContentStatus}) {
  const cfg:Record<ContentStatus,{label:string;cls:string}> = {
    locked:{label:"Chưa có",cls:"border-gray-200 bg-gray-100 text-gray-500"},
    ready:{label:"Sẵn sàng",cls:"border-blue-100 bg-blue-50 text-blue-700"},
    created:{label:"Đã có",cls:"border-emerald-100 bg-emerald-50 text-emerald-700"},
    loading:{label:"Đang tạo...",cls:"border-violet-100 bg-violet-50 text-violet-700"},
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg[status].cls}`}>{cfg[status].label}</span>;
}

// ─── Teacher ContentCard ───────────────────────────────────────────────────────
function ContentCard({icon,title,description,status,primaryLabel,secondaryLabel,onPrimary,onSecondary,disabled}:{
  icon:ReactNode;title:string;description:string;status:ContentStatus;
  primaryLabel:string;secondaryLabel?:string;onPrimary:()=>void;onSecondary?:()=>void;disabled?:boolean;
}) {
  return (
    <Card className="group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">{icon}</div>
          <StatusBadge status={status}/>
        </div>
        <div className="mt-5 flex-1">
          <h3 className="text-lg font-bold text-gray-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={onPrimary} disabled={disabled||status==="loading"} className="rounded-xl">{primaryLabel}</Button>
          {secondaryLabel&&onSecondary&&<Button type="button" variant="outline" onClick={onSecondary} className="rounded-xl">{secondaryLabel}</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Student NavCard ───────────────────────────────────────────────────────────
function StudentNavCard({icon,title,subtitle,description,status,available,onClick}:{
  icon:ReactNode;title:string;subtitle?:string;description:string;
  status:ContentStatus;available:boolean;onClick:()=>void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={!available}
      className={`group flex w-full flex-col rounded-2xl border-2 bg-white p-5 text-left transition
        ${available?"cursor-pointer border-gray-200 hover:border-violet-400 hover:shadow-lg hover:-translate-y-1":"cursor-not-allowed border-gray-100 opacity-40"}`}>
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition
          ${available?"bg-violet-50 text-violet-700 ring-violet-100 group-hover:bg-violet-100":"bg-gray-50 text-gray-400 ring-gray-100"}`}>
          {icon}
        </div>
        <StatusBadge status={status}/>
      </div>
      <div className="flex-1">
        <p className="font-bold text-gray-950 text-base">{title}</p>
        {subtitle&&<p className="mt-0.5 text-xs font-semibold text-violet-600">{subtitle}</p>}
        <p className="mt-2 text-sm text-gray-500 leading-5">{description}</p>
        {!available&&<p className="mt-2 text-xs text-gray-300">Giáo viên chưa chuẩn bị</p>}
      </div>
      {available&&(
        <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-violet-600 group-hover:text-violet-700">
          Mở <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"/>
        </div>
      )}
    </button>
  );
}

// ─── Generate Questions Dialog form ───────────────────────────────────────────
function GenerateQForm({onConfirm,onCancel,loading}:{
  onConfirm:(opts:{questionCount:number;difficulty:string;questionType:string})=>void;
  onCancel:()=>void;loading:boolean;
}) {
  const [questionCount,setCount]=useState("10");
  const [difficulty,setDiff]=useState("medium");
  const [questionType,setType]=useState("mcq");
  return (
    <div className="space-y-4 pt-1">
      <p className="text-sm text-gray-500">AI tự động tạo câu hỏi từ giáo án. Có thể chỉnh sửa lại sau.</p>
      <div className="space-y-2"><Label>Số câu hỏi</Label>
        <select value={questionCount} onChange={e=>setCount(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          {["5","10","15","20","30"].map(v=><option key={v} value={v}>{v} câu</option>)}
        </select>
      </div>
      <div className="space-y-2"><Label>Độ khó</Label>
        <select value={difficulty} onChange={e=>setDiff(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="easy">Dễ</option><option value="medium">Trung bình</option><option value="hard">Khó</option>
        </select>
      </div>
      <div className="space-y-2"><Label>Loại câu hỏi</Label>
        <select value={questionType} onChange={e=>setType(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="mcq">Trắc nghiệm 4 đáp án</option>
          <option value="true_false">Đúng / Sai</option>
          <option value="mixed">Kết hợp</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading} className="rounded-xl">Hủy</Button>
        <Button type="button" onClick={()=>onConfirm({questionCount:Number(questionCount),difficulty,questionType})} disabled={loading} className="rounded-xl">
          <Sparkles className="mr-2 h-4 w-4"/>{loading?"Đang tạo...":"Tạo câu hỏi"}
        </Button>
      </div>
    </div>
  );
}

// ─── Student View ─────────────────────────────────────────────────────────────
function StudentModuleView({data,id,navigate}:{data:any;id:string;navigate:(p:any)=>void}) {
  const {module,learningPath,mindmap,questionItems}=data;
  const hasLP=!!learningPath, hasMM=!!mindmap, hasQ=!!questionItems?.length;
  const qCount=questionItems?.length||0;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <Button type="button" variant="outline" onClick={()=>navigate("/student/modules")} className="rounded-xl">
        <ArrowLeft className="mr-2 h-4 w-4"/>Danh sách môn học
      </Button>

      {/* Header */}
      <Card className="overflow-hidden rounded-3xl border-0 shadow-lg">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-violet-600 to-blue-600 px-6 py-7 text-white">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-0.5 text-xs font-semibold">{module.subject}</span>
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-0.5 text-xs font-semibold">Lớp {module.grade}</span>
            </div>
            <h1 className="text-2xl font-black leading-tight">{module.title}</h1>
            <p className="mt-1.5 text-sm text-white/75">📖 {module.lesson_title}</p>
            <div className="mt-5">
              <div className="flex justify-between text-xs text-white/60 mb-1"><span>Tiến độ</span><span>{module.progress_percent||0}%</span></div>
              <div className="h-2 w-full rounded-full bg-white/20"><div className="h-2 rounded-full bg-white" style={{width:`${module.progress_percent||0}%`}}/></div>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 bg-white">
            {[{label:"Lộ trình",ok:hasLP},{label:"Mindmap",ok:hasMM},{label:"Bài thi",ok:hasQ,extra:hasQ?`${qCount} câu`:undefined}].map(s=>(
              <div key={s.label} className="flex flex-col items-center py-3.5">
                <span className={`text-sm font-black ${s.ok?"text-emerald-600":"text-gray-300"}`}>{s.extra||(s.ok?"✓":"—")}</span>
                <span className="text-xs text-gray-400 mt-0.5">{s.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 3 nav cards */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">Tài liệu học tập</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <StudentNavCard icon={<ListChecks className="h-6 w-6"/>} title="Lộ trình"
            subtitle={hasLP?"7 bước học":undefined}
            description="Đọc gì, làm gì và tự kiểm tra."
            status={hasLP?"created":"locked"} available={hasLP}
            onClick={()=>navigate(`/student/modules/${id}/learning-path`)}/>
          <StudentNavCard icon={<Network className="h-6 w-6"/>} title="Sơ đồ tư duy"
            subtitle={hasMM?"Tổng quan toàn bài":undefined}
            description="Ý chính và nhánh kiến thức quan trọng."
            status={hasMM?"created":"locked"} available={hasMM}
            onClick={()=>navigate(`/student/modules/${id}/mindmap`)}/>
          <StudentNavCard icon={<Trophy className="h-6 w-6"/>} title="Bài thi"
            subtitle={hasQ?`${qCount} câu`:undefined}
            description="Làm bài và xem lại kết quả đã nộp."
            status={hasQ?"created":"locked"} available={hasQ}
            onClick={()=>navigate(`/student/modules/${id}/question-bank`)}/>
        </div>
      </div>

      {/* Tip */}
      {(!hasLP&&!hasMM&&!hasQ)?(
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          ⏳ Giáo viên đang chuẩn bị nội dung. Hãy quay lại sau!
        </div>
      ):(
        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-800">
          💡 <b>Gợi ý:</b> Bắt đầu từ <b>Lộ trình</b> → <b>Sơ đồ tư duy</b> → rồi làm <b>Bài thi</b> để kiểm tra.
        </div>
      )}
    </div>
  );
}

// ─── Teacher View ─────────────────────────────────────────────────────────────
function TeacherModuleView({data,id,navigate}:{data:any;id:string;navigate:(p:any)=>void}) {
  const {module,lessonPlan,learningPath,mindmap,questionItems}=data;
  const [actionLoading,setAL]=useState("");
  const [uploadOpen,setUO]=useState(false);
  const [uploadFile,setUF]=useState<File|null>(null);
  const [uploading,setUpd]=useState(false);
  const [sendOpen,setSO]=useState(false);
  const [students,setStudents]=useState<StudentOption[]>([]);
  const [studentsLoading,setSL]=useState(false);
  const [selectedIds,setSelIds]=useState<string[]>([]);
  const [sending,setSending]=useState(false);
  const [genQOpen,setGQ]=useState(false);

  const stats=useMemo(()=>({
    createdCount:[lessonPlan,learningPath,mindmap,questionItems?.length].filter(Boolean).length,
    qCount:questionItems?.length||0,
  }),[lessonPlan,learningPath,mindmap,questionItems]);

  const lpStatus:ContentStatus=actionLoading==="learning-path"?"loading":learningPath?"created":lessonPlan?"ready":"locked";
  const mmStatus:ContentStatus=actionLoading==="mindmap"?"loading":mindmap?"created":lessonPlan?"ready":"locked";
  const qStatus:ContentStatus=actionLoading==="questions"?"loading":questionItems?.length?"created":lessonPlan?"ready":"locked";

  async function doUpload() {
    if(!uploadFile){toast.error("Chọn file trước");return;}
    setUpd(true);
    try {
      const sp=`${module.id}/${sanitizeFileName(uploadFile.name)}`;
      const{error:ue}=await supabase.storage.from(LESSON_PLAN_BUCKET).upload(sp,uploadFile,{contentType:uploadFile.type||"application/octet-stream",upsert:false});
      if(ue) throw new Error(ue.message);
      await apiCall("/lesson-plans",{method:"POST",body:JSON.stringify({moduleId:module.id,title:module.title,subject:module.subject,grade:module.grade,lessonTitle:module.lesson_title,bookSet:module.book_set,description:module.description,fileName:uploadFile.name,filePath:sp,extractedText:null})});
      toast.success("Đã upload giáo án"); setUF(null); setUO(false);
    } catch(e:any){toast.error(e.message);} finally{setUpd(false);}
  }

  async function doGenLP() {
    if(!lessonPlan?.id){toast.error("Upload giáo án trước");return;}
    setAL("learning-path");
    try{await apiCall("/generate-learning-path",{method:"POST",body:JSON.stringify({lessonPlanId:lessonPlan.id})});toast.success("Đã tạo lộ trình");}
    catch(e:any){toast.error(e.message);} finally{setAL("");}
  }

  async function doGenMM() {
    if(!lessonPlan?.id){toast.error("Upload giáo án trước");return;}
    setAL("mindmap");
    try{await apiCall("/generate-mindmap",{method:"POST",body:JSON.stringify({lessonPlanId:lessonPlan.id})});toast.success("Đã tạo mindmap");}
    catch(e:any){toast.error(e.message);} finally{setAL("");}
  }

  async function doGenQ(opts:{questionCount:number;difficulty:string;questionType:string}) {
    if(!lessonPlan?.id){toast.error("Upload giáo án trước");return;}
    setAL("questions"); setGQ(false);
    try{await apiCall("/generate-questions",{method:"POST",body:JSON.stringify({lessonPlanId:lessonPlan.id,...opts})});toast.success(`Đã tạo ${opts.questionCount} câu hỏi`);}
    catch(e:any){toast.error(e.message);} finally{setAL("");}
  }

  async function doDelete() {
    if(!confirm("Xóa môn học này?"))return;
    try{await apiCall(`/modules/${id}`,{method:"DELETE"});toast.success("Đã xóa");navigate("/teacher/modules");}
    catch(e:any){toast.error(e.message);}
  }

  async function openSend() {
    setSelIds((data.assignedStudents||[]).map((s:StudentOption)=>s.id).filter(Boolean));
    setSO(true); setSL(true);
    try{const r=await apiCall("/users");setStudents((r.users||[]).filter((u:StudentOption)=>u.role==="student"));}
    catch{toast.error("Không thể tải học sinh");} finally{setSL(false);}
  }

  async function doSend() {
    if(!selectedIds.length&&!confirm("Chưa chọn học sinh. Gỡ tất cả?"))return;
    setSending(true);
    try{await apiCall(`/modules/${id}/assign`,{method:"POST",body:JSON.stringify({studentIds:selectedIds})});toast.success(`Đã gửi cho ${selectedIds.length} học sinh`);setSO(false);}
    catch(e:any){toast.error(e.message);} finally{setSending(false);}
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUO}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload giáo án</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>File giáo án</Label>
              <Input type="file" accept=".pdf,.doc,.docx,.txt" onChange={e=>setUF(e.target.files?.[0]||null)}/>
              <p className="text-xs text-gray-500">PDF, DOC, DOCX, TXT.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={()=>setUO(false)} disabled={uploading}>Hủy</Button>
              <Button type="button" onClick={doUpload} disabled={uploading}><Upload className="mr-2 h-4 w-4"/>{uploading?"Đang upload...":"Upload"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={setSO}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Gửi môn học cho học sinh</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">Chọn học sinh nhận môn học <b>{module.title}</b>.</div>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
              <p className="text-sm font-semibold">Đã chọn {selectedIds.length}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={()=>setSelIds(students.map(s=>s.id))} disabled={!students.length}>Tất cả</Button>
                <Button type="button" variant="outline" size="sm" onClick={()=>setSelIds([])} disabled={!selectedIds.length}>Bỏ chọn</Button>
              </div>
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-gray-200 p-2">
              {studentsLoading?<p className="py-6 text-center text-sm text-gray-400">Đang tải...</p>:students.length===0?<p className="py-6 text-center text-sm text-gray-400">Chưa có học sinh.</p>:students.map(s=>{
                const checked=selectedIds.includes(s.id);
                return (
                  <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${checked?"border-violet-200 bg-violet-50":"border-gray-100 bg-white hover:bg-gray-50"}`}>
                    <input type="checkbox" checked={checked} onChange={e=>setSelIds(prev=>e.target.checked?[...new Set([...prev,s.id])]:prev.filter(x=>x!==s.id))} className="h-4 w-4 accent-violet-600"/>
                    <span className="text-sm font-medium text-gray-900">{s.full_name||s.name||s.id}</span>
                    {checked&&<Badge className="ml-auto rounded-full bg-violet-600 text-xs">Đã chọn</Badge>}
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={()=>setSO(false)} disabled={sending}>Hủy</Button>
              <Button type="button" onClick={doSend} disabled={sending}><Send className="mr-2 h-4 w-4"/>{sending?"Đang gửi...":"Gửi"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gen Q dialog */}
      <Dialog open={genQOpen} onOpenChange={setGQ}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-600"/>Tạo ngân hàng câu hỏi</DialogTitle></DialogHeader>
          <GenerateQForm onConfirm={doGenQ} onCancel={()=>setGQ(false)} loading={actionLoading==="questions"}/>
        </DialogContent>
      </Dialog>

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={()=>navigate(-1)} className="rounded-xl"><ArrowLeft className="mr-2 h-4 w-4"/>Quay lại</Button>
        <div className="flex gap-2">
          <Button type="button" onClick={openSend} className="rounded-xl"><Send className="mr-2 h-4 w-4"/>Gửi cho học sinh</Button>
          <Button type="button" variant="outline" onClick={doDelete} className="rounded-xl text-red-600 hover:text-red-700"><Trash2 className="mr-2 h-4 w-4"/>Xóa</Button>
        </div>
      </div>

      {/* Banner */}
      <Card className="overflow-hidden rounded-3xl border-2 border-violet-500 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-violet-50 via-white to-blue-50 px-7 py-7">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="outline" className="rounded-full bg-white">Tổng quan</Badge>
              <Badge variant="outline" className="rounded-full bg-white">{module.progress_percent||0}% hoàn thành</Badge>
            </div>
            <h1 className="text-3xl font-bold text-gray-950">{module.title}</h1>
            <p className="mt-1 text-sm text-gray-500">{module.subject} • Lớp {module.grade}{module.book_set?` • ${module.book_set}`:""}</p>
            <p className="text-sm text-gray-400">Bài học: {module.lesson_title}</p>
            <div className="mt-4 h-2 w-full max-w-md rounded-full bg-white ring-1 ring-gray-200">
              <div className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-violet-600" style={{width:`${module.progress_percent||0}%`}}/>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {[{label:"Nội dung đã có",value:`${stats.createdCount}/4`},{label:"Số câu hỏi",value:stats.qCount},{label:"Trạng thái",value:lessonPlan?"Đã có giáo án":"Chưa upload"}].map(m=>(
          <div key={m.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{m.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-950">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Lesson plan summary */}
      <Card className="rounded-3xl border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2"><FileText className="h-5 w-5 text-violet-600"/><h2 className="text-xl font-bold text-gray-950">Thông tin giáo án</h2></div>
              {lessonPlan?(
                <div className="grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                  <p><b>File:</b> {lessonPlan.file_name}</p><p><b>Trạng thái:</b> {lessonPlan.status||"Đã upload"}</p>
                  <p><b>Ngày upload:</b> {formatDate(lessonPlan.created_at)}</p><p><b>Nội dung trích xuất:</b> {lessonPlan.extracted_text?"Đã có":"Chưa có"}</p>
                </div>
              ):<p className="text-sm text-gray-500">Chưa có giáo án. Upload để bắt đầu tạo nội dung.</p>}
            </div>
            <Button type="button" onClick={()=>setUO(true)} className="rounded-xl shrink-0"><Upload className="mr-2 h-4 w-4"/>{lessonPlan?"Thay giáo án":"Upload giáo án"}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Content cards */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-gray-950">Nội dung học tập</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ContentCard icon={<FileText className="h-6 w-6"/>} title="Giáo án gốc" description="File giáo án, trạng thái xử lý và nội dung trích xuất."
            status={lessonPlan?"created":"ready"} primaryLabel={lessonPlan?"Xem giáo án":"Upload giáo án"} secondaryLabel={lessonPlan?"Thay file":undefined}
            onPrimary={()=>lessonPlan?navigate(`/teacher/modules/${id}/lesson-plan`):setUO(true)} onSecondary={()=>setUO(true)}/>
          <ContentCard icon={<ListChecks className="h-6 w-6"/>} title="Lộ trình học tập" description="Lộ trình 7 bước, mục tiêu từng bước và câu hỏi kiểm tra."
            status={lpStatus} primaryLabel={learningPath?"Xem lộ trình":"Tạo lộ trình"} secondaryLabel={learningPath?"Tạo lại":undefined}
            onPrimary={()=>learningPath?navigate(`/teacher/modules/${id}/learning-path`):doGenLP()} onSecondary={doGenLP} disabled={!lessonPlan||actionLoading==="learning-path"}/>
          <ContentCard icon={<Network className="h-6 w-6"/>} title="Sơ đồ tư duy" description="Mindmap tổng quan toàn bộ kiến thức của bài học."
            status={mmStatus} primaryLabel={mindmap?"Xem mindmap":"Tạo mindmap"} secondaryLabel={mindmap?"Tạo lại":undefined}
            onPrimary={()=>mindmap?navigate(`/teacher/modules/${id}/mindmap`):doGenMM()} onSecondary={doGenMM} disabled={!lessonPlan||actionLoading==="mindmap"}/>
          <ContentCard icon={<HelpCircle className="h-6 w-6"/>} title="Ngân hàng câu hỏi" description="Tạo, chỉnh sửa câu hỏi và giao bài thi cho học sinh."
            status={qStatus} primaryLabel={questionItems?.length?"Xem câu hỏi":"Tạo câu hỏi"} secondaryLabel={questionItems?.length?"Tạo lại":undefined}
            onPrimary={()=>questionItems?.length?navigate(`/teacher/modules/${id}/question-bank`):setGQ(true)} onSecondary={()=>setGQ(true)} disabled={!lessonPlan||actionLoading==="questions"}/>
        </div>
      </div>

      {/* Bottom hint */}
      {!lessonPlan?(
        <Card className="rounded-3xl border-dashed border-gray-300 bg-gray-50">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <BookOpen className="h-10 w-10 text-gray-400"/>
            <h3 className="mt-4 text-lg font-bold text-gray-900">Bước tiếp theo: upload giáo án</h3>
            <p className="mt-2 text-sm text-gray-500">Sau khi upload, hệ thống tạo được lộ trình, mindmap và câu hỏi.</p>
            <Button type="button" onClick={()=>setUO(true)} className="mt-4 rounded-xl"><Sparkles className="mr-2 h-4 w-4"/>Upload giáo án</Button>
          </CardContent>
        </Card>
      ):(
        <Card className="rounded-3xl border-emerald-100 bg-emerald-50">
          <CardContent className="flex items-start gap-3 p-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700 shrink-0"/>
            <p className="text-sm text-emerald-800"><b className="text-emerald-950">Module đã sẵn sàng.</b> Học sinh chỉ thấy lộ trình, mindmap và bài thi của mình — không thấy giáo án hay ngân hàng câu hỏi gốc.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ModuleDetail() {
  const {id}=useParams();
  const navigate=useNavigate();
  const userProfile=getUserProfile();
  const isTeacher=userProfile?.role==="teacher";
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!id) return;
    apiCall(`/modules/${id}`).then(r=>setData(r)).catch((e:any)=>toast.error(e.message||"Không thể tải")).finally(()=>setLoading(false));
  },[id]);

  if(loading) return <div className="flex items-center justify-center py-20 text-sm text-gray-400">Đang tải...</div>;
  if(!data?.module) return <div className="py-20 text-center text-gray-500">Không tìm thấy môn học.</div>;

  if(!isTeacher) return <StudentModuleView data={data} id={id!} navigate={navigate}/>;
  return <TeacherModuleView data={data} id={id!} navigate={navigate}/>;
}