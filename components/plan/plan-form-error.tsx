import type { PlanFormError } from "@/lib/plan/contracts";

export function PlanFormErrorMessage({
  id,
  field,
  error,
}: {
  id: string;
  field: PlanFormError["field"];
  error: PlanFormError | null;
}) {
  if (!error || error.field !== field) return null;

  return (
    <p id={id} className="mt-2 text-sm leading-5 text-red-700">
      {error.message}
    </p>
  );
}
