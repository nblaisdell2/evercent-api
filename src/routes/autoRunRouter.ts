import express, { Router } from "express";
import {
  saveAutoRunDetailsReq,
  cancelAutoRunsReq,
  lockAutoRunsReq,
  runAutomationReq,
} from "../controllers/autoRun";

const router: Router = express.Router();

// Define the routes and methods available for each route
router.route("/").post(saveAutoRunDetailsReq);
router.route("/cancel").post(cancelAutoRunsReq);
router.route("/lock").post(lockAutoRunsReq);
router.route("/run").post(runAutomationReq);
// router.route("/sendEmail").post(sendTestEmail);

export default router;
