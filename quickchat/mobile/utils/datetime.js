const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDate(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function localDayKey(value) {
  const date = toDate(value);

  if (!date) return '';

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatMessageTime(value) {
  const date = toDate(value);

  if (!date) return '';

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function formatDayLabel(value) {
  const date = toDate(value);

  if (!date) return '';

  const today = new Date();
  const key = localDayKey(date);

  if (key === localDayKey(today)) return 'Today';

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (key === localDayKey(yesterday)) return 'Yesterday';

  const base = `${MONTHS[date.getMonth()]} ${date.getDate()}`;

  return date.getFullYear() === today.getFullYear() ? base : `${base}, ${date.getFullYear()}`;
}

export function formatConversationTime(value) {
  const date = toDate(value);

  if (!date) return '';

  const now = new Date();
  const key = localDayKey(date);

  if (key === localDayKey(now)) return formatMessageTime(date);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (key === localDayKey(yesterday)) return 'Yesterday';

  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / MS_PER_DAY);

  if (diffDays >= 0 && diffDays < 7) return WEEKDAYS[date.getDay()];

  const base = `${MONTHS[date.getMonth()]} ${date.getDate()}`;

  return date.getFullYear() === now.getFullYear() ? base : `${base}, ${date.getFullYear()}`;
}
