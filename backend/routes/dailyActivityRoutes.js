const express = require("express");

const {
  getDailyActivities,
  getDailyActivityById,
  createDailyActivity,
  updateDailyActivity,
  deleteDailyActivity,
  getDailyActivityCalendar
} = require("../controllers/dailyActivityController");

const router = express.Router();

router.get("/", getDailyActivities);
router.get("/calendar", getDailyActivityCalendar);
router.get("/:id", getDailyActivityById);

router.post("/", createDailyActivity);
router.put("/:id", updateDailyActivity);
router.delete("/:id", deleteDailyActivity);


module.exports = router;