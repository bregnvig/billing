const parts = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * `Thu 5 Nov, 08:02`, with the year only when it isn't the current one (ui-design skill).
 * Built from parts, because Intl's own punctuation changes when the year is included.
 */
export const formatDateTime = (d: Date, now = new Date()): string => {
  const p = Object.fromEntries(parts.formatToParts(d).map((x) => [x.type, x.value]));
  const year = d.getFullYear() === now.getFullYear() ? '' : ` ${p['year']}`;
  return `${p['weekday']} ${p['day']} ${p['month']}${year}, ${p['hour']}:${p['minute']}`;
};
