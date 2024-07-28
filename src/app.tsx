import type { Express, Request, Response, NextFunction } from "express";
import express, { json, urlencoded } from "express";
import createError, { HttpError } from "http-errors";
import cors from "cors";

import * as trpcExpress from "@trpc/server/adapters/express";

import { log, logError } from "./utils/log";

import { sendEmailMessage } from "./utils/email";
import { appRouter, createContext } from "./trpc";

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

// tRPC
const trpcMiddleware = trpcExpress.createExpressMiddleware({
  router: appRouter,
  createContext,
});
app.use("/", trpcMiddleware);

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

  // return the data to the user
  return res.json(data);
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

  const endpoint = req.method + " " + req.url;
  logError(err.status || 500, endpoint, err.message);

  await sendEmailMessage({
    from: "Evercent API <nblaisdell2@gmail.com>",
    to: "nblaisdell2@gmail.com",
    subject: "Error!",
    message: err.message,
    attachments: [],
  });

  // render the error page
  return res.status(err.status || 500).json({ error: err.message });
});

const throwExpressError = (
  next: NextFunction,
  message: string,
  statusCode: number = 500
) => {
  next({ status: statusCode, message });
};

export default app;
