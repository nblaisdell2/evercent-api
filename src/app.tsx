import express, { json, urlencoded } from "express";
import cors from "cors";

import * as trpcExpress from "@trpc/server/adapters/express";
import { initTRPC } from "@trpc/server";
import { appRouter } from "evercent";

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

// created for each request
export const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => ({}); // no context
// type Context = Awaited<ReturnType<typeof createContext>>;

// export const ctx = initTRPC.context<Context>().create();
// type TContext = typeof ctx;

// export const getProc = (
//   fn: (...args: any) => Promise<EvercentResponse<any>>,
//   mutate: boolean
// ) => {
//   if (mutate) {
//     return publicProcedure
//       .input(z.custom<Parameters<typeof fn>[0]>())
//       .mutation(async (opts) => {
//         const response = await fn(opts.input);
//         if (response.err) sendErrorEmail(mutate, response, opts);
//         return response;
//       });
//   } else {
//     return publicProcedure
//       .input(z.custom<Parameters<typeof fn>[0]>())
//       .query(async (opts) => {
//         const response = await fn(opts.input);
//         if (response.err) sendErrorEmail(mutate, response, opts);
//         return response;
//       });
//   }
// };

// tRPC
app.use(
  "/",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
