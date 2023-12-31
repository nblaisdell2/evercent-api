import winston from "winston";
import expressWinston from "express-winston";
import type { Request, Response } from "express";
import { execute } from "./sql";

export const routeLogger = () => {
  return expressWinston.logger({
    transports: [new winston.transports.Console()],
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info: winston.Logform.TransformableInfo) => {
        return `${getDateString()} ${info.message}`;
      })
    ),
    meta: false, // optional: control whether you want to log the meta data about the request (default to true)
    msg: (req: Request, res: Response) => {
      // log("Generating log message", req, res);
      // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
      return "{{req.method}} {{req.url}} || ({{res.responseTime}}ms) || (Status = {{res.statusCode}}) || {{res.locals.message}}";
    },
    // expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
    colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
    // ignoreRoute: (req: Request, res: Response) => {
    //   return req.path == "/log";
    // },
  });
};

export const logInfo = async function (
  req: Request,
  level: "Success" | "Error" | "Info",
  statusCode: string | number,
  logEndpoint: string,
  logMessage: string | null
) {
  await execute(req, "spEV_AddLog", [
    { name: "LogLevel", value: level },
    { name: "StatusCode", value: statusCode },
    { name: "LogMessage", value: logEndpoint },
    { name: "LogMessageAdditional", value: logMessage },
    { name: "LogTimestamp", value: new Date().toISOString() },
  ]);
};

const getDateString = () => {
  const currDate = new Date();
  return (
    "[" +
    currDate.getFullYear() +
    "-" +
    (currDate.getMonth() + 1).toString().padStart(2, "0") +
    "-" +
    currDate.getDate().toString().padStart(2, "0") +
    "T" +
    currDate.getHours().toString().padStart(2, "0") +
    ":" +
    currDate.getMinutes().toString().padStart(2, "0") +
    ":" +
    currDate.getSeconds().toString().padStart(2, "0") +
    "." +
    currDate.getMilliseconds().toString().padStart(3, "0") +
    "Z]"
  );
};

export const log = console.log.bind(console, getDateString());
export const logError = console.error.bind(
  console,
  getDateString(),
  "\x1b[31mERROR\x1b[0m:"
);
