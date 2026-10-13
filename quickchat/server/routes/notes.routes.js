const express = require('express');
const mongoose = require('mongoose');

const Note = require('../models/Note');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/error');
const { serializeNote } = require('../utils/serialize');

const router = express.Router();

const MAX_TITLE = 128;
const MAX_CONTENT = 10000;
const MAX_NOTES = 500;

function sanitize(body) {
  const rawTitle = body && body.title;
  const rawContent = body && body.content;

  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  const content = typeof rawContent === 'string' ? rawContent : '';

  if (title.length > MAX_TITLE) {
    throw new HttpError(400, `Title must be at most ${MAX_TITLE} characters`, 'INVALID_NOTE');
  }

  if (content.length > MAX_CONTENT) {
    throw new HttpError(400, `Note is too long (max ${MAX_CONTENT} characters)`, 'INVALID_NOTE');
  }

  return { title, content };
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
    const { title, content } = sanitize(req.body);

    const count = await Note.countDocuments({ userId: req.userId });

    if (count >= MAX_NOTES) {
      throw new HttpError(400, 'Note limit reached', 'NOTE_LIMIT');
    }

    const note = await Note.create({ userId: req.userId, title, content });

    return res.status(201).json({ note: serializeNote(note) });
  })
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const note = await loadOwnedNote(req);
    const { title, content } = sanitize(req.body);

    note.title = title;
    note.content = content;

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
