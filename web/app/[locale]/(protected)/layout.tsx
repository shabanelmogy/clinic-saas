import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Auth guard — only runs for routes inside (protected)/
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (!token) {
    redirect("/login");
  }

  return <>{children}</>;
}
