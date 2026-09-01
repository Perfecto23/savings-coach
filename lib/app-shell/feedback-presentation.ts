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

const COPY: AppFeedbackCopy = {
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

export function getAppFeedbackCopy(): AppFeedbackCopy {
  return COPY;
}
