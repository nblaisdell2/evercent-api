import express, { Router } from "express";
import { getAPIStatus, logInfo } from "../controllers/index";

const router: Router = express.Router();

// Define the routes and methods available for each route
router.route("/").get(getAPIStatus);
router.route("/log").post(logInfo);

export default router;
