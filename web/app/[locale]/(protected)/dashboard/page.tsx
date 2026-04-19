"use client";

import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, ClipboardList, Stethoscope } from "lucide-react";

export default function DashboardPage() {
  const t = useTranslations();
  const user = useAuthStore((s) => s.user);

  const stats = [
    { label: t("nav.patients"),     icon: Users,          value: "—", color: "text-blue-500" },
    { label: t("nav.appointments"), icon: Calendar,       value: "—", color: "text-green-500" },
    { label: t("nav.requests"),     icon: ClipboardList,  value: "—", color: "text-orange-500" },
    { label: t("nav.doctors"),      icon: Stethoscope,    value: "—", color: "text-purple-500" },
  ];

  return (
    <div className="p-6 space-y-6">
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
            <Badge variant="outline">Clinic scoped</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, icon: Icon, value, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
