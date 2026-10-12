const mongoose = require('mongoose');

function encodeCursor(doc) {
  if (!doc || !doc.createdAt || !doc._id) {
    return null;
  }

  const payload = `${new Date(doc.createdAt).toISOString()}|${String(doc._id)}`;

  return Buffer.from(payload, 'utf8').toString('base64url');
}

function decodeCursor(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const separator = decoded.lastIndexOf('|');

    if (separator === -1) {
      return null;
    }

    const createdAt = new Date(decoded.slice(0, separator));
    const id = decoded.slice(separator + 1);

    if (Number.isNaN(createdAt.getTime()) || !mongoose.isValidObjectId(id)) {
      return null;
    }

    return { createdAt, id: new mongoose.Types.ObjectId(id) };
  } catch (err) {
    return null;
  }
}

function buildKeysetFilter(cursor, direction) {
  if (direction === 'before') {
    return {
      $or: [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
      ],
    };
  }

  return {
    $or: [
      { createdAt: { $gt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $gt: cursor.id } },
    ],
  };
}

module.exports = { encodeCursor, decodeCursor, buildKeysetFilter };
