import { initTRPC, ProcedureRouterRecord } from "@trpc/server";
import { z } from "zod";
import * as trpcExpress from "@trpc/server/adapters/express";
import {
  cancelAutoRuns,
  EvercentResponse,
  getAllEvercentData,
  getBudgetsList,
  lockAutoRuns,
  runAutomation,
  saveAutoRunDetails,
  switchBudget,
  updateBudgetCategoryAmount,
  updateCategoryDetails,
  updateMonthsAheadTarget,
  updateUserDetails,
} from "evercent";

export type FnType<T> = T extends (...args: any) => any
  ? FnType<ReturnType<T>>
  : T extends Promise<infer K>
  ? FnType<Awaited<K>>
  : T extends EvercentResponse<infer K>
  ? T["data"]
  : T;

// created for each request
export const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => ({}); // no context
type Context = Awaited<ReturnType<typeof createContext>>;

export const ctx = initTRPC.context<Context>().create();
type TContext = typeof ctx;

export const createRouter = (ctx: TContext, procs: ProcedureRouterRecord) => {
  return ctx.router(procs);
};

export const getProc = (
  ctx: TContext,
  fn: (...args: any) => any,
  mutate: boolean
) => {
  if (mutate) {
    return ctx.procedure
      .input(z.custom<Parameters<typeof fn>[0]>())
      .mutation(async (opts) => await fn(opts.input));
  } else {
    return ctx.procedure
      .input(z.custom<Parameters<typeof fn>[0]>())
      .query(async (opts) => await fn(opts.input));
  }
};

const checkAPIStatus = () => {
  return { status: "API is up-and-running!" };
};

export const appRouter = createRouter(ctx, {
  getAPIStatus: getProc(ctx, checkAPIStatus, false),
  user: createRouter(ctx, {
    getAllUserData: getProc(ctx, getAllEvercentData, false),
    updateUserDetails: getProc(ctx, updateUserDetails, true),
    updateCategoryDetails: getProc(ctx, updateCategoryDetails, true),
    updateMonthsAheadTarget: getProc(ctx, updateMonthsAheadTarget, true),
  }),
  budget: createRouter(ctx, {
    //   connectToYNAB: getProc(ctx, connecttoyna, false),
    getBudgetsList: getProc(ctx, getBudgetsList, false),
    switchBudget: getProc(ctx, switchBudget, true),
    authorizeBudget: getProc(ctx, updateMonthsAheadTarget, true),
    updateBudgetCategoryAmount: getProc(ctx, updateBudgetCategoryAmount, true),
  }),
  autoRun: createRouter(ctx, {
    saveAutoRunDetails: getProc(ctx, saveAutoRunDetails, true),
    cancelAutoRuns: getProc(ctx, cancelAutoRuns, true),
    lockAutoRuns: getProc(ctx, lockAutoRuns, true),
    runAutomation: getProc(ctx, runAutomation, true),
  }),
});

// export type definition of API
export type AppRouter = typeof appRouter;
