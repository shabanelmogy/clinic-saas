"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  Stethoscope,
} from "lucide-react";

const navItems = [
  { key: "dashboard",    icon: LayoutDashboard, href: "dashboard"    },
  { key: "patients",     icon: Users,           href: "patients"     },
  { key: "appointments", icon: Calendar,        href: "appointments" },
  { key: "requests",     icon: ClipboardList,   href: "requests"     },
] as const;

export function Sidebar() {
  const t = useTranslations("nav");
  const { locale } = useParams<{ locale: string }>();
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-64 shrink-0 border-e bg-sidebar h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <Stethoscope className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">Clinic SaaS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ key, icon: Icon, href }) => {
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
