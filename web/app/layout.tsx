import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clinic SaaS",
  description: "Healthcare SaaS Platform",
};

/**
 * Root layout — passthrough only.
 * <html> and <body> are rendered in [locale]/layout.tsx
 * so lang and dir can be set from the locale param.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
