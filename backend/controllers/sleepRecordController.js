const SleepRecord = require("../models/SleepRecord");


// Convert HH:MM into minutes
const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
};


// Calculate sleep duration
const calculateDuration = (startTime, endTime) => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  let duration = end - start;

  // Sleep crossed midnight
  if (duration < 0) {
    duration += 24 * 60;
  }

  return duration;
};


// GET sleep record by date
const getSleepRecord = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required"
      });
    }

    const record = await SleepRecord.findOne({ date });

    // No sleep record yet
    if (!record) {
      return res.status(200).json({
        success: true,
        data: {
          date,
          startTime: "",
          endTime: "",
          durationMinutes: 0
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: record
    });

  } catch (error) {
    console.error("Get sleep record error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sleep record"
    });
  }
};


// CREATE or UPDATE sleep record
const saveSleepRecord = async (req, res) => {
  try {
    const {
      date,
      startTime,
      endTime
    } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Date, startTime and endTime are required"
      });
    }

    // Basic HH:MM validation
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({
        success: false,
        message: "Time must be in HH:MM format"
      });
    }

    const durationMinutes = calculateDuration(
      startTime,
      endTime
    );

    const record = await SleepRecord.findOneAndUpdate(
      { date },
      {
        date,
        startTime,
        endTime,
        durationMinutes
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    return res.status(200).json({
      success: true,
      message: "Sleep record saved successfully",
      data: record
    });

  } catch (error) {
    console.error("Save sleep record error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save sleep record"
    });
  }
};


// DELETE sleep record
const deleteSleepRecord = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required"
      });
    }

    const record = await SleepRecord.findOneAndDelete({ date });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Sleep record not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Sleep record deleted successfully"
    });

  } catch (error) {
    console.error("Delete sleep record error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete sleep record"
    });
  }
};


module.exports = {
  getSleepRecord,
  saveSleepRecord,
  deleteSleepRecord
};