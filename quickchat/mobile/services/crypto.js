import * as Crypto from 'expo-crypto';
import { x25519 } from '@noble/curves/ed25519';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { scrypt } from '@noble/hashes/scrypt';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

const CONVERSATION_INFO = utf8ToBytes('quickchat/conversation/v1');
const NOTES_INFO = utf8ToBytes('quickchat/notes/v1');

const SCRYPT_PARAMS = { N: 1 << 14, r: 8, p: 1, dkLen: 32 };
const NONCE_BYTES = 24;
const NONCE_HEX = NONCE_BYTES * 2;

export const MESSAGE_ALG = 'xc20p-v1';
export const NOTE_ALG = 'xc20p-v1';

export function isSupported() {
  try {
    return Boolean(
      Crypto &&
        typeof Crypto.getRandomBytes === 'function' &&
        x25519 &&
        xchacha20poly1305 &&
        scrypt
    );
  } catch (err) {
    return false;
  }
}

export function randomBytes(length) {
  return Crypto.getRandomBytes(length);
}

export function randomHex(length) {
  return bytesToHex(randomBytes(length));
}

export function generateIdentityKeyPair() {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);

  return { privateKey: bytesToHex(privateKey), publicKey: bytesToHex(publicKey) };
}

export function publicKeyFromPrivate(privateKeyHex) {
  return bytesToHex(x25519.getPublicKey(hexToBytes(privateKeyHex)));
}

export function deriveMasterKey(secretKey, saltHex) {
  return scrypt(utf8ToBytes(String(secretKey)), hexToBytes(saltHex), SCRYPT_PARAMS);
}

export function sealBackup(masterKey, payload) {
  const nonce = randomBytes(NONCE_BYTES);
  const plaintext = utf8ToBytes(JSON.stringify(payload));
  const ciphertext = xchacha20poly1305(masterKey, nonce).encrypt(plaintext);

  return bytesToHex(nonce) + bytesToHex(ciphertext);
}

export function openBackup(masterKey, blobHex) {
  if (typeof blobHex !== 'string' || blobHex.length <= NONCE_HEX) {
    throw new Error('INVALID_BACKUP');
  }

  const nonce = hexToBytes(blobHex.slice(0, NONCE_HEX));
  const ciphertext = hexToBytes(blobHex.slice(NONCE_HEX));
  const plaintext = xchacha20poly1305(masterKey, nonce).decrypt(ciphertext);

  return JSON.parse(bytesToUtf8(plaintext));
}

export function pairKey(a, b) {
  return [String(a), String(b)].sort().join('__');
}

export function deriveConversationKey(privateKeyHex, publicKeyHex, conversationPairKey) {
  const shared = x25519.getSharedSecret(hexToBytes(privateKeyHex), hexToBytes(publicKeyHex));

  return hkdf(sha256, shared, utf8ToBytes(conversationPairKey), CONVERSATION_INFO, 32);
}

export function deriveNotesKey(dataKeyHex) {
  return hkdf(sha256, hexToBytes(dataKeyHex), undefined, NOTES_INFO, 32);
}

export function encryptText(keyBytes, plaintext) {
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(keyBytes, nonce).encrypt(utf8ToBytes(String(plaintext)));

  return { cipher: bytesToHex(ciphertext), nonce: bytesToHex(nonce) };
}

export function decryptText(keyBytes, cipherHex, nonceHex) {
  const plaintext = xchacha20poly1305(keyBytes, hexToBytes(nonceHex)).decrypt(
    hexToBytes(cipherHex)
  );

  return bytesToUtf8(plaintext);
}
