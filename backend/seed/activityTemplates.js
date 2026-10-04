const mongoose = require("mongoose");
const ActivityTemplate = require("../models/ActivityTemplate");

const activities = [
  {
    name: "Make Bed",
    category: "routine",
    icon: "🛏️",
    isDefault: true
  },
  {
    name: "Tea Break",
    category: "break",
    icon: "☕",
    isDefault: true
  },
  {
    name: "Math",
    category: "study",
    icon: "📐",
    isDefault: true
  },
  {
    name: "Online Class",
    category: "study",
    icon: "🎓",
    isDefault: true
  },
  {
    name: "Cold Shower",
    category: "health",
    icon: "🚿",
    isDefault: true
  },
  {
    name: "Meeting",
    category: "work",
    icon: "🤝",
    isDefault: true
  },
  {
    name: "Office Shift",
    category: "work",
    icon: "🏢",
    isDefault: true
  },
  {
    name: "DSA",
    category: "study",
    icon: "💻",
    isDefault: true
  },
  {
    name: "Book Reading",
    category: "learning",
    icon: "📖",
    isDefault: true
  },
  {
    name: "SQL",
    category: "study",
    icon: "🗄️",
    isDefault: true
  },
  {
    name: "Python",
    category: "study",
    icon: "🐍",
    isDefault: true
  },
  {
    name: "Code Review",
    category: "work",
    icon: "🔍",
    isDefault: true
  },
  {
    name: "Extra Skills",
    category: "learning",
    icon: "🚀",
    isDefault: true
  },
  {
    name: "Breakfast",
    category: "routine",
    icon: "🍳",
    isDefault: true
  },
  {
    name: "Lunch",
    category: "routine",
    icon: "🍱",
    isDefault: true
  },
  {
    name: "Dinner",
    category: "routine",
    icon: "🍽️",
    isDefault: true
  },
  {
    name: "Evening Break",
    category: "break",
    icon: "🌆",
    isDefault: true
  },
  {
    name: "Meditation",
    category: "health",
    icon: "🧘",
    isDefault: true
  }
];

const seedActivityTemplates = async () => {
  try {
    // Prevent duplicate default activities
    const existingCount = await ActivityTemplate.countDocuments({
      isDefault: true
    });

    if (existingCount > 0) {
      console.log(
        `Default activities already exist (${existingCount}).`
      );
      return;
    }

    await ActivityTemplate.insertMany(activities);

    console.log(
      `${activities.length} default activities inserted successfully.`
    );
  } catch (error) {
    console.error("Error seeding activity templates:", error);
  }
};

module.exports = seedActivityTemplates;