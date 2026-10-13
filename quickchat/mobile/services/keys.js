import * as crypto from './crypto';

const SALT_BYTES = 16;
const DATA_KEY_BYTES = 32;

let session = null;
const listeners = new Set();

function emit() {
  for (const listener of listeners) {
    try {
      listener(session);
    } catch (err) {
      console.warn('[crypto] key listener failed', err);
    }
  }
}

function setSession(next) {
  session = next;
  emit();
}

export function subscribe(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function isUnlocked() {
  return Boolean(session);
}

export function getSession() {
  return session;
}

export function lockKeys() {
  if (session) setSession(null);
}

function buildBundle(secretKey) {
  const kdfSalt = crypto.randomHex(SALT_BYTES);
  const masterKey = crypto.deriveMasterKey(secretKey, kdfSalt);
  const { privateKey, publicKey } = crypto.generateIdentityKeyPair();
  const dataKey = crypto.randomHex(DATA_KEY_BYTES);
  const keyBackup = crypto.sealBackup(masterKey, {
    v: 1,
    identityPriv: privateKey,
    dataKey,
  });

  return { publicKey, kdfSalt, keyBackup, identityPriv: privateKey, dataKey };
}

export function provisionKeys(secretKey, userId) {
  const bundle = buildBundle(secretKey);

  setSession({
    userId: userId ? String(userId) : null,
    identityPriv: bundle.identityPriv,
    identityPub: bundle.publicKey,
    dataKey: bundle.dataKey,
  });

  return { publicKey: bundle.publicKey, kdfSalt: bundle.kdfSalt, keyBackup: bundle.keyBackup };
}

export function adoptUserId(userId) {
  if (session) {
    session.userId = String(userId);
  }
}

export function unlockKeys({ userId, secretKey, kdfSalt, keyBackup }) {
  if (!kdfSalt || !keyBackup) return false;

  try {
    const masterKey = crypto.deriveMasterKey(secretKey, kdfSalt);
    const payload = crypto.openBackup(masterKey, keyBackup);

    if (!payload || !payload.identityPriv || !payload.dataKey) return false;

    setSession({
      userId: String(userId),
      identityPriv: payload.identityPriv,
      identityPub: crypto.publicKeyFromPrivate(payload.identityPriv),
      dataKey: payload.dataKey,
    });

    return true;
  } catch (err) {
    return false;
  }
}

export function rewrapBackup({ currentSecretKey, newSecretKey, kdfSalt, keyBackup }) {
  const payload = crypto.openBackup(crypto.deriveMasterKey(currentSecretKey, kdfSalt), keyBackup);
  const nextSalt = crypto.randomHex(SALT_BYTES);
  const masterKey = crypto.deriveMasterKey(newSecretKey, nextSalt);
  const nextBackup = crypto.sealBackup(masterKey, {
    v: 1,
    identityPriv: payload.identityPriv,
    dataKey: payload.dataKey,
  });

  return { publicKey: crypto.publicKeyFromPrivate(payload.identityPriv), kdfSalt: nextSalt, keyBackup: nextBackup };
}

function conversationKey(peerUserId, peerPublicKey) {
  if (!session || !session.userId || !session.identityPriv || !peerPublicKey) return null;

  try {
    return crypto.deriveConversationKey(
      session.identityPriv,
      peerPublicKey,
      crypto.pairKey(session.userId, peerUserId)
    );
  } catch (err) {
    return null;
  }
}

export function encryptMessage(peerUserId, peerPublicKey, text) {
  const key = conversationKey(peerUserId, peerPublicKey);

  if (!key) return null;

  try {
    const { cipher, nonce } = crypto.encryptText(key, text);

    return { cipher, nonce, alg: crypto.MESSAGE_ALG };
  } catch (err) {
    return null;
  }
}

export function decryptMessage(peerUserId, peerPublicKey, message) {
  if (!message || !message.alg || !message.cipher || !message.nonce) return null;

  const key = conversationKey(peerUserId, peerPublicKey);

  if (!key) return null;

  try {
    return crypto.decryptText(key, message.cipher, message.nonce);
  } catch (err) {
    return null;
  }
}

export function encryptNote({ title, content }) {
  if (!session) return null;

  try {
    const key = crypto.deriveNotesKey(session.dataKey);
    const payload = JSON.stringify({ title: title || '', content: content || '' });
    const { cipher, nonce } = crypto.encryptText(key, payload);

    return { cipher, nonce, alg: crypto.NOTE_ALG };
  } catch (err) {
    return null;
  }
}

export function decryptNote(note) {
  if (!note) return { title: '', content: '' };

  if (!note.alg || !note.cipher || !note.nonce) {
    return { title: note.title || '', content: note.content || '' };
  }

  if (!session) return null;

  try {
    const key = crypto.deriveNotesKey(session.dataKey);
    const parsed = JSON.parse(crypto.decryptText(key, note.cipher, note.nonce));

    return { title: parsed.title || '', content: parsed.content || '' };
  } catch (err) {
    return null;
  }
}
