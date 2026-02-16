/**
 * 中国个人所得税 — 累计预扣预缴法
 *
 * 公式：
 *   月应纳税所得额 = 税前 - 社保个人 - 公积金个人 - 5000(起征点) - 专项附加扣除
 *   累计应纳税所得额 = Σ 月应纳税所得额 (从1月累计)
 *   累计应纳税额 = 累计应纳税所得额 × 税率 - 速算扣除数
 *   当月个税 = 累计应纳税额 - 已累计预缴税额
 */

const TAX_BRACKETS = [
  { ceiling: 36000, rate: 0.03, deduction: 0 },
  { ceiling: 144000, rate: 0.10, deduction: 2520 },
  { ceiling: 300000, rate: 0.20, deduction: 16920 },
  { ceiling: 420000, rate: 0.25, deduction: 31920 },
  { ceiling: 660000, rate: 0.30, deduction: 52920 },
  { ceiling: 960000, rate: 0.35, deduction: 85920 },
  { ceiling: Infinity, rate: 0.45, deduction: 181920 },
];

export interface TaxInput {
  monthlyGross: number;
  socialInsurance: number;
  housingFundRate: number;
  housingFundBase?: number;
  specialDeductions: number;
}

export interface MonthlyBreakdown {
  month: number;
  gross: number;
  socialInsurance: number;
  housingFund: number;
  taxableIncome: number;
  cumulativeTaxable: number;
  cumulativeTax: number;
  monthlyTax: number;
  netIncome: number;
  housingFundCompany: number;
}

export function calculateYearlyTax(input: TaxInput): MonthlyBreakdown[] {
  const base = input.housingFundBase ?? input.monthlyGross;
  const housingFund = Math.round((base * input.housingFundRate) / 100);
  const housingFundCompany = housingFund;

  const monthlyDeduction =
    input.socialInsurance + housingFund + 5000 + input.specialDeductions;

  const results: MonthlyBreakdown[] = [];
  let cumulativeTaxable = 0;
  let cumulativeTax = 0;

  for (let m = 1; m <= 12; m++) {
    const taxableIncome = Math.max(0, input.monthlyGross - monthlyDeduction);
    cumulativeTaxable += taxableIncome;

    const bracket =
      TAX_BRACKETS.find((b) => cumulativeTaxable <= b.ceiling) ??
      TAX_BRACKETS[TAX_BRACKETS.length - 1];

    const newCumulativeTax =
      cumulativeTaxable * bracket.rate - bracket.deduction;
    const monthlyTax = Math.max(
      0,
      Math.round((newCumulativeTax - cumulativeTax) * 100) / 100
    );
    cumulativeTax = newCumulativeTax;

    results.push({
      month: m,
      gross: input.monthlyGross,
      socialInsurance: input.socialInsurance,
      housingFund,
      taxableIncome,
      cumulativeTaxable,
      cumulativeTax,
      monthlyTax,
      netIncome:
        input.monthlyGross - input.socialInsurance - housingFund - monthlyTax,
      housingFundCompany,
    });
  }

  return results;
}
