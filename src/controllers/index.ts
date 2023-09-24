import { Request, Response, NextFunction } from "express";

export const getAPIStatus = function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  next({ status: "API is up-and-running!" });
};
