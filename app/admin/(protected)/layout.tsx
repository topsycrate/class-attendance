import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdmin();

  return <AdminShell>{children}</AdminShell>;
}
