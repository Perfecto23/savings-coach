"use client";

import { useState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-amber-50 to-orange-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-orange-500" aria-hidden="true">
              <title>储蓄教练</title>
              <path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5c.214 0 .425.015.633.045A4.483 4.483 0 0 1 9 3c1.262 0 2.41.52 3.228 1.357A4.489 4.489 0 0 1 15 3c1.141 0 2.183.425 2.976 1.125A4.483 4.483 0 0 1 18.75 4.5c.214 0 .425.015.633.045A4.483 4.483 0 0 1 22.5 6v.923a2.112 2.112 0 0 1-1.029 1.81l-.141.08c-1.209.688-2.786.374-3.618-.834a3.61 3.61 0 0 0-2.468-1.604A4.487 4.487 0 0 1 12 8.25a4.487 4.487 0 0 1-3.244-1.375 3.61 3.61 0 0 0-2.468 1.604c-.832 1.208-2.41 1.522-3.618.834l-.141-.08A2.112 2.112 0 0 1 1.5 7.423V6c0-.614.123-1.199.345-1.733.074-.176.161-.346.26-.508l.168-.243Z" />
              <path fillRule="evenodd" d="M12 2.25c-2.429 0-4.467 1.692-4.958 3.962a.75.75 0 0 1-1.476-.259C6.166 2.955 8.838 1.5 12 1.5c3.162 0 5.834 1.455 6.434 4.453a.75.75 0 0 1-1.476.259C16.467 3.942 14.429 2.25 12 2.25Z" clipRule="evenodd" />
              <path d="M21 12.75a.75.75 0 0 0-1.5 0v1.434l-2.872-1.238a.75.75 0 0 0-.594 1.377l3.278 1.413A3.75 3.75 0 0 1 21 19.101V21a.75.75 0 0 0 1.5 0v-1.899a5.25 5.25 0 0 0-3.006-4.742L21 13.434V12.75ZM3 12.75a.75.75 0 0 1 1.5 0v1.434l2.872-1.238a.75.75 0 0 1 .594 1.377l-3.278 1.413A3.75 3.75 0 0 0 3 19.101V21a.75.75 0 0 1-1.5 0v-1.899a5.25 5.25 0 0 1 3.006-4.742L3 13.434V12.75Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">储蓄教练</h1>
          <p className="mt-1 text-sm text-gray-500">登录以继续你的储蓄之旅</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              邮箱
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-lg bg-orange-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
