import Link from "next/link";
import { getAppFeedbackCopy } from "@/lib/app-shell/feedback-presentation";
import { getSetupState } from "@/lib/setup/server";

export default async function NotFound() {
  const setup = await getSetupState();
  const locale = setup.preferences?.locale ?? "en-US";
  const copy = getAppFeedbackCopy(locale).notFound;

  return (
    <div lang={locale} className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
        <span className="text-2xl" aria-hidden="true">
          🔍
        </span>
      </div>
      <h2 className="mt-4 text-xl font-bold text-gray-900">{copy.title}</h2>
      <p className="mt-2 text-sm text-gray-500">
        {copy.description}
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600"
      >
        {copy.home}
      </Link>
    </div>
  );
}
