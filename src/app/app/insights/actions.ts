"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppContext } from "@/lib/auth/session";
import { isRange } from "@/lib/insights";
import { ServiceError } from "@/lib/services/errors";
import { refreshInsights } from "@/lib/services/insights";

const uuid = z.string().uuid();

export async function refreshInsightsAction(formData: FormData): Promise<void> {
  const ctx = await requireAppContext();
  const page = uuid.safeParse(formData.get("page"));
  const range = Number(formData.get("range"));
  if (!page.success || !isRange(range)) redirect("/app/insights?error=failed");
  let notice = "refreshed";
  try {
    const result = await refreshInsights(ctx, page.data, range);
    if (!result.refreshed) notice = "recent";
  } catch (error) {
    const code = error instanceof ServiceError ? error.kind : "failed";
    redirect(`/app/insights?page=${page.data}&range=${range}&error=${code}`);
  }
  revalidatePath("/app/insights");
  redirect(`/app/insights?page=${page.data}&range=${range}&notice=${notice}`);
}
