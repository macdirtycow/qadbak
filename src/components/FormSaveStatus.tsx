"use client";

export type FormSaveState = "idle" | "saving" | "saved" | "error";

export function FormSaveStatus({
  state,
  errorMessage,
  savedMessage = "Changes saved.",
}: {
  state: FormSaveState;
  errorMessage?: string | null;
  savedMessage?: string;
}) {
  if (state === "idle") return null;
  if (state === "saving") {
    return (
      <p className="text-sm text-panel-muted" role="status" aria-live="polite">
        Saving…
      </p>
    );
  }
  if (state === "saved") {
    return (
      <p
        className="text-sm text-emerald-400"
        role="status"
        aria-live="polite"
      >
        {savedMessage}
      </p>
    );
  }
  return (
    <p className="text-sm text-red-400" role="alert">
      {errorMessage ?? "Save failed. Try again."}
    </p>
  );
}
