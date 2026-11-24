/**
 * The words the approval card shows for a routine's schedule, from its cron
 * expression's minute and hour fields. Only the shapes the editor writes are
 * worded; anything else is shown as the expression itself.
 */
export function cronWords(minute: string, hour: string): string {
  const everyMinutes = /^\*\/(\d+)$/.exec(minute);
  if (everyMinutes && hour === '*') return `every ${Number(everyMinutes[1])} minutes`;
  const everyHours = /^\*\/(\d+)$/.exec(hour);
  if (/^\d+$/.test(minute) && everyHours) return `every ${Number(everyHours[1])} hours`;
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    return `every day at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }
  return `${minute} ${hour} * * *`;
}
