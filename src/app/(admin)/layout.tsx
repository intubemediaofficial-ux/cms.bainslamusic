import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[250px] transition-all duration-300">
        <TopBar />
        <main className="p-6 bg-slate-50 min-h-[calc(100vh-64px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
