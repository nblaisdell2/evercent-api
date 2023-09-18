import express, { Router } from "express";
import {
  getBudgetData,
  getBudgetsList,
  switchBudget,
  updateCategoryAmount,
  authorizeBudget,
  connectToYNAB,
} from "../controllers/budget";

const router: Router = express.Router();

// Define the routes and methods available for each route
router.route("/").get(getBudgetData);
router.route("/getBudgetsList").get(getBudgetsList);
router.route("/switchBudget").post(switchBudget);
router.route("/updateCategoryAmount").post(updateCategoryAmount);
router.route("/connect").get(connectToYNAB);
router.route("/authorizeBudget").get(authorizeBudget);

export default router;
