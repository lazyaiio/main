import { deleteProjectAction, setArchivedAction } from "@/app/app/projects/actions";
import { Button } from "@/components/ui/button";

export function ProjectDangerZone({
  projectId,
  archived,
  canDelete,
}: {
  projectId: string;
  archived: boolean;
  canDelete: boolean;
}) {
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
      <h2 className="font-display text-lg font-bold">Archive or delete</h2>
      <p className="mt-1 text-sm text-ink-600">
        Archiving hides the project from new work but keeps everything made from it.
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <form action={setArchivedAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="archived" value={archived ? "false" : "true"} />
          <Button type="submit" variant="secondary">
            {archived ? "Restore project" : "Archive project"}
          </Button>
        </form>

        {canDelete ? (
          <details className="rounded-xl border border-red-100 bg-red-50/50 px-4 py-2.5">
            <summary className="cursor-pointer list-none text-sm font-semibold text-red-700 [&::-webkit-details-marker]:hidden">
              Delete project…
            </summary>
            <form action={deleteProjectAction} className="mt-3 space-y-3">
              <input type="hidden" name="projectId" value={projectId} />
              <p className="max-w-sm text-sm text-ink-700">
                This permanently deletes the project. It cannot be undone. Projects that already
                have campaigns or posts cannot be deleted; archive them instead.
              </p>
              <button
                type="submit"
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Yes, delete this project
              </button>
            </form>
          </details>
        ) : null}
      </div>
    </section>
  );
}
