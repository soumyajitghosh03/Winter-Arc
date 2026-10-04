const express = require("express");

const {
  getActivityTemplates,
  getActivityTemplateById,
  createActivityTemplate,
  updateActivityTemplate,
  deleteActivityTemplate
} = require("../controllers/activityTemplateController");

const router = express.Router();


// GET all activity templates
router.get(
  "/",
  getActivityTemplates
);


// GET single activity template
router.get(
  "/:id",
  getActivityTemplateById
);


// CREATE activity template
router.post(
  "/",
  createActivityTemplate
);


// UPDATE activity template
router.put(
  "/:id",
  updateActivityTemplate
);


// DELETE activity template
router.delete(
  "/:id",
  deleteActivityTemplate
);


module.exports = router;