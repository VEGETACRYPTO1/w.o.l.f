import { CyberGlobe } from "@/components/CyberGlobe";
import { ChatOverlay } from "@/components/ChatOverlay";
import { useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import type { WakePhase } from "@/contexts/WakeContext";

export function AppLayout({ children, phase }: { children: React.ReactNode; phase: WakePhase }) {
  const location = useLocation();
  const isDashboard = location.pathname === "/";
  const dissolving = phase === "sleeping-out";
  const prevPhase = useRef<WakePhase>(phase);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    // Flash when transitioning from waking → awake (covers the gap)
    if (prevPhase.current === "waking" && phase === "awake") {
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
    }
    // Flash when transitioning from awake → sleeping-out (cinematic)
    if (prevPhase.current === "awake" && phase === "sleeping-out") {
      setFlash(true);
      setTimeout(() => setFlash(false), 300);
    }
    prevPhase.current = phase;
  }, [phase]);

  return (
    <div className="min-h-screen flex w-full relative bg-background">
      <div className="absolute inset-0">
        <CyberGlobe phase={phase} dissolving={dissolving} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <main className={`flex-1 overflow-auto ${isDashboard ? "relative" : "p-6"}`}>{children}</main>
      </div>
      <ChatOverlay />

      {/* Cinematic flash overlay — covers orb→brain gap */}
      {flash && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 999,
            background: "radial-gradient(circle, rgba(255,220,100,0.95) 0%, rgba(255,150,0,0.6) 40%, transparent 70%)",
            animation: "flashFade 0.4s ease-out forwards",
          }}
        />
      )}

      <style>{`
        @keyframes flashFade {
          0% { opacity: 1; transform: scale(0.3); }
          40% { opacity: 0.8; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(2); }
        }
      `}</style>
    </div>
  );
}
