import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
        <span className="text-2xl" aria-hidden="true">
          🔍
        </span>
      </div>
      <h2 className="mt-4 text-xl font-bold text-gray-900">页面未找到</h2>
      <p className="mt-2 text-sm text-gray-500">
        你访问的页面不存在或已被移除
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600"
      >
        返回首页
      </Link>
    </div>
  );
}
