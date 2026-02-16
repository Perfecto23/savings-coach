"use client";

import { useState } from "react";
import type { AiConfig } from "@/lib/types/database";
import {
  deleteAiConfig,
  saveAiConfig,
  setActiveAiConfig,
} from "@/app/(app)/settings/actions";

interface AiConfigFormProps {
  initialConfigs: AiConfig[];
}

export function AiConfigManager({ initialConfigs }: AiConfigFormProps) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  async function handleCreate(formData: FormData) {
    setLoading(true);
    setError(null);
    formData.set("is_active", String(configs.length === 0));
    const result = await saveAiConfig(formData);
    if (result.success) {
      setConfigs((prev) => [...prev, result.data]);
      setShowForm(false);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  async function handleSetActive(id: string) {
    const result = await setActiveAiConfig(id);
    if (result.success) {
      setConfigs((prev) =>
        prev.map((c) => ({ ...c, is_active: c.id === id }))
      );
    } else {
      setError(result.error);
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteAiConfig(id);
    if (result.success) {
      setConfigs((prev) => prev.filter((c) => c.id !== id));
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {configs.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          还没有 AI 配置，点击下方按钮添加。
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <div
              key={config.id}
              className={`rounded-xl border p-4 transition-colors ${
                config.is_active
                  ? "border-orange-300 bg-orange-50/50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">
                      {config.provider_name}
                    </h4>
                    {config.is_active && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        当前使用
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    模型: {config.model_name}
                  </p>
                  <p className="text-sm text-gray-400">URL: {config.api_url}</p>
                  <p className="text-sm text-gray-400">
                    Key:{" "}
                    {showKeys[config.id]
                      ? config.api_key
                      : `••••••••${config.api_key.length > 4 ? config.api_key.slice(-4) : "••••"}`}
                    <button
                      type="button"
                      onClick={() =>
                        setShowKeys((prev) => ({
                          ...prev,
                          [config.id]: !prev[config.id],
                        }))
                      }
                      className="ml-2 cursor-pointer text-xs text-orange-500 hover:text-orange-600"
                    >
                      {showKeys[config.id] ? "隐藏" : "显示"}
                    </button>
                  </p>
                </div>

                <div className="flex gap-2">
                  {!config.is_active && (
                    <button
                      type="button"
                      onClick={() => handleSetActive(config.id)}
                      className="cursor-pointer rounded-lg bg-orange-100 px-3 py-1.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-200"
                    >
                      设为当前
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(config.id)}
                    className="cursor-pointer rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-700">添加 AI 模型配置</h4>
          <form action={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="provider_name" className="block text-sm font-medium text-gray-700">
                  提供商名称
                </label>
                <input
                  id="provider_name"
                  name="provider_name"
                  type="text"
                  required
                  placeholder="如：OpenAI"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label htmlFor="model_name" className="block text-sm font-medium text-gray-700">
                  模型名称
                </label>
                <input
                  id="model_name"
                  name="model_name"
                  type="text"
                  required
                  placeholder="如：gpt-4o"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="api_url" className="block text-sm font-medium text-gray-700">
                API URL
              </label>
              <input
                id="api_url"
                name="api_url"
                type="url"
                required
                placeholder="如：https://api.openai.com/v1"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div>
              <label htmlFor="api_key" className="block text-sm font-medium text-gray-700">
                API Key
              </label>
              <input
                id="api_key"
                name="api_key"
                type="password"
                required
                placeholder="sk-..."
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                {loading ? "保存中..." : "添加"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full cursor-pointer rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-400 transition-colors hover:border-orange-300 hover:text-orange-500"
        >
          + 添加 AI 模型配置
        </button>
      )}
    </div>
  );
}
