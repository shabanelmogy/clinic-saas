"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, EyeOff, Stethoscope, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth.store";
import { api, getErrorMessage } from "@/lib/api";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({ email: "", password: "", clinicId: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        email: form.email,
        password: form.password,
        ...(form.clinicId.trim() ? { clinicId: form.clinicId.trim() } : {}),
      });
      setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* ── Left panel — branding ─────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/10">
            <Stethoscope className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Clinic SaaS</span>
        </div>

        <div className="space-y-4">
          <blockquote className="text-3xl font-semibold leading-snug">
            {t("tagline")}
          </blockquote>
          <p className="text-primary-foreground/70 text-sm">
            Manage clinics, doctors, patients and appointments — all in one place.
          </p>
        </div>

        {/* Decorative grid */}
        <div className="grid grid-cols-3 gap-3 opacity-20">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-primary-foreground/20" />
          ))}
        </div>
      </div>

      {/* ── Right panel — form ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Stethoscope className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Clinic SaaS</span>
          </div>

          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{t("login")}</h1>
            <p className="text-sm text-muted-foreground">{t("tagline")}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@clinic.com"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="pe-10"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" />
                    : <Eye className="h-4 w-4" />
                  }
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="clinicId">{t("clinicId")}</Label>
                <span className="text-xs text-muted-foreground">({t("clinicIdHint")})</span>
              </div>
              <Input
                id="clinicId"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={form.clinicId}
                onChange={(e) => setForm((f) => ({ ...f, clinicId: e.target.value }))}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t("loggingIn")}</>
                : t("loginButton")
              }
            </Button>
          </form>

          <Separator />

          {/* Dev hint */}
          <div className="rounded-lg border border-dashed p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Dev credentials
            </p>
            <div className="space-y-1 text-xs text-muted-foreground font-mono">
              <p>super@clinicsaas.com / SuperAdmin1</p>
              <p>alice@cityhealth.com / ClinicAdmin1</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
