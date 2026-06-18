import { Link, useNavigate } from "react-router";
import { BookOpen, LogOut, User } from "lucide-react";
import { Button } from "./ui/button";
import { getUserProfile, removeAccessToken, removeUserProfile } from "../utils/api";
import { toast } from "sonner";

export default function Header() {
  const navigate = useNavigate();
  const userProfile = getUserProfile();

  const handleLogout = () => {
    removeAccessToken();
    removeUserProfile();
    toast.success("Đã đăng xuất thành công");
    navigate("/login");
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-2xl font-bold text-blue-600">
            <BookOpen className="w-8 h-8" />
            <span>EduPlatform</span>
          </Link>

          <nav className="flex items-center gap-4">
            {userProfile ? (
              <>
                <Link
                  to={userProfile.role === "teacher" ? "/teacher" : "/student"}
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span>{userProfile.name}</span>
                </Link>
                <Button onClick={handleLogout} variant="outline" size="sm">
                  <LogOut className="w-4 h-4 mr-2" />
                  Đăng xuất
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline" size="sm">Đăng nhập</Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Đăng ký</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
