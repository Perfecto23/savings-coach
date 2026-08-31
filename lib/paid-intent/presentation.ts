import type { PaidIntentErrorCode } from "./contracts";
import { isChineseLocale } from "../i18n/locale";

export interface PaidIntentCopy {
  recorded: {
    ariaLabel: string;
    label: string;
    title: string;
    description: string;
  };
  offer: {
    ariaLabel: string;
    label: string;
    title: string;
    description: string;
    price: string;
    disclaimer: string;
    recording: string;
    record: string;
    dismiss: string;
  };
  errors: Record<PaidIntentErrorCode, string>;
}

const ENGLISH_COPY: PaidIntentCopy = {
  recorded: {
    ariaLabel: "Pro beta interest",
    label: "Interest recorded",
    title: "You were not charged, and no subscription was created.",
    description:
      "This is a product-interest signal only. It does not unlock Pro or reserve a future price.",
  },
  offer: {
    ariaLabel: "Savings Coach Pro beta offer",
    label: "Pro beta interest",
    title: "Help shape Savings Coach Pro",
    description:
      "We are exploring scheduled reminders and richer Monthly Review guidance. Planned features are not available or guaranteed yet.",
    price: "US$4.99/month after launch",
    disclaimer:
      "Today: no charge. No card. No subscription. This records interest only; it does not start a trial or reserve a price.",
    recording: "Recording…",
    record: "I'm interested in Pro beta",
    dismiss: "Not now",
  },
  errors: {
    UNAUTHENTICATED: "Please sign in again.",
    NOT_ELIGIBLE: "Complete a Monthly Review before recording Pro beta interest.",
    RECORD_FAILED: "Pro beta interest could not be recorded. Try again.",
  },
};

const CHINESE_COPY: PaidIntentCopy = {
  recorded: {
    ariaLabel: "专业版内测付费意愿",
    label: "付费意愿已记录",
    title: "没有产生收费，也没有创建订阅。",
    description: "该记录只表示产品兴趣，不会解锁专业版，也不会保留未来价格。",
  },
  offer: {
    ariaLabel: "储蓄教练专业版内测方案",
    label: "专业版内测付费意愿",
    title: "参与完善储蓄教练专业版",
    description: "我们正在探索定时提醒和更丰富的月度复盘指引。计划中的功能尚未开放，也不保证交付。",
    price: "正式发布后每月 4.99 美元",
    disclaimer: "今天不会收费，无需银行卡，也不会创建订阅。该操作只记录兴趣，不会开始试用或保留价格。",
    recording: "记录中…",
    record: "我对专业版内测感兴趣",
    dismiss: "暂不考虑",
  },
  errors: {
    UNAUTHENTICATED: "请重新登录。",
    NOT_ELIGIBLE: "请先完成一次月度复盘，再记录专业版内测付费意愿。",
    RECORD_FAILED: "专业版内测付费意愿记录失败，请重试。",
  },
};

export function getPaidIntentCopy(locale: string | null | undefined): PaidIntentCopy {
  return isChineseLocale(locale) ? CHINESE_COPY : ENGLISH_COPY;
}
