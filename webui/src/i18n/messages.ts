import { en } from "./locales/en";
import { zh } from "./locales/zh";

export type Locale = "en-US" | "zh-CN";
export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export const messages: Record<Locale, Messages> = {
  "en-US": en,
  "zh-CN": zh
};

export function normalizeLocale(value: string | undefined): Locale {
  if (value?.toLowerCase().startsWith("en")) {
    return "en-US";
  }
  return "zh-CN";
}
