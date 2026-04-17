import { CyberGlobe } from "@/components/CyberGlobe";
import { ChatOverlay } from "@/components/ChatOverlay";
import { useLocation } from "react-router-dom";
import type { WakePhase } from "@/contexts/WakeContext";

export function AppLayout({ children, phase }: { children: React.ReactNode; phase: WakePhase }) {
  const location = useLocation();
  const isDashboard = location.pathname === "/";
  const dissolving = phase === "sleeping-out";

  return (
    <div className="min-h-screen flex w-full relative bg-background">
      <div className="absolute inset-0">
        <CyberGlobe phase={phase} dissolving={dissolving} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <main className={`flex-1 overflow-auto ${isDashboard ? "relative" : "p-6"}`}>
          {children}
        </main>
      </div>
      <ChatOverlay />
    </div>
  );
}
