import { CHINA_TIMEZONE } from "@/lib/constants";

export function getChinaDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: CHINA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("无法生成中国时区日期");
  }

  return `${year}-${month}-${day}`;
}

export function getChinaDateRange(dateString: string) {
  const normalizedDate = dateString.split("/").join("-");
  const [year, month, day] = normalizedDate.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("无效的日期格式");
  }

  const start = new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, -8, 0, 0, 0));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function getSessionExpireAt(createdAt: string, durationMinutes: number) {
  return new Date(new Date(createdAt).getTime() + durationMinutes * 60_000);
}

export function formatChinaDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: CHINA_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function formatChinaDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: CHINA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatPercent(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}
