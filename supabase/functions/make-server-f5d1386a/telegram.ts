import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js";

const telegramApp = new Hono();

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const telegramWebhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")!;
const botUsername = Deno.env.get("APP_BOT_USERNAME")!;

const LESSON_PLAN_BUCKET = "make-f5d1386a-lesson-plans";

const n8nLessonPlanExtractWebhook =
  Deno.env.get("N8N_LESSON_PLAN_EXTRACT_WEBHOOK") || "";``

const n8nLearningPathWebhook =
  Deno.env.get("N8N_LEARNING_PATH_WEBHOOK") || "";

function createAdminClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function createUserClient(authHeader?: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

async function getCurrentUser(c: any) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return null;

  const supabase = createUserClient(authHeader);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendTelegramMessage(chatId: number | string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  return await res.json();
}

async function sendLongTelegramMessage(chatId: number | string, text: string) {
  const MAX = 3500;

  if (text.length <= MAX) {
    await sendTelegramMessage(chatId, text);
    return;
  }

  for (let i = 0; i < text.length; i += MAX) {
    await sendTelegramMessage(chatId, text.slice(i, i + MAX));
  }
}

async function createSignedLessonPlanUrl(filePath?: string | null) {
  if (!filePath) return null;

  const admin = createAdminClient();

  const { data, error } = await admin.storage
    .from(LESSON_PLAN_BUCKET)
    .createSignedUrl(filePath, 3600);

  if (error) {
    throw new Error(error.message);
  }

  return data?.signedUrl || null;
}

async function persistExtractedTextIfNeeded(
  lessonPlanId: string,
  currentExtractedText: string | null,
  extractedTextFromN8n: string | null | undefined,
) {
  const normalizedText =
    typeof extractedTextFromN8n === "string" ? extractedTextFromN8n.trim() : "";

  if (!normalizedText) return;
  if (currentExtractedText && currentExtractedText.trim().length > 0) return;

  const admin = createAdminClient();

  const { error } = await admin
    .from("lesson_plans")
    .update({
      extracted_text: normalizedText,
      status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonPlanId);

  if (error) {
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

async function getRecentTeacherLessonPlans(teacherId: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("lesson_plans")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

async function findTeacherLessonPlanByShortCode(teacherId: string, shortCode: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("lesson_plans")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  const normalized = shortCode.trim().toLowerCase();

  return (data || []).find((item: any) =>
    String(item.id).toLowerCase().startsWith(normalized)
  ) || null;
}

async function generateLearningPathFromLessonPlan(params: {
  teacherId: string;
  lessonPlan: any;
}) {
  if (!n8nLearningPathWebhook) {
    throw new Error("Chưa cấu hình N8N_LEARNING_PATH_WEBHOOK");
  }

  const { teacherId, lessonPlan } = params;

  const fileUrl = lessonPlan.file_path
    ? await createSignedLessonPlanUrl(lessonPlan.file_path)
    : null;

  if (!lessonPlan.extracted_text && !fileUrl) {
    throw new Error("Giáo án không có extracted_text và cũng không có fileUrl");
  }

  const n8nResponse = await fetch(n8nLearningPathWebhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      lessonTitle: lessonPlan.lesson_title || lessonPlan.title,
      subject: lessonPlan.subject,
      grade: lessonPlan.grade,
      fileName: lessonPlan.file_name,
      filePath: lessonPlan.file_path,
      fileUrl,
      extractedText: lessonPlan.extracted_text || null,
    }),
  });

  if (!n8nResponse.ok) {
    const errorText = await n8nResponse.text();
    throw new Error(`n8n webhook call failed: ${errorText}`);
  }

  const raw = await n8nResponse.json();
  const aiResult = Array.isArray(raw) ? (raw[0] || {}) : raw;

  const extractedTextFromN8n =
    aiResult.extractedText ||
    aiResult.extracted_text ||
    aiResult.documentText ||
    null;

  await persistExtractedTextIfNeeded(
    lessonPlan.id,
    lessonPlan.extracted_text || null,
    extractedTextFromN8n,
  );

  const finalPath =
    aiResult.learningPath ||
    aiResult.learning_path ||
    aiResult;

  const finalPathText =
    aiResult.learningPathText ||
    aiResult.learning_path_text ||
    formatLearningPathText(finalPath);

  const admin = createAdminClient();

  const { data: inserted, error: insertError } = await admin
    .from("learning_paths")
    .insert({
      lesson_plan_id: lessonPlan.id,
      teacher_id: teacherId,
      title: lessonPlan.title || lessonPlan.lesson_title,
      content_json: finalPath,
      content_text: finalPathText,
      status: "generated",
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message || "Không thể lưu learning path");
  }

  return {
    learningPathId: inserted.id,
    learningPathText: finalPathText,
  };
}

async function getLinkedProfileByTelegramUserId(telegramUserId: number) {
  const admin = createAdminClient();

  const { data: telegramAccount, error: accountError } = await admin
    .from("telegram_accounts")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (accountError || !telegramAccount) return null;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", telegramAccount.user_id)
    .maybeSingle();

  if (profileError || !profile) return null;

  return {
    telegramAccount,
    profile,
  };
}

async function getUploadSession(userId: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("telegram_upload_sessions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

async function upsertUploadSession(userId: string, payload: Record<string, any>) {
  const admin = createAdminClient();

  const { error } = await admin
    .from("telegram_upload_sessions")
    .upsert(
      {
        user_id: userId,
        ...payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(error.message);
  }
}

async function clearUploadSession(userId: string) {
  await upsertUploadSession(userId, {
    state: "idle",
    title: null,
    subject: null,
    grade: null,
    lesson_title: null,
    book_set: null,
    description: null,
  });
}

async function getTelegramFilePath(fileId: string) {
  const res = await fetch(
    `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`
  );

  const data = await res.json();

  if (!data.ok || !data.result?.file_path) {
    throw new Error("Không lấy được file_path từ Telegram");
  }

  return data.result.file_path as string;
}

async function downloadTelegramFile(filePath: string) {
  const res = await fetch(
    `https://api.telegram.org/file/bot${telegramBotToken}/${filePath}`
  );

  if (!res.ok) {
    throw new Error("Không tải được file từ Telegram");
  }

  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

async function extractLessonPlanViaN8n(params: {
  lessonPlanId: string;
  title: string;
  lessonTitle: string;
  subject: string;
  grade: string;
  fileName: string;
  filePath: string;
  currentExtractedText?: string | null;
}) {
  if (params.currentExtractedText && params.currentExtractedText.trim()) {
    return {
      extractedText: params.currentExtractedText,
      status: "ready",
    };
  }

  if (!n8nLessonPlanExtractWebhook) {
    return {
      extractedText: null,
      status: "uploaded",
    };
  }

  const fileUrl = await createSignedLessonPlanUrl(params.filePath);

  const response = await fetch(n8nLessonPlanExtractWebhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      lessonPlanId: params.lessonPlanId,
      lessonTitle: params.lessonTitle,
      title: params.title,
      subject: params.subject,
      grade: params.grade,
      fileName: params.fileName,
      filePath: params.filePath,
      fileUrl,
      extractedText: params.currentExtractedText || null,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`n8n extract webhook failed: ${errorText}`);
  }

  const raw = await response.json();
  const result = Array.isArray(raw) ? (raw[0] || {}) : raw;

  const extractedText = (
    result.extractedText ||
    result.extracted_text ||
    result.documentText ||
    result.text ||
    ""
  ).trim();

  if (!extractedText) {
    return {
      extractedText: null,
      status: "uploaded",
    };
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("lesson_plans")
    .update({
      extracted_text: extractedText,
      status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.lessonPlanId);

  if (error) {
    throw new Error(error.message);
  }

  return {
    extractedText,
    status: "ready",
  };
}

telegramApp.post("/telegram/create-link-code", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const admin = createAdminClient();

  const code = generate6DigitCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await admin
    .from("telegram_link_tokens")
    .delete()
    .eq("user_id", user.id)
    .is("used_at", null);

  const { error } = await admin.from("telegram_link_tokens").insert({
    user_id: user.id,
    link_code: code,
    expires_at: expiresAt,
  });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    link_code: code,
    expires_at: expiresAt,
    bot_link: `https://t.me/${botUsername}?start=link_${code}`,
  });
});

telegramApp.get("/telegram/link-status", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("telegram_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  if (!data) {
    return c.json({ is_linked: false });
  }

  return c.json({
    is_linked: true,
    telegram_user_id: data.telegram_user_id,
    telegram_username: data.telegram_username,
    telegram_first_name: data.telegram_first_name,
    linked_at: data.linked_at,
  });
});

telegramApp.post("/telegram/unlink", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("telegram_accounts")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true, message: "Đã hủy liên kết Telegram" });
});

