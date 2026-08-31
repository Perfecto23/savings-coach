export function PlanFormErrorMessage({
  id,
  message,
}: {
  id: string;
  message: string | null;
}) {
  if (!message) return null;

  return (
    <p id={id} className="mt-2 text-sm leading-5 text-red-700">
      {message}
    </p>
  );
}
