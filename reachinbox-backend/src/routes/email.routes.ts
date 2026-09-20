import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.middleware";
import {
  scheduleEmail,
  scheduleEmailCsv,
  listScheduled,
  listSent,
  getEmailById,
  cancelEmail,
} from "../controllers/email.controller";
import { createSender, listSenders, deleteSender } from "../controllers/sender.controller";
import { env } from "../config/env";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_CSV_FILE_SIZE_BYTES },
});

router.use(requireAuth);

router.post("/schedule", scheduleEmail);
router.post("/schedule/csv", upload.single("file"), scheduleEmailCsv);
router.get("/scheduled", listScheduled);
router.get("/sent", listSent);
router.get("/senders", listSenders);
router.post("/senders", createSender);
router.delete("/senders/:id", deleteSender);
router.get("/:id", getEmailById);
router.delete("/:id", cancelEmail);

export default router;
