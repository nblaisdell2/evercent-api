import React from "react";
import { Request, Response, NextFunction } from "express";
import { find, getDistinctValues, sleep } from "../utils/util";
import { execute, query, sqlErr } from "../utils/sql";
import { log } from "../utils/log";
import {
  BudgetMonth,
  BudgetMonthCategory,
  getBudget,
  getBudgetCategory,
  getBudgetMonth,
  updateBudgetCategoryAmount,
} from "../model/budget";
import { dueDateAndAmountSet, getCategoryData } from "../model/category";
import { getAutoRunCategories, getAutoRunData } from "../model/autoRun";
import { createTransport } from "nodemailer";
import { render } from "@react-email/render";
import Email, { EmailProps, EmailPropsGroup } from "../model/Email";
import { sendEmail } from "../utils/email";
import { format, parseISO } from "date-fns";

type LockedResult = {
  runID: string;
  userEmail?: string;
  userID?: string;
  budgetID?: string;
  runTime?: string;
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

  next({
    data: queryRes.resultData,
    message: JSON.stringify({
      NewRunTime: RunTime,
      ToggledCategories: ToggledCategories,
    }),
  });
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

  next({
    data: queryRes.resultData,
    message: "Canceled upcoming AutoRuns for user: " + UserID,
  });
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
    next({
      data: { status: "No AutoRuns to lock. Exiting..." },
      message: "No AutoRuns to lock. Exiting...",
    });
    return;
  }

  if (!Array.isArray(queryRes.resultData)) {
    queryRes.resultData = [queryRes.resultData];
  }

  log("querydata", queryRes.resultData);

  // 2. Then, loop through each Run and...
  let lockedResults: LockedResult[] = [];
  for (let i = 0; i < queryRes.resultData.length; i++) {
    const { RunID, UserID, BudgetID, PayFrequency, NextPaydate } =
      queryRes.resultData[i];

    // - Get the current budget/autoRun details for this UserID/BudgetID
    const budget = await getBudget(req, next, UserID, BudgetID);
    if (!budget) return;

    // log("budget", budget);

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

    // log("categories", categoryData.categoryGroups);

    const autoRunData = await getAutoRunData(
      req,
      next,
      UserID,
      BudgetID,
      budget.months,
      PayFrequency,
      categoryData.categoryGroups
    );
    if (!autoRunData) return;

    log("autoRunData", autoRunData.autoRuns);

    const autoRunCategories = getAutoRunCategories(autoRunData.autoRuns);
    log("autoRunData2", autoRunCategories);
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

  log(JSON.stringify({ results: lockedResults }));

  // 3. Run the stored procedure for locking the results using our JSON
  queryRes = await execute(req, "spEV_LockAutoRuns", [
    {
      name: "LockedResults",
      value: JSON.stringify({ results: lockedResults }),
    },
  ]);
  if (sqlErr(next, queryRes)) return;

  next({
    data: { status: "EverCent categories locked successfully!" },
    message: JSON.stringify({ results: lockedResults }),
  });
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

    next({
      data: { status: "No Locked AutoRuns found. Exiting automation..." },
      message: "No Locked AutoRuns found. Exiting automation...",
    });
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
    const { UserID, UserEmail, BudgetID, RunTime } = categoryData[0];

    const budget = await getBudget(
      req,
      next,
      UserID as string,
      BudgetID as string
    );
    if (!budget) return;

    let bm: BudgetMonth | null = null;
    let bc: BudgetMonthCategory | null = null;

    let results: EmailPropsGroup[] = [];
    const categoryIDs = getDistinctValues(categoryData, "CategoryID");
    for (let j = 0; j < categoryIDs.length; j++) {
      const currCategoryID = categoryIDs[j];

      const monthData = categoryData.filter(
        (r) => r.CategoryID == currCategoryID
      );
      for (let k = 0; k < monthData.length; k++) {
        const category = monthData[k];
        if (!category.IsIncluded) continue;

        const currMonth = new Date(category.PostingMonth);

        bm = getBudgetMonth(budget.months, currMonth);
        bc = getBudgetCategory(
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

        // Adding Details for email later on
        // ============================================
        if (
          !results.some(
            (a) => a.groupID.toLowerCase() == bc?.categoryGroupID.toLowerCase()
          )
        ) {
          results.push({
            groupID: bc.categoryGroupID,
            groupName: bc.categoryGroupName,
            categories: [],
          });
        }

        const currGroup = find(
          results,
          (a) => a.groupID.toLowerCase() == bc?.categoryGroupID.toLowerCase()
        );
        if (
          !currGroup.categories.some(
            (a) => a.categoryID.toLowerCase() == bc?.categoryID.toLowerCase()
          )
        ) {
          currGroup.categories.push({
            categoryID: bc.categoryID,
            categoryName: bc.name,
            months: [],
          });
        }

        const currCat = find(
          currGroup.categories,
          (a) => a.categoryID.toLowerCase() == bc?.categoryID.toLowerCase()
        );
        if (!currCat.months.some((a) => a.monthName == category.PostingMonth)) {
          currCat.months.push({
            monthName: category.PostingMonth,
            amountPosted: category.AmountToPost,
            newAmtBudgeted: newBudgeted,
          });
        }
        // ============================================

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

    // PREPARING EMAIL
    // ======================

    // Sort the groups by their order in YNAB,
    let sortedResults = results.sort(
      (a, b) =>
        (bm as BudgetMonth).groups.findIndex(
          (cg) => cg.categoryGroupID.toLowerCase() == a.groupID.toLowerCase()
        ) -
        (bm as BudgetMonth).groups.findIndex(
          (cg) => cg.categoryGroupID.toLowerCase() == b.groupID.toLowerCase()
        )
    );
    // Then sort the categories within each of the groups based on their order in YNAB
    for (let i = 0; i < sortedResults.length; i++) {
      let currGroup = find(
        (bm as BudgetMonth).groups,
        (cg) =>
          cg.categoryGroupID.toLowerCase() ==
          sortedResults[i].groupID.toLowerCase()
      );
      sortedResults[i].categories = sortedResults[i].categories.sort(
        (a, b) =>
          currGroup.categories.findIndex(
            (c) => c.categoryID.toLowerCase() == a.categoryID.toLowerCase()
          ) -
          currGroup.categories.findIndex(
            (c) => c.categoryID.toLowerCase() == b.categoryID.toLowerCase()
          )
      );
    }

    await sendEvercentEmail(
      UserEmail as string,
      RunTime as string,
      sortedResults
    );
    // ======================
  }

  log("EVERCENT AUTOMATION - COMPLETE!");

  next({
    data: { status: "EverCent Automation completed successfully!" },
    message: "EverCent Automation completed successfully!",
  });
};

export const sendTestEmail = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const emailProps: EmailPropsGroup[] = [
    {
      groupID: "",
      groupName: "Immediate Obligations",
      categories: [
        {
          categoryID: "",
          categoryName: "Groceries",
          months: [
            {
              monthName: "NOV 2023",
              amountPosted: 69.13,
              newAmtBudgeted: 100,
            },
            {
              monthName: "DEC 2023",
              amountPosted: 30.87,
              newAmtBudgeted: 100,
            },
          ],
        },
        {
          categoryID: "",
          categoryName: "Phone",
          months: [
            {
              monthName: "NOV 2023",
              amountPosted: 30,
              newAmtBudgeted: 100,
            },
          ],
        },
      ],
    },
    {
      groupID: "",
      groupName: "Subscriptions",
      categories: [
        {
          categoryID: "",
          categoryName: "Groceries",
          months: [
            {
              monthName: "NOV 2023",
              amountPosted: 69.13,
              newAmtBudgeted: 100,
            },
            {
              monthName: "DEC 2023",
              amountPosted: 30.87,
              newAmtBudgeted: 100,
            },
          ],
        },
        {
          categoryID: "",
          categoryName: "Phone",
          months: [
            {
              monthName: "NOV 2023",
              amountPosted: 30,
              newAmtBudgeted: 100,
            },
          ],
        },
      ],
    },
  ];

  await sendEvercentEmail(
    "nblaisdell2@gmail.com",
    new Date().toISOString(),
    emailProps
  );

  next({ msg: "sent email successfully!" });
};

export const sendEvercentEmail = async function (
  userEmail: string,
  runTime: string,
  emailProps: EmailPropsGroup[]
) {
  const info = await sendEmail({
    emailComponent: (
      <Email
        runTime={format(
          parseISO(new Date(runTime).toISOString()),
          "MM/dd/yyyy @ h:mma"
        )}
        groups={emailProps}
      />
    ),
    from: '"Evercent" <nblaisdell2@gmail.com>',
    to: userEmail,
    subject: "Budget Automation Results",
    attachments: [
      {
        filename: "evercent_logo.png",
        path: __dirname + "/../public/evercent_logo.png",
        cid: "logo",
      },
    ],
  });

  console.log("Message sent: %s", info.messageId);
};
