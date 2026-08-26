"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const studentLinks = [
  { href: "/browse", label: "Browse" },
  { href: "/shortlist", label: "My shortlist" },
];

const adminLinks = [
  { href: "/admin/activities", label: "Activities" },
  { href: "/admin/reminders", label: "Reminders" },
  { href: "/admin/bulk-send", label: "Bulk send" },
  { href: "/admin/tracking", label: "Tracking" },
  { href: "/admin/roster", label: "Roster" },
];

const STUDENT_ROUTE_PREFIXES = ["/browse", "/activity", "/shortlist"];

export function TopNav() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (pathname === "/login") return null;

  const isAdmin = session?.user.role === "ADMIN";
  const onStudentRoute = STUDENT_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isPreviewing = isAdmin && onStudentRoute;

  const links = isAdmin && !isPreviewing ? adminLinks : studentLinks;

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-40">
      {isPreviewing && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-medium text-center py-1.5">
          Admin preview — this is what a student sees.{" "}
          <Link href="/admin/activities" className="underline hover:no-underline">
            Exit preview
          </Link>
        </div>
      )}
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-6">
        <Link href={isAdmin && !isPreviewing ? "/admin/activities" : "/browse"} className="flex items-center gap-2 shrink-0">
          <span className="h-7 w-7 rounded-lg bg-primary text-white grid place-items-center text-sm font-bold">EA</span>
          <span className="font-semibold text-sm hidden sm:inline">Extracurricular Activities</span>
        </Link>

        {status === "authenticated" && (
          <nav className="flex items-center gap-1 overflow-x-auto">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    active ? "bg-primary-soft text-primary" : "text-muted hover:bg-black/[.03]"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-3 shrink-0">
          {status === "authenticated" && isAdmin && (
            <Link
              href={isPreviewing ? "/admin/activities" : "/browse"}
              className="hidden sm:inline-flex text-sm font-medium text-muted hover:text-foreground border border-border rounded-full px-3 py-1.5"
            >
              {isPreviewing ? "Exit preview" : "Preview as student"}
            </Link>
          )}
          {status === "authenticated" && (
            <>
              <span className="hidden md:flex flex-col items-end leading-tight">
                <span className="text-sm font-medium">{session.user.name}</span>
                <span className="text-xs text-muted">
                  {isAdmin ? (isPreviewing ? "Admin (previewing)" : "Admin") : session.user.grade ? `Grade ${session.user.grade}` : "Student"}
                </span>
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-sm font-medium text-muted hover:text-foreground border border-border rounded-full px-3 py-1.5"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
