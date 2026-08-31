import { isChineseLocale } from "@/lib/i18n/locale";

export interface AppFeedbackCopy {
  error: {
    iconTitle: string;
    title: string;
    errorId: string;
    description: string;
    retry: string;
    home: string;
  };
  notFound: {
    title: string;
    description: string;
    home: string;
  };
}

const ENGLISH_COPY: AppFeedbackCopy = {
  error: {
    iconTitle: "Error",
    title: "Something went wrong",
    errorId: "Error ID",
    description: "The page could not be loaded. Try again.",
    retry: "Try again",
    home: "Return home",
  },
  notFound: {
    title: "Page not found",
    description: "This page does not exist or has been removed.",
    home: "Return home",
  },
};

const CHINESE_COPY: AppFeedbackCopy = {
  error: {
    iconTitle: "错误",
    title: "出了点问题",
    errorId: "错误 ID",
    description: "无法加载页面，请重试。",
    retry: "重试",
    home: "返回首页",
  },
  notFound: {
    title: "页面未找到",
    description: "你访问的页面不存在或已被移除。",
    home: "返回首页",
  },
};

export function getAppFeedbackCopy(locale: string | null | undefined) {
  return isChineseLocale(locale) ? CHINESE_COPY : ENGLISH_COPY;
}
