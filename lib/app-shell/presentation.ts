import type { AppLocale } from "@/lib/product-locale";

export interface AppShellCopy {
  locale: AppLocale;
  brand: string;
  navigationLabel: string;
  navigation: {
    home: string;
    plan: string;
    sop: string;
    balances: string;
    income: string;
    milestones: string;
    impulse: string;
    settings: string;
  };
  mobile: {
    home: string;
    plan: string;
    sop: string;
    balances: string;
    more: string;
    moreMenu: string;
    closeMore: string;
  };
  logout: string;
}

const COPY: AppShellCopy = {
  locale: "zh-CN",
  brand: "储蓄教练",
  navigationLabel: "主导航",
  navigation: {
    home: "仪表盘",
    plan: "储蓄计划",
    sop: "月度 SOP",
    balances: "余额记录",
    income: "收入管理",
    milestones: "里程碑",
    impulse: "冲动拦截",
    settings: "设置",
  },
  mobile: {
    home: "首页",
    plan: "计划",
    sop: "SOP",
    balances: "余额",
    more: "更多",
    moreMenu: "更多导航",
    closeMore: "关闭更多导航",
  },
  logout: "退出登录",
};

export function getAppShellCopy(): AppShellCopy {
  return COPY;
}
