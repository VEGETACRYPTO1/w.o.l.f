import { CyberGlobe } from "@/components/CyberGlobe";
import { ChatOverlay } from "@/components/ChatOverlay";
import { useLocation } from "react-router-dom";

export function AppLayout({ children, dissolving = false }: { children: React.ReactNode; dissolving?: boolean }) {
  const location = useLocation();
  const isDashboard = location.pathname === "/";

  return (
    <div className="min-h-screen flex w-full relative">
      <CyberGlobe dissolving={dissolving} />
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <main className={`flex-1 overflow-auto ${isDashboard ? "relative" : "p-6"}`}>
          {children}
        </main>
      </div>
      <ChatOverlay />
    </div>
  );
}
