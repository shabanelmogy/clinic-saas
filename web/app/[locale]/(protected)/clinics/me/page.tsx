"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Globe, Building2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useMyClinic, useUpdateMyClinic } from "@/features/clinics/hooks/use-clinics";
import type { UpdateClinicInput } from "@/features/clinics/types/clinic.types";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2.5">
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-sm font-medium break-all">{value || "—"}</span>
    </div>
  );
}

export default function MyClinicPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  const { data: clinic, isLoading } = useMyClinic();
  const updateMutation = useUpdateMyClinic();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateClinicInput>({});

  useEffect(() => {
    if (clinic) {
      setForm({
        name:        clinic.name,
        description: clinic.description ?? "",
        address:     clinic.address ?? "",
        phone:       clinic.phone ?? "",
        email:       clinic.email ?? "",
        website:     clinic.website ?? "",
        isPublished: clinic.isPublished,
      });
    }
  }, [clinic]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!clinic) {
    return <div className="p-6"><p className="text-muted-foreground">Clinic not found.</p></div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UpdateClinicInput = {
      name:        form.name,
      description: form.description || undefined,
      address:     form.address || undefined,
      phone:       form.phone || undefined,
      email:       form.email || undefined,
      website:     form.website || undefined,
      isPublished: form.isPublished,
    };
    updateMutation.mutate(payload, {
      onSuccess: () => setEditing(false),
    });
  };

  // ── View mode ────────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="p-6 space-y-6 max-w-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-bold">{clinic.name}</h1>
              <p className="text-sm text-muted-foreground">/{clinic.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {clinic.isPublished
              ? <Badge className="bg-green-100 text-green-700 border-0 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 me-1" /> Published
                </Badge>
              : <Badge variant="secondary">
                  <XCircle className="h-3 w-3 me-1" /> Unpublished
                </Badge>
            }
            <Button onClick={() => setEditing(true)}>Edit Settings</Button>
          </div>
        </div>

        {/* Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Clinic Information</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <InfoRow label="Name"        value={clinic.name} />
            <InfoRow label="Description" value={clinic.description} />
            <InfoRow label="Address"     value={clinic.address} />
            <InfoRow label="Phone"       value={clinic.phone} />
            <InfoRow label="Email"       value={clinic.email} />
            <InfoRow label="Website"     value={clinic.website} />
          </CardContent>
        </Card>

        {/* Marketplace status */}
        <Card>
          <CardHeader><CardTitle className="text-base">Marketplace Visibility</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              {clinic.isPublished
                ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                : <XCircle className="h-5 w-5 text-muted-foreground" />
              }
              <div>
                <p className="text-sm font-medium">
                  {clinic.isPublished ? "Visible on marketplace" : "Hidden from marketplace"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {clinic.isPublished
                    ? "Patients can discover and book appointments at your clinic."
                    : "Your clinic is not visible to patients on the marketplace."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    );
  }

  // ── Edit mode ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Edit Clinic Settings</h1>
          <p className="text-sm text-muted-foreground">{clinic.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Basic info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Clinic Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of your clinic…"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={form.address ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="123 Main St, City, Country"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader><CardTitle className="text-base">Contact Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+1-555-0100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="clinic@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">
                <Globe className="inline h-3.5 w-3.5 me-1 text-muted-foreground" />
                Website
              </Label>
              <Input
                id="website"
                type="url"
                value={form.website ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://yourclinic.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Marketplace */}
        <Card>
          <CardHeader><CardTitle className="text-base">Marketplace Visibility</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Published</p>
                <p className="text-xs text-muted-foreground">
                  Make your clinic visible to patients on the marketplace.
                </p>
              </div>
              <Checkbox
                checked={form.isPublished ?? false}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isPublished: v === true }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
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
