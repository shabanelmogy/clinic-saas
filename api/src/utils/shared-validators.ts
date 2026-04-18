import { z } from "zod";

/**
 * Shared/reusable Zod schemas.
 * Only put schemas here that are used across multiple modules.
 * Module-specific schemas belong in their own validation files.
 */

// ─── Basic Schemas ────────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid("Invalid UUID format");

export const emailSchema = z
  .string()
  .email("Invalid email address")
  .toLowerCase()
  .trim();

// ─── Pagination & Sorting ─────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const sortSchema = z.object({
  sortBy: z.string().min(1).max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const paginationWithSortSchema = paginationSchema.merge(sortSchema);

// ─── Date & Time ──────────────────────────────────────────────────────────────

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ─── Search & Filters ─────────────────────────────────────────────────────────

export const searchSchema = z.object({
  search: z.string().min(1).max(100).trim().optional(),
});

// ─── Route Parameters ─────────────────────────────────────────────────────────

export const idParamSchema = z.object({
  id: uuidSchema,
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaginationQuery = z.infer<typeof paginationSchema>;
export type SortQuery = z.infer<typeof sortSchema>;
export type PaginationWithSortQuery = z.infer<typeof paginationWithSortSchema>;
export type DateRangeQuery = z.infer<typeof dateRangeSchema>;
export type SearchQuery = z.infer<typeof searchSchema>;
export type IdParam = z.infer<typeof idParamSchema>;
