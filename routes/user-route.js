import express from "express";
import { syncUser } from "../controllers/user-controller.js";
import { verifyFirebaseToken } from "../middleware/validate-token-handler.js";

const router = express.Router();

router.post("/sync", verifyFirebaseToken, syncUser);

export default router;
