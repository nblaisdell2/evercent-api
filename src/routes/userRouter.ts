import express, { Router } from "express";
import {
  getAllUserDataReq,
  updateUserDetailsReq,
  updateCategoryDetailsReq,
  updateMonthsAheadTargetReq,
} from "../controllers/user";

const router: Router = express.Router();

// Define the routes and methods available for each route
router.route("/").get(getAllUserDataReq);
router.route("/userData").put(updateUserDetailsReq);
router.route("/categoryData").put(updateCategoryDetailsReq);
router.route("/monthsAhead").put(updateMonthsAheadTargetReq);

export default router;
