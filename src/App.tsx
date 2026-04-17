import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModeProvider } from "@/contexts/ModeContext";
import { WakeProvider, useWake } from "@/contexts/WakeContext";
import { AppLayout } from "@/components/AppLayout";
import { EnergyBall } from "@/components/EnergyBall";
import { SleepWakeListener } from "@/components/SleepWakeListener";
import Dashboard from "./pages/Dashboard";
import Goals from "./pages/Goals";
import Habits from "./pages/Habits";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function WakeGate() {
  const { phase } = useWake();
  const showApp = phase === "awake" || phase === "sleeping-out";
  const showOrb = phase === "sleeping" || phase === "waking" || phase === "sleeping-out";
  const sucking = phase === "sleeping-out";
  const wrapperRef = useRef<HTMLDivElement>(null);

  // When entering sleeping-out, compute per-element vector toward viewport center
  // and write it into a CSS var so the keyframe pulls each element to the orb.
  useEffect(() => {
    if (!sucking || !wrapperRef.current) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const els = wrapperRef.current.querySelectorAll<HTMLElement>("[data-bh]");
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const dx = cx - ex;
      const dy = cy - ey;
      el.style.setProperty("--bh-dx", `${dx}px`);
      el.style.setProperty("--bh-dy", `${dy}px`);
    });
  }, [sucking]);

  return (
    <>
      {showApp && (
        <div
          ref={wrapperRef}
          className={`${sucking ? "black-hole-active" : "animate-fade-in"}`}
        >
          <BrowserRouter>
            <AppLayout dissolving={sucking}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/habits" element={<Habits />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </div>
      )}
      {showOrb && <EnergyBall phase={phase} />}
      <SleepWakeListener />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ModeProvider>
        <WakeProvider>
          <WakeGate />
        </WakeProvider>
      </ModeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

