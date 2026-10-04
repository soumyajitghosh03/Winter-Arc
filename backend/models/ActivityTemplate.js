const mongoose = require("mongoose");

const activityTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      required: true,
      enum: [
        "general",
        "study",
        "work",
        "health",
        "routine",
        "break",
        "learning"
      ]
    },

    icon: {
      type: String,
      default: "📌"
    },

    isDefault: {
      type: Boolean,
      default: false
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "ActivityTemplate",
  activityTemplateSchema
);