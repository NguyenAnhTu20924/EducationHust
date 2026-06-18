import { createBrowserRouter } from "react-router";
import Root from "./Root";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import TeacherLayout from "./components/TeacherLayout";
import StudentLayout from "./components/StudentLayout";
import TeacherHome from "./pages/TeacherHome";
import StudentHome from "./pages/StudentHome";
import StudentProfile from "./pages/StudentProfile";
import UserManagement from "./pages/UserManagement";
import TelegramLink from "./pages/TelegramLink";
import Modules from "./pages/Modules";
import ModuleDetail from "./pages/ModuleDetail";
import LessonPlanPage from "./pages/LessonPlanPage";
import LearningPathPage from "./pages/LearningPathPage";
import MindmapPage from "./pages/MindmapPage";
import QuestionBankPage from "./pages/QuestionBankPage";
import QuizAttemptPage from "./pages/QuizAttemptPage";
import NotFound from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      { index: true, element: <Home /> },
      { path: "login", element: <Login /> },
      { path: "signup", element: <Signup /> },
      {
        path: "teacher",
        element: <TeacherLayout />,
        children: [
          { index: true, element: <TeacherHome /> },
          { path: "profile", element: <StudentProfile /> },
          { path: "modules", element: <Modules /> },
          { path: "modules/:id", element: <ModuleDetail /> },
          { path: "modules/:id/lesson-plan", element: <LessonPlanPage /> },
          { path: "modules/:id/learning-path", element: <LearningPathPage /> },
          { path: "modules/:id/mindmap", element: <MindmapPage /> },
          { path: "modules/:id/question-bank", element: <QuestionBankPage /> },
          { path: "telegram-link", element: <TelegramLink /> },
          { path: "users", element: <UserManagement /> },
        ],
      },
      {
        path: "student",
        element: <StudentLayout />,
        children: [
          { index: true, element: <StudentHome /> },
          { path: "profile", element: <StudentProfile /> },
          { path: "modules", element: <Modules /> },
          { path: "modules/:id", element: <ModuleDetail /> },
          { path: "modules/:id/lesson-plan", element: <LessonPlanPage /> },
          { path: "modules/:id/learning-path", element: <LearningPathPage /> },
          { path: "modules/:id/mindmap", element: <MindmapPage /> },
          { path: "modules/:id/question-bank", element: <QuestionBankPage /> },
          { path: "quiz/:assignmentId", element: <QuizAttemptPage /> },
          // ── FIX: thêm route telegram cho học sinh ──────────────────────
          { path: "telegram-link", element: <TelegramLink /> },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);