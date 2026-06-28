import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import telegramApp from "./telegram.ts";
import { createClient } from "npm:@supabase/supabase-js";

const app = new Hono();

// Create Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const LESSON_PLAN_BUCKET = "make-f5d1386a-lesson-plans";
const AVATAR_BUCKET = "make-f5d1386a-avatars";

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-f5d1386a/health", (c) => {
  return c.json({ status: "ok" });
});

// Initialize storage bucket
async function initializeBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket) => bucket.name === LESSON_PLAN_BUCKET);

    if (!bucketExists) {
      await supabase.storage.createBucket(LESSON_PLAN_BUCKET, { public: false });
      console.log(`Created bucket: ${LESSON_PLAN_BUCKET}`);
    }

    const avatarExists = buckets?.some((b) => b.name === AVATAR_BUCKET);
    if (!avatarExists) {
      await supabase.storage.createBucket(AVATAR_BUCKET, { public: true });
      console.log(`Created bucket: ${AVATAR_BUCKET}`);
    }
  } catch (error) {
    console.error("Error initializing bucket:", error);
  }
}

// Call initialization
initializeBucket();

async function persistExtractedTextIfNeeded(
  lessonPlanId: string,
  currentExtractedText: string | null,
  extractedTextFromN8n: string | null | undefined,
) {
  const normalizedText =
    typeof extractedTextFromN8n === "string" ? extractedTextFromN8n.trim() : "";

  if (!normalizedText) return;

  // Đã có text rồi thì không ghi đè
  if (currentExtractedText && currentExtractedText.trim().length > 0) return;

  const { error } = await supabase
    .from("lesson_plans")
    .update({
      extracted_text: normalizedText,
      status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonPlanId);

  if (error) {
    console.error("Persist extracted_text error:", error);
    throw new Error(error.message);
  }
}

function formatLearningPathText(data: any): string {
  if (!data || typeof data !== "object") {
    return "📘 Lộ trình học tập\n\nChưa có dữ liệu.";
  }

  const lessonTitle = data.lesson_title || "Chưa có tên bài học";
  const subject = data.subject || "Chưa rõ môn";
  const grade = data.grade || "Chưa rõ lớp";

  const goals = Array.isArray(data.pre_class_goals) ? data.pre_class_goals : [];
  const prerequisites = Array.isArray(data.prerequisite_knowledge)
    ? data.prerequisite_knowledge
    : [];
  const steps = Array.isArray(data.learning_steps) ? data.learning_steps : [];
  const warmups = Array.isArray(data.warmup_questions) ? data.warmup_questions : [];
  const outputs = Array.isArray(data.expected_output) ? data.expected_output : [];

  return [
    `📘 Lộ trình học tập: ${lessonTitle}`,
    `🎓 Môn học: ${subject} | ${grade}`,
    "",
    "🎯 Mục tiêu chuẩn bị trước buổi học:",
    ...(goals.length ? goals.map((x: string) => `• ${x}`) : ["• Chưa có dữ liệu"]),
    "",
    "📚 Kiến thức nền cần ôn lại:",
    ...(prerequisites.length
      ? prerequisites.map((x: string) => `• ${x}`)
      : ["• Chưa có dữ liệu"]),
    "",
    "📝 Các bước học trước buổi học:",
    ...(steps.length
      ? steps.flatMap((step: any, index: number) => [
        `${index + 1}. ${step.title || "Chưa có tiêu đề"} (${step.estimated_minutes || "?"} phút)`,
        `   ${step.description || "Chưa có mô tả"}`,
      ])
      : ["• Chưa có dữ liệu"]),
    "",
    "❓ Câu hỏi khởi động:",
    ...(warmups.length ? warmups.map((x: string) => `• ${x}`) : ["• Chưa có dữ liệu"]),
    "",
    "✅ Kết quả mong đợi:",
    ...(outputs.length ? outputs.map((x: string) => `• ${x}`) : ["• Chưa có dữ liệu"]),
  ].join("\n");
}

async function createSignedLessonPlanUrl(filePath?: string | null) {
  if (!filePath) return null;

  const { data: signedData, error: signedError } = await supabase.storage
    .from(LESSON_PLAN_BUCKET)
    .createSignedUrl(filePath, 3600);

  if (signedError) {
    console.error("createSignedLessonPlanUrl error:", {
      filePath,
      message: signedError.message,
    });
    return null;
  }

  return signedData?.signedUrl || null;
}

// ===== AUTH ROUTES =====

// Sign up endpoint
app.post("/make-server-f5d1386a/signup", async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();

    if (!email || !password || !name || !role) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    if (!["teacher", "student"].includes(role)) {
      return c.json({ error: "Invalid role. Must be 'teacher' or 'student'" }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name: name,
        role,
      },
      email_confirm: true,
    });

    if (error) {
      console.error("Signup error:", error);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: data.user });
  } catch (error) {
    console.error("Signup exception:", error);
    return c.json({ error: "Internal server error during signup" }, 500);
  }
});

// Get user profile
app.get("/make-server-f5d1386a/profile", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) {
      return c.json({ error: "No authorization token" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      console.error("Auth error while getting profile:", authError);
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return c.json({ error: profileError.message }, 500);
    }

    if (!profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    return c.json({
      user: {
        id: profile.id,
        email: user.email,
        name: profile.full_name,
        role: profile.role,
        avatar_url: profile.avatar_url || null,
      },
    });
  } catch (error) {
    console.error("Profile fetch exception:", error);
    return c.json({ error: "Internal server error while fetching profile" }, 500);
  }
});



// ===== MODULE HELPERS =====

function calculateModuleProgress(snapshot: {
  hasLessonPlan: boolean;
  hasLearningPath: boolean;
  hasMindmap: boolean;
  hasQuestionBank: boolean;
}) {
  if (!snapshot.hasLessonPlan) return { stage: "draft", percent: 0 };
  if (snapshot.hasLessonPlan && !snapshot.hasLearningPath) return { stage: "lesson_plan_uploaded", percent: 25 };
  if (snapshot.hasLearningPath && !snapshot.hasMindmap) return { stage: "learning_path_generated", percent: 50 };
  if (snapshot.hasMindmap && !snapshot.hasQuestionBank) return { stage: "mindmap_generated", percent: 75 };
  if (snapshot.hasQuestionBank) return { stage: "question_bank_generated", percent: 100 };
  return { stage: "draft", percent: 0 };
}

async function updateModuleProgress(moduleId?: string | null) {
  if (!moduleId) return null;

  const [
    { data: lessonPlan },
    { data: learningPath },
    { data: mindmap },
    { data: questionBank },
  ] = await Promise.all([
    supabase.from("lesson_plans").select("id").eq("module_id", moduleId).limit(1).maybeSingle(),
    supabase.from("learning_paths").select("id").eq("module_id", moduleId).limit(1).maybeSingle(),
    supabase.from("mindmaps").select("id").eq("module_id", moduleId).limit(1).maybeSingle(),
    supabase.from("question_banks").select("id").eq("module_id", moduleId).limit(1).maybeSingle(),
  ]);

  const progress = calculateModuleProgress({
    hasLessonPlan: !!lessonPlan,
    hasLearningPath: !!learningPath,
    hasMindmap: !!mindmap,
    hasQuestionBank: !!questionBank,
  });

  const { error } = await supabase
    .from("subject_modules")
    .update({
      progress_stage: progress.stage,
      progress_percent: progress.percent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", moduleId);

  if (error) {
    console.error("updateModuleProgress error:", error);
    throw new Error(error.message);
  }

  return progress;
}

function normalizeUuidArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
}

// ===== MODULE ROUTES =====

app.post("/make-server-f5d1386a/modules", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);
    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (profileError || !profile) return c.json({ error: "Profile not found" }, 404);
    if (profile.role !== "teacher") return c.json({ error: "Only teachers can create modules" }, 403);
    const { title, subject, grade, bookSet, lessonTitle, description } = await c.req.json();
    if (!title || !subject || !grade || !lessonTitle) return c.json({ error: "Missing required fields" }, 400);
    const { data, error } = await supabase.from("subject_modules").insert({ teacher_id: user.id, title, subject, grade, book_set: bookSet || null, lesson_title: lessonTitle, description: description || null }).select("*").single();
    if (error || !data) return c.json({ error: error?.message || "Failed to create module" }, 500);
    return c.json({ module: data });
  } catch (error) {
    console.error("Create module error:", error);
    return c.json({ error: error instanceof Error ? error.message : "Failed to create module" }, 500);
  }
});

