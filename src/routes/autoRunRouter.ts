import express, { Router } from "express";
import {
  saveAutoRunDetails,
  cancelAutoRuns,
  lockAutoRuns,
  runAutomation,
  sendEvercentEmail,
  sendTestEmail,
} from "../controllers/autoRun";

const router: Router = express.Router();

// Define the routes and methods available for each route
router.route("/").post(saveAutoRunDetails);
router.route("/cancel").post(cancelAutoRuns);
router.route("/lock").post(lockAutoRuns);
router.route("/run").post(runAutomation);
router.route("/sendEmail").post(sendTestEmail);

export default router;
