// routes/design-route.js
const express = require("express");
const validateToken = require("../middleware/validate-token-handler");
const {
  listDesigns,
  getDesignById,
  createDesign,
  deleteDesign,
  updateDesign,
  exportDesignsPdf,
  listLatestDesigns
} = require("../controllers/design-controller");

const router = express.Router();

router.use(validateToken);            // all endpoints require auth
router.get("/", listDesigns);
router.post("/", createDesign);
router.delete("/:id", deleteDesign);
router.get("/report", exportDesignsPdf);
router.get("/latest", validateToken, listLatestDesigns);

module.exports = router;
