import { Request, Response, NextFunction } from "express";
import { execute } from "../utils/sql";
import { log } from "../utils/log";

export const getAPIStatus = function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  res.status(200).json({ status: "API is up-and-running!" });
};

export const logInfo = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  log("req.body", req.body);
  const { level, message, timestamp } = req.body;

  const messageItems = message.split("||").map((item: string) => item.trim());
  const timeElapsed = messageItems[1]
    .replace("(", "")
    .replace(")", "")
    .replace("ms", "");
  const statusCode = messageItems[2].replace("(Status = ", "").replace(")", "");

  const queryRes = await execute(req, "spEV_AddLog", [
    { name: "LogLevel", value: level },
    { name: "StatusCode", value: statusCode },
    { name: "TimeElapsedMs", value: timeElapsed },
    { name: "LogMessage", value: messageItems[0] },
    { name: "LogMessageAdditional", value: messageItems[3] },
    { name: "LogTimestamp", value: timestamp },
  ]);

  res.status(200).json(queryRes);
};
