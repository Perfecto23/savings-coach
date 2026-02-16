"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-7 w-7 text-red-600"
          aria-hidden="true"
        >
          <title>错误</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>
      <h2 className="mt-4 text-xl font-bold text-gray-900">出了点问题</h2>
      <p className="mt-2 text-sm text-gray-500">
        {error.digest
          ? `错误 ID: ${error.digest}`
          : "加载页面时发生错误，请重试"}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
        >
          重试
        </button>
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
