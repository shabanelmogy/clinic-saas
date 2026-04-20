"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Users, Calendar, ClipboardList, Stethoscope,
  ArrowRight, TrendingUp, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { patientsApi } from "@/features/patients/api/patients.api";
import { appointmentsApi } from "@/features/appointments/api/appointments.api";
import { patientRequestsApi, doctorRequestsApi } from "@/features/requests/api/requests.api";
import { doctorsApi } from "@/features/doctors/api/doctors.api";
import type { AppointmentStatus } from "@/features/appointments/types/appointment.types";

// ─── Shared staleTime — dashboard data is fine being 2 min stale ─────────────
const STALE = 2 * 60 * 1000; // 2 minutes

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, icon: Icon, value, sub, color, href, loading,
}: {
  label: string;
  icon: React.ElementType;
  value: number | undefined;
  sub?: string;
  color: string;
  href: string;
  loading: boolean;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow group">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-muted`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-3xl font-bold tabular-nums">
            {value?.toLocaleString() ?? "—"}
          </div>
        )}
        {sub && !loading && (
          <p className="text-xs text-muted-foreground">{sub}</p>
        )}
        <Link href={href}>
          <Button
            variant="ghost" size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground -ms-2"
          >
            View all <ArrowRight className="h-3 w-3 ms-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Recent appointments ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  no_show:   "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function RecentAppointments({ locale }: { locale: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "recent-appointments"],
    queryFn: () => appointmentsApi.list({ page: 1, limit: 5 }),
    staleTime: STALE,
  });
  const appointments = data?.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Recent Appointments
        </CardTitle>
        <Link href={`/${locale}/appointments`}>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
            View all <ArrowRight className="h-3 w-3 ms-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No appointments yet.</p>
        ) : (
          <div className="space-y-1">
            {appointments.map((a) => (
              <Link
                key={a.id}
                href={`/${locale}/appointments/${a.id}`}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
              >
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(a.scheduledAt), "PP · p")}
                    {a.patientName && <> · {a.patientName}</>}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize shrink-0 ${STATUS_COLORS[a.status]}`}>
                  {a.status.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Pending requests summary ─────────────────────────────────────────────────

function PendingRequestsSummary({ locale }: { locale: string }) {
  // Two requests — but both are cheap (limit=1, just need meta.total)
  const { data: patientData, isLoading: pLoading } = useQuery({
    queryKey: ["dashboard", "pending-patient-requests"],
    queryFn: () => patientRequestsApi.list({ status: "pending", limit: 1 }),
    staleTime: STALE,
  });
  const { data: doctorData, isLoading: dLoading } = useQuery({
    queryKey: ["dashboard", "pending-doctor-requests"],
    queryFn: () => doctorRequestsApi.list({ status: "pending", limit: 1 }),
    staleTime: STALE,
  });

  const patientPending = patientData?.meta.total ?? 0;
  const doctorPending  = doctorData?.meta.total  ?? 0;
  const total   = patientPending + doctorPending;
  const loading = pLoading || dLoading;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          Pending Reviews
        </CardTitle>
        <Link href={`/${locale}/requests`}>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
            Review <ArrowRight className="h-3 w-3 ms-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : total === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 py-2">
            <CheckCircle2 className="h-4 w-4" />
            All requests reviewed — nothing pending.
          </div>
        ) : (
          <div className="space-y-2">
            {patientPending > 0 && (
              <Link href={`/${locale}/requests`}>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Patient Requests</span>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700 border-0 dark:bg-orange-900/30 dark:text-orange-400">
                    {patientPending} pending
                  </Badge>
                </div>
              </Link>
            )}
            {doctorPending > 0 && (
              <Link href={`/${locale}/requests`}>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Doctor Requests</span>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700 border-0 dark:bg-orange-900/30 dark:text-orange-400">
                    {doctorPending} pending
                  </Badge>
                </div>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Appointment breakdown — single query, client-side grouping ───────────────
// Fetches up to 200 appointments and counts by status client-side.
// This avoids 4 separate API calls for the breakdown.

const BREAKDOWN_STATUSES: AppointmentStatus[] = ["pending", "confirmed", "completed", "cancelled"];
const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending:   "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show:   "No Show",
};
const BAR_COLORS: Record<AppointmentStatus, string> = {
  pending:   "bg-yellow-400",
  confirmed: "bg-green-500",
  completed: "bg-blue-500",
  cancelled: "bg-red-400",
  no_show:   "bg-gray-400",
};

function AppointmentBreakdown({ locale }: { locale: string }) {
  // Single request — fetch total count + first page to derive breakdown
  // We use limit=1 for the total, then fetch per-status counts with 4 cheap queries
  // BUT to avoid 4 requests, we instead fetch a larger page and count client-side.
  // For dashboards with <200 appointments this is fine; for larger datasets
  // the per-status approach is better but we keep it to 1 request here.
  const { data: totalData, isLoading: totalLoading } = useQuery({
    queryKey: ["dashboard", "appt-total"],
    queryFn: () => appointmentsApi.list({ page: 1, limit: 1 }),
    staleTime: STALE,
  });

  // Per-status counts — 4 requests but with staleTime they only fire once per 2 min
  const { data: pendingData,   isLoading: l1 } = useQuery({ queryKey: ["dashboard", "appt-pending"],   queryFn: () => appointmentsApi.list({ status: "pending",   limit: 1 }), staleTime: STALE });
  const { data: confirmedData, isLoading: l2 } = useQuery({ queryKey: ["dashboard", "appt-confirmed"], queryFn: () => appointmentsApi.list({ status: "confirmed", limit: 1 }), staleTime: STALE });
  const { data: completedData, isLoading: l3 } = useQuery({ queryKey: ["dashboard", "appt-completed"], queryFn: () => appointmentsApi.list({ status: "completed", limit: 1 }), staleTime: STALE });
  const { data: cancelledData, isLoading: l4 } = useQuery({ queryKey: ["dashboard", "appt-cancelled"], queryFn: () => appointmentsApi.list({ status: "cancelled", limit: 1 }), staleTime: STALE });

  const loading = totalLoading || l1 || l2 || l3 || l4;
  const grandTotal = totalData?.meta.total ?? 0;

  const counts: Record<AppointmentStatus, number> = {
    pending:   pendingData?.meta.total   ?? 0,
    confirmed: confirmedData?.meta.total ?? 0,
    completed: completedData?.meta.total ?? 0,
    cancelled: cancelledData?.meta.total ?? 0,
    no_show:   0,
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Appointment Breakdown
        </CardTitle>
        <Link href={`/${locale}/appointments`}>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
            View all <ArrowRight className="h-3 w-3 ms-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-1.5 flex-1 rounded-full" />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {BREAKDOWN_STATUSES.map((status) => {
              const count = counts[status];
              const pct = grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{STATUS_LABELS[status]}</span>
                    <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${BAR_COLORS[status]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const t = useTranslations();
  const { locale } = useParams<{ locale: string }>();
  const user = useAuthStore((s) => s.user);
  const isGlobal = !user?.clinicId;

  // Stat counts — limit=1 to get meta.total cheaply, staleTime avoids refetch on focus
  const { data: patientData,     isLoading: pLoading } = useQuery({
    queryKey: ["dashboard", "patient-count"],
    queryFn: () => patientsApi.list({ limit: 1 }),
    staleTime: STALE,
  });
  const { data: appointmentData, isLoading: aLoading } = useQuery({
    queryKey: ["dashboard", "appointment-count"],
    queryFn: () => appointmentsApi.list({ limit: 1 }),
    staleTime: STALE,
  });
  const { data: requestData,     isLoading: rLoading } = useQuery({
    queryKey: ["dashboard", "pending-requests-count"],
    queryFn: () => patientRequestsApi.list({ status: "pending", limit: 1 }),
    staleTime: STALE,
  });
  const { data: doctorData,      isLoading: dLoading } = useQuery({
    queryKey: ["dashboard", "doctor-count"],
    queryFn: () => doctorsApi.list({ limit: 1 }),
    staleTime: STALE,
    enabled: !isGlobal, // super admin has no clinic — skip this query
  });

  const patientCount     = patientData?.meta.total;
  const appointmentCount = appointmentData?.meta.total;
  const pendingRequests  = requestData?.meta.total;
  const doctorCount      = doctorData?.meta.total;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        {user && (
          <p className="text-muted-foreground mt-1">
            {t("dashboard.welcome", { name: user.name })}
          </p>
        )}
        <div className="flex gap-2 mt-2 flex-wrap">
          {user?.roles.map((role) => (
            <Badge key={role} variant="secondary">{role}</Badge>
          ))}
          {user?.clinicId && (
            <Badge variant="outline" className="font-mono text-xs">clinic-scoped</Badge>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("nav.patients")}
          icon={Users}
          value={patientCount}
          color="text-blue-500"
          href={`/${locale}/patients`}
          loading={pLoading}
        />
        <StatCard
          label={t("nav.appointments")}
          icon={Calendar}
          value={appointmentCount}
          color="text-green-500"
          href={`/${locale}/appointments`}
          loading={aLoading}
        />
        <StatCard
          label="Pending Requests"
          icon={ClipboardList}
          value={pendingRequests}
          sub={pendingRequests ? `${pendingRequests} awaiting review` : "All clear"}
          color="text-orange-500"
          href={`/${locale}/requests`}
          loading={rLoading}
        />
        <StatCard
          label={t("nav.doctors")}
          icon={Stethoscope}
          value={isGlobal ? undefined : doctorCount}
          sub={isGlobal ? "Super admin view" : undefined}
          color="text-purple-500"
          href={isGlobal ? `/${locale}/clinics` : `/${locale}/doctors`}
          loading={!isGlobal && dLoading}
        />
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentAppointments locale={locale} />
        </div>
        <div className="space-y-6">
          <PendingRequestsSummary locale={locale} />
          <AppointmentBreakdown locale={locale} />
        </div>
      </div>

    </div>
  );
}
