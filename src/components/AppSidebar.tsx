import { LayoutDashboard, MessageSquare, Target, Activity, BarChart3, Zap } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useMode, MODE_CONFIGS, type Mode } from "@/contexts/ModeContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "JARVIS Chat", url: "/chat", icon: MessageSquare },
  { title: "Goals", url: "/goals", icon: Target },
  { title: "Habits", url: "/habits", icon: Activity },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

const modes: Mode[] = ["war", "rebuild", "expansion"];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { mode, setMode, config } = useMode();

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-heading text-xs tracking-widest uppercase text-muted-foreground">
            {!collapsed && "SK10 JARVIS"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      activeClassName="text-primary bg-accent"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-heading">Mode</p>
            <div className="flex flex-col gap-1">
              {modes.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-all ${
                    mode === m
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <span>{MODE_CONFIGS[m].icon}</span>
                  <span>{MODE_CONFIGS[m].label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex flex-col items-center gap-1">
            {modes.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`p-1.5 rounded text-sm transition-all ${
                  mode === m ? "bg-primary/15" : "hover:bg-accent"
                }`}
                title={MODE_CONFIGS[m].label}
              >
                {MODE_CONFIGS[m].icon}
              </button>
            ))}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
