"use client";

import { useState } from "react";
import { regenerateMilestones } from "@/app/(app)/income/actions";
import { useRouter } from "next/navigation";

export function RegenerateMilestonesButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleRegenerate() {
    setLoading(true);
    setMessage(null);
    const result = await regenerateMilestones();
    if (result.success) {
      setMessage(`已生成 ${result.data.length} 个月的里程碑`);
      router.refresh();
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage(result.error);
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span className="text-sm text-gray-500">{message}</span>
      )}
      <button
        type="button"
        onClick={handleRegenerate}
        disabled={loading}
        className="cursor-pointer rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-50"
      >
        {loading ? "生成中..." : "🔄 重新生成里程碑"}
      </button>
    </div>
  );
}
