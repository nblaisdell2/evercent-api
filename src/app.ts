import express, { json, urlencoded } from "express";
import type { Express, Request, Response, NextFunction } from "express";
import createError, { HttpError } from "http-errors";

import { createSharedConnectionPool } from "./utils/sql";
import { logError, routeLogger } from "./utils/log";

import indexRouter from "./routes/indexRouter";
import budgetRouter from "./routes/budgetRouter";
import userRouter from "./routes/userRouter";
import autoRunRouter from "./routes/autoRunRouter";

import { config } from "dotenv";
config();

const app: Express = express();

// Makes sure our API can only accept URL-encoded strings, or JSON data
app.use(json());
app.use(urlencoded({ extended: false }));

// Logging mechanisms
app.use(routeLogger());

// Define our endpoints (routers) that are made available for our API
app.use("/", indexRouter);

// Evercent endpoints
app.use("/budget", budgetRouter);
app.use("/user", userRouter);
app.use("/autoRun", autoRunRouter);

// Create a "shared" lobal connection pool for SQL Server queries
createSharedConnectionPool().then((pool) => {
  app.locals.db = pool;
});

// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
  next(createError(404));
});

// error handler
app.use(function (
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  logError(err.message);

  // render the error page
  res.status(err.status || 500).json({ error: "Error occurred with request." });
});

export const throwExpressError = (
  next: NextFunction,
  message: string,
  statusCode: number = 500
) => {
  next({ status: statusCode, message });
};

export default app;
