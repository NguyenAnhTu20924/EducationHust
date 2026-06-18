import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { LogIn } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { supabase, setAccessToken, setUserProfile, apiCall } from "../utils/api";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session?.access_token) {
        setAccessToken(data.session.access_token);
        
        // Fetch user profile
        const profile = await apiCall("/profile");
        setUserProfile(profile.user);
        
        toast.success("Đăng nhập thành công!");
        
        if (profile.user.role === "teacher") {
          navigate("/teacher");
        } else {
          navigate("/student");
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error(error.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Đăng Nhập</CardTitle>
          <CardDescription>
            Đăng nhập để truy cập vào nền tảng học tập
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="w-4 h-4 mr-2" />
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-gray-600">
            Chưa có tài khoản?{" "}
            <Link to="/signup" className="text-blue-600 hover:underline">
              Đăng ký ngay
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
