import { Request, Response, NextFunction } from "express";
import { execute, sqlErr } from "../utils/sql";
import { log } from "../utils/log";

import { UserData, getUserData } from "../model/user";
import { Budget, getBudget } from "../model/budget";
import {
  CategoryGroup,
  ExcludedCategory,
  getCategoryData,
} from "../model/category";
import { AutoRun, getAutoRunData } from "../model/autoRun";

type EvercentData = {
  userData: UserData;
  budget: Budget;
  categoryGroups: CategoryGroup[];
  excludedCategories: ExcludedCategory[];
  autoRuns: AutoRun[];
  pastRuns: AutoRun[];
};

export const getAllUserData = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserEmail } = req.query;

  const userData = await getUserData(req, next, UserEmail as string);
  if (!userData) return;

  const budget = await getBudget(req, next, userData.userID, userData.budgetID);
  if (!budget) return;

  const categoryData = await getCategoryData(
    req,
    next,
    budget,
    userData.userID,
    userData.budgetID,
    userData.payFrequency,
    userData.nextPaydate
  );
  if (!categoryData) return;

  const autoRunData = await getAutoRunData(
    req,
    next,
    userData.userID,
    userData.budgetID,
    userData.payFrequency,
    budget,
    categoryData.categoryGroups
  );
  if (!autoRunData) return;

  res.status(200).json({
    userData,
    budget,
    ...categoryData,
    ...autoRunData,
  } as EvercentData);
};

export const getUserDetails = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserEmail } = req.query;

  const userData = await getUserData(req, next, UserEmail as string);
  if (!userData) return;

  res.status(200).json(userData);
};

export const updateUserDetails = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, MonthlyIncome, PayFrequency, NextPaydate } =
    req.body;

  const queryRes = await execute(req, "spEV_UpdateUserDetails", [
    { name: "UserID", value: UserID },
    { name: "BudgetID", value: BudgetID },
    { name: "MonthlyIncome", value: MonthlyIncome },
    { name: "PayFrequency", value: PayFrequency },
    { name: "NextPaydate", value: NextPaydate },
  ]);
  if (sqlErr(next, queryRes)) return;

  res.status(200).json(queryRes.resultData);
};

export const getCategoryDetails = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserEmail } = req.query;

  const userData = await getUserData(req, next, UserEmail as string);
  if (!userData) return;

  const budget = await getBudget(req, next, userData.userID, userData.budgetID);
  if (!budget) return;

  const categoryData = await getCategoryData(
    req,
    next,
    budget,
    userData.userID,
    userData.budgetID,
    userData.payFrequency,
    userData.nextPaydate
  );
  if (!categoryData) return;

  res.status(200).json(categoryData);
};

export const updateCategoryDetails = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, Details } = req.body;

  const queryRes = await execute(req, "spEV_UpdateCategoryDetails", [
    { name: "UserID", value: UserID },
    { name: "BudgetID", value: BudgetID },
    { name: "Details", value: Details },
  ]);
  if (sqlErr(next, queryRes)) return;

  res.status(200).json(queryRes.resultData);
};

export const updateMonthsAheadTarget = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, NewTarget } = req.body;

  const queryRes = await execute(req, "spEV_UpdateUserMonthsAheadTarget", [
    { name: "UserID", value: UserID },
    { name: "BudgetID", value: BudgetID },
    { name: "NewTarget", value: NewTarget },
  ]);
  if (sqlErr(next, queryRes)) return;

  res.status(200).json(queryRes.resultData);
};
