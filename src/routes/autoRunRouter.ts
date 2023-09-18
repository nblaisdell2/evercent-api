import express, { Router } from "express";
import {
  getAutoRuns,
  saveAutoRunDetails,
  cancelAutoRuns,
  lockAutoRuns,
  runAutomation,
} from "../controllers/autoRun";

const router: Router = express.Router();

// Define the routes and methods available for each route
router.route("/").get(getAutoRuns);
router.route("/").post(saveAutoRunDetails);
router.route("/cancel").post(cancelAutoRuns);
router.route("/lock").post(lockAutoRuns);
router.route("/run").post(runAutomation);

export default router;
