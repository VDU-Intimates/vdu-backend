// routes/design-route.js
const express = require("express");
const validateToken = require("../middleware/validate-token-handler");
const {
  listDesigns,
  getDesignById,
  createDesign,
  deleteDesign,
  updateDesign,
} = require("../controllers/design-controller");

const router = express.Router();

router.use(validateToken);            // all endpoints require auth
router.get("/", listDesigns);
router.get("/:id", getDesignById);
router.post("/", createDesign);
router.put("/:id", updateDesign);     // optional
router.delete("/:id", deleteDesign);

module.exports = router;
