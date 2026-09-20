import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { connectSlack, slackCallback, disconnectSlack, slackStatus } from "../controllers/slack.controller";

const router = Router();

// Callback is hit directly by Slack's browser redirect — no Bearer token available.
router.get("/callback", slackCallback);

router.use(requireAuth);
router.get("/connect", connectSlack);
router.post("/disconnect", disconnectSlack);
router.get("/status", slackStatus);

export default router;
