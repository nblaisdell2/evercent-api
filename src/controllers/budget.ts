import { Request, Response, NextFunction } from "express";
import ynab, {
  GetURL_YNABAuthorizationPage,
  getNewAccessTokens,
  YnabReq,
} from "../utils/ynab";
import { log } from "../utils/log";
import { execute, sqlErr } from "../utils/sql";
import {
  FAKE_BUDGET_ID,
  createCategories,
  getBudget,
  updateBudgetCategoryAmount,
} from "../model/budget";

const openURL = (url: string) => {
  const urlFormatted = url.replace(/&/g, "^&");
  const start =
    process.platform == "darwin"
      ? "open"
      : process.platform == "win32"
      ? "start"
      : "xdg-open";
  require("child_process").exec(start + " " + urlFormatted);
};

export const connectToYNAB = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID } = req.body;

  const url = GetURL_YNABAuthorizationPage(UserID as string);
  // openURL(url);
  // res.redirect(url);
  next({ url });
};

export const getBudgetData = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID } = req.body;

  if (BudgetID == FAKE_BUDGET_ID) {
    const url = GetURL_YNABAuthorizationPage(UserID);
    openURL(url);
    res.status(200).json({ status: "Not Authorized Yet! Sending to YNAB..." });
  } else {
    const budgetData = await getBudget(req, next, UserID, BudgetID);
    if (!budgetData) return;

    next(budgetData);
  }
};

export const getBudgetsList = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID } = req.query;

  const budgets = await ynab(
    req,
    next,
    UserID as string,
    FAKE_BUDGET_ID,
    YnabReq.getBudgetsList
  );
  if (!budgets) return;

  next(budgets);
};

export const switchBudget = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, NewBudgetID } = req.body;

  const budget = await ynab(req, next, UserID, NewBudgetID, YnabReq.getBudget);
  if (!budget) return;

  const newCategories = createCategories(budget.categories);

  const queryRes = await execute(req, "spEV_UpdateInitialYNABDetails", [
    { name: "UserID", value: UserID },
    { name: "NewBudgetID", value: NewBudgetID },
    { name: "Details", value: JSON.stringify({ details: newCategories }) },
  ]);
  if (sqlErr(next, queryRes)) return;

  next({ status: "Budgets switched successfully!" });
};

export const updateCategoryAmount = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, CategoryID, Month, NewBudgetedAmount } = req.body;

  const result = await updateBudgetCategoryAmount(
    req,
    next,
    UserID,
    BudgetID,
    CategoryID,
    Month,
    NewBudgetedAmount
  );
  if (!result) return;

  next({ result });
};

export const authorizeBudget = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { code, state: userID } = req.query;

  const newTokens = await getNewAccessTokens(next, code as string);
  if (!newTokens) return;

  // Save token details in DB for this user
  let sqlRes = await execute(req, "spEV_YNAB_SaveTokenDetails", [
    { name: "UserID", value: userID },
    { name: "AccessToken", value: newTokens.accessToken },
    { name: "RefreshToken", value: newTokens.refreshToken },
    { name: "ExpirationDate", value: newTokens.expirationDate },
  ]);
  if (sqlErr(next, sqlRes)) return;

  // 1. Use the YNAB API to obtain the initial budget details for this user
  //    before saving the token details to the DB
  const budget = await ynab(
    req,
    next,
    userID as string,
    FAKE_BUDGET_ID,
    YnabReq.getBudget
  );
  if (!budget) return;

  const { id, categories } = budget;

  const newBudgetID = id;
  const newCategories = createCategories(categories);

  // 2. Use a separate query to save the token details AND the budget/categories
  //    at the same time, so we only have to run a single query
  sqlRes = await execute(req, "spEV_UpdateInitialYNABDetails", [
    { name: "UserID", value: userID },
    { name: "NewBudgetID", value: newBudgetID },
    { name: "Details", value: JSON.stringify({ details: newCategories }) },
  ]);
  if (sqlErr(next, sqlRes)) return;

  res.redirect(process.env.CLIENT_BASE_URL as string);
};
