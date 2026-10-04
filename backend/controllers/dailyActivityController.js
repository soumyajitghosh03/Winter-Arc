const DailyActivity = require("../models/DailyActivity");
const ActivityTemplate = require("../models/ActivityTemplate");

// GET all activities for a specific date
const getDailyActivities = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required"
      });
    }

    const activities = await DailyActivity.find({ date })
      .sort({ order: 1, createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: activities.length,
      data: activities
    });
  } catch (error) {
    console.error("Get daily activities error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch daily activities"
    });
  }
};

// GET calendar activity summary for a date range
const getDailyActivityCalendar = async (req, res) => {
    try {
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                message: "from and to dates are required"
            });
        }

        const activities = await DailyActivity.find({
            date: {
                $gte: new Date(from),
                $lte: new Date(to)
            }
        }).select("date status");

        const summary = {};

        activities.forEach(activity => {
            const date = new Date(activity.date)
                .toISOString()
                .split("T")[0];

            if (!summary[date]) {
                summary[date] = {
                    total: 0,
                    completed: 0
                };
            }

            summary[date].total += 1;

            if (activity.status === "completed") {
                summary[date].completed += 1;
            }
        });

        return res.status(200).json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error(
            "Get daily activity calendar error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch calendar activity"
        });
    }
};

// GET single daily activity
const getDailyActivityById = async (req, res) => {
  try {
    const activity = await DailyActivity.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Daily activity not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error("Get daily activity error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch daily activity"
    });
  }
};


// CREATE daily activity
const createDailyActivity = async (req, res) => {
  try {
    const {
      date,
      activityId,
      startTime,
      endTime,
      status,
      order
    } = req.body;

    if (!date || !activityId) {
      return res.status(400).json({
        success: false,
        message: "Date and activityId are required"
      });
    }

    // Find the reusable activity template
    const template = await ActivityTemplate.findOne({
      _id: activityId,
      isActive: true
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Activity template not found"
      });
    }

    // Create daily activity using template information
    const dailyActivity = await DailyActivity.create({
      date,
      activityId: template._id,
      title: template.name,
      icon: template.icon,
      category: template.category,
      startTime: startTime || "",
      endTime: endTime || "",
      status: status || "planned",
      order: order ?? 0
    });

    return res.status(201).json({
      success: true,
      message: "Daily activity created successfully",
      data: dailyActivity
    });
  } catch (error) {
    console.error("Create daily activity error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create daily activity"
    });
  }
};


// UPDATE daily activity
const updateDailyActivity = async (req, res) => {
  try {
    const {
      startTime,
      endTime,
      status,
      order
    } = req.body;

    const activity = await DailyActivity.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Daily activity not found"
      });
    }

    if (startTime !== undefined) {
      activity.startTime = startTime;
    }

    if (endTime !== undefined) {
      activity.endTime = endTime;
    }

    if (status !== undefined) {
      activity.status = status;
    }

    if (order !== undefined) {
      activity.order = order;
    }

    await activity.save();

    return res.status(200).json({
      success: true,
      message: "Daily activity updated successfully",
      data: activity
    });
  } catch (error) {
    console.error("Update daily activity error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update daily activity"
    });
  }
};


// DELETE daily activity
const deleteDailyActivity = async (req, res) => {
  try {
    const activity = await DailyActivity.findByIdAndDelete(
      req.params.id
    );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Daily activity not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Daily activity deleted successfully"
    });
  } catch (error) {
    console.error("Delete daily activity error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete daily activity"
    });
  }
};


module.exports = {
  getDailyActivities,
  getDailyActivityCalendar,
  getDailyActivityById,
  createDailyActivity,
  updateDailyActivity,
  deleteDailyActivity
};