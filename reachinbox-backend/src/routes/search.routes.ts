import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { searchEmails } from "../controllers/search.controller";

const router = Router();
router.use(requireAuth);
router.get("/", searchEmails);

export default router;
