import { Outlet, useLocation } from "react-router";
import { Toaster } from "sonner";
import Header from "./components/Header";

export default function Root() {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/teacher") || location.pathname.startsWith("/student");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {!isDashboard && <Header />}
      <main className={isDashboard ? "" : "container mx-auto px-4 py-8"}>
        <Outlet />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
