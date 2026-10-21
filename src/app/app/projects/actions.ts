"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { firstError } from "@/lib/auth/schemas";
import type { FormState } from "@/lib/auth/form-state";
import { requireAppContext } from "@/lib/auth/session";
import { projectFormSchema, readProjectForm, toProjectSettings, type ProjectFormInput } from "@/lib/projects";
import * as projects from "@/lib/services/projects";
import { ServiceError } from "@/lib/services/projects";

const uuid = z.string().uuid();

function toInput(data: ProjectFormInput) {
  return {
    name: data.name,
    inputType: data.inputType,
    inputValue: data.inputValue,
    languages: data.languages,
    settings: toProjectSettings(data),
  };
}

function echo(raw: ReturnType<typeof readProjectForm>): Record<string, string> {
  return {
    name: raw.name,
    inputType: raw.inputType,
    inputValue: raw.inputValue,
    languages: raw.languages.join(","),
    audience: raw.audience ?? "",
    tone: raw.tone ?? "",
    notes: raw.notes ?? "",
  };
}

function errorCode(error: unknown): string {
  return error instanceof ServiceError ? error.kind : "failed";
}

function messageFor(error: unknown): string {
  return error instanceof ServiceError ? error.message : "Something went wrong. Please try again.";
}

export async function createProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readProjectForm(formData);
  const values = echo(raw);
  const parsed = projectFormSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const ctx = await requireAppContext();
  let id: string;
  try {
    id = await projects.createProject(ctx, toInput(parsed.data));
  } catch (error) {
    return { error: messageFor(error), values };
  }
  revalidatePath("/app/projects");
  return redirect(`/app/projects/${id}?notice=created`);
}

export async function updateProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readProjectForm(formData);
  const values = echo(raw);
  const id = uuid.safeParse(formData.get("projectId"));
  if (!id.success) return { error: "That project could not be found.", values };
  const parsed = projectFormSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const ctx = await requireAppContext();
  try {
    await projects.updateProject(ctx, id.data, toInput(parsed.data));
  } catch (error) {
    return { error: messageFor(error), values };
  }
  revalidatePath("/app/projects");
  return { success: true, message: "Saved.", values };
}

export async function setArchivedAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("projectId"));
  if (!id.success) redirect("/app/projects");
  const archived = formData.get("archived") === "true";
  const ctx = await requireAppContext();
  try {
    await projects.setProjectArchived(ctx, id.data, archived);
  } catch (error) {
    redirect(`/app/projects/${id.data}?error=${errorCode(error)}`);
  }
  revalidatePath("/app/projects");
  redirect(`/app/projects/${id.data}?notice=${archived ? "archived" : "restored"}`);
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("projectId"));
  if (!id.success) redirect("/app/projects");
  const ctx = await requireAppContext();
  try {
    await projects.deleteProject(ctx, id.data);
  } catch (error) {
    redirect(`/app/projects/${id.data}?error=${errorCode(error)}`);
  }
  revalidatePath("/app/projects");
  redirect("/app/projects?notice=deleted");
}
