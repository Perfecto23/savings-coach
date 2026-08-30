const FALLBACK_LOCALE = "en-US";
const FALLBACK_CURRENCY = "USD";
const AMBIGUOUS_DOLLAR_SYMBOLS: Record<string, string> = {
  AUD: "A$",
  CAD: "CA$",
  HKD: "HK$",
  NZD: "NZ$",
  SGD: "S$",
  USD: "$",
};

function formatWith(formatter: Intl.NumberFormat, amount: number, currency: string) {
  const parts = formatter.formatToParts(amount);
  const currencyPart = parts.find((part) => part.type === "currency");

  if (currencyPart?.value !== "$" || !AMBIGUOUS_DOLLAR_SYMBOLS[currency]) {
    return parts.map((part) => part.value).join("");
  }

  return parts
    .map((part) =>
      part.type === "currency"
        ? AMBIGUOUS_DOLLAR_SYMBOLS[currency]
        : part.value
    )
    .join("");
}

export function formatMoney(
  amount: number,
  locale: string = FALLBACK_LOCALE,
  currency: string = FALLBACK_CURRENCY
) {
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatWith(formatter, amount, currency);
  } catch {
    const formatter = new Intl.NumberFormat(FALLBACK_LOCALE, {
      style: "currency",
      currency: FALLBACK_CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatWith(formatter, amount, FALLBACK_CURRENCY);
  }
}
