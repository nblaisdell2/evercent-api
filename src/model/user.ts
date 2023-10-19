import { Request, NextFunction } from "express";
import { query, sqlErr } from "../utils/sql";
import { addMonths, addWeeks } from "date-fns";

export type PayFrequency = "Weekly" | "Every 2 Weeks" | "Monthly";

export type UserData = {
  userID: string;
  budgetID: string;
  username: string;
  monthlyIncome: number;
  payFrequency: PayFrequency;
  nextPaydate: string;
  monthsAheadTarget: number;
};

const createUserData = (userData: any): UserData => {
  return {
    userID: userData.UserID,
    budgetID: userData.DefaultBudgetID,
    username: userData.UserName,
    monthlyIncome: userData.MonthlyIncome,
    payFrequency: userData.PayFrequency,
    nextPaydate: userData.NextPaydate,
    monthsAheadTarget: userData.MonthsAheadTarget,
  };
};

export const getAmountByPayFrequency = (
  amount: number,
  payFreq: PayFrequency
) => {
  switch (payFreq) {
    case "Weekly":
      return amount / 4;
    case "Every 2 Weeks":
      return amount / 2;
    case "Monthly":
      return amount;
    default:
      return -1;
  }
};

export const incrementDateByFrequency = (dt: Date, payFreq: PayFrequency) => {
  switch (payFreq) {
    case "Weekly":
      return addWeeks(dt, 1);
    case "Every 2 Weeks":
      return addWeeks(dt, 2);
    case "Monthly":
      return addMonths(dt, 1);
    default:
      return dt;
  }
};

export const getUserData = async (
  req: Request,
  next: NextFunction,
  userEmail: string
) => {
  // log("Getting user details for email: '" + userEmail + "'");

  const queryRes = await query(req, "spEV_GetUserData", [
    { name: "UserEmail", value: userEmail },
  ]);
  if (sqlErr(next, queryRes)) return null;

  return createUserData(queryRes.resultData);
};
