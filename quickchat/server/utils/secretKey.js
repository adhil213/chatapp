const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

function validateSecretKey(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return { error: 'Secret key is required' };
  }

  if (/\s/.test(value)) {
    return { error: 'Secret key cannot contain spaces' };
  }

  if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
    return { error: `Secret key must be ${MIN_LENGTH}-${MAX_LENGTH} characters` };
  }

  if (!/[A-Za-z]/.test(value)) {
    return { error: 'Secret key must include at least one letter' };
  }

  if (!/[0-9]/.test(value)) {
    return { error: 'Secret key must include at least one number' };
  }

  return { secretKey: value };
}

module.exports = { validateSecretKey, MIN_LENGTH, MAX_LENGTH };
