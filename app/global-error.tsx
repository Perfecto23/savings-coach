"use client";

import type { AppFeedbackCopy } from "@/lib/app-shell/feedback-presentation";
import { getAppFeedbackCopy } from "@/lib/app-shell/feedback-presentation";

const localeBootstrap = `(() => {
  const match = document.cookie.match(/(?:^|; )savings-coach-locale=([^;]*)/);
  const cookieLocale = match ? decodeURIComponent(match[1]) : "";
  const locale = /^(en-US|en-SG|zh-CN)$/.test(cookieLocale)
    ? cookieLocale
    : navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
  document.documentElement.lang = locale;
})();`;

function ErrorPanel({
  copy,
  error,
  reset,
  className,
  locale,
}: {
  copy: AppFeedbackCopy["error"];
  error: Error & { digest?: string };
  reset: () => void;
  className: string;
  locale: "en-US" | "zh-CN";
}) {
  return (
    <div
      lang={locale}
      className={`${className} mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg`}
    >
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
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-US" suppressHydrationWarning>
      <head>
        <style>{`.locale-zh { display: none; } html[lang="zh-CN"] .locale-en { display: none; } html[lang="zh-CN"] .locale-zh { display: block; }`}</style>
        <script dangerouslySetInnerHTML={{ __html: localeBootstrap }} />
      </head>
      <body className="flex min-h-screen items-center justify-center bg-orange-50">
        <ErrorPanel
          className="locale-en"
          locale="en-US"
          copy={getAppFeedbackCopy("en-US").error}
          error={error}
          reset={reset}
        />
        <ErrorPanel
          className="locale-zh"
          locale="zh-CN"
          copy={getAppFeedbackCopy("zh-CN").error}
          error={error}
          reset={reset}
        />
      </body>
    </html>
  );
}
