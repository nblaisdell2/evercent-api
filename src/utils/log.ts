import winston from "winston";
import expressWinston from "express-winston";
import type { Request, Response } from "express";

export const routeLogger = () => {
  return expressWinston.logger({
    transports: [
      new winston.transports.Console(),
      new winston.transports.Http({
        host: "fg20cv9eg4.execute-api.us-east-1.amazonaws.com/dev",
        port: 443,
        path: "/log",
      }),
    ],
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
    ignoreRoute: (req: Request, res: Response) => {
      return req.path == "/log";
    },
  });
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
