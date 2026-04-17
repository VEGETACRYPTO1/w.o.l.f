import { CyberGlobe } from "@/components/CyberGlobe";
import { ChatOverlay } from "@/components/ChatOverlay";
import { EnergyBall } from "@/components/EnergyBall";
import { SleepWakeListener } from "@/components/SleepWakeListener";
import { useWake } from "@/contexts/WakeContext";
import { useLocation } from "react-router-dom";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isDashboard = location.pathname === "/";
  const { awake, transitioning } = useWake();

  // Show full UI only when awake. During "sleeping" transition keep it mounted but fade out.
  const showUI = awake;
  const uiOpacity = awake && transitioning !== "sleeping" ? 1 : 0;

  return (
    <div className="min-h-screen flex w-full relative bg-background">
      <SleepWakeListener />
      <EnergyBall />

      {showUI && (
        <div
          className="absolute inset-0 flex w-full transition-opacity duration-700"
          style={{ opacity: uiOpacity }}
        >
          <CyberGlobe />
          <div className="flex-1 flex flex-col min-w-0 relative z-10">
            <main className={`flex-1 overflow-auto ${isDashboard ? "relative" : "p-6"}`}>
              {children}
            </main>
          </div>
          <ChatOverlay />
        </div>
      )}
    </div>
  );
}
