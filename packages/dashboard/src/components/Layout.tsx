import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

export function Layout() {
  const location = useLocation();
  const isProjectDetail = /^\/projects\/[^/]+$/.test(location.pathname);

  // Project detail has its own full-screen layout with a built-in top bar,
  // so we render it without the global navigation header.
  if (isProjectDetail) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight group-hover:text-foreground transition-colors">
              AutoGoals
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                location.pathname === "/"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              Projects
            </Link>
            <Link
              to="/rules"
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                location.pathname === "/rules"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              Rules
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
