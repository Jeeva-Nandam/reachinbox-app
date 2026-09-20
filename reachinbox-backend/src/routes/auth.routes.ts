import { Router } from "express";
import { googleAuthStart, googleAuthCallback, devLogin, getCurrentUser } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/google", googleAuthStart);
router.get("/google/callback", ...googleAuthCallback);
router.post("/dev-login", devLogin);
router.get("/me", requireAuth, getCurrentUser);

export default router;
