import { Request, Response, NextFunction } from "express";
import {
  authorizeBudget,
  getBudgetsList,
  GetURL_YNABAuthorizationPage,
  switchBudget,
  updateBudgetCategoryAmount,
} from "evercent";
import { sendExpressResponse, throwExpressError } from "../app";

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

  const result = await getBudgetsList(UserID as string);
  return sendExpressResponse(next, result);
};

export const switchBudgetReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, NewBudgetID } = req.body;

  const result = await switchBudget(UserID, NewBudgetID);
  return sendExpressResponse(next, result);
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
  return sendExpressResponse(next, result);
};

export const authorizeBudgetReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { code, state: userID } = req.query;
  const result = await authorizeBudget(userID as string, code as string);

  if (result.err) return throwExpressError(next, result.err);
  if (result.data) res.redirect(result.data.redirectURL as string);
};
