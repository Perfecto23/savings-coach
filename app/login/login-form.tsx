"use client";

import { useRef, useState } from "react";
import type { PublicCopy } from "@/lib/public/presentation";
import { login } from "./actions";

export function LoginForm({ copy }: { copy: PublicCopy["login"] }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!email) {
      setError(copy.emailRequired);
      emailRef.current?.focus();
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(copy.emailInvalid);
      emailRef.current?.focus();
      return;
    }
    if (!password) {
      setError(copy.passwordRequired);
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    const result = await login(formData);
    if (result?.error) {
      setError(copy.error);
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          {copy.email}
        </label>
        <input
          id="email"
          ref={emailRef}
          name="email"
          type="email"
          required
          autoComplete="email"
          spellCheck={false}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          {copy.password}
        </label>
        <input
          id="password"
          ref={passwordRef}
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>

      {error ? (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full cursor-pointer rounded-lg bg-orange-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
