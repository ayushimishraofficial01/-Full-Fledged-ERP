const WEEKDAY_INDEX = Object.freeze({
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
});

function officeTimeParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    weekday: WEEKDAY_INDEX[values.weekday],
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function isWithinOfficeHours(schedule, date = new Date()) {
  if (!schedule?.startTime || !schedule?.endTime) return true;
  const local = officeTimeParts(date, schedule.timezone || 'Asia/Kolkata');
  const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
  const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return schedule.weekdays.includes(local.weekday) && local.minutes >= start && local.minutes < end;
}

module.exports = { isWithinOfficeHours };
