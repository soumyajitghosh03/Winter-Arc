require("dotenv").config();

const mongoose = require("mongoose");
const seedActivityTemplates = require("./seed/activityTemplates");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully");

    await seedActivityTemplates();

    await mongoose.connection.close();

    console.log("Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
};

connectDB();