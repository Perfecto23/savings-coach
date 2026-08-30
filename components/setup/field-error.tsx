import type { SetupFormError } from "@/lib/setup/contracts";

interface FieldErrorProps {
  id: string;
  field: string;
  error: SetupFormError | null;
}

export function FieldError({ id, field, error }: FieldErrorProps) {
  if (error?.field !== field) return null;

  return (
    <p id={id} className="mt-2 text-sm font-medium text-red-700">
      {error.message}
    </p>
  );
}