// ─── DEBUG ENDPOINT (xóa sau khi fix xong) ───────────────────────────────────
telegramApp.post("/telegram/debug-webhook", async (c) => {
  const secret = c.req.header("x-telegram-bot-api-secret-token");
  const envSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const botUsername = Deno.env.get("APP_BOT_USERNAME");

  let body: any = null;
  try { body = await c.req.json(); } catch { body = "cannot parse JSON"; }

  return c.json({
    received_secret: secret || null,
    env_secret: envSecret ? envSecret.slice(0, 4) + "****" : "NOT SET",
    secret_match: secret === envSecret,
    bot_token_set: !!botToken,
    bot_username: botUsername || "NOT SET",
    body_preview: JSON.stringify(body).slice(0, 500),
  });
});

telegramApp.get("/telegram/debug-env", async (c) => {
  return c.json({
    TELEGRAM_BOT_TOKEN: Deno.env.get("TELEGRAM_BOT_TOKEN") ? "SET ✅" : "NOT SET ❌",
    TELEGRAM_WEBHOOK_SECRET: Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ? "SET ✅" : "NOT SET ❌",
    APP_BOT_USERNAME: Deno.env.get("APP_BOT_USERNAME") || "NOT SET ❌",
    N8N_LEARNING_PATH_WEBHOOK: Deno.env.get("N8N_LEARNING_PATH_WEBHOOK") ? "SET ✅" : "NOT SET ❌",
  });
});
// ─────────────────────────────────────────────────────────────────────────────

