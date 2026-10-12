const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validateUsername(value) {
  const username = normalizeUsername(value);

  if (!USERNAME_PATTERN.test(username)) {
    return { error: 'username must be 3-20 characters using a-z, 0-9 or _' };
  }

  return { username };
}

const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N} ._-]+$/u;

function validateDisplayName(value) {
  if (typeof value !== 'string') {
    return { error: 'displayName is required' };
  }

  const displayName = value.trim().replace(/\s+/g, ' ');

  if (displayName.length < 2 || displayName.length > 32) {
    return { error: 'displayName must be between 2 and 32 characters' };
  }

  if (!DISPLAY_NAME_PATTERN.test(displayName)) {
    return { error: 'displayName may only contain letters, numbers, spaces, dot, underscore or hyphen' };
  }

  return { displayName };
}

module.exports = { normalizeUsername, validateUsername, validateDisplayName };
