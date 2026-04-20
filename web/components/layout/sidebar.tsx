"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  Stethoscope,
  Building2,
  UserCog,
  Shield,
  Settings2,
} from "lucide-react";

// ─── Nav item definition ──────────────────────────────────────────────────────

type NavItem = {
  key: string;
  icon: React.ElementType;
  href: string;
  /** undefined = visible to all, true = super admin only, false = clinic staff only */
  superAdminOnly?: boolean;
  clinicOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  // ── Always visible ──────────────────────────────────────────────────────────
  { key: "dashboard",    icon: LayoutDashboard, href: "dashboard"   },
  { key: "requests",     icon: ClipboardList,   href: "requests"    },

  // ── Visible to all authenticated staff ─────────────────────────────────────
  { key: "patients",     icon: Users,           href: "patients"     },
  { key: "appointments", icon: Calendar,        href: "appointments" },

  // ── Clinic staff only ───────────────────────────────────────────────────────
  { key: "doctors",      icon: Stethoscope,     href: "doctors",      clinicOnly: true },
  { key: "myClinic",     icon: Settings2,       href: "clinics/me"   },

  // ── Super admin only ────────────────────────────────────────────────────────
  { key: "clinics",      icon: Building2,       href: "clinics",      superAdminOnly: true },
  { key: "staffUsers",   icon: UserCog,         href: "staff-users",  superAdminOnly: true },
  { key: "roles",        icon: Shield,          href: "roles",        superAdminOnly: true },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const t = useTranslations("nav");
  const { locale } = useParams<{ locale: string }>();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const isGlobal = !user?.clinicId; // Super Admin — no clinic scope

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly && !isGlobal) return false; // hide super-admin items from clinic staff
    if (item.clinicOnly && isGlobal) return false;      // hide clinic items from super admin
    return true;
  });

  return (
    <aside className="flex flex-col w-64 shrink-0 border-e bg-sidebar h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <Stethoscope className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">Clinic SaaS</span>
      </div>

      {/* Role label */}
      {user && (
        <div className="px-4 py-2 border-b">
          <p className="text-xs text-muted-foreground truncate">{user.name}</p>
          <p className="text-xs font-medium text-primary truncate">
            {isGlobal ? "Super Admin" : user.roles[0] ?? "Staff"}
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(({ key, icon: Icon, href }) => {
          const fullHref = `/${locale}/${href}`;
          const active = pathname === fullHref || pathname.startsWith(`${fullHref}/`);
          return (
            <Link
              key={key}
              href={fullHref}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
