import { Request, Response, NextFunction } from "express";
import {
  cancelAutoRuns,
  lockAutoRuns,
  runAutomation,
  saveAutoRunDetails,
} from "evercent";

export const saveAutoRunDetailsReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, RunTime, ToggledCategories } = req.body;

  const result = await saveAutoRunDetails(
    UserID,
    BudgetID,
    RunTime,
    ToggledCategories
  );
  if (!result) return;

  next({
    data: result,
    message: JSON.stringify({
      NewRunTime: RunTime,
      ToggledCategories: ToggledCategories,
    }),
  });
};

export const cancelAutoRunsReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID } = req.body;

  const result = await cancelAutoRuns(UserID, BudgetID);
  if (!result) return;

  next({
    data: result,
    message: result,
  });
};

export const lockAutoRunsReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const result = await lockAutoRuns();
  if (!result) return;

  next({
    data: result,
    message: result,
  });
};

export const runAutomationReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const result = await runAutomation();

  next({
    data: { status: result },
    message: result,
  });
};
