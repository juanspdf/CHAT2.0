const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  senderNickname: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['TEXT', 'FILE'],
    required: true,
    default: 'TEXT'
  },
  content: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    default: null
  },
  fileMimeType: {
    type: String,
    default: null
  },
  fileSizeBytes: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', messageSchema);
