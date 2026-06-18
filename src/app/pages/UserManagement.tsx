import { useEffect, useMemo, useState } from "react";
import { Users, Search, GraduationCap, BookOpen, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { apiCall } from "../utils/api";
import { toast } from "sonner";

type UserEntry = {
  id: string;
  full_name?: string;
  name?: string;
  role?: string;
};

type FilterTab = "all" | "student" | "teacher";

export default function UserManagement() {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiCall("/users");
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Không thể tải danh sách người dùng");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const keyword = searchQuery.toLowerCase();
      const name = (u.full_name || u.name || "").toLowerCase();
      const matchSearch = name.includes(keyword) || u.id.toLowerCase().includes(keyword);
      const matchTab =
        activeTab === "all" ||
        (activeTab === "student" && u.role === "student") ||
        (activeTab === "teacher" && u.role === "teacher");
      return matchSearch && matchTab;
    });
  }, [users, searchQuery, activeTab]);

  const totalStudents = users.filter((u) => u.role === "student").length;
  const totalTeachers = users.filter((u) => u.role === "teacher").length;

  const tabs: { key: FilterTab; label: string; count: number; icon: React.ReactNode; color: string }[] = [
    { key: "all",     label: "Tất cả",    count: users.length,   icon: <Users className="w-4 h-4" />,         color: "text-gray-700 bg-gray-100" },
    { key: "student", label: "Học sinh",  count: totalStudents,  icon: <GraduationCap className="w-4 h-4" />, color: "text-blue-700 bg-blue-100" },
    { key: "teacher", label: "Giáo viên", count: totalTeachers,  icon: <BookOpen className="w-4 h-4" />,      color: "text-violet-700 bg-violet-100" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Quản Lý Người Dùng</h1>
        <p className="text-gray-600 mt-1">Xem toàn bộ giáo viên và học sinh trong hệ thống</p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gray-100">
                <Users className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Tổng người dùng</p>
                <p className="text-2xl font-bold text-gray-900">{loading ? "..." : users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100">
                <GraduationCap className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Học sinh</p>
                <p className="text-2xl font-bold text-blue-700">{loading ? "..." : totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-100">
                <BookOpen className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Giáo viên</p>
                <p className="text-2xl font-bold text-violet-700">{loading ? "..." : totalTeachers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Danh Sách Người Dùng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs + search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? "bg-violet-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                    activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                  }`}>
                    {loading ? "–" : tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex-1 min-w-48 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Tìm theo tên hoặc ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="h-9 gap-1.5">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Tải lại
            </Button>
          </div>

          {/* Table */}
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Tên</TableHead>
                  <TableHead className="font-semibold">Vai trò</TableHead>
                  <TableHead className="font-semibold">ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-gray-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Đang tải...
                    </TableCell>
                  </TableRow>
                )}

                {!loading && filtered.map((u) => {
                  const name = u.full_name || u.name || "Chưa có tên";
                  const isTeacher = u.role === "teacher";
                  return (
                    <TableRow key={u.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                            isTeacher ? "bg-gradient-to-br from-violet-500 to-purple-600" : "bg-gradient-to-br from-blue-400 to-cyan-500"
                          }`}>
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`font-semibold border-0 ${
                          isTeacher
                            ? "bg-violet-100 text-violet-800 hover:bg-violet-100"
                            : "bg-blue-100 text-blue-800 hover:bg-blue-100"
                        }`}>
                          {isTeacher ? "Giáo viên" : "Học sinh"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-400 text-xs font-mono">{u.id}</TableCell>
                    </TableRow>
                  );
                })}

                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-gray-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Không tìm thấy người dùng nào
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && filtered.length > 0 && (
            <p className="text-xs text-gray-400 text-right">
              Hiển thị {filtered.length} / {users.length} người dùng
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}