import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { CyberGlobe } from "@/components/CyberGlobe";
import { useMode } from "@/contexts/ModeContext";
import { Zap } from "lucide-react";
import { useLocation } from "react-router-dom";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { config } = useMode();
  const location = useLocation();
  const isDashboard = location.pathname === "/";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full relative">
        <CyberGlobe />
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <header className={`h-12 flex items-center justify-between border-b border-border/50 px-4 backdrop-blur-sm ${isDashboard ? "bg-transparent border-transparent" : "bg-background/60"} z-30 relative`}>
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              {!isDashboard && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Zap className="h-3 w-3 text-primary animate-pulse-glow" />
                  <span className="font-heading uppercase tracking-wider">{config.label} Active</span>
                </div>
              )}
            </div>
          </header>
          <main className={`flex-1 overflow-auto ${isDashboard ? "relative" : "p-6"}`}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
