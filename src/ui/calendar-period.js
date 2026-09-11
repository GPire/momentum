// Month browsing must never skip a month because the selected date is the 31st.
export function shiftCalendarMonth(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

// Compare civil Mondays through UTC day numbers, independent of DST hour changes.
export function weekOffsetForMonth(selected, today) {
  if (selected.getFullYear() === today.getFullYear() && selected.getMonth() === today.getMonth()) return 0;
  const end = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
  const mondayNumber = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7) / 86400000;
  return Math.min(0, Math.round((mondayNumber(end) - mondayNumber(today)) / 7));
}

// Horizontal tabs leave vertical arrow keys available for page scrolling.
export function calendarViewForKey(current, key) {
  if (!['week','month'].includes(current)) return null;
  if (key === 'Home') return 'week';
  if (key === 'End') return 'month';
  if (key === 'ArrowLeft' || key === 'ArrowRight') return current === 'week' ? 'month' : 'week';
  return null;
}

// Calendar position is a date fact, not a financial goal or a score.
export function calendarPosition(selected, today, week = false) {
  const dayNumber = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  const start = week
    ? new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - (selected.getDay() + 6) % 7)
    : new Date(selected.getFullYear(), selected.getMonth(), 1);
  const total = week ? 7 : new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
  const day = Math.max(0, Math.min(total, dayNumber(today) - dayNumber(start) + 1));
  return { day, total, progress: day / total * 100 };
}
