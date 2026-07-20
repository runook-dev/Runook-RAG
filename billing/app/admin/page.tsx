import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import AdminConsole from "@/components/admin-console";

export const dynamic = "force-dynamic";

export default async function Admin() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <AdminConsole />;
}
