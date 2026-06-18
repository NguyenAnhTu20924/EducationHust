import { Link } from "react-router";
import { Home } from "lucide-react";
import { Button } from "../components/ui/button";

export default function NotFound() {
  return (
    <div className="max-w-4xl mx-auto text-center py-16">
      <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
      <h2 className="text-3xl font-bold mb-4">Không Tìm Thấy Trang</h2>
      <p className="text-gray-600 mb-8">
        Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
      </p>
      <Link to="/">
        <Button>
          <Home className="w-4 h-4 mr-2" />
          Về Trang Chủ
        </Button>
      </Link>
    </div>
  );
}