telegramApp.post("/telegram/webhook", async (c) => {
  const secret = c.req.header("x-telegram-bot-api-secret-token");
  if (secret !== telegramWebhookSecret) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const message = body.message;

  if (!message || !message.from || !message.chat) {
    return c.json({ ok: true });
  }

  const telegramUserId = message.from.id;
  const chatId = message.chat.id;
  const username = message.from.username ?? null;
  const firstName = message.from.first_name ?? null;
  const lastName = message.from.last_name ?? null;
  const text = (message.text || "").trim();
  const document = message.document || null;

  let linkCode: string | null = null;

  if (text.startsWith("/link ")) {
    linkCode = text.replace("/link", "").trim();
  } else if (text.startsWith("/start ")) {
    const payload = text.replace("/start", "").trim();
    if (payload.startsWith("link_")) {
      linkCode = payload.replace("link_", "").trim();
    }
  }

  // 1) Xử lý liên kết tài khoản
  if (linkCode) {
    const admin = createAdminClient();

    const { data: tokenRow, error: tokenError } = await admin
      .from("telegram_link_tokens")
      .select("*")
      .eq("link_code", linkCode)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (tokenError || !tokenRow) {
      await sendTelegramMessage(
        chatId,
        "Mã liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng."
      );
      return c.json({ ok: true });
    }

    const { data: existingByTelegram } = await admin
      .from("telegram_accounts")
      .select("*")
      .eq("telegram_user_id", telegramUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (existingByTelegram && existingByTelegram.user_id !== tokenRow.user_id) {
      await sendTelegramMessage(
        chatId,
        "Tài khoản Telegram này đã được liên kết với một tài khoản khác."
      );
      return c.json({ ok: true });
    }

    const { error: upsertError } = await admin
      .from("telegram_accounts")
      .upsert(
        {
          user_id: tokenRow.user_id,
          telegram_user_id: telegramUserId,
          telegram_chat_id: chatId,
          telegram_username: username,
          telegram_first_name: firstName,
          telegram_last_name: lastName,
          is_active: true,
          linked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      await sendTelegramMessage(chatId, "Liên kết thất bại. Vui lòng thử lại sau.");
      return c.json({ ok: true });
    }

    await admin
      .from("telegram_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    await sendTelegramMessage(
      chatId,
      "Liên kết Telegram thành công.\n\nGõ /menu để xem các chức năng hiện có."
    );

    return c.json({ ok: true });
  }

  // 2) Xử lý cho user đã liên kết
  const linked = await getLinkedProfileByTelegramUserId(telegramUserId);

  if (!linked) {
    await sendTelegramMessage(
      chatId,
      "Tài khoản Telegram này chưa được liên kết với hệ thống. Vui lòng vào website để tạo liên kết trước."
    );
    return c.json({ ok: true });
  }

  const fullName = linked.profile.full_name || "người dùng";
  const role = linked.profile.role;
  const userId = linked.profile.id;

  // 3) Lệnh chung
  if (text === "/start" || text === "/menu") {
    if (role === "teacher") {
      await sendTelegramMessage(
        chatId,
        `Xin chào thầy/cô ${fullName}.\n\nChức năng hiện có:\n/upload - Upload giáo án\n/learningpath - Tạo lộ trình từ giáo án\n/menu - Xem menu\n/cancel - Hủy thao tác đang làm`
      );
      return c.json({ ok: true });
    }

    if (role === "student") {
      await sendTelegramMessage(
        chatId,
        `Xin chào ${fullName}.\n\nChức năng hiện có:\n/menu - Xem menu`
      );
      return c.json({ ok: true });
    }
  }

  if (text === "/cancel") {
    await clearUploadSession(userId);
    await sendTelegramMessage(chatId, "Đã hủy thao tác hiện tại.");
    return c.json({ ok: true });
  }

  // 4) Chỉ teacher mới được /upload
  if (text === "/upload") {
    if (role !== "teacher") {
      await sendTelegramMessage(chatId, "Chỉ giáo viên mới có thể upload giáo án.");
      return c.json({ ok: true });
    }

    await upsertUploadSession(userId, {
      state: "awaiting_metadata",
      title: null,
      subject: null,
      grade: null,
      lesson_title: null,
      book_set: null,
      description: null,
    });

    await sendTelegramMessage(
      chatId,
      "Bắt đầu upload giáo án.\n\nBước 1: Hãy gửi thông tin theo đúng mẫu:\nTên hiển thị | Môn | Lớp | Tên bài học\n\nVí dụ:\nDao động điều hòa | Lý | 11 | Dao động điều hòa"
    );
    return c.json({ ok: true });
  }

  if (text === "/learningpath") {
    if (role !== "teacher") {
      await sendTelegramMessage(chatId, "Chỉ giáo viên mới có thể tạo lộ trình học tập.");
      return c.json({ ok: true });
    }

    try {
      const plans = await getRecentTeacherLessonPlans(userId);

      if (!plans.length) {
        await sendTelegramMessage(
          chatId,
          "Bạn chưa có giáo án nào. Hãy dùng /upload để tải giáo án lên trước."
        );
        return c.json({ ok: true });
      }

      const lines = plans.map((plan: any, index: number) => {
        const shortCode = String(plan.id).slice(0, 8);
        return `${index + 1}. ${plan.title || plan.lesson_title} | ${plan.subject} | Lớp ${plan.grade} | mã: ${shortCode}`;
      });

      await sendTelegramMessage(
        chatId,
        `Chọn giáo án để tạo lộ trình.\n\n${lines.join("\n")}\n\nChỉ cần gửi mã 8 ký tự của giáo án.\nVí dụ: ca1dbdf7`
      );

      return c.json({ ok: true });
    } catch (error) {
      await sendTelegramMessage(
        chatId,
        `Không lấy được danh sách giáo án: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return c.json({ ok: true });
    }
  }
  if (text.startsWith("/learningpath ")) {
    if (role !== "teacher") {
      await sendTelegramMessage(chatId, "Chỉ giáo viên mới có thể tạo lộ trình học tập.");
      return c.json({ ok: true });
    }

    const shortCode = text.replace("/learningpath", "").trim();

    if (!shortCode) {
      await sendTelegramMessage(chatId, "Thiếu mã giáo án. Ví dụ: /learningpath 383a39a2");
      return c.json({ ok: true });
    }

    try {
      const lessonPlan = await findTeacherLessonPlanByShortCode(userId, shortCode);

      if (!lessonPlan) {
        await sendTelegramMessage(
          chatId,
          "Không tìm thấy giáo án phù hợp với mã bạn gửi. Hãy gõ /learningpath để xem lại danh sách."
        );
        return c.json({ ok: true });
      }

      await sendTelegramMessage(
        chatId,
        `Đang tạo lộ trình cho bài "${lessonPlan.lesson_title || lessonPlan.title}"...`
      );

      const result = await generateLearningPathFromLessonPlan({
        teacherId: userId,
        lessonPlan,
      });

      await sendLongTelegramMessage(
        chatId,
        `Tạo lộ trình thành công.\n\n${result.learningPathText}`
      );

      return c.json({ ok: true });
    } catch (error) {
      await sendTelegramMessage(
        chatId,
        `Tạo lộ trình thất bại: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return c.json({ ok: true });
    }
  }

  if (
    role === "teacher" &&
    text &&
    !text.startsWith("/") &&
    /^[a-f0-9]{8}$/i.test(text)
  ) {
    try {
      const lessonPlan = await findTeacherLessonPlanByShortCode(userId, text.trim());

      if (!lessonPlan) {
        await sendTelegramMessage(
          chatId,
          "Không tìm thấy giáo án phù hợp với mã bạn gửi. Hãy gõ /learningpath để xem lại danh sách."
        );
        return c.json({ ok: true });
      }

      await sendTelegramMessage(
        chatId,
        `Đang tạo lộ trình cho bài "${lessonPlan.lesson_title || lessonPlan.title}"...`
      );

      const result = await generateLearningPathFromLessonPlan({
        teacherId: userId,
        lessonPlan,
      });

      await sendLongTelegramMessage(
        chatId,
        `Tạo lộ trình thành công.\n\n${result.learningPathText}`
      );

      return c.json({ ok: true });
    } catch (error) {
      await sendTelegramMessage(
        chatId,
        `Tạo lộ trình thất bại: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return c.json({ ok: true });
    }
  }

  const session = await getUploadSession(userId);

  // 5) Đang chờ metadata
  if (
    role === "teacher" &&
    session?.state === "awaiting_metadata" &&
    text &&
    !text.startsWith("/")
  ) {
    const parts = text.split("|").map((x: string) => x.trim()).filter(Boolean);

    if (parts.length < 4) {
      await sendTelegramMessage(
        chatId,
        "Sai định dạng.\n\nHãy gửi theo mẫu:\nTên hiển thị | Môn | Lớp | Tên bài học"
      );
      return c.json({ ok: true });
    }

    const [title, subject, grade, lessonTitle] = parts;

    await upsertUploadSession(userId, {
      state: "awaiting_document",
      title,
      subject,
      grade,
      lesson_title: lessonTitle,
    });

    await sendTelegramMessage(
      chatId,
      `Đã nhận thông tin:\n- Tiêu đề: ${title}\n- Môn: ${subject}\n- Lớp: ${grade}\n- Tên bài học: ${lessonTitle}\n\nBước 2: Hãy gửi file giáo án cho bot (PDF).`
    );
    return c.json({ ok: true });
  }

  // 6) Đang chờ file document
  if (role === "teacher" && session?.state === "awaiting_document") {
    if (!document) {
      await sendTelegramMessage(
        chatId,
        "Bot đang chờ file giáo án. Hãy gửi file document cho bot hoặc gõ /cancel để hủy."
      );
      return c.json({ ok: true });
    }

    try {
      const admin = createAdminClient();

      const fileId = document.file_id;
      const originalFileName =
        document.file_name || `telegram_upload_${Date.now()}.bin`;
      const mimeType = document.mime_type || "application/octet-stream";

      const safeFileName = originalFileName.replace(/[^\w.\-]+/g, "_");
      const storagePath = `${Date.now()}_${safeFileName}`;

      const telegramFilePath = await getTelegramFilePath(fileId);
      const fileBytes = await downloadTelegramFile(telegramFilePath);

      const { error: uploadError } = await admin.storage
        .from(LESSON_PLAN_BUCKET)
        .upload(storagePath, fileBytes, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        await sendTelegramMessage(chatId, `Upload file thất bại: ${uploadError.message}`);
        return c.json({ ok: true });
      }

      let extractedText: string | null = null;
      if (mimeType === "text/plain" || originalFileName.toLowerCase().endsWith(".txt")) {
        extractedText = new TextDecoder().decode(fileBytes);
      }

      const { data: insertedLessonPlan, error: insertError } = await admin
        .from("lesson_plans")
        .insert({
          teacher_id: userId,
          title: session.title,
          subject: session.subject,
          grade: session.grade,
          lesson_title: session.lesson_title,
          book_set: session.book_set || null,
          description: session.description || "Uploaded from Telegram",
          file_name: originalFileName,
          file_path: storagePath,
          extracted_text: extractedText,
          status: extractedText ? "ready" : "uploaded",
        })
        .select("*")
        .single();

      if (insertError || !insertedLessonPlan) {
        await sendTelegramMessage(chatId, `Lưu giáo án thất bại: ${insertError?.message}`);
        return c.json({ ok: true });
      }

      let extractionStatusMessage = "";

      if (extractedText) {
        extractionStatusMessage = "Đã đọc nội dung TXT trực tiếp và lưu vào hệ thống.";
      } else if (n8nLessonPlanExtractWebhook) {
        await sendTelegramMessage(
          chatId,
          "Đã nhận file. Hệ thống đang trích xuất nội dung từ giáo án, vui lòng chờ một chút..."
        );

        try {
          const extractionResult = await extractLessonPlanViaN8n({
            lessonPlanId: insertedLessonPlan.id,
            title: session.title,
            lessonTitle: session.lesson_title,
            subject: session.subject,
            grade: session.grade,
            fileName: originalFileName,
            filePath: storagePath,
            currentExtractedText: null,
          });

          extractionStatusMessage = extractionResult.extractedText
            ? "Đã trích xuất nội dung giáo án thành công."
            : "Đã upload file nhưng chưa trích xuất được nội dung.";
        } catch (extractError) {
          extractionStatusMessage = `Đã upload file nhưng trích xuất nội dung thất bại: ${extractError instanceof Error ? extractError.message : "Unknown error"
            }`;
        }
      } else {
        extractionStatusMessage =
          "Đã upload file thành công nhưng chưa cấu hình webhook n8n để trích xuất nội dung.";
      }

      await clearUploadSession(userId);

      await sendTelegramMessage(
        chatId,
        `Upload giáo án thành công.\n\n- File: ${originalFileName}\n- Bài học: ${session.lesson_title}\n- Môn: ${session.subject}\n- Lớp: ${session.grade}\n- Trạng thái: ${extractionStatusMessage}\n\nGõ /menu để tiếp tục.`
      );

      return c.json({ ok: true });
    } catch (error) {
      await sendTelegramMessage(
        chatId,
        `Có lỗi khi xử lý file: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return c.json({ ok: true });
    }
  }

  // 7) Mặc định
  await sendTelegramMessage(
    chatId,
    `Xin chào ${fullName}.\nGõ /menu để xem các chức năng hiện có.`
  );

  return c.json({ ok: true });
});

export default telegramApp;