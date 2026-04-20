"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useStaffUser, useUpdateStaffUser } from "@/features/staff-users/hooks/use-staff-users";
import type { UpdateStaffUserInput } from "@/features/staff-users/types/staff-user.types";

export default function StaffUserEditPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();

  const { data: user, isLoading } = useStaffUser(id);
  const updateMutation = useUpdateStaffUser(id);

  const [form, setForm] = useState<UpdateStaffUserInput>({});
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Populate form once user loads
  useEffect(() => {
    if (user) {
      setForm({
        name:     user.name,
        email:    user.email,
        phone:    user.phone ?? "",
        isActive: user.isActive,
      });
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-lg">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return <div className="p-6"><p className="text-muted-foreground">Staff user not found.</p></div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: UpdateStaffUserInput = {
      name:     form.name,
      email:    form.email,
      phone:    form.phone || undefined,
      isActive: form.isActive,
    };

    // Only include password if the user typed one
    if (newPassword.trim()) {
      payload.password = newPassword.trim();
    }

    updateMutation.mutate(payload, {
      onSuccess: () => router.push(`/${locale}/staff-users/${id}`),
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-lg">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Edit Staff User</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Basic info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+1-555-0100"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive users cannot log in.</p>
              </div>
              <Checkbox
                checked={form.isActive ?? true}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v === true }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Password change */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Leave blank to keep the current password.
            </p>
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="pe-10"
                  minLength={newPassword ? 8 : undefined}
                />
                <button
                  type="button"
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            Save Changes
          </Button>
        </div>

      </form>
    </div>
  );
}
