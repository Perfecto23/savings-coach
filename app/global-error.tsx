"use client";

import { getAppFeedbackCopy } from "@/lib/app-shell/feedback-presentation";
import { APP_LOCALE } from "@/lib/product-locale";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const copy = getAppFeedbackCopy().error;

  return (
    <html lang={APP_LOCALE}>
      <body className="flex min-h-screen items-center justify-center bg-orange-50">
        <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-7 w-7 text-red-600"
          aria-hidden="true"
        >
          <title>{copy.iconTitle}</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>
      <h2 className="mt-4 text-xl font-bold text-gray-900">{copy.title}</h2>
      <p className="mt-2 text-sm text-gray-500">
        {error.digest ? `${copy.errorId}: ${error.digest}` : copy.description}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600"
      >
        {copy.retry}
      </button>
        </div>
      </body>
    </html>
  );
}
