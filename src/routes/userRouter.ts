import express, { Router } from "express";
import {
  getAllUserData,
  updateUserDetails,
  updateCategoryDetails,
  updateMonthsAheadTarget,
} from "../controllers/user";

const router: Router = express.Router();

// Define the routes and methods available for each route
router.route("/").get(getAllUserData);
router.route("/userData").put(updateUserDetails);
router.route("/categoryData").put(updateCategoryDetails);
router.route("/monthsAhead").put(updateMonthsAheadTarget);

export default router;
