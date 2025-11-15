const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  pinHash: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['TEXT', 'MULTIMEDIA'],
    required: true,
    default: 'TEXT'
  },
  maxFileSizeMB: {
    type: Number,
    default: 10,
    min: 1,
    max: 50
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'CLOSED'],
    default: 'ACTIVE'
  }
});

module.exports = mongoose.model('Room', roomSchema);
