/** 网站运行时间：按日历单位显示，并保留每秒更新。 */

export const SITE_STARTED_AT = '2026-10-04T22:50:16+08:00';

function addYears(date, years) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function uptimeParts(now = new Date(), startedAt = SITE_STARTED_AT) {
  const start = new Date(startedAt);
  if (!Number.isFinite(start.getTime()) || now < start) {
    return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  let cursor = start;
  let years = 0;
  while (addYears(cursor, years + 1) <= now) years += 1;
  cursor = addYears(cursor, years);

  let months = 0;
  while (addMonths(cursor, months + 1) <= now) months += 1;
  cursor = addMonths(cursor, months);

  const remainingMs = now.getTime() - cursor.getTime();
  const days = Math.floor(remainingMs / 86400000);
  const hours = Math.floor((remainingMs % 86400000) / 3600000);
  const minutes = Math.floor((remainingMs % 3600000) / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  return { years, months, days, hours, minutes, seconds };
}

export function formatUptime(now = new Date(), startedAt = SITE_STARTED_AT) {
  const parts = uptimeParts(now, startedAt);
  return `${parts.years}年${parts.months}月${parts.days}日${parts.hours}小时${parts.minutes}分钟${parts.seconds}秒`;
}

export function mountUptime(root, startedAt = SITE_STARTED_AT) {
  const target = root?.querySelector('[data-site-uptime]');
  if (!target) return () => {};

  const update = () => {
    target.textContent = formatUptime(new Date(), startedAt);
    target.dateTime = new Date().toISOString();
  };
  update();
  const timer = window.setInterval(update, 1000);
  return () => window.clearInterval(timer);
}
