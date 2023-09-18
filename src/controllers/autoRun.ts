import { Request, Response, NextFunction } from "express";
import { getDistinctValues, sleep } from "../utils/util";
import { execute, query, sqlErr } from "../utils/sql";
import { log } from "../utils/log";
import { getUserData } from "../model/user";
import {
  getBudget,
  getBudgetCategory,
  getBudgetMonth,
  updateBudgetCategoryAmount,
} from "../model/budget";
import { dueDateAndAmountSet, getCategoryData } from "../model/category";
import { getAutoRunCategories, getAutoRunData } from "../model/autoRun";

type LockedResult = {
  runID: string;
  userID?: string;
  budgetID?: string;
  categoryGUID?: string;
  categoryGroupID?: string;
  categoryID: string;
  postingMonth: string;
  amountToPost: number;
  isIncluded: boolean;
  categoryAmount: number;
  categoryExtraAmount: number;
  categoryAdjustedAmount: number;
  categoryAdjAmountPerPaycheck: number;
};

type CapitalizeKeys<T> = {
  [k in keyof T as Capitalize<string & k>]: T[k];
};

export const getAutoRuns = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserEmail } = req.query;

  const userData = await getUserData(req, next, UserEmail as string);
  if (!userData) return;

  const budget = await getBudget(req, next, userData.userID, userData.budgetID);
  if (!budget) return;

  const categoryData = await getCategoryData(
    req,
    next,
    budget,
    userData.userID,
    userData.budgetID,
    userData.payFrequency,
    userData.nextPaydate
  );
  if (!categoryData) return;

  const autoRunData = await getAutoRunData(
    req,
    next,
    userData.userID,
    userData.budgetID,
    userData.payFrequency,
    budget,
    categoryData.categoryGroups
  );
  if (!autoRunData) return;

  res.status(200).json(autoRunData);
};

export const saveAutoRunDetails = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID, RunTime, ToggledCategories } = req.body;

  const queryRes = await execute(req, "spEV_UpdateAutoRunDetails", [
    { name: "UserID", value: UserID },
    { name: "BudgetID", value: BudgetID },
    { name: "NewRunTime", value: RunTime },
    {
      name: "ToggledCategories",
      value: ToggledCategories,
    },
  ]);
  if (sqlErr(next, queryRes)) return;

  res.status(200).json(queryRes.resultData);
};

export const cancelAutoRuns = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { UserID, BudgetID } = req.body;

  const queryRes = await execute(req, "spEV_CancelAutomationRuns", [
    { name: "UserID", value: UserID },
    { name: "BudgetID", value: BudgetID },
  ]);
  if (sqlErr(next, queryRes)) return;

  res.status(200).json(queryRes.resultData);
};

export const lockAutoRuns = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 1. Get the AutoRuns to lock for this hour
  let queryRes = await query(req, "spEV_GetAutoRunsToLock", []);
  if (sqlErr(next, queryRes)) return;

  // Check to see if we have any runs to lock.
  // If not, exit early here.
  if (!queryRes.resultData) {
    res.status(200).json({ status: "No AutoRuns to lock. Exiting..." });
    return;
  }

  if (queryRes.resultCount == 1) {
    queryRes.resultData = [queryRes.resultData];
  }

  // 2. Then, loop through each Run and...
  let lockedResults: LockedResult[] = [];
  for (let i = 0; i < queryRes.resultData.length; i++) {
    const { RunID, UserID, BudgetID, PayFrequency, NextPaydate } =
      queryRes.resultData[i];

    // - Get the current budget/autoRun details for this UserID/BudgetID
    const budget = await getBudget(req, next, UserID, BudgetID);
    if (!budget) return;

    const categoryData = await getCategoryData(
      req,
      next,
      budget,
      UserID,
      BudgetID,
      PayFrequency,
      NextPaydate.toISOString()
    );
    if (!categoryData) return;

    const autoRunData = await getAutoRunData(
      req,
      next,
      UserID,
      BudgetID,
      PayFrequency,
      budget,
      categoryData.categoryGroups
    );
    if (!autoRunData) return;

    const autoRunCategories = getAutoRunCategories(autoRunData.autoRuns);
    for (let j = 0; j < autoRunCategories.length; j++) {
      const currCat = autoRunCategories[j];

      for (let k = 0; k < currCat.postingMonths.length; k++) {
        const currMonth = currCat.postingMonths[k];

        // - Add the info to the Locked results JSON for the stored procedure
        lockedResults.push({
          runID: RunID,
          categoryID: currCat.categoryID,
          postingMonth: currMonth.postingMonth,
          amountToPost: currMonth.amountToPost,
          isIncluded: currMonth.included,
          categoryAmount: currCat.categoryAmount,
          categoryExtraAmount: currCat.categoryExtraAmount,
          categoryAdjustedAmount: currCat.categoryAdjustedAmount,
          categoryAdjAmountPerPaycheck:
            currCat.categoryAdjustedAmountPerPaycheck,
        });
      }
    }
  }

  // 3. Run the stored procedure for locking the results using our JSON
  queryRes = await execute(req, "spEV_LockAutoRuns", [
    {
      name: "LockedResults",
      value: JSON.stringify({ results: lockedResults }),
    },
  ]);
  if (sqlErr(next, queryRes)) return;

  res.status(200).json({ status: "EverCent categories locked successfully!" });
};

