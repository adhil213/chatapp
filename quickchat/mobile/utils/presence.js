export function formatLastSeen(value) {
  if (!value) {
    return 'Offline';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Offline';
  }

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) {
    return 'Last seen just now';
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `Last seen ${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `Last seen ${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days === 1) {
    return 'Last seen yesterday';
  }

  if (days < 7) {
    return `Last seen ${days}d ago`;
  }

  return `Last seen ${date.toLocaleDateString()}`;
}

export function presenceLabel(presenceEntry) {
  if (!presenceEntry) {
    return '';
  }

  if (presenceEntry.online) {
    return 'Online';
  }

  return formatLastSeen(presenceEntry.lastSeen);
}
