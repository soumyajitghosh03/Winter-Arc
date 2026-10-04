const mongoose = require("mongoose");

const dailyActivitySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true
    },

    activityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActivityTemplate",
      required: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    icon: {
      type: String,
      default: "📌"
    },

    category: {
      type: String,
      required: true
    },

    startTime: {
      type: String,
      default: ""
    },

    endTime: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      enum: [
        "planned",
        "in_progress",
        "completed",
        "skipped"
      ],
      default: "planned"
    },

    order: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "DailyActivity",
  dailyActivitySchema
);