import express, { Router } from "express";
import { getAPIStatus } from "../controllers/index";

const router: Router = express.Router();

// Define the routes and methods available for each route
router.route("/").get(getAPIStatus);

export default router;
