export interface ReviewReminderEmailInput {
  appBaseUrl: string;
  deliveryId: string;
  from: string;
  recipientEmail: string;
  reviewYearMonth: string;
  supabaseUrl: string;
  unsubscribeToken: string;
}

export interface ResendEmailPayload {
  from: string;
  headers: Record<string, string>;
  html: string;
  subject: string;
  text: string;
  to: string[];
}

export interface ReviewReminderEmail {
  idempotencyKey: string;
  payload: ResendEmailPayload;
  unsubscribeUrl: string;
}

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

function parseAbsoluteHttpUrl(value: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name}_invalid`);
  }
  const localHttp = url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (
    (url.protocol !== "https:" && !localHttp) || url.username || url.password
  ) {
    throw new Error(`${name}_invalid`);
  }
  return url;
}

export function isValidEmailAddress(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 &&
    !value.includes("\r") && !value.includes("\n") && EMAIL_PATTERN.test(value);
}

export function isValidFromAddress(value: unknown): value is string {
  if (
    typeof value !== "string" || value.length > 320 ||
    value.includes("\r") || value.includes("\n")
  ) {
    return false;
  }
  if (isValidEmailAddress(value)) return true;
  const match = /^([^<>]{1,100})\s<([^<>]+)>$/.exec(value);
  return Boolean(match && match[1].trim() && isValidEmailAddress(match[2]));
}

export function validateReviewReminderConfiguration(input: {
  appBaseUrl: string;
  from: string;
  supabaseUrl: string;
}): boolean {
  if (!isValidFromAddress(input.from)) return false;
  try {
    parseAbsoluteHttpUrl(input.appBaseUrl, "app_base_url");
    parseAbsoluteHttpUrl(input.supabaseUrl, "supabase_url");
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatReviewMonth(yearMonth: string): string {
  if (!YEAR_MONTH_PATTERN.test(yearMonth)) {
    throw new Error("review_year_month_invalid");
  }
  const [year, month] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function buildReviewReminderEmail(
  input: ReviewReminderEmailInput,
): ReviewReminderEmail {
  if (!UUID_PATTERN.test(input.deliveryId)) {
    throw new Error("delivery_id_invalid");
  }
  if (!UUID_PATTERN.test(input.unsubscribeToken)) {
    throw new Error("unsubscribe_token_invalid");
  }
  if (!isValidFromAddress(input.from)) throw new Error("from_invalid");
  if (!isValidEmailAddress(input.recipientEmail)) {
    throw new Error("recipient_email_invalid");
  }

  const appBaseUrl = parseAbsoluteHttpUrl(input.appBaseUrl, "app_base_url");
  const supabaseUrl = parseAbsoluteHttpUrl(input.supabaseUrl, "supabase_url");
  const reviewLabel = formatReviewMonth(input.reviewYearMonth);
  const reviewUrl = new URL(
    `/milestones/${input.reviewYearMonth}/report`,
    appBaseUrl,
  ).toString();
  const unsubscribeUrl = new URL(
    "/functions/v1/review-reminder-unsubscribe",
    supabaseUrl,
  );
  unsubscribeUrl.searchParams.set("token", input.unsubscribeToken);

  const safeReviewLabel = escapeHtml(reviewLabel);
  const safeReviewUrl = escapeHtml(reviewUrl);
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl.toString());
  const preheader = "登录储蓄教练，完成月度复盘。";
  const text = [
    `你的 ${reviewLabel}月度复盘已准备好。`,
    "",
    preheader,
    `打开月度复盘：${reviewUrl}`,
    "",
    "你收到此提醒，是因为你已在设置中启用月度复盘邮件提醒。",
    "",
    `退订月度复盘邮件提醒：${unsubscribeUrl}`,
  ].join("\n");
  const html = [
    '<!doctype html><html lang="zh-CN"><body>',
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${
      escapeHtml(preheader)
    }</div>`,
    `<p>你的 ${safeReviewLabel}月度复盘已准备好。</p>`,
    `<p>${escapeHtml(preheader)}</p>`,
    `<p><a href="${safeReviewUrl}">打开月度复盘</a></p>`,
    "<p>你收到此提醒，是因为你已在设置中启用月度复盘邮件提醒。</p>",
    `<p><a href="${safeUnsubscribeUrl}">退订月度复盘邮件提醒</a></p>`,
    "</body></html>",
  ].join("");

  return {
    idempotencyKey: input.deliveryId,
    unsubscribeUrl: unsubscribeUrl.toString(),
    payload: {
      from: input.from,
      to: [input.recipientEmail],
      subject: `请完成 ${reviewLabel}月度复盘`,
      text,
      html,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl.toString()}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    },
  };
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isValidYearMonth(value: unknown): value is string {
  return typeof value === "string" && YEAR_MONTH_PATTERN.test(value);
}
