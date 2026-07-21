/**
 * DEPRECATED. This page used to render a customer's billing/usage from an
 * `?email=` query param, which is an IDOR (anyone could view another
 * customer's plan/usage). It has been replaced by the authenticated in-product
 * Billing page at /user-setting/billing (which proves identity via the RAGFlow
 * session token). We redirect there and render no data.
 */
import { redirect } from "next/navigation";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Account() {
  redirect(`${config.appUrl}/user-setting/billing`);
}
