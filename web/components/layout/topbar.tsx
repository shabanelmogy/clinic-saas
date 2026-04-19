"use client";

import { useState, useEffect } from "react";

import { useRouter, useParams, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Moon, Sun, Monitor, LogOut, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";

const THEMES = [
  { value: "light",  label: "Light",  icon: Sun     },
  { value: "dark",   label: "Dark",   icon: Moon    },
  { value: "system", label: "System", icon: Monitor },
] as const;

const LOCALES = [
  { value: "en", label: "English", dir: "ltr" },
  { value: "ar", label: "العربية", dir: "rtl" },
] as const;

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const ThemeIcon = mounted ? (THEMES.find((t) => t.value === theme)?.icon ?? Monitor) : Monitor;
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) await api.post("/auth/logout", { refreshToken });
    } catch {
      // ignore — logout anyway
    }
    logout();
    router.push(`/${locale}/login`);
    toast.success("Logged out");
  };

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  };

  return (
    <header className="flex items-center justify-end gap-2 px-6 h-14 border-b bg-background shrink-0">

      {/* Theme switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Switch theme">
          <ThemeIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {THEMES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              className={theme === value ? "bg-accent" : ""}
            >
              <Icon className="h-4 w-4 me-2" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Locale switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Switch language">
            <Globe className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Language</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {LOCALES.map(({ value, label }) => (
            <DropdownMenuItem
              key={value}
              onClick={() => switchLocale(value)}
              className={locale === value ? "bg-accent" : ""}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-6" />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden sm:block">{user?.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive">
            <LogOut className="h-4 w-4 me-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