app.put("/make-server-f5d1386a/profile", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const newName = (body.name || "").trim();
    if (!newName) return c.json({ error: "Tên không được để trống" }, 400);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: newName })
      .eq("id", user.id);

    if (updateError) return c.json({ error: updateError.message }, 500);

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return c.json({ user: { id: profile.id, email: user.email, name: profile.full_name, role: profile.role } });
  } catch (error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get("/make-server-f5d1386a/users", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (myProfile?.role !== "teacher") return c.json({ error: "Only teachers can view users list" }, 403);

    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["student", "teacher"])
      .order("role", { ascending: false });

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ users: users || [] });
  } catch (error) {
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

app.post("/make-server-f5d1386a/profile/avatar", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const formData = await c.req.formData();
    const file = formData.get("avatar") as File | null;
    if (!file) return c.json({ error: "Không tìm thấy file ảnh" }, 400);

    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${user.id}/avatar.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, arrayBuffer, { contentType: file.type, upsert: true });

    if (uploadError) return c.json({ error: uploadError.message }, 500);

    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl + `?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);

    return c.json({ avatar_url: avatarUrl });
  } catch (error) {
    return c.json({ error: "Upload failed" }, 500);
  }
});

app.get("/make-server-f5d1386a/modules", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);
    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (profileError || !profile) return c.json({ error: "Profile not found" }, 404);
    if (profile.role === "teacher") {
      const { data, error } = await supabase.from("subject_modules").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false });
      if (error) return c.json({ error: error.message }, 500);
      return c.json({ modules: data || [] });
    }
    const { data, error } = await supabase.from("subject_modules").select("*").contains("assigned_student_ids", [user.id]).order("created_at", { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ modules: data || [] });
  } catch (error) {
    console.error("Fetch modules error:", error);
    return c.json({ error: error instanceof Error ? error.message : "Failed to fetch modules" }, 500);
  }
});

app.get("/make-server-f5d1386a/modules/:id", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);
    const moduleId = c.req.param("id");
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);
    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (profileError || !profile) return c.json({ error: "Profile not found" }, 404);
    const { data: moduleData, error: moduleError } = await supabase.from("subject_modules").select("*").eq("id", moduleId).maybeSingle();
    if (moduleError || !moduleData) return c.json({ error: "Module not found" }, 404);
    if (profile.role === "teacher" && moduleData.teacher_id !== user.id) return c.json({ error: "Forbidden" }, 403);
    if (profile.role === "student" && !(moduleData.assigned_student_ids || []).includes(user.id)) return c.json({ error: "Forbidden" }, 403);
    const [{ data: lessonPlan }, { data: learningPath }, { data: learningPathNodes }, { data: mindmap }, { data: questionBank }, { data: questionItems }] = await Promise.all([
      supabase.from("lesson_plans").select("*").eq("module_id", moduleId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("learning_paths").select("*").eq("module_id", moduleId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("learning_path_nodes").select("*").eq("module_id", moduleId).order("step_no"),
      supabase.from("mindmaps").select("*").eq("module_id", moduleId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("question_banks").select("*").eq("module_id", moduleId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("question_items").select("*").eq("module_id", moduleId).order("order_no"),
    ]);
    const assignedIds = normalizeUuidArray(moduleData.assigned_student_ids || []);
    let assignedStudents: any[] = [];
    // Thêm đoạn này sau khi lấy moduleData
    const { data: studentsDone } = await supabase
      .from("self_assessment_checklist")
      .select("student_id")
      .eq("module_id", moduleId)
      .neq("done", false);

    const totalStudentsDone = new Set(studentsDone?.map((s: any) => s.student_id)).size;
    if (assignedIds.length) {
      const { data } = await supabase.from("profiles").select("id, full_name, role").in("id", assignedIds);
      assignedStudents = data || [];
    }
    return c.json({ module: moduleData, lessonPlan: lessonPlan || null, learningPath: learningPath || null, learningPathNodes: learningPathNodes || [], mindmap: mindmap || null, questionBank: questionBank || null, questionItems: questionItems || [], assignedStudents, totalStudentsDone });
  } catch (error) {
    console.error("Fetch module detail error:", error);
    return c.json({ error: error instanceof Error ? error.message : "Failed to fetch module detail" }, 500);
  }
});

app.post("/make-server-f5d1386a/modules/:id/assign", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);
    const moduleId = c.req.param("id");
    const { studentIds } = await c.req.json();
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);
    const { data: moduleData, error: moduleError } = await supabase.from("subject_modules").select("*").eq("id", moduleId).eq("teacher_id", user.id).maybeSingle();
    if (moduleError || !moduleData) return c.json({ error: "Module not found" }, 404);
    const normalizedStudentIds = normalizeUuidArray(studentIds);
    if (normalizedStudentIds.length) {
      const { data: students, error: studentError } = await supabase.from("profiles").select("id").in("id", normalizedStudentIds).eq("role", "student");
      if (studentError) return c.json({ error: studentError.message }, 500);
      const validIds = (students || []).map((s: any) => s.id);
      const invalidIds = normalizedStudentIds.filter((id) => !validIds.includes(id));
      if (invalidIds.length) return c.json({ error: "Một số studentId không hợp lệ" }, 400);
    }
    const { error } = await supabase.from("subject_modules").update({ assigned_student_ids: normalizedStudentIds, updated_at: new Date().toISOString() }).eq("id", moduleId);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    console.error("Assign students to module error:", error);
    return c.json({ error: error instanceof Error ? error.message : "Failed to assign students" }, 500);
  }
});

app.post("/make-server-f5d1386a/modules/:id/recalculate-progress", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);
    const moduleId = c.req.param("id");
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);
    const { data: moduleData } = await supabase.from("subject_modules").select("*").eq("id", moduleId).eq("teacher_id", user.id).maybeSingle();
    if (!moduleData) return c.json({ error: "Module not found" }, 404);
    const progress = await updateModuleProgress(moduleId);
    return c.json({ success: true, progress });
  } catch (error) {
    console.error("Recalculate module progress error:", error);
    return c.json({ error: error instanceof Error ? error.message : "Failed to recalculate module progress" }, 500);
  }
});

app.delete("/make-server-f5d1386a/modules/:id", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);
    const moduleId = c.req.param("id");
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);
    const { data: moduleData, error: moduleError } = await supabase.from("subject_modules").select("*").eq("id", moduleId).eq("teacher_id", user.id).maybeSingle();
    if (moduleError || !moduleData) return c.json({ error: "Module not found" }, 404);
    const { data: lessonPlans } = await supabase.from("lesson_plans").select("id, file_path").eq("module_id", moduleId);
    const lessonPlanPaths = (lessonPlans || []).map((x: any) => x.file_path).filter(Boolean);
    const { data: mindmaps } = await supabase.from("mindmaps").select("id").eq("module_id", moduleId);
    const mindmapIds = (mindmaps || []).map((x: any) => x.id);
    const { data: learningPaths } = await supabase.from("learning_paths").select("id").eq("module_id", moduleId);
    const learningPathIds = (learningPaths || []).map((x: any) => x.id);
    const { data: questionBanks } = await supabase.from("question_banks").select("id").eq("module_id", moduleId);
    const questionBankIds = (questionBanks || []).map((x: any) => x.id);
    if (questionBankIds.length) { await supabase.from("question_items").delete().in("question_bank_id", questionBankIds); await supabase.from("question_bank_assignments").delete().in("question_bank_id", questionBankIds); }
    if (learningPathIds.length) { await supabase.from("learning_path_nodes").delete().in("learning_path_id", learningPathIds); await supabase.from("learning_path_assignments").delete().in("learning_path_id", learningPathIds); }
    if (mindmapIds.length) await supabase.from("mindmap_assignments").delete().in("mindmap_id", mindmapIds);
    await supabase.from("mindmaps").delete().eq("module_id", moduleId);
    await supabase.from("question_banks").delete().eq("module_id", moduleId);
    await supabase.from("learning_paths").delete().eq("module_id", moduleId);
    await supabase.from("lesson_plans").delete().eq("module_id", moduleId);
    if (lessonPlanPaths.length) await supabase.storage.from(LESSON_PLAN_BUCKET).remove(lessonPlanPaths);
    const { error: deleteModuleError } = await supabase.from("subject_modules").delete().eq("id", moduleId).eq("teacher_id", user.id);
    if (deleteModuleError) return c.json({ error: deleteModuleError.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    console.error("Delete module error:", error);
    return c.json({ error: error instanceof Error ? error.message : "Failed to delete module" }, 500);
  }
});

// POST /modules/:id/self-assessment
app.post("/make-server-f5d1386a/modules/:id/self-assessment", async (c) => {
  try {
    const moduleId = c.req.param("id");
    const { studentId, checklist } = await c.req.json();

    if (!moduleId || !studentId || !Array.isArray(checklist)) {
      return c.json({ error: "Missing required data" }, 400);
    }

    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId || userId !== studentId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { error } = await supabase
      .from("self_assessment_checklist")
      .upsert(
        checklist.map((item: any) => ({
          module_id: moduleId,
          student_id: studentId,
          criteria: item.criteria,
          bloom_level: item.bloom_level,
          done: item.done,
        })),
        { onConflict: ["module_id", "student_id", "criteria"] }
      );

    if (error) return c.json({ success: false, error: error.message }, 500);

    return c.json({ success: true });
  } catch (err: any) {
    console.error("Checklist error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ===== LESSON PLAN ROUTES =====

// Upload lesson plan
app.post("/make-server-f5d1386a/lesson-plans", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) {
      return c.json({ error: "No authorization token" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    if (profile.role !== "teacher") {
      return c.json({ error: "Only teachers can upload lesson plans" }, 403);
    }

    const {
      moduleId,
      title,
      subject,
      grade,
      lessonTitle,
      bookSet,
      description,
      fileName,
      filePath,
      extractedText,
    } = await c.req.json();

    if (!title || !subject || !grade || !fileName || !filePath) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const status = extractedText ? "ready" : "uploaded";

    const { data, error } = await supabase
      .from("lesson_plans")
      .insert({
        module_id: moduleId || null,
        teacher_id: user.id,
        title,
        subject,
        grade,
        lesson_title: lessonTitle || title,
        book_set: bookSet || null,
        description: description || null,
        file_name: fileName,
        file_path: filePath,
        extracted_text: extractedText || null,
        status,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Insert lesson plan error:", error);
      return c.json({ error: error.message }, 500);
    }

    if (moduleId) {
      await updateModuleProgress(moduleId);
    }

    return c.json({ lessonPlan: data });
  } catch (error) {
    console.error("Lesson plan upload error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to upload lesson plan" },
      500,
    );
  }
});

// Get teacher's lesson plans
app.get("/make-server-f5d1386a/lesson-plans", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) {
      return c.json({ error: "No authorization token" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase
      .from("lesson_plans")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch lesson plans error:", error);
      return c.json({ error: error.message }, 500);
    }

    const formatted = await Promise.all(
      (data || []).map(async (item: any) => {
        let signedUrl: string | null = null;

        try {
          if (item.file_path) {
            signedUrl = await createSignedLessonPlanUrl(item.file_path);
          }
        } catch (e) {
          console.error("Lesson plan signed URL failed:", item.id, item.file_path, e);
          signedUrl = null;
        }

        return {
          id: item.id,
          teacherId: item.teacher_id,
          title: item.title,
          subject: item.subject,
          grade: item.grade,
          lessonTitle: item.lesson_title,
          bookSet: item.book_set,
          description: item.description,
          fileName: item.file_name,
          filePath: item.file_path,
          fileUrl: signedUrl,
          content: item.extracted_text,
          status: item.status,
          createdAt: item.created_at,
        };
      }),
    );

    return c.json({ lessonPlans: formatted });
  } catch (error) {
    console.error("Fetch lesson plans error:", error);
    return c.json({ error: "Failed to fetch lesson plans" }, 500);
  }
});

// Delete lesson plan
app.delete("/make-server-f5d1386a/lesson-plans/:id", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);

    const lessonPlanId = c.req.param("id");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: lessonPlan, error: lessonPlanError } = await supabase
      .from("lesson_plans")
      .select("*")
      .eq("id", lessonPlanId)
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (lessonPlanError || !lessonPlan) {
      return c.json({ error: "Lesson plan not found" }, 404);
    }

    const moduleId = lessonPlan.module_id || null;

    // Xóa assignment + learning paths liên quan
    const { data: learningPaths } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("lesson_plan_id", lessonPlanId)
      .eq("teacher_id", user.id);

    const learningPathIds = (learningPaths || []).map((x: any) => x.id);
    if (learningPathIds.length) {
      await supabase.from("learning_path_assignments").delete().in("learning_path_id", learningPathIds);
      await supabase.from("learning_paths").delete().in("id", learningPathIds);
    }

    // Xóa assignment + question banks liên quan
    const { data: questionBanks } = await supabase
      .from("question_banks")
      .select("id")
      .eq("lesson_plan_id", lessonPlanId)
      .eq("teacher_id", user.id);

    const questionBankIds = (questionBanks || []).map((x: any) => x.id);
    if (questionBankIds.length) {
      await supabase.from("question_bank_assignments").delete().in("question_bank_id", questionBankIds);
      await supabase.from("question_banks").delete().in("id", questionBankIds);
    }

    // Xóa assignment + mindmaps liên quan
    const { data: mindmaps } = await supabase
      .from("mindmaps")
      .select("id")
      .eq("lesson_plan_id", lessonPlanId)
      .eq("creator_id", user.id);

    const mindmapIds = (mindmaps || []).map((x: any) => x.id);
    if (mindmapIds.length) {
      await supabase.from("mindmap_assignments").delete().in("mindmap_id", mindmapIds);
      await supabase.from("mindmaps").delete().in("id", mindmapIds);
    }

    // Xóa file storage
    if (lessonPlan.file_path) {
      await supabase.storage.from(LESSON_PLAN_BUCKET).remove([lessonPlan.file_path]);
    }

    const { error } = await supabase
      .from("lesson_plans")
      .delete()
      .eq("id", lessonPlanId)
      .eq("teacher_id", user.id);

    if (error) return c.json({ error: error.message }, 500);

    if (moduleId) {
      await updateModuleProgress(moduleId);
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to delete lesson plan" },
      500,
    );
  }
});

// ===== LEARNING PATH ROUTES =====

// Generate learning path (via n8n webhook)
app.post("/make-server-f5d1386a/generate-learning-path", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "No authorization token" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    if (profile.role !== "teacher") {
      return c.json({ error: "Only teachers can generate learning paths" }, 403);
    }

    const { lessonPlanId, studentId } = await c.req.json();

    if (!lessonPlanId) {
      return c.json({ error: "Missing lessonPlanId" }, 400);
    }

    const n8nWebhookUrl = Deno.env.get("N8N_LEARNING_PATH_WEBHOOK");

    if (!n8nWebhookUrl) {
      return c.json({ error: "Learning path webhook is not configured" }, 500);
    }

    const { data: lessonPlan, error: lessonPlanError } = await supabase
      .from("lesson_plans")
      .select("*")
      .eq("id", lessonPlanId)
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (lessonPlanError || !lessonPlan) {
      return c.json({ error: "Lesson plan not found" }, 404);
    }

    let signedFileUrl: string | null = null;

    if (lessonPlan.file_path) {
      signedFileUrl = await createSignedLessonPlanUrl(lessonPlan.file_path);
    }

    if (!lessonPlan.extracted_text && !signedFileUrl) {
      return c.json(
        { error: "Lesson plan has neither extracted text nor file URL" },
        400,
      );
    }

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonTitle: lessonPlan.lesson_title || lessonPlan.title,
        subject: lessonPlan.subject,
        grade: lessonPlan.grade,
        bookSet: lessonPlan.book_set || null,
        fileName: lessonPlan.file_name,
        filePath: lessonPlan.file_path,
        fileUrl: signedFileUrl,
        extractedText: lessonPlan.extracted_text || null,
      }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      throw new Error(`n8n webhook call failed: ${errorText}`);
    }

    const n8nRawResult = await n8nResponse.json();

    console.log(
      "N8N RAW RESULT:",
      JSON.stringify(n8nRawResult).slice(0, 3000),
    );

    const normalizedAiResult = Array.isArray(n8nRawResult)
      ? n8nRawResult[0] || {}
      : n8nRawResult;

    const extractedTextFromN8n =
      normalizedAiResult.extractedText ||
      normalizedAiResult.extracted_text ||
      normalizedAiResult.documentText ||
      null;

    await persistExtractedTextIfNeeded(
      lessonPlan.id,
      lessonPlan.extracted_text || null,
      extractedTextFromN8n,
    );

    let learningPath =
      normalizedAiResult.learningPath ||
      normalizedAiResult.learning_path ||
      normalizedAiResult.data?.learningPath ||
      normalizedAiResult.data?.learning_path ||
      normalizedAiResult;

    if (typeof learningPath === "string") {
      try {
        learningPath = JSON.parse(learningPath);
      } catch {
        throw new Error("learningPath từ n8n là string nhưng không parse được JSON.");
      }
    }

    if (!learningPath || typeof learningPath !== "object") {
      throw new Error("n8n không trả về learningPath hợp lệ");
    }

    if (!Array.isArray(learningPath.timeline_nodes)) {
      console.error("Invalid learningPath:", JSON.stringify(learningPath).slice(0, 2000));
      throw new Error("learningPath không có timeline_nodes");
    }

    if (learningPath.timeline_nodes.length !== 7) {
      throw new Error(
        `learningPath phải có đúng 7 bước, hiện có ${learningPath.timeline_nodes.length}`,
      );
    }

    const schemaVersion =
      learningPath.schema_version || "learning_path_v3_detailed";

    const finalPathText =
      normalizedAiResult.learningPathText ||
      normalizedAiResult.learning_path_text ||
      learningPath.overview ||
      `Lộ trình học tập: ${learningPath.lesson_title ||
      lessonPlan.lesson_title ||
      lessonPlan.title ||
      "Bài học"
      }`;

    // Xóa lộ trình cũ của lesson plan này để tránh frontend lấy nhầm bản v2 cũ
    const { data: oldLearningPaths } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("lesson_plan_id", lessonPlan.id)
      .eq("teacher_id", user.id);

    const oldLearningPathIds = (oldLearningPaths || []).map((x: any) => x.id);

    if (oldLearningPathIds.length) {
      await supabase
        .from("learning_path_nodes")
        .delete()
        .in("learning_path_id", oldLearningPathIds);

      await supabase
        .from("learning_path_assignments")
        .delete()
        .in("learning_path_id", oldLearningPathIds);

      await supabase
        .from("learning_paths")
        .delete()
        .in("id", oldLearningPathIds);
    }

    const { data: insertedLearningPath, error: insertError } = await supabase
      .from("learning_paths")
      .insert({
        module_id: lessonPlan.module_id || null,
        lesson_plan_id: lessonPlan.id,
        teacher_id: user.id,

        title:
          learningPath.title ||
          lessonPlan.title ||
          lessonPlan.lesson_title ||
          "Lộ trình học tập",

        overview: learningPath.overview || "",
        estimated_total_minutes: learningPath.estimated_total_minutes || 60,

        content_json: learningPath,
        content_text: finalPathText,

        source_schema_version: schemaVersion,
        status: "generated",
      })
      .select("*")
      .single();

    if (insertError || !insertedLearningPath) {
      console.error("Insert learning path error:", insertError);
      return c.json(
        { error: insertError?.message || "Failed to insert learning path" },
        500,
      );
    }

    const timelineNodes = learningPath.timeline_nodes;

    const rows = timelineNodes.map((node: any, index: number) => ({
      module_id: lessonPlan.module_id || null,
      learning_path_id: insertedLearningPath.id,

      step_no: node.step_no || index + 1,
      bloom_level: node.bloom_level || "Understand",

      title: node.title || `Bước ${index + 1}`,
      short_label: node.short_label || null,

      description: node.description || node.short_description || "",
      estimated_minutes: node.estimated_minutes || null,
      learning_goal: node.learning_goal || null,

      what_to_read: Array.isArray(node.what_to_read) ? node.what_to_read : [],
      what_to_do: Array.isArray(node.what_to_do) ? node.what_to_do : [],
      what_to_write: Array.isArray(node.what_to_write) ? node.what_to_write : [],
      guiding_questions: Array.isArray(node.guiding_questions)
        ? node.guiding_questions
        : [],

      key_content: Array.isArray(node.key_content) ? node.key_content : [],
      formulas: Array.isArray(node.formulas) ? node.formulas : [],

      practice_task:
        node.practice_task && typeof node.practice_task === "object"
          ? node.practice_task
          : {},

      common_mistakes: Array.isArray(node.common_mistakes)
        ? node.common_mistakes
        : [],

      expected_output: Array.isArray(node.expected_output)
        ? node.expected_output
        : node.expected_output
          ? [String(node.expected_output)]
          : [],

      checkpoint_question: node.checkpoint_question || null,
      mastery_check: node.mastery_check || null,
      support_tip: node.support_tip || null,
    }));

    const { error: nodeError } = await supabase
      .from("learning_path_nodes")
      .insert(rows);

    if (nodeError) {
      console.error("Insert learning_path_nodes error:", nodeError);
      return c.json({ error: nodeError.message }, 500);
    }

    if (lessonPlan.module_id) {
      await updateModuleProgress(lessonPlan.module_id);
    }

    if (studentId) {
      const { error: assignmentError } = await supabase
        .from("learning_path_assignments")
        .insert({
          learning_path_id: insertedLearningPath.id,
          teacher_id: user.id,
          student_id: studentId,
        });

      if (assignmentError) {
        console.error("Learning path assignment error:", assignmentError);
        return c.json({ error: assignmentError.message }, 500);
      }
    }

    return c.json({
      success: true,
      learningPath: insertedLearningPath,
      pathJson: learningPath,
      timelineNodes: rows,
      extractedText: extractedTextFromN8n || null,
    });
  } catch (error) {
    console.error("Generate learning path error:", error);

    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate learning path",
      },
      500,
    );
  }
});

// Get learning paths
app.get("/make-server-f5d1386a/learning-paths", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) {
      return c.json({ error: "No authorization token" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    if (profile.role === "teacher") {
      const { data, error } = await supabase
        .from("learning_paths")
        .select(`
          *,
          lesson_plans (
            subject,
            grade
          )
        `)
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch teacher learning paths error:", error);
        return c.json({ error: error.message }, 500);
      }

      const formatted = (data || []).map((item: any) => ({
        id: item.id,
        teacherId: item.teacher_id,
        studentId: null,
        lessonPlanId: item.lesson_plan_id,
        subject: item.lesson_plans?.subject || null,
        grade: item.lesson_plans?.grade || null,
        path: item.content_text || formatLearningPathText(item.content_json),
        pathText: item.content_text || formatLearningPathText(item.content_json),
        pathJson: item.content_json,
        createdAt: item.created_at,
      }));

      return c.json({ learningPaths: formatted });
    }

    const { data: assignments, error: assignmentError } = await supabase
      .from("learning_path_assignments")
      .select("learning_path_id")
      .eq("student_id", user.id);

    if (assignmentError) {
      console.error("Fetch learning path assignments error:", assignmentError);
      return c.json({ error: assignmentError.message }, 500);
    }

    const learningPathIds = (assignments || []).map((a) => a.learning_path_id);

    if (!learningPathIds.length) {
      return c.json({ learningPaths: [] });
    }

    const { data, error } = await supabase
      .from("learning_paths")
      .select(`
        *,
        lesson_plans (
          subject,
          grade
        )
      `)
      .in("id", learningPathIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch student learning paths error:", error);
      return c.json({ error: error.message }, 500);
    }

    const formatted = (data || []).map((item: any) => ({
      id: item.id,
      teacherId: item.teacher_id,
      studentId: user.id,
      lessonPlanId: item.lesson_plan_id,
      subject: item.lesson_plans?.subject || null,
      grade: item.lesson_plans?.grade || null,
      path: item.content_text || formatLearningPathText(item.content_json),
      pathText: item.content_text || formatLearningPathText(item.content_json),
      pathJson: item.content_json,
      createdAt: item.created_at,
    }));

    return c.json({ learningPaths: formatted });
  } catch (error) {
    console.error("Fetch learning paths error:", error);
    return c.json({ error: "Failed to fetch learning paths" }, 500);
  }
});

// Assign learning path to student after creation
app.post("/make-server-f5d1386a/learning-paths/:id/assign", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);

    const learningPathId = c.req.param("id");
    const { studentId } = await c.req.json();

    if (!studentId) {
      return c.json({ error: "Missing studentId" }, 400);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: learningPath, error: pathError } = await supabase
      .from("learning_paths")
      .select("*")
      .eq("id", learningPathId)
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (pathError || !learningPath) {
      return c.json({ error: "Learning path not found" }, 404);
    }

    const { data: student, error: studentError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", studentId)
      .eq("role", "student")
      .maybeSingle();

    if (studentError || !student) {
      return c.json({ error: "Student not found" }, 404);
    }

    const { data: existing } = await supabase
      .from("learning_path_assignments")
      .select("id")
      .eq("learning_path_id", learningPathId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await supabase
        .from("learning_path_assignments")
        .insert({
          learning_path_id: learningPathId,
          teacher_id: user.id,
          student_id: studentId,
        });

      if (insertError) return c.json({ error: insertError.message }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to assign learning path" },
      500,
    );
  }
});

// Delete learning path
app.delete("/make-server-f5d1386a/learning-paths/:id", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);

    const id = c.req.param("id");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    await supabase
      .from("learning_path_assignments")
      .delete()
      .eq("learning_path_id", id);

    const { error } = await supabase
      .from("learning_paths")
      .delete()
      .eq("id", id)
      .eq("teacher_id", user.id);

    if (error) return c.json({ error: error.message }, 500);

    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to delete learning path" },
      500,
    );
  }
});

// ===== MINDMAP ROUTES =====

// Generate mindmap
app.post("/make-server-f5d1386a/generate-mindmap", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) {
      return c.json({ error: "No authorization token" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    const { lessonPlanId, title, sourceText, studentId } = await c.req.json();

    const n8nWebhookUrl = Deno.env.get("N8N_MINDMAP_WEBHOOK");
    if (!n8nWebhookUrl) {
      return c.json({ error: "Mindmap webhook is not configured" }, 500);
    }

    let finalTitle = "";
    let finalSourceText: string | null = "";
    let finalSourceType: "lesson_plan" | "textbook_text";
    let finalLessonPlanId: string | null = null;
    let finalFileName: string | null = null;
    let finalFilePath: string | null = null;
    let finalFileUrl: string | null = null;
    let finalModuleId: string | null = null;

    if (lessonPlanId) {
      if (profile.role !== "teacher") {
        return c.json({ error: "Only teachers can create mindmaps from lesson plans" }, 403);
      }

      const { data: lessonPlan, error: lessonPlanError } = await supabase
        .from("lesson_plans")
        .select("*")
        .eq("id", lessonPlanId)
        .eq("teacher_id", user.id)
        .maybeSingle();

      if (lessonPlanError || !lessonPlan) {
        return c.json({ error: "Lesson plan not found" }, 404);
      }

      if (lessonPlan.file_path) {
        finalFileUrl = await createSignedLessonPlanUrl(lessonPlan.file_path);
      }

      finalTitle = lessonPlan.title || lessonPlan.lesson_title || "Mindmap";
      finalSourceText = lessonPlan.extracted_text || null;
      finalSourceType = "lesson_plan";
      finalLessonPlanId = lessonPlan.id;
      finalModuleId = lessonPlan.module_id || null;
      finalFileName = lessonPlan.file_name || null;
      finalFilePath = lessonPlan.file_path || null;

      if (!finalSourceText && !finalFileUrl) {
        return c.json(
          { error: "Lesson plan has neither extracted text nor file URL" },
          400,
        );
      }
    } else if (sourceText && title) {
      if (profile.role !== "student") {
        return c.json({ error: "Only students can create mindmaps from textbook text in this mode" }, 403);
      }

      finalTitle = title;
      finalSourceText = sourceText;
      finalSourceType = "textbook_text";
      finalLessonPlanId = null;
      finalModuleId = null;
      finalFileName = null;
      finalFilePath = null;
      finalFileUrl = null;
    } else {
      return c.json(
        {
          error: "You must provide either lessonPlanId or both title and sourceText",
        },
        400,
      );
    }

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: finalTitle,
        sourceType: finalSourceType,
        sourceText: finalSourceText,
        creatorRole: profile.role,
        fileName: finalFileName,
        filePath: finalFilePath,
        fileUrl: finalFileUrl,
      }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      throw new Error(`n8n webhook call failed: ${errorText}`);
    }

    const n8nText = await n8nResponse.text();

    console.log("N8N RAW TEXT:", n8nText.slice(0, 3000));

    if (!n8nText || !n8nText.trim()) {
      throw new Error("n8n trả về body rỗng. Hãy kiểm tra node Respond to Webhook trong n8n.");
    }

    let n8nRawResult: any;

    try {
      n8nRawResult = JSON.parse(n8nText);
    } catch (parseError) {
      console.error("N8N JSON parse error:", parseError);
      console.error("N8N response text:", n8nText.slice(0, 3000));
      throw new Error("n8n không trả về JSON hợp lệ. Hãy kiểm tra node Respond to Webhook.");
    }

    const normalizedAiResult = Array.isArray(n8nRawResult)
      ? n8nRawResult[0] || {}
      : n8nRawResult;

    if (finalLessonPlanId) {
      const extractedTextFromN8n =
        normalizedAiResult.extractedText ||
        normalizedAiResult.extracted_text ||
        normalizedAiResult.documentText ||
        null;

      await persistExtractedTextIfNeeded(
        finalLessonPlanId,
        finalSourceText || null,
        extractedTextFromN8n,
      );
    }

    const finalMindmap =
      normalizedAiResult.mindmap ||
      normalizedAiResult.mind_map ||
      normalizedAiResult;

    const finalMindmapText =
      normalizedAiResult.mindmapText ||
      normalizedAiResult.content_text ||
      (typeof finalMindmap === "string" ? finalMindmap : JSON.stringify(finalMindmap));

    const { data: insertedMindmap, error: insertError } = await supabase
      .from("mindmaps")
      .insert({
        module_id: finalModuleId,
        lesson_plan_id: finalLessonPlanId,
        creator_id: user.id,
        creator_role: profile.role,
        title: finalTitle,
        source_type: finalSourceType,
        source_text: finalSourceText,
        content_json: finalMindmap,
        content_text: finalMindmapText,
        chapter_structure: finalMindmap,
        status: "generated",
      })
      .select("*")
      .single();

    if (insertError) {
      return c.json({ error: insertError.message }, 500);
    }

    if (finalModuleId) {
      await updateModuleProgress(finalModuleId);
    }

    if (profile.role === "teacher" && studentId) {
      const { error: assignmentError } = await supabase
        .from("mindmap_assignments")
        .insert({
          mindmap_id: insertedMindmap.id,
          teacher_id: user.id,
          student_id: studentId,
        });

      if (assignmentError) {
        return c.json({ error: assignmentError.message }, 500);
      }
    }

    return c.json({ mindmap: insertedMindmap });
  } catch (error) {
    console.error("Generate mindmap error:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate mindmap",
      },
      500,
    );
  }
});

// Get user's mindmaps
app.get("/make-server-f5d1386a/mindmaps", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) {
      return c.json({ error: "No authorization token" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    if (profile.role === "teacher") {
      const { data, error } = await supabase
        .from("mindmaps")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return c.json({ error: error.message }, 500);
      }

      return c.json({ mindmaps: data || [] });
    }

    const { data: ownMindmaps, error: ownError } = await supabase
      .from("mindmaps")
      .select("*")
      .eq("creator_id", user.id);

    if (ownError) {
      return c.json({ error: ownError.message }, 500);
    }

    const { data: assignments, error: assignmentError } = await supabase
      .from("mindmap_assignments")
      .select("mindmap_id")
      .eq("student_id", user.id);

    if (assignmentError) {
      return c.json({ error: assignmentError.message }, 500);
    }

    const assignedIds = (assignments || []).map((a) => a.mindmap_id);

    let assignedMindmaps: any[] = [];
    if (assignedIds.length > 0) {
      const { data, error } = await supabase
        .from("mindmaps")
        .select("*")
        .in("id", assignedIds);

      if (error) {
        return c.json({ error: error.message }, 500);
      }

      assignedMindmaps = data || [];
    }

    const combined = [...(ownMindmaps || []), ...assignedMindmaps];
    const uniqueMindmaps = Array.from(
      new Map(combined.map((m) => [m.id, m])).values(),
    ).sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return c.json({ mindmaps: uniqueMindmaps });
  } catch (error) {
    console.error("Fetch mindmaps error:", error);
    return c.json({ error: "Failed to fetch mindmaps" }, 500);
  }
});

// Delete mindmap
app.delete("/make-server-f5d1386a/mindmaps/:id", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);

    const id = c.req.param("id");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) return c.json({ error: "Unauthorized" }, 401);

    await supabase
      .from("mindmap_assignments")
      .delete()
      .eq("mindmap_id", id);

    const { error } = await supabase
      .from("mindmaps")
      .delete()
      .eq("id", id)
      .eq("creator_id", user.id);

    if (error) return c.json({ error: error.message }, 500);

    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to delete mindmap" },
      500,
    );
  }
});

// ===== QUESTION BANK ROUTES =====

// Generate question bank
app.post("/make-server-f5d1386a/generate-questions", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    if (profile.role !== "teacher") {
      return c.json({ error: "Only teachers can generate questions" }, 403);
    }

    const { lessonPlanId, questionCount, difficulty, studentId } = await c.req.json();

    if (!lessonPlanId) {
      return c.json({ error: "Missing lessonPlanId" }, 400);
    }

    const n8nWebhookUrl = Deno.env.get("N8N_QUESTION_BANK_WEBHOOK");
    if (!n8nWebhookUrl) {
      return c.json({ error: "Question bank webhook is not configured" }, 500);
    }

    const { data: lessonPlan, error: lessonPlanError } = await supabase
      .from("lesson_plans")
      .select("*")
      .eq("id", lessonPlanId)
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (lessonPlanError || !lessonPlan) {
      return c.json({ error: "Lesson plan not found" }, 404);
    }

    let signedFileUrl: string | null = null;

    if (lessonPlan.file_path) {
      signedFileUrl = await createSignedLessonPlanUrl(lessonPlan.file_path);
    }

    if (!lessonPlan.extracted_text && !signedFileUrl) {
      return c.json(
        { error: "Lesson plan has neither extracted text nor file URL" },
        400,
      );
    }

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonTitle: lessonPlan.lesson_title || lessonPlan.title,
        subject: lessonPlan.subject,
        grade: lessonPlan.grade,
        fileName: lessonPlan.file_name,
        filePath: lessonPlan.file_path,
        fileUrl: signedFileUrl,
        extractedText: lessonPlan.extracted_text || null,
        questionCount: questionCount || 10,
        difficulty: difficulty || "medium",
      }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      throw new Error(`n8n webhook call failed: ${errorText}`);
    }

    const aiResult = await n8nResponse.json();
    const normalizedAiResult = Array.isArray(aiResult) ? (aiResult[0] || {}) : aiResult;

    const extractedTextFromN8n =
      normalizedAiResult.extractedText ||
      normalizedAiResult.extracted_text ||
      normalizedAiResult.documentText ||
      null;

    await persistExtractedTextIfNeeded(
      lessonPlan.id,
      lessonPlan.extracted_text || null,
      extractedTextFromN8n,
    );

    const finalQuestions =
      normalizedAiResult.questions ||
      normalizedAiResult.question_bank ||
      normalizedAiResult;

    const normalizedQuestionCount = Array.isArray(finalQuestions)
      ? finalQuestions.length
      : questionCount || 10;

    const { data: insertedQuestionBank, error: insertError } = await supabase
      .from("question_banks")
      .insert({
        module_id: lessonPlan.module_id || null,
        lesson_plan_id: lessonPlan.id,
        teacher_id: user.id,
        title: lessonPlan.title || lessonPlan.lesson_title,
        question_count: normalizedQuestionCount,
        difficulty: difficulty || "medium",
        content_json: finalQuestions,
        status: "generated",
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Insert question bank error:", insertError);
      return c.json({ error: insertError.message }, 500);
    }

    if (lessonPlan.module_id) {
      const { data: learningPathNodes } = await supabase.from("learning_path_nodes").select("*").eq("module_id", lessonPlan.module_id).order("step_no");
      if (Array.isArray(finalQuestions) && finalQuestions.length) {
        const rows = finalQuestions.map((q: any, index: number) => {
          const matchedNode = (learningPathNodes || []).find((node: any) => node.step_no === q.learning_path_node_step_no);
          return {
            module_id: lessonPlan.module_id,
            question_bank_id: insertedQuestionBank.id,
            learning_path_node_id: matchedNode?.id || null,
            bloom_level: q.bloom_level || null,
            question_type: q.question_type || q.type || "mcq",
            question_text: q.question_text || q.question || "",
            options: q.options || q.answers || null,
            correct_answer: q.correct_answer || q.correctAnswer || null,
            explanation: q.explanation || null,
            order_no: index + 1,
          };
        }).filter((row: any) => row.question_text);
        if (rows.length) {
          const { error: itemError } = await supabase.from("question_items").insert(rows);
          if (itemError) return c.json({ error: itemError.message }, 500);
        }
      }
      await updateModuleProgress(lessonPlan.module_id);
    }

    if (studentId) {
      const { error: assignmentError } = await supabase
        .from("question_bank_assignments")
        .insert({
          question_bank_id: insertedQuestionBank.id,
          teacher_id: user.id,
          student_id: studentId,
        });

      if (assignmentError) {
        console.error("Question bank assignment error:", assignmentError);
        return c.json({ error: assignmentError.message }, 500);
      }
    }

    return c.json({
      questionBank: {
        id: insertedQuestionBank.id,
        teacherId: insertedQuestionBank.teacher_id,
        lessonPlanId: insertedQuestionBank.lesson_plan_id,
        subject: lessonPlan.subject,
        grade: lessonPlan.grade,
        questions: finalQuestions,
        createdAt: insertedQuestionBank.created_at,
      },
    });
  } catch (error) {
    console.error("Generate questions error:", error);
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate questions",
      },
      500,
    );
  }
});

// Get question banks
app.get("/make-server-f5d1386a/question-banks", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "No authorization token" }, 401);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    if (profile.role === "teacher") {
      const { data, error } = await supabase
        .from("question_banks")
        .select(`
          *,
          lesson_plans (
            subject,
            grade
          )
        `)
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return c.json({ error: error.message }, 500);
      }

      const formatted = (data || []).map((item: any) => ({
        id: item.id,
        teacherId: item.teacher_id,
        lessonPlanId: item.lesson_plan_id,
        subject: item.lesson_plans?.subject || null,
        grade: item.lesson_plans?.grade || null,
        questions: item.content_json,
        createdAt: item.created_at,
      }));

      return c.json({ questionBanks: formatted });
    }

    const { data: assignments, error: assignmentError } = await supabase
      .from("question_bank_assignments")
      .select("question_bank_id")
      .eq("student_id", user.id);

    if (assignmentError) {
      return c.json({ error: assignmentError.message }, 500);
    }

    const ids = (assignments || []).map((a) => a.question_bank_id);
    if (!ids.length) {
      return c.json({ questionBanks: [] });
    }

    const { data, error } = await supabase
      .from("question_banks")
      .select(`
        *,
        lesson_plans (
          subject,
          grade
        )
      `)
      .in("id", ids)
      .order("created_at", { ascending: false });
S
    if (error) {
      return c.json({ error: error.message }, 500);
    }

    const formatted = (data || []).map((item: any) => ({
      id: item.id,
      teacherId: item.teacher_id,
      lessonPlanId: item.lesson_plan_id,
      subject: item.lesson_plans?.subject || null,
      grade: item.lesson_plans?.grade || null,
      questions: item.content_json,
      createdAt: item.created_at,
    }));

    return c.json({ questionBanks: formatted });
  } catch (error) {
    console.error("Fetch question banks error:", error);
    return c.json({ error: "Failed to fetch question banks" }, 500);
  }
});

// Export to Quizizz format
app.post("/make-server-f5d1386a/export-quizizz", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) {
      return c.json({ error: "No authorization token" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { questionBankId } = await c.req.json();
    if (!questionBankId) {
      return c.json({ error: "Missing questionBankId" }, 400);
    }

    const { data: questionBank, error } = await supabase
      .from("question_banks")
      .select("*")
      .eq("id", questionBankId)
      .maybeSingle();

    if (error || !questionBank) {
      return c.json({ error: "Question bank not found" }, 404);
    }

    const questions = Array.isArray(questionBank.content_json)
      ? questionBank.content_json
      : [];

    const quizizzFormat = {
      title: questionBank.title || "Quizizz Export",
      questions: questions.map((q: any) => ({
        question: q.question,
        answers: q.options || q.answers || [],
        correctAnswer: q.correctAnswer,
        type: q.type || "multiple_choice",
        time: 30,
      })),
    };

    return c.json({ quizizzFormat });
  } catch (error) {
    console.error("Export Quizizz error:", error);
    return c.json({ error: "Failed to export to Quizizz format" }, 500);
  }
});

// Get all students (for teachers)
app.get("/make-server-f5d1386a/students", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) {
      return c.json({ error: "No authorization token" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data: myProfile, error: myProfileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (myProfileError || !myProfile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    if (myProfile.role !== "teacher") {
      return c.json({ error: "Only teachers can view students list" }, 403);
    }

    const { data: students, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("role", "student");

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json({ students: students || [] });
  } catch (error) {
    console.error("Fetch students error:", error);
    return c.json({ error: "Failed to fetch students" }, 500);
  }
});

// ─── Helper: get auth user + profile ─────────────────────────────────────────
 
async function getAuthUser(c: any) {
  const accessToken = c.req.header("Authorization")?.split(" ")[1];
  if (!accessToken) return null;
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return profile ? { user, profile } : null;
}
 
// ─── 1. Bulk update question items (GV lưu chỉnh sửa) ─────────────────────────
 
app.post("/make-server-f5d1386a/question-items/bulk-update", async (c) => {
  try {
    const auth = await getAuthUser(c);
    if (!auth) return c.json({ error: "Unauthorized" }, 401);
    if (auth.profile.role !== "teacher") return c.json({ error: "Forbidden" }, 403);
 
    const { moduleId, questions } = await c.req.json();
    if (!moduleId || !Array.isArray(questions)) return c.json({ error: "Missing moduleId or questions" }, 400);
 
    // Verify teacher owns this module
    const { data: mod } = await supabase.from("subject_modules").select("teacher_id").eq("id", moduleId).maybeSingle();
    if (!mod || mod.teacher_id !== auth.user.id) return c.json({ error: "Forbidden" }, 403);
 
    // Upsert each question
    for (const q of questions) {
      if (q.id && !q.id.startsWith("new_")) {
        // Update existing
        await supabase.from("question_items").update({
          question_type: q.question_type,
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          bloom_level: q.bloom_level,
          points: q.points ?? 1,
          order_no: q.order_no,
        }).eq("id", q.id);
      } else {
        // Insert new
        const { data: qBank } = await supabase.from("question_banks").select("id").eq("module_id", moduleId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (qBank) {
          await supabase.from("question_items").insert({
            module_id: moduleId,
            question_bank_id: qBank.id,
            question_type: q.question_type,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            bloom_level: q.bloom_level,
            points: q.points ?? 1,
            order_no: q.order_no,
          });
        }
      }
    }
 
    // Delete questions that are no longer in the list
    const existingIds = questions.filter((q: any) => !q.id.startsWith("new_")).map((q: any) => q.id);
    if (existingIds.length > 0) {
      // Keep only the ones in our list, delete the rest
      await supabase.from("question_items")
        .delete()
        .eq("module_id", moduleId)
        .not("id", "in", `(${existingIds.map((id: string) => `'${id}'`).join(",")})`);
    }
 
    return c.json({ ok: true });
  } catch (err) {
    console.error("Bulk update error:", err);
    return c.json({ error: "Failed to update questions" }, 500);
  }
});
 
// ─── 2. Create quiz assignment (GV giao bài thi) ──────────────────────────────
 
app.post("/make-server-f5d1386a/quiz-assignments", async (c) => {
  try {
    const auth = await getAuthUser(c);
    if (!auth) return c.json({ error: "Unauthorized" }, 401);
    if (auth.profile.role !== "teacher") return c.json({ error: "Forbidden" }, 403);
 
    const { moduleId, questionBankId, title, assignedStudentIds, deadline, timeLimitMinutes, totalPoints } = await c.req.json();
 
    if (!moduleId || !questionBankId || !title || !Array.isArray(assignedStudentIds) || assignedStudentIds.length === 0) {
      return c.json({ error: "Missing required fields" }, 400);
    }
 
    const { data: assignment, error } = await supabase.from("quiz_assignments").insert({
      module_id: moduleId,
      question_bank_id: questionBankId,
      teacher_id: auth.user.id,
      title,
      assigned_student_ids: assignedStudentIds,
      deadline: deadline || null,
      time_limit_minutes: timeLimitMinutes || null,
      total_points: totalPoints || 10,
      status: "active",
    }).select("*").single();
 
    if (error) return c.json({ error: error.message }, 500);
 
    return c.json({ assignment });
  } catch (err) {
    console.error("Create assignment error:", err);
    return c.json({ error: "Failed to create assignment" }, 500);
  }
});
 
// ─── 3. Get quiz assignments for a module ─────────────────────────────────────
 
app.get("/make-server-f5d1386a/quiz-assignments", async (c) => {
  try {
    const auth = await getAuthUser(c);
    if (!auth) return c.json({ error: "Unauthorized" }, 401);
 
    const moduleId = c.req.query("moduleId");
 
    if (auth.profile.role === "teacher") {
      // Teacher: get all assignments for this module
      const query = supabase.from("quiz_assignments").select("*").eq("teacher_id", auth.user.id).order("created_at", { ascending: false });
      if (moduleId) query.eq("module_id", moduleId);
      const { data, error } = await query;
      if (error) return c.json({ error: error.message }, 500);
      return c.json({ assignments: data || [] });
    } else {
      // Student: get assignments assigned to them
      const { data, error } = await supabase.from("quiz_assignments")
        .select("*")
        .contains("assigned_student_ids", [auth.user.id])
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) return c.json({ error: error.message }, 500);
      return c.json({ assignments: data || [] });
    }
  } catch (err) {
    console.error("Get assignments error:", err);
    return c.json({ error: "Failed to fetch assignments" }, 500);
  }
});
 
// ─── 4. Get single quiz assignment (student làm bài) ─────────────────────────
 
app.get("/make-server-f5d1386a/quiz-assignments/:assignmentId", async (c) => {
  try {
    const auth = await getAuthUser(c);
    if (!auth) return c.json({ error: "Unauthorized" }, 401);
 
    const { assignmentId } = c.req.param();
 
    const { data: assignment, error } = await supabase.from("quiz_assignments").select("*").eq("id", assignmentId).maybeSingle();
    if (error || !assignment) return c.json({ error: "Assignment not found" }, 404);
 
    // Students can only see assignments they're assigned to
    if (auth.profile.role === "student" && !assignment.assigned_student_ids.includes(auth.user.id)) {
      return c.json({ error: "Forbidden" }, 403);
    }
 
    // Check if student already submitted
    if (auth.profile.role === "student") {
      const { data: existing } = await supabase.from("quiz_attempts")
        .select("id, score, total_points, submitted_at")
        .eq("assignment_id", assignmentId)
        .eq("student_id", auth.user.id)
        .maybeSingle();
      if (existing) return c.json({ error: "Bạn đã nộp bài thi này rồi", alreadySubmitted: true, attempt: existing }, 400);
    }
 
    // Load questions — WITHOUT correct_answer for students
    const { data: questions } = await supabase.from("question_items")
      .select(auth.profile.role === "teacher"
        ? "*"
        : "id, order_no, question_type, question_text, options, points, bloom_level"
      )
      .eq("question_bank_id", assignment.question_bank_id)
      .order("order_no");
 
    return c.json({
      assignment: {
        ...assignment,
        questions: questions || [],
      },
    });
  } catch (err) {
    console.error("Get assignment error:", err);
    return c.json({ error: "Failed to fetch assignment" }, 500);
  }
});
 
// ─── 5. Submit quiz attempt (student nộp bài) ─────────────────────────────────
 
app.post("/make-server-f5d1386a/quiz-assignments/:assignmentId/submit", async (c) => {
  try {
    const auth = await getAuthUser(c);
    if (!auth) return c.json({ error: "Unauthorized" }, 401);
    if (auth.profile.role !== "student") return c.json({ error: "Only students can submit" }, 403);
 
    const { assignmentId } = c.req.param();
    const { answers } = await c.req.json(); // { [questionId]: "A" | "B" | ... }
 
    const { data: assignment } = await supabase.from("quiz_assignments").select("*").eq("id", assignmentId).maybeSingle();
    if (!assignment) return c.json({ error: "Assignment not found" }, 404);
    if (!assignment.assigned_student_ids.includes(auth.user.id)) return c.json({ error: "Forbidden" }, 403);
 
    // Check duplicate
    const { data: existing } = await supabase.from("quiz_attempts").select("id").eq("assignment_id", assignmentId).eq("student_id", auth.user.id).maybeSingle();
    if (existing) return c.json({ error: "Bạn đã nộp bài này rồi" }, 400);
 
    // Get questions WITH correct answers for grading
    const { data: questions } = await supabase.from("question_items").select("*").eq("question_bank_id", assignment.question_bank_id).order("order_no");
 
    // Grade
    let score = 0;
    const gradedAnswers = (questions || []).map((q: any) => {
      const studentAnswer = answers[q.id] || "";
      const isCorrect = studentAnswer.trim().toLowerCase() === (q.correct_answer || "").trim().toLowerCase();
      const pts = q.points ?? 1;
      const earned = isCorrect ? pts : 0;
      score += earned;
      return {
        question_id: q.id,
        question_text: q.question_text,
        your_answer: studentAnswer,
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        explanation: q.explanation || null,
        points: pts,
        earned,
      };
    });
 
    const totalPoints = assignment.total_points || gradedAnswers.reduce((s: number, a: any) => s + a.points, 0);
    const percent = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
 
    // Save attempt
    await supabase.from("quiz_attempts").insert({
      assignment_id: assignmentId,
      student_id: auth.user.id,
      module_id: assignment.module_id,
      answers_json: answers,
      graded_answers_json: gradedAnswers,
      score,
      total_points: totalPoints,
      percent,
      submitted_at: new Date().toISOString(),
    });
 
    return c.json({
      result: {
        score,
        total_points: totalPoints,
        percent,
        answers: gradedAnswers,
      },
    });
  } catch (err) {
    console.error("Submit attempt error:", err);
    return c.json({ error: "Failed to submit attempt" }, 500);
  }
});
 
// ─── 6. Get results for an assignment (teacher xem bảng điểm) ─────────────────
 
app.get("/make-server-f5d1386a/quiz-assignments/:assignmentId/results", async (c) => {
  try {
    const auth = await getAuthUser(c);
    if (!auth) return c.json({ error: "Unauthorized" }, 401);
    if (auth.profile.role !== "teacher") return c.json({ error: "Forbidden" }, 403);
 
    const { assignmentId } = c.req.param();
 
    const { data: attempts, error } = await supabase.from("quiz_attempts")
      .select("student_id, score, total_points, percent, submitted_at")
      .eq("assignment_id", assignmentId)
      .order("submitted_at", { ascending: true });
 
    if (error) return c.json({ error: error.message }, 500);
    if (!attempts || attempts.length === 0) return c.json({ results: [] });
 
    // Fetch student names
    const studentIds = attempts.map((a: any) => a.student_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", studentIds);
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name]));
 
    const results = attempts.map((a: any) => ({
      student_id: a.student_id,
      student_name: profileMap[a.student_id] || a.student_id,
      score: a.score,
      total_points: a.total_points,
      percent: a.percent,
      submitted_at: a.submitted_at,
    }));
 
    return c.json({ results });
  } catch (err) {
    console.error("Get results error:", err);
    return c.json({ error: "Failed to fetch results" }, 500);
  }
});


// ─── 7. GET /my-quiz-attempts — học sinh xem lịch sử bài đã làm ──────────────

app.get("/make-server-f5d1386a/my-quiz-attempts", async (c) => {
  try {
    const auth = await getAuthUser(c);
    if (!auth) return c.json({ error: "Unauthorized" }, 401);
    if (auth.profile.role !== "student") return c.json({ error: "Forbidden" }, 403);

    const moduleId = c.req.query("moduleId");

    let query = supabase
      .from("quiz_attempts")
      .select("*")
      .eq("student_id", auth.user.id)
      .order("submitted_at", { ascending: false });

    if (moduleId) query = query.eq("module_id", moduleId);

    const { data: attempts, error } = await query;
    if (error) return c.json({ error: error.message }, 500);
    if (!attempts?.length) return c.json({ attempts: [] });

    const assignmentIds = [...new Set(attempts.map((a: any) => a.assignment_id))];
    const { data: assignments } = await supabase
      .from("quiz_assignments")
      .select("id, title, time_limit_minutes, deadline")
      .in("id", assignmentIds);

    const assignMap = Object.fromEntries((assignments || []).map((a: any) => [a.id, a]));

    return c.json({
      attempts: attempts.map((a: any) => ({
        id: a.id,
        assignment_id: a.assignment_id,
        assignment_title: assignMap[a.assignment_id]?.title || "Bài thi",
        time_limit_minutes: assignMap[a.assignment_id]?.time_limit_minutes || null,
        deadline: assignMap[a.assignment_id]?.deadline || null,
        score: a.score,
        total_points: a.total_points,
        percent: a.percent,
        submitted_at: a.submitted_at,
        graded_answers_json: a.graded_answers_json || [],
      })),
    });
  } catch (err) {
    console.error("my-quiz-attempts error:", err);
    return c.json({ error: "Failed to fetch attempts" }, 500);
  }
});


// ─── PATCH learning-path-nodes/:id (GV chỉnh sửa trực tiếp) ─────────────────

app.patch("/make-server-f5d1386a/learning-path-nodes/:id", async (c) => {
  try {
    const auth = await getAuthUser(c);
    if (!auth) return c.json({ error: "Unauthorized" }, 401);
    if (auth.profile.role !== "teacher") return c.json({ error: "Forbidden" }, 403);

    const nodeId = c.req.param("id");
    const body = await c.req.json();

    // Verify node tồn tại và thuộc module của giáo viên này
    const { data: node, error: nodeError } = await supabase
      .from("learning_path_nodes")
      .select("id, module_id")
      .eq("id", nodeId)
      .maybeSingle();

    if (nodeError || !node) return c.json({ error: "Node not found" }, 404);

    // Kiểm tra giáo viên sở hữu module này
    if (node.module_id) {
      const { data: mod } = await supabase
        .from("subject_modules")
        .select("teacher_id")
        .eq("id", node.module_id)
        .maybeSingle();
      if (!mod || mod.teacher_id !== auth.user.id) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }

    // Chỉ cho phép update các field an toàn
    const allowedFields = [
      "description", "learning_goal", "mini_example",
      "practice_task", "mastery_check", "support_tip",
      "checkpoint_question", "key_content", "what_to_read",
      "what_to_do", "what_to_write", "guiding_questions",
      "common_mistakes", "expected_output",
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) {
        let value = body[field];
        // Nếu là string JSON array thì parse lại
        if (typeof value === "string") {
          try { value = JSON.parse(value); } catch { /* giữ nguyên string */ }
        }
        updateData[field] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: "No valid fields to update" }, 400);
    }

    const { error: updateError } = await supabase
      .from("learning_path_nodes")
      .update(updateData)
      .eq("id", nodeId);

    if (updateError) return c.json({ error: updateError.message }, 500);

    return c.json({ success: true });
  } catch (err) {
    console.error("Patch learning-path-node error:", err);
    return c.json({ error: "Failed to update node" }, 500);
  }
});

// ─── PATCH mindmaps/:id (GV chỉnh sửa trực tiếp) ────────────────────────────

app.patch("/make-server-f5d1386a/mindmaps/:id", async (c) => {
  try {
    const auth = await getAuthUser(c);
    if (!auth) return c.json({ error: "Unauthorized" }, 401);
    if (auth.profile.role !== "teacher") return c.json({ error: "Forbidden" }, 403);

    const mindmapId = c.req.param("id");
    const body = await c.req.json();

    const { data: mindmap } = await supabase
      .from("mindmaps")
      .select("id, creator_id")
      .eq("id", mindmapId)
      .maybeSingle();

    if (!mindmap) return c.json({ error: "Mindmap not found" }, 404);
    if (mindmap.creator_id !== auth.user.id) return c.json({ error: "Forbidden" }, 403);

    const { error } = await supabase
      .from("mindmaps")
      .update({
        content_json: body.content_json,
        chapter_structure: body.content_json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", mindmapId);

    if (error) return c.json({ error: error.message }, 500);

    return c.json({ success: true });
  } catch (err) {
    console.error("Patch mindmap error:", err);
    return c.json({ error: "Failed to update mindmap" }, 500);
  }
});

app.route("/make-server-f5d1386a/api", telegramApp);

Deno.serve(app.fetch);