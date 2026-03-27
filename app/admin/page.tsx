import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";

export default async function AdminPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin/session");
  }

  redirect("/admin/login");
}
