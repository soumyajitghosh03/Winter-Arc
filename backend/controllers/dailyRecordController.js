const DailyRecord = require("../models/DailyRecord");


// GET daily record by date
const getDailyRecord = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required"
      });
    }

    const record = await DailyRecord.findOne({ date });

    // No record yet is not an error
    if (!record) {
      return res.status(200).json({
        success: true,
        data: {
          date,
          note: ""
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: record
    });

  } catch (error) {
    console.error("Get daily record error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch daily record"
    });
  }
};


// CREATE or UPDATE daily record
const saveDailyRecord = async (req, res) => {
  try {
    const { date, note } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required"
      });
    }

    const record = await DailyRecord.findOneAndUpdate(
      { date },
      {
        date,
        note: note || ""
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
      message: "Daily record saved successfully",
      data: record
    });

  } catch (error) {
    console.error("Save daily record error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save daily record"
    });
  }
};


// DELETE daily record
const deleteDailyRecord = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required"
      });
    }

    const record = await DailyRecord.findOneAndDelete({ date });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Daily record not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Daily record deleted successfully"
    });

  } catch (error) {
    console.error("Delete daily record error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete daily record"
    });
  }
};


module.exports = {
  getDailyRecord,
  saveDailyRecord,
  deleteDailyRecord
};