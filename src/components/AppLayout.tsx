import { CyberGlobe } from "@/components/CyberGlobe";
import { ChatOverlay } from "@/components/ChatOverlay";
import { SleepOrb } from "@/components/SleepOrb";
import { useLocation } from "react-router-dom";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isDashboard = location.pathname === "/";
  const asleep = true;

  if (asleep) {
    return <SleepOrb />;
  }

  return (
    <div className="min-h-screen flex w-full relative">
      <CyberGlobe />
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <main className={`flex-1 overflow-auto ${isDashboard ? "relative" : "p-6"}`}>
          {children}
        </main>
      </div>
      <ChatOverlay />
    </div>
  );
}
