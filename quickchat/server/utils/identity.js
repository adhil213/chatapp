const { HttpError } = require('../middleware/error');

const PUBLIC_KEY_RE = /^[0-9a-f]{32,128}$/i;
const SALT_RE = /^[0-9a-f]{16,64}$/i;
const BACKUP_RE = /^[0-9a-f]{48,80000}$/i;

function readIdentity(body) {
  const publicKey = body && body.publicKey;
  const kdfSalt = body && body.kdfSalt;
  const keyBackup = body && body.keyBackup;

  if (publicKey === undefined && kdfSalt === undefined && keyBackup === undefined) {
    return { present: false };
  }

  if (
    typeof publicKey !== 'string' ||
    typeof kdfSalt !== 'string' ||
    typeof keyBackup !== 'string' ||
    !PUBLIC_KEY_RE.test(publicKey) ||
    !SALT_RE.test(kdfSalt) ||
    !BACKUP_RE.test(keyBackup)
  ) {
    throw new HttpError(400, 'Invalid encryption identity', 'INVALID_IDENTITY');
  }

  return { present: true, publicKey, kdfSalt, keyBackup };
}

function applyIdentity(user, identity) {
  if (!identity.present) return;

  user.publicKey = identity.publicKey;
  user.kdfSalt = identity.kdfSalt;
  user.keyBackup = identity.keyBackup;
}

module.exports = { readIdentity, applyIdentity };
