import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Next.js 16 proxy (replaces middleware.ts).
 * Handles locale routing only — auth is in layout.tsx (server-side).
 */
export const proxy = createMiddleware(routing);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
