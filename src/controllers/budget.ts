import { Request, Response, NextFunction } from "express";
import {
  authorizeBudget,
  getBudgetsList,
  GetURL_YNABAuthorizationPage,
  switchBudget,
  updateBudgetCategoryAmount,
} from "evercent";

export const connectToYNABReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID } = req.body;
  const url = GetURL_YNABAuthorizationPage(UserID as string);
  next({ data: { url }, message: "Connecting to YNAB for user: " + UserID });
};

export const getBudgetsListReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID } = req.query;

  const budgets = await getBudgetsList(UserID as string);
  if (!budgets) return;

  next({
    data: budgets,
    message: "Loaded all Budgets list for user: " + UserID,
  });
};

export const switchBudgetReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, NewBudgetID } = req.body;

  const result = await switchBudget(UserID, NewBudgetID);
  if (!result) return;

  next({
    data: { status: result },
    message: result,
  });
};

export const updateCategoryAmountReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, CategoryID, Month, NewBudgetedAmount } = req.body;

  const result = await updateBudgetCategoryAmount(
    UserID,
    BudgetID,
    CategoryID,
    Month,
    NewBudgetedAmount
  );
  if (!result) return;

  next({
    data: result,
    message: result,
  });
};

export const authorizeBudgetReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { code, state: userID } = req.query;
  const redirectURL = await authorizeBudget(userID as string, code as string);
  if (redirectURL) res.redirect(redirectURL as string);
};
