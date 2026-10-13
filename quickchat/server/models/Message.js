const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    cipher: {
      type: String,
      default: null,
    },
    nonce: {
      type: String,
      default: null,
    },
    alg: {
      type: String,
      default: null,
    },
    clientMessageId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    deliveredAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

messageSchema.index({ senderId: 1, clientMessageId: 1 }, { unique: true });
messageSchema.index({ conversationId: 1, createdAt: 1, _id: 1 });
messageSchema.index({ recipientId: 1, status: 1 });

module.exports = mongoose.model('Message', messageSchema);
