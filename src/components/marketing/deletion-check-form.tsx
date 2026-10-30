/** The box where a person types the confirmation code of a deletion request started from Facebook. */
export function DeletionCheckForm() {
  return (
    <form action="/data-deletion/status" method="get" className="mt-3 flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-ink-700">
          Confirmation code
        </label>
        <input
          id="code"
          name="code"
          required
          maxLength={64}
          pattern="[A-Za-z0-9_-]{8,64}"
          autoComplete="off"
          className="mt-1 h-11 w-64 rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>
      <button type="submit" className="h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-800">
        Check status
      </button>
    </form>
  );
}
