const mongoose = require('mongoose');

const chatRequestSchema = new mongoose.Schema(
  {
    pairKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

chatRequestSchema.index({ recipient: 1, status: 1 });
chatRequestSchema.index({ requester: 1, status: 1 });

module.exports = mongoose.model('ChatRequest', chatRequestSchema);
