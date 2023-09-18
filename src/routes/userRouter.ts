import express, { Router } from "express";
import {
  getAllUserData,
  getUserDetails,
  updateUserDetails,
  getCategoryDetails,
  updateCategoryDetails,
  updateMonthsAheadTarget,
} from "../controllers/user";

const router: Router = express.Router();

// Define the routes and methods available for each route
router.route("/").get(getAllUserData);
router.route("/userData").get(getUserDetails);
router.route("/userData").put(updateUserDetails);
router.route("/categoryData").get(getCategoryDetails);
router.route("/categoryData").put(updateCategoryDetails);
router.route("/monthsAhead").put(updateMonthsAheadTarget);

export default router;
