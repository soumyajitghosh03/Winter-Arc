const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const activityTemplateRoutes = require("./routes/activityTemplateRoutes");
const dailyActivityRoutes = require("./routes/dailyActivityRoutes");
const dailyRecordRoutes = require("./routes/dailyRecordRoutes");
const sleepRecordRoutes = require("./routes/sleepRecordRoutes");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  "/api/v1/activity-templates",
  activityTemplateRoutes
);

app.use(
  "/api/v1/daily-activities",
  dailyActivityRoutes
);

app.use(
  "/api/v1/daily-records",
  dailyRecordRoutes
);

app.use(
  "/api/v1/sleep-records",
  sleepRecordRoutes
);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error);
  });

app.get("/", (req, res) => {
  res.json({
    message: "Winter Arc API is running"
  });
});

