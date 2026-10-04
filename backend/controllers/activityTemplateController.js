const ActivityTemplate = require("../models/ActivityTemplate");

// GET /api/v1/activity-templates
const getActivityTemplates = async (req, res) => {
  try {
    const activities = await ActivityTemplate.find({
      isActive: true
    }).sort({
      createdAt: 1
    });

    res.status(200).json({
      success: true,
      count: activities.length,
      data: activities
    });
  } catch (error) {
    console.error("Get activity templates error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch activity templates"
    });
  }
};


// GET /api/v1/activity-templates/:id
const getActivityTemplateById = async (req, res) => {
  try {
    const activity = await ActivityTemplate.findOne({
      _id: req.params.id,
      isActive: true
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity template not found"
      });
    }

    res.status(200).json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error("Get activity template error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch activity template"
    });
  }
};


// POST /api/v1/activity-templates
const createActivityTemplate = async (req, res) => {
  try {
    const {
      name,
      category,
      icon
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: "Name and category are required"
      });
    }

    const activity = await ActivityTemplate.create({
      name,
      category,
      icon: icon || "📌",
      isDefault: false
    });

    res.status(201).json({
      success: true,
      message: "Activity template created successfully",
      data: activity
    });
  } catch (error) {
    console.error("Create activity template error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create activity template"
    });
  }
};


// PUT /api/v1/activity-templates/:id
const updateActivityTemplate = async (req, res) => {
  try {
    const {
      name,
      category,
      icon,
      isActive
    } = req.body;

    const activity = await ActivityTemplate.findById(
      req.params.id
    );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity template not found"
      });
    }

    if (name !== undefined) {
      activity.name = name;
    }

    if (category !== undefined) {
      activity.category = category;
    }

    if (icon !== undefined) {
      activity.icon = icon;
    }

    if (isActive !== undefined) {
      activity.isActive = isActive;
    }

    await activity.save();

    res.status(200).json({
      success: true,
      message: "Activity template updated successfully",
      data: activity
    });
  } catch (error) {
    console.error("Update activity template error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update activity template"
    });
  }
};


// DELETE /api/v1/activity-templates/:id
const deleteActivityTemplate = async (req, res) => {
  try {
    const activity = await ActivityTemplate.findById(
      req.params.id
    );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity template not found"
      });
    }

    // Soft delete
    activity.isActive = false;

    await activity.save();

    res.status(200).json({
      success: true,
      message: "Activity template deleted successfully"
    });
  } catch (error) {
    console.error("Delete activity template error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete activity template"
    });
  }
};


module.exports = {
  getActivityTemplates,
  getActivityTemplateById,
  createActivityTemplate,
  updateActivityTemplate,
  deleteActivityTemplate
};