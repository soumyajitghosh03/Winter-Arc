const mongoose = require("mongoose");

const dailyRecordSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
      index: true
    },

    note: {
      type: String,
      default: "",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "DailyRecord",
  dailyRecordSchema
);