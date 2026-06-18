import { Link } from "react-router";
import { BookOpen, Brain, GraduationCap } from "lucide-react";
import { Button } from "../components/ui/button";

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto space-y-16 py-12">
      {/* Hero Section */}
      <section className="text-center space-y-6">
        <h1 className="text-5xl font-bold text-gray-900">
          Nền Tảng Giáo Dục Thông Minh
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Hỗ trợ giáo viên và học sinh cấp 3 với AI, tạo lộ trình học tập, 
          mindmaps, ngân hàng câu hỏi và nhiều tính năng khác
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/signup">
            <Button size="lg" className="text-lg px-8 py-6">
              Bắt đầu ngay
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6">
              Đăng nhập
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        <FeatureCard
          icon={<GraduationCap className="w-12 h-12 text-purple-600" />}
          title="Lộ Trình Học Tập"
          description="AI tạo lộ trình học tập cá nhân hóa cho từng học sinh"
        />
        <FeatureCard
          icon={<Brain className="w-12 h-12 text-pink-600" />}
          title="Mindmaps"
          description="Tạo sơ đồ tư duy từ nội dung SGK một cách tự động"
        />
        <FeatureCard
          icon={<BookOpen className="w-12 h-12 text-green-600" />}
          title="Ngân Hàng Câu Hỏi"
          description="Tạo và quản lý bộ câu hỏi từ giáo án của bạn"
        />
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white text-center">
        <h2 className="text-3xl font-bold mb-4">
          Sẵn sàng nâng cao trải nghiệm giáo dục?
        </h2>
        <p className="text-lg mb-6 opacity-90">
          Tham gia cùng hàng nghìn giáo viên và học sinh đang sử dụng nền tảng của chúng tôi
        </p>
        <Link to="/signup">
          <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
            Đăng ký miễn phí
          </Button>
        </Link>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2 text-gray-900">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}