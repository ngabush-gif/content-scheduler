import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronRight,
  Crown,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  PlugZap,
  Send,
  Settings,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", group: "main" },
  { icon: Wand2, label: "AI Generator", path: "/generate", group: "content" },
  { icon: BookOpen, label: "My Content", path: "/my-content", group: "content" },
  { icon: CheckSquare, label: "Approval Queue", path: "/approval", group: "content", adminOnly: true },
  { icon: BookOpen, label: "Content Library", path: "/library", group: "content" },
  { icon: Calendar, label: "Calendar", path: "/calendar", group: "content" },
  { icon: Send, label: "Publishing", path: "/publish", group: "publish" },
  { icon: PlugZap, label: "Connections", path: "/connections", group: "publish" },
  { icon: BarChart3, label: "Analytics", path: "/analytics", group: "publish" },
  { icon: Users, label: "Team", path: "/team", group: "settings", adminOnly: true },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 50% 50%, oklch(0.78 0.12 80 / 0.08) 0%, transparent 70%)",
          }}
        />
        <div className="relative flex flex-col items-center gap-8 p-10 max-w-md w-full">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
              <Crown className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-semibold text-gold-gradient">Upliftaz Amplify</h1>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your intelligent social media command centre. Sign in to access your team workspace.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg font-medium"
          >
            Sign in to Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";

  // Pending approval count for admins
  const { data: pendingPosts } = trpc.approval.pending.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 30000,
  });
  const pendingCount = pendingPosts?.length ?? 0;

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const visibleItems = menuItems.filter((item) => !item.adminOnly || isAdmin);
  const groups = [
    { key: "main", label: null },
    { key: "content", label: "Content" },
    { key: "publish", label: "Publish" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-border/50" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-16 border-b border-border/50">
            <div className="flex items-center gap-3 px-3 h-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-accent rounded-lg transition-colors shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="font-display font-semibold text-sm text-gold-gradient truncate">
                    Upliftaz Amplify
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Nav */}
          <SidebarContent className="gap-0 py-3">
            {groups.map((group) => {
              const items = visibleItems.filter((i) => i.group === group.key);
              if (items.length === 0) return null;
              return (
                <div key={group.key} className="mb-1">
                  {group.label && !isCollapsed && (
                    <p className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      {group.label}
                    </p>
                  )}
                  <SidebarMenu className="px-2">
                    {items.map((item) => {
                      const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                      const showBadge = item.path === "/approval" && pendingCount > 0;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setLocation(item.path)}
                            tooltip={item.label}
                            className={`h-9 transition-all font-normal rounded-lg ${
                              isActive
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                            <span className="flex-1">{item.label}</span>
                            {showBadge && (
                              <Badge className="h-5 min-w-5 px-1 text-[10px] bg-primary text-primary-foreground">
                                {pendingCount}
                              </Badge>
                            )}
                            {isActive && !isCollapsed && (
                              <ChevronRight className="h-3 w-3 text-primary/60 ml-auto" />
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </div>
              );
            })}
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="border-t border-border/50 p-3">
            {isAdmin && !isCollapsed && (
              <div className="mb-2 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/10 flex items-center gap-2">
                <Crown className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[11px] text-primary font-medium">Admin Access</span>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8 border border-border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-none">{user?.name || "User"}</p>
                      <p className="text-xs text-muted-foreground truncate mt-1">{user?.email || ""}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
                <DropdownMenuItem className="text-muted-foreground text-xs" disabled>
                  {user?.role === "admin" ? "Administrator" : "Team Member"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-background">
        {isMobile && (
          <div className="flex border-b border-border/50 h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-8 w-8 rounded-lg" />
              <span className="font-medium text-sm">
                {visibleItems.find((i) => i.path === location)?.label ?? "Menu"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 min-h-screen">{children}</main>
      </SidebarInset>
    </>
  );
}
