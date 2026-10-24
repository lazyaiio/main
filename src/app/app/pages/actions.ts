"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppContext } from "@/lib/auth/session";
import { ServiceError } from "@/lib/services/errors";
import * as social from "@/lib/services/social";
import { FLOW_COOKIE } from "@/lib/social/flow";

const uuid = z.string().uuid();

function errorCode(error: unknown): string {
  return error instanceof ServiceError ? error.kind : "failed";
}

/** Sends the signed-in admin to Facebook (or to the pretend Facebook in test mode). */
export async function startFacebookConnectionAction(): Promise<void> {
  const ctx = await requireAppContext();
  let started: { authorizeUrl: string; cookieValue: string };
  try {
    started = await social.startConnection(ctx);
  } catch (error) {
    redirect(`/app/pages?error=${errorCode(error)}`);
  }
  const jar = await cookies();
  jar.set(FLOW_COOKIE, started.cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/meta",
    maxAge: 10 * 60,
  });
  redirect(started.authorizeUrl);
}

/** Saves the Pages chosen on the selection screen. */
export async function connectPagesAction(formData: FormData): Promise<void> {
  const flow = uuid.safeParse(formData.get("flowId"));
  if (!flow.success) redirect("/app/pages?error=social_attempt_expired");
  const ids = formData
    .getAll("pageId")
    .filter((v): v is string => typeof v === "string" && /^\d{1,25}$/.test(v))
    .slice(0, 300);

  const ctx = await requireAppContext();
  let count: number;
  try {
    count = await social.connectPages(ctx, flow.data, ids);
  } catch (error) {
    const code = errorCode(error);
    // An expired attempt cannot be retried from the same screen.
    if (code === "social_attempt_expired") redirect(`/app/pages?error=${code}`);
    redirect(`/app/pages/connect?flow=${flow.data}&error=${code}`);
  }
  revalidatePath("/app/pages");
  revalidatePath("/app");
  redirect(`/app/pages?notice=${count === 1 ? "connected_one" : "connected_many"}`);
}

export async function checkPageAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("pageId"));
  if (!id.success) redirect("/app/pages");
  const ctx = await requireAppContext();
  let result: Awaited<ReturnType<typeof social.checkPageConnection>>;
  try {
    result = await social.checkPageConnection(ctx, id.data);
  } catch (error) {
    redirect(`/app/pages?error=${errorCode(error)}`);
  }
  revalidatePath("/app/pages");
  if (!result.ok) redirect(`/app/pages?error=${social.socialErrorKind(result.kind)}`);
  redirect("/app/pages?notice=checked");
}

export async function disconnectPageAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("pageId"));
  if (!id.success) redirect("/app/pages");
  const ctx = await requireAppContext();
  try {
    await social.disconnectPage(ctx, id.data);
  } catch (error) {
    redirect(`/app/pages?error=${errorCode(error)}`);
  }
  revalidatePath("/app/pages");
  revalidatePath("/app");
  redirect("/app/pages?notice=disconnected");
}
