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
  const appFadingOut = phase === "sleeping-out";

  return (
    <>
      {showApp && (
        <div
          className={`transition-opacity duration-700 ${appFadingOut ? "opacity-0" : "opacity-100 animate-fade-in"}`}
          style={{ pointerEvents: appFadingOut ? "none" : "auto" }}
        >
          <BrowserRouter>
            <AppLayout dissolving={appFadingOut}>
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
      {showOrb && <EnergyBall />}
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
