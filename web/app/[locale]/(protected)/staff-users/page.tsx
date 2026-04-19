"use client";

import { useState } from "react";
import { format } from "date-fns";
import { UserPlus, Search, MoreHorizontal, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useStaffUsers, useCreateStaffUser, useDeleteStaffUser } from "@/features/staff-users/hooks/use-staff-users";
import type { CreateStaffUserInput } from "@/features/staff-users/types/staff-user.types";

export default function StaffUsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateStaffUserInput>({ name: "", email: "", password: "" });

  const { data, isLoading } = useStaffUsers({ page, limit: 20, search: search || undefined });
  const createMutation = useCreateStaffUser();
  const deleteMutation = useDeleteStaffUser();

  const users = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage all staff accounts across the platform.</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email..." className="ps-9" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4 me-2" /> Add Staff User
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              : users.length === 0
                ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No staff users found</TableCell></TableRow>
                : users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-sm">{u.phone ?? "—"}</TableCell>
                    <TableCell>
                      {u.isActive
                        ? <Badge className="bg-green-100 text-green-700 border-0">Active</Badge>
                        : <Badge variant="secondary">Inactive</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(u.createdAt), "PP")}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(u.id)}>
                            <Trash2 className="h-4 w-4 me-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta.total} users total</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={!meta.hasPrevPage} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span>Page {meta.page} of {meta.totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={!meta.hasNextPage} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Staff User</DialogTitle>
            <DialogDescription>Create a new staff account.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form, { onSuccess: () => { setCreateOpen(false); setForm({ name: "", email: "", password: "" }); } }); }}>
            <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Phone (optional)</Label><Input value={form.phone ?? ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Staff User</DialogTitle><DialogDescription>This will soft-delete the account.</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteId && deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) })}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
