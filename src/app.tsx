import express, { json, urlencoded } from "express";
import type { Express, Request, Response, NextFunction } from "express";
import createError, { HttpError } from "http-errors";
import cors from "cors";

import { log, logError } from "./utils/log";

import indexRouter from "./routes/indexRouter";
import budgetRouter from "./routes/budgetRouter";
import userRouter from "./routes/userRouter";
import autoRunRouter from "./routes/autoRunRouter";

import { sendEmailMessage } from "./utils/email";

const app: Express = express();

// Makes sure our API can only accept URL-encoded strings, or JSON data
app.use(json());
app.use(urlencoded({ extended: false }));
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://evercent.net",
      "https://api.ynab.com",
    ],
  })
);

// // Logging mechanisms
// app.use(routeLogger());

// Define our endpoints (routers) that are made available for our API
app.use("/", indexRouter);

// Evercent endpoints
app.use("/budget", budgetRouter);
app.use("/user", userRouter);
app.use("/autoRun", autoRunRouter);

// // Create a "shared" lobal connection pool for SQL Server queries
// createSharedConnectionPool().then((pool) => {
//   app.locals.db = pool;
// });

// success handler
app.use(async function (
  data: {
    data: any;
    message: string;
    status?: number;
  },
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (data?.status && data?.status == 500) {
    return throwExpressError(next, data.message);
  }

  const endpoint = req.method + " " + req.url;
  log("Request Info: ", res.statusCode, endpoint);
  log(data.message);

  // render the error page
  return res.status(200).json(data.data);
});

// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
  next(createError(404));
});

// error handler
app.use(async function (
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // set locals, only providing error in development
  res.locals.error = req.app.get("env") === "development" ? err : {};
  logError(err.message);

  console.log("err", err);
  const endpoint = req.method + " " + req.url;
  log(req, "Error", err.status || 500, endpoint, err.message);

  await sendEmailMessage({
    from: "Evercent API <nblaisdell2@gmail.com>",
    to: "nblaisdell2@gmail.com",
    subject: "Error!",
    message: err.message,
    attachments: [],
  });

  // render the error page
  return res
    .status(err.status || 500)
    .json({ error: "Error occurred with request." });
});

export const throwExpressError = (
  next: NextFunction,
  message: string,
  statusCode: number = 500
) => {
  next({ status: statusCode, message });
};

export default app;
