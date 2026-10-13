const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 128,
      default: '',
    },
    content: {
      type: String,
      maxlength: 10000,
      default: '',
    },
    cipher: {
      type: String,
      maxlength: 60000,
      default: null,
    },
    nonce: {
      type: String,
      maxlength: 128,
      default: null,
    },
    alg: {
      type: String,
      maxlength: 32,
      default: null,
    },
  },
  { timestamps: true }
);

noteSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Note', noteSchema);
