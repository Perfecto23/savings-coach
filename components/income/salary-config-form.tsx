"use client";

import { useState } from "react";
import type { SalaryConfig } from "@/lib/types/database";
import { saveSalaryConfig } from "@/app/(app)/income/actions";
import { calculateYearlyTax } from "@/lib/tax-calculator";

interface SalaryConfigFormProps {
  config: SalaryConfig | null;
  onSaved?: (config: SalaryConfig) => void;
}

export function SalaryConfigForm({ config, onSaved }: SalaryConfigFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ min: number; max: number } | null>(
    () => {
      if (!config) return null;
      const breakdown = calculateYearlyTax({
        monthlyGross: config.monthly_gross,
        socialInsurance: config.social_insurance,
        housingFundRate: config.housing_fund_rate,
        housingFundBase: config.housing_fund_base ?? undefined,
        specialDeductions: config.special_deductions,
      });
      const nets = breakdown.map((b) => b.netIncome);
      return { min: Math.min(...nets), max: Math.max(...nets) };
    }
  );

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    if (config) formData.set("id", config.id);

    const result = await saveSalaryConfig(formData);
    if (result.success) {
      onSaved?.(result.data);
      const breakdown = calculateYearlyTax({
        monthlyGross: Number(formData.get("monthly_gross")),
        socialInsurance: Number(formData.get("social_insurance")),
        housingFundRate: Number(formData.get("housing_fund_rate")),
        housingFundBase: formData.get("housing_fund_base")
          ? Number(formData.get("housing_fund_base"))
          : undefined,
        specialDeductions: Number(formData.get("special_deductions")),
      });
      const nets = breakdown.map((b) => b.netIncome);
      setPreview({ min: Math.min(...nets), max: Math.max(...nets) });
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">薪资配置</h3>
      <p className="mt-1 text-sm text-gray-500">
        配置税前月薪和扣除项，系统将自动计算每月到手工资
      </p>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="monthly_gross" className="block text-sm font-medium text-gray-700">
              税前月薪（¥）
            </label>
            <input
              id="monthly_gross"
              name="monthly_gross"
              type="number"
              inputMode="decimal"
              step="0.01"
              required
              defaultValue={config?.monthly_gross ?? ""}
              placeholder="30000"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label htmlFor="social_insurance" className="block text-sm font-medium text-gray-700">
              社保个人月缴（¥）
            </label>
            <input
              id="social_insurance"
              name="social_insurance"
              type="number"
              inputMode="decimal"
              step="0.01"
              required
              defaultValue={config?.social_insurance ?? ""}
              placeholder="养老+医疗+失业"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label htmlFor="housing_fund_rate" className="block text-sm font-medium text-gray-700">
              公积金比例（%）
            </label>
            <input
              id="housing_fund_rate"
              name="housing_fund_rate"
              type="number"
              inputMode="decimal"
              step="0.01"
              required
              defaultValue={config?.housing_fund_rate ?? 12}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label htmlFor="housing_fund_base" className="block text-sm font-medium text-gray-700">
              公积金基数（¥）
            </label>
            <input
              id="housing_fund_base"
              name="housing_fund_base"
              type="number"
              inputMode="decimal"
              step="0.01"
              defaultValue={config?.housing_fund_base ?? ""}
              placeholder="默认=税前月薪"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label htmlFor="special_deductions" className="block text-sm font-medium text-gray-700">
              专项附加扣除月额（¥）
            </label>
            <input
              id="special_deductions"
              name="special_deductions"
              type="number"
              inputMode="decimal"
              step="0.01"
              required
              defaultValue={config?.special_deductions ?? ""}
              placeholder="租房/教育等"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label htmlFor="effective_from" className="block text-sm font-medium text-gray-700">
              生效起始月
            </label>
            <input
              id="effective_from"
              name="effective_from"
              type="date"
              required
              defaultValue={config?.effective_from ?? ""}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {preview && (
            <p className="text-sm text-gray-600">
              预估每月到手：
              <span className="font-semibold text-orange-600">
                ¥{preview.max.toLocaleString()}
              </span>
              {" ~ "}
              <span className="font-semibold text-orange-600">
                ¥{preview.min.toLocaleString()}
              </span>
              <span className="text-gray-400">（年初→年末）</span>
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "保存中..." : "保存配置"}
          </button>
        </div>
      </form>
    </div>
  );
}
