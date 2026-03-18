import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Layout() {
  const location = useLocation();
  const isProjectDetail = /^\/projects\/[^/]+$/.test(location.pathname);

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight group-hover:text-foreground transition-colors">
              Small Singularity
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
          </nav>
        </div>
      </header>

      {/* Main content */}
      {isProjectDetail ? (
        <Outlet />
      ) : (
        <main className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </main>
      )}
    </div>
  );
}
