"use client";

import { useState } from "react";
import { Search, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClinics } from "@/features/clinics/hooks/use-clinics";

export default function ClinicsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useClinics({ page, limit: 12, search: search || undefined });

  const clinics = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clinics</h1>
        <p className="text-sm text-muted-foreground mt-1">All published clinics on the marketplace.</p>
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search clinics..." className="ps-9" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {isLoading
        ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
          </div>
        : clinics.length === 0
          ? <p className="text-muted-foreground text-center py-12">No clinics found</p>
          : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clinics.map((clinic) => (
                <Card key={clinic.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight">{clinic.name}</h3>
                      <Badge variant="outline" className="text-xs shrink-0">{clinic.slug}</Badge>
                    </div>
                    {clinic.description && <p className="text-sm text-muted-foreground line-clamp-2">{clinic.description}</p>}
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {clinic.address && <p>📍 {clinic.address}</p>}
                      {clinic.phone && <p>📞 {clinic.phone}</p>}
                      {clinic.website && (
                        <a href={clinic.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
                          <Globe className="h-3 w-3" /> {clinic.website}
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
      }

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta.total} clinics total</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={!meta.hasPrevPage} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span>Page {meta.page} of {meta.totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={!meta.hasNextPage} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
