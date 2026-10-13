const express = require('express');
const mongoose = require('mongoose');

const Note = require('../models/Note');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/error');
const { serializeNote } = require('../utils/serialize');

const router = express.Router();

const MAX_TITLE = 128;
const MAX_CONTENT = 10000;
const MAX_CIPHER = 60000;
const MAX_NONCE = 128;
const MAX_ALG = 32;
const MAX_NOTES = 500;

function sanitize(body) {
  const rawTitle = body && body.title;
  const rawContent = body && body.content;
  const rawCipher = body && body.cipher;
  const rawNonce = body && body.nonce;
  const rawAlg = body && body.alg;

  const hasCipher =
    typeof rawCipher === 'string' && rawCipher.length > 0 && typeof rawNonce === 'string' && rawNonce.length > 0;

  if (hasCipher) {
    if (rawCipher.length > MAX_CIPHER) {
      throw new HttpError(400, 'Encrypted note is too long', 'INVALID_NOTE');
    }

    if (typeof rawNonce !== 'string' || rawNonce.length > MAX_NONCE) {
      throw new HttpError(400, 'Invalid note nonce', 'INVALID_NOTE');
    }

    const alg = typeof rawAlg === 'string' && rawAlg.length > 0 ? rawAlg : 'xc20p-v1';

    if (alg.length > MAX_ALG) {
      throw new HttpError(400, 'Invalid note algorithm', 'INVALID_NOTE');
    }

    return { title: '', content: '', cipher: rawCipher, nonce: rawNonce, alg };
  }

  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  const content = typeof rawContent === 'string' ? rawContent : '';

  if (title.length > MAX_TITLE) {
    throw new HttpError(400, `Title must be at most ${MAX_TITLE} characters`, 'INVALID_NOTE');
  }

  if (content.length > MAX_CONTENT) {
    throw new HttpError(400, `Note is too long (max ${MAX_CONTENT} characters)`, 'INVALID_NOTE');
  }

  return { title, content, cipher: null, nonce: null, alg: null };
}

async function loadOwnedNote(req) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(404, 'Note not found', 'NOT_FOUND');
  }

  const note = await Note.findOne({ _id: req.params.id, userId: req.userId });

  if (!note) {
    throw new HttpError(404, 'Note not found', 'NOT_FOUND');
  }

  return note;
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notes = await Note.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .limit(MAX_NOTES);

    return res.json({ notes: notes.map(serializeNote) });
  })
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { title, content, cipher, nonce, alg } = sanitize(req.body);

    const count = await Note.countDocuments({ userId: req.userId });

    if (count >= MAX_NOTES) {
      throw new HttpError(400, 'Note limit reached', 'NOTE_LIMIT');
    }

    const note = await Note.create({ userId: req.userId, title, content, cipher, nonce, alg });

    return res.status(201).json({ note: serializeNote(note) });
  })
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const note = await loadOwnedNote(req);
    const { title, content, cipher, nonce, alg } = sanitize(req.body);

    note.title = title;
    note.content = content;
    note.cipher = cipher;
    note.nonce = nonce;
    note.alg = alg;

    await note.save();

    return res.json({ note: serializeNote(note) });
  })
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const note = await loadOwnedNote(req);

    await note.deleteOne();

    return res.json({ ok: true });
  })
);

module.exports = router;
