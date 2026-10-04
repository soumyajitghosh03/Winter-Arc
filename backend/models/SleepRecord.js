const mongoose = require("mongoose");

const sleepRecordSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
      index: true
    },

    startTime: {
      type: String,
      required: true
    },

    endTime: {
      type: String,
      required: true
    },

    durationMinutes: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "SleepRecord",
  sleepRecordSchema
);