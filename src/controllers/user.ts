import { Request, Response, NextFunction } from "express";
import {
  getAllEvercentData,
  updateCategoryDetails,
  updateMonthsAheadTarget,
  updateUserDetails,
} from "evercent";
import { sendExpressResponse } from "../app";

export const getAllUserDataReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserEmail } = req.query;

  let result = await getAllEvercentData(UserEmail as string);
  return sendExpressResponse(next, result);
};

export const updateUserDetailsReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, MonthlyIncome, PayFrequency, NextPaydate } =
    req.body;

  const result = await updateUserDetails(
    UserID,
    BudgetID,
    MonthlyIncome,
    PayFrequency,
    NextPaydate
  );
  return sendExpressResponse(next, result);
};

export const updateCategoryDetailsReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, Details } = req.body;

  const result = await updateCategoryDetails(UserID, BudgetID, Details);
  return sendExpressResponse(next, result);
};

export const updateMonthsAheadTargetReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, NewTarget } = req.body;

  const result = await updateMonthsAheadTarget(UserID, BudgetID, NewTarget);
  return sendExpressResponse(next, result);
};
