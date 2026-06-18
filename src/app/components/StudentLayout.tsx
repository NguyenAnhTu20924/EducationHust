import { Link, useLocation, Outlet, useNavigate } from "react-router";
import { Home, User, BookOpenCheck, LogOut, Send } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";
import { getUserProfile, removeAccessToken, removeUserProfile } from "../utils/api";
import { toast } from "sonner";

const menuItems = [
  { icon: Home, label: "Trang Chủ", path: "/student" },
  { icon: User, label: "Thông Tin Cá Nhân", path: "/student/profile" },
  { icon: BookOpenCheck, label: "Môn học", path: "/student/modules" },
  { icon: Send, label: "Liên kết Telegram", path: "/student/telegram-link" },
];

export default function StudentLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const userProfile = getUserProfile();

  const handleLogout = () => {
    removeAccessToken();
    removeUserProfile();
    toast.success("Đã đăng xuất thành công");
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <Link to="/student" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
              <BookOpenCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">EduPlatform</h2>
              <p className="text-xs text-gray-500">Học sinh</p>
            </div>
          </Link>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-semibold">
              {userProfile?.name?.charAt(0).toUpperCase() || "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{userProfile?.name || "Học sinh"}</p>
              <p className="text-xs text-gray-500 truncate">{userProfile?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path.includes("modules") && location.pathname.startsWith("/student/modules"));
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      isActive ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white" : "text-gray-700 hover:bg-gray-100",
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <Button onClick={handleLogout} variant="outline" className="w-full justify-start">
            <LogOut className="w-4 h-4 mr-3" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
