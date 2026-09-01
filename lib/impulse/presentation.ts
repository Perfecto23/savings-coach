export interface ImpulseCopy {
  page: {
    title: string;
    description: string;
  };
  counter: {
    label: string;
    description: string;
  };
  form: {
    title: string;
    description: string;
    itemLabel: string;
    itemPlaceholder: string;
    amountLabel: string;
    amountPlaceholder: string;
    reasonLabel: string;
    reasonPlaceholder: string;
    submit: string;
    submitting: string;
  };
  list: {
    title: string;
    empty: string;
    amountAriaLabel: string;
    delete: string;
    deleteConfirm: string;
    deleteError: string;
  };
  errors: Record<string, string>;
}

const COPY: ImpulseCopy = {
  page: {
    title: "冲动拦截",
    description: "记录一次决定放弃的计划外购买，但不把拦截金额算作已确认储蓄。",
  },
  counter: {
    label: "拦截金额",
    description: "你决定不购买物品的预估价格。该金额不是已确认储蓄。",
  },
  form: {
    title: "记录一次冲动拦截",
    description: "记录你决定不买物品的预估价格。该金额不是已确认储蓄。",
    itemLabel: "你决定不买什么？",
    itemPlaceholder: "例如：降噪耳机",
    amountLabel: "拦截金额",
    amountPlaceholder: "3999",
    reasonLabel: "你为什么停下来？",
    reasonPlaceholder: "例如：先等一周再决定",
    submit: "记录冲动拦截",
    submitting: "记录中…",
  },
  list: {
    title: "冲动拦截记录",
    empty: "还没有冲动拦截记录。下次决定不买计划外物品时，可以记录下来。",
    amountAriaLabel: "拦截金额",
    delete: "删除",
    deleteConfirm: "删除这条冲动拦截记录？",
    deleteError: "无法删除冲动拦截记录，请重试。",
  },
  errors: {
    UNAUTHENTICATED: "请重新登录。",
    INVALID_ITEM_NAME: "请输入你决定不买的物品。",
    INVALID_AMOUNT: "请输入有效的正数拦截金额。",
    INVALID_CATEGORY: "请输入有效分类。",
    NOT_FOUND: "找不到该冲动拦截记录。",
    SAVE_FAILED: "无法保存冲动拦截记录，请重试。",
  },
};

export function getImpulseCopy(): ImpulseCopy {
  return COPY;
}

export function getImpulseErrorMessage(error: string, copy: ImpulseCopy): string {
  return copy.errors[error] ?? copy.errors.SAVE_FAILED;
}

export function formatImpulseDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
}