export const runAutomation = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  log("STARTING EVERCENT AUTOMATION");

  let queryRes = await query(req, "spEV_GetAutoRunsLocked", []);
  if (sqlErr(next, queryRes)) return;

  // Check to see if we have any runs to lock.
  // If not, exit early here.
  if (!queryRes.resultData) {
    log("No Locked AutoRuns found. Exiting automation...");
    res.status(200).json({ status: "No AutoRuns to lock. Exiting..." });
    return;
  }

  if (!Array.isArray(queryRes.resultData)) {
    queryRes.resultData = [queryRes.resultData];
  }

  const queryData: CapitalizeKeys<LockedResult>[] = queryRes.resultData;

  const runIDs = getDistinctValues(queryData, "RunID");
  for (let i = 0; i < runIDs.length; i++) {
    const currRunID = runIDs[i];
    log("Running automation for RunID: '" + currRunID + "'");

    const categoryData = queryData.filter((r) => r.RunID == currRunID);
    const { UserID, BudgetID } = categoryData[0];

    const budget = await getBudget(
      req,
      next,
      UserID as string,
      BudgetID as string
    );
    if (!budget) return;

    const categoryIDs = getDistinctValues(categoryData, "CategoryID");
    for (let j = 0; j < categoryIDs.length; j++) {
      const currCategoryID = categoryIDs[j];

      const monthData = categoryData.filter(
        (r) => r.CategoryID == currCategoryID
      );
      for (let k = 0; k < monthData.length; k++) {
        const category = monthData[k];
        const currMonth = new Date(category.PostingMonth);

        const bm = getBudgetMonth(budget.months, currMonth);
        const bc = getBudgetCategory(
          bm,
          category.CategoryGroupID as string,
          category.CategoryID
        );

        const oldBudgeted = bc.budgeted;
        const newBudgeted = oldBudgeted + category.AmountToPost;

        log("  Posting amount to YNAB budget", {
          postingMonth: category.PostingMonth,
          oldBudgeted,
          newBudgeted,
        });

        const formattedMonth = new Date(category.PostingMonth)
          .toISOString()
          .substring(0, 10);
        const result = await updateBudgetCategoryAmount(
          req,
          next,
          UserID as string,
          BudgetID as string,
          category.CategoryID,
          formattedMonth,
          newBudgeted
        );
        if (!result) return;

        log("  Result from YNAB:", result);

        // Add a record to the database for every time we post an update
        // to a user's budget categories, so we can check them again later
        await execute(req, "spEV_AddPastAutomationResults", [
          { name: "RunID", value: category.RunID },
          { name: "CategoryID", value: category.CategoryID },
          { name: "CategoryAmount", value: category.CategoryAmount },
          { name: "CategoryExtraAmount", value: category.CategoryExtraAmount },
          {
            name: "CategoryAdjustedAmount",
            value: category.CategoryAdjustedAmount,
          },
          {
            name: "CategoryAdjAmountPerPaycheck",
            value: category.CategoryAdjAmountPerPaycheck,
          },
          { name: "PostingMonth", value: category.PostingMonth },
          { name: "OldAmountBudgeted", value: oldBudgeted },
          { name: "AmountPosted", value: category.AmountToPost },
          { name: "NewAmountBudgeted", value: newBudgeted },
        ]);

        // Sleep for 2 seconds between each post to YNAB
        log("Sleeping...");
        await sleep(2000);

        const regDetailsRes = await query(
          req,
          "spEV_GetRegularExpenseDetails",
          [
            { name: "UserID", value: UserID },
            { name: "BudgetID", value: BudgetID },
            { name: "CategoryID", value: category.CategoryID },
          ]
        );
        if (sqlErr(next, regDetailsRes)) return;

        // Check for non-monthly regular expense for updating
        // months divisor in DB for this category
        if (regDetailsRes.resultData) {
          const { IsMonthly, NextDueDate } = regDetailsRes.resultData;

          if (
            dueDateAndAmountSet(
              IsMonthly,
              NextDueDate,
              category.CategoryAmount,
              bc,
              currMonth
            )
          ) {
            log("  Updating expense months divisor");
            const cleanupQueryRes = await execute(
              req,
              "spEV_UpdateCategoryExpenseMonthsDivisor",
              [
                { name: "UserID", value: UserID },
                { name: "BudgetID", value: BudgetID },
                { name: "CategoryGUID", value: category.CategoryGUID },
              ]
            );
            if (sqlErr(next, cleanupQueryRes)) return;
          }
        }
      }
    }

    log("Cleaning up automation for: '" + currRunID + "'");
    const cleanupQueryRes = await execute(req, "spEV_CleanupAutomationRun", [
      { name: "RunID", value: currRunID },
    ]);
    if (sqlErr(next, cleanupQueryRes)) return;
  }

  log("EVERCENT AUTOMATION - COMPLETE!");
  res
    .status(200)
    .json({ status: "EverCent Automation completed successfully!" });
};
