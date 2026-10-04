const express = require("express");

const {
  getSleepRecord,
  saveSleepRecord,
  deleteSleepRecord
} = require("../controllers/sleepRecordController");

const router = express.Router();

router.get("/", getSleepRecord);
router.post("/", saveSleepRecord);
router.delete("/", deleteSleepRecord);

module.exports = router;