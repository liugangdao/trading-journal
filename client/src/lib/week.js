export function currentWeekKey(date = new Date()) {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7))
  const year = day.getUTCFullYear()
  const first = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil((((day - first) / 86400000) + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function localMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
