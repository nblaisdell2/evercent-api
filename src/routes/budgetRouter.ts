import express, { Router } from "express";
import {
  getBudgetsListReq,
  switchBudgetReq,
  updateCategoryAmountReq,
  authorizeBudgetReq,
  connectToYNABReq,
} from "../controllers/budget";

const router: Router = express.Router();

// Define the routes and methods available for each route
router.route("/getBudgetsList").get(getBudgetsListReq);
router.route("/switchBudget").post(switchBudgetReq);
router.route("/updateCategoryAmount").post(updateCategoryAmountReq);
router.route("/connect").post(connectToYNABReq);
router.route("/authorizeBudget").get(authorizeBudgetReq);

export default router;
