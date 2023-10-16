import { Request, Response, NextFunction } from "express";

export const getAPIStatus = function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  next({ data: { status: "API is up-and-running!" } });
};
