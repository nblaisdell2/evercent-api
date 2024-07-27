import { Request, Response, NextFunction } from "express";
import {
  cancelAutoRuns,
  lockAutoRuns,
  runAutomation,
  saveAutoRunDetails,
} from "evercent";
import { sendExpressResponse } from "../app";

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
  return sendExpressResponse(next, result);
};

export const cancelAutoRunsReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID } = req.body;

  const result = await cancelAutoRuns(UserID, BudgetID);
  return sendExpressResponse(next, result);
};

export const lockAutoRunsReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const result = await lockAutoRuns();
  return sendExpressResponse(next, result);
};

export const runAutomationReq = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const result = await runAutomation();
  return sendExpressResponse(next, result);
};
