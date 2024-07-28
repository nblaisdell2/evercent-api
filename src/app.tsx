import express, { json, urlencoded } from "express";
import cors from "cors";
import { appRouter, createContext } from "evercent";

import * as trpcExpress from "@trpc/server/adapters/express";

const app = express();

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

// tRPC
const trpcMiddleware = trpcExpress.createExpressMiddleware({
  router: appRouter,
  createContext,
});
app.use("/", trpcMiddleware);

export default app;
