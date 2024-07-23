import { Request, Response, NextFunction } from "express";
import {
  getAllEvercentData,
  updateCategoryDetails,
  updateMonthsAheadTarget,
  updateUserDetails,
} from "evercent";

export const getAllUserDataReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserEmail } = req.query;
  let allData = await getAllEvercentData(UserEmail as string);
  if (!allData) return;

  next({
    data: allData,
    message: "All Data Loaded for user: " + allData?.userData?.username,
  });
};

export const updateUserDetailsReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, MonthlyIncome, PayFrequency, NextPaydate } =
    req.body;

  const data = await updateUserDetails(
    UserID,
    BudgetID,
    MonthlyIncome,
    PayFrequency,
    NextPaydate
  );
  if (!data) return;

  next({
    data,
    message: JSON.stringify({
      UserID,
      BudgetID,
      MonthlyIncome,
      PayFrequency,
      NextPaydate,
    }),
  });
};

export const updateCategoryDetailsReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, Details } = req.body;

  const newCategories = await updateCategoryDetails(UserID, BudgetID, Details);
  if (!newCategories) return;

  next({
    data: newCategories,
    message: "Categories Updated Successfully",
  });
};

export const updateMonthsAheadTargetReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, NewTarget } = req.body;

  const newTarget = await updateMonthsAheadTarget(UserID, BudgetID, NewTarget);
  if (!newTarget) return;

  next({
    data: newTarget,
    message:
      "Updated Months Ahead Target to '" + newTarget + "' for user: " + UserID,
  });
};
