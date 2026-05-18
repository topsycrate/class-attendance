import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { getCurrentActiveSession } from "@/lib/actions";

export default async function AdminPage() {
  if (await isAdminAuthenticated()) {
    const activeSession = await getCurrentActiveSession();

    if (activeSession) {
      redirect(`/admin/session/${activeSession.id}`);
    }

    redirect("/admin/session");
  }

  redirect("/admin/login");
}
