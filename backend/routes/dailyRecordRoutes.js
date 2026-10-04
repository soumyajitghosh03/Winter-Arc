const express = require("express");

const {
  getDailyRecord,
  saveDailyRecord,
  deleteDailyRecord
} = require("../controllers/dailyRecordController");

const router = express.Router();

router.get("/", getDailyRecord);
router.post("/", saveDailyRecord);
router.delete("/", deleteDailyRecord);

module.exports = router;