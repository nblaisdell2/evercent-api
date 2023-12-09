import { Request, NextFunction } from "express";
import { log } from "../utils/log";
import { query, sqlErr } from "../utils/sql";
import { find, generateUUID, getDistinctValues } from "../utils/util";
import { PayFrequency, getAmountByPayFrequency } from "./user";
import {
  Budget,
  BudgetMonth,
  BudgetMonthCategory,
  getBudget,
  getBudgetCategories,
} from "./budget";
import { CategoryGroup, getPostingMonths } from "./category";

export type AutoRun = {
  runID: string;
  runTime: string;
  isLocked: boolean;
  categoryGroups: AutoRunCategoryGroup[];
};

export type AutoRunCategoryGroup = {
  groupID: string;
  groupName: string;
  categories: AutoRunCategory[];
};

export type AutoRunCategory = {
  categoryGUID: string;
  categoryID: string;
  categoryName: string;
  categoryAmount: number;
  categoryExtraAmount: number;
  categoryAdjustedAmount: number;
  categoryAdjustedAmountPerPaycheck: number;
  postingMonths: AutoRunCategoryMonth[];
  included: boolean;
};

export type AutoRunCategoryMonth = {
  postingMonth: string;
  included: boolean;
  amountToPost: number;
  amountPosted?: number;
  oldAmountBudgeted?: number;
  newAmountBudgeted?: number;
};

type AutoRunDB = {
  RunID: string;
  RunTime: string;
  IsLocked: boolean;
};

type AutoRunCategoryDB = {
  RunID: string;
  CategoryGUID: string;
  CategoryGroupID: string;
  CategoryID: string;
  PostingMonth: string;
  IsIncluded: boolean;
  AmountToPost: number;
  AmountPosted: number;
  OldAmountBudgeted: number;
  NewAmountBudgeted: number;
  CategoryAmount: number;
  CategoryExtraAmount: number;
  CategoryAdjustedAmount: number;
  CategoryAdjAmountPerPaycheck: number;
};

const createAutoRunCategoryGroups = (
  categoriesDB: AutoRunCategoryDB[],
  categories: CategoryGroup[],
  budgetMonths: BudgetMonth[],
  payFreq: PayFrequency,
  getPastRuns: boolean
): AutoRunCategoryGroup[] => {
  let returnGroups: AutoRunCategoryGroup[] = [];
  let returnCategories: AutoRunCategory[] = [];
  let returnPostingMonths: AutoRunCategoryMonth[] = [];

  returnGroups = [];

  // For cany categories that we aren't able to find a categoryGroupID for are ones
  // that have been hidden/deleted from the user's budget since that run.
  // This will find that groupID, so the rest of the code will work as intended,
  // as well as generate a new CategoryGUID, again just so the code will work.
  const backfilled = categoriesDB.map((c) => {
    if (!c.CategoryGroupID) {
      let foundGroupID = "";
      for (let i = 0; i < budgetMonths[0].groups.length; i++) {
        for (let j = 0; j < budgetMonths[0].groups[i].categories.length; j++) {
          if (
            budgetMonths[0].groups[i].categories[j].categoryID.toLowerCase() ==
            c.CategoryID.toLowerCase()
          ) {
            foundGroupID =
              budgetMonths[0].groups[i].categories[j].categoryGroupID;
            break;
          }
        }

        if (foundGroupID != "") {
          break;
        }
      }
      return {
        ...c,
        CategoryGUID: generateUUID().toUpperCase(),
        CategoryGroupID: foundGroupID.toUpperCase(),
      };
    }
    return c;
  });

  log("categoriesDB", backfilled);
  const groupIDs = getDistinctValues(backfilled, "CategoryGroupID");
  log("groupIDs", groupIDs);

  for (let i = 0; i < categories.length; i++) {
    const currGroup = categories[i];
    const groupID = currGroup.groupID.toLowerCase();
    if (
      groupIDs.length == 0 ||
      !groupIDs.map((g) => g?.toLowerCase()).includes(groupID)
    )
      continue;

    let groupName = currGroup.groupName;

    const categoriesForGroupDB = backfilled.filter(
      (cat) => cat.CategoryGroupID.toLowerCase() == groupID
    );
    const categoryIDs = getDistinctValues(categoriesForGroupDB, "CategoryID");

    returnCategories = [];
    for (let j = 0; j < currGroup.categories.length; j++) {
      const currCategory = currGroup.categories[j];
      const categoryID = currCategory.categoryID.toLowerCase();
      if (!categoryIDs.map((c) => c.toLowerCase()).includes(categoryID))
        continue;
      returnPostingMonths = [];

      let categoryName = currCategory.name;

      const categoriesForIDDB = categoriesForGroupDB.filter(
        (cat) => cat.CategoryID.toLowerCase() == categoryID
      );

      if (getPastRuns) {
        for (let k = 0; k < categoriesForIDDB.length; k++) {
          const categoryDB = categoriesForIDDB[k];

          returnPostingMonths.push({
            postingMonth: categoryDB.PostingMonth,
            included: true,
            amountToPost: categoryDB.AmountToPost,
            amountPosted: categoryDB.AmountPosted,
            oldAmountBudgeted: categoryDB.OldAmountBudgeted,
            newAmountBudgeted: categoryDB.NewAmountBudgeted,
          });
        }

        returnCategories.push({
          categoryGUID: categoriesForIDDB[0].CategoryGUID,
          categoryID: categoriesForIDDB[0].CategoryID,
          categoryName: categoryName,
          categoryAmount: categoriesForIDDB[0].CategoryAmount,
          categoryExtraAmount: categoriesForIDDB[0].CategoryExtraAmount,
          categoryAdjustedAmount: categoriesForIDDB[0].CategoryAdjustedAmount,
          categoryAdjustedAmountPerPaycheck:
            categoriesForIDDB[0].CategoryAdjAmountPerPaycheck,
          postingMonths: returnPostingMonths,
          included: categoriesForIDDB[0].IsIncluded,
        });
      } else {
        const evercentGroup = find(
          categories,
          (grp) => grp.groupID.toLowerCase() == groupID
        );
        const evercentCategory = find(
          evercentGroup.categories,
          (cat) => cat.categoryID.toLowerCase() == categoryID
        );

        for (let k = 0; k < evercentCategory.postingMonths.length; k++) {
          const currPM = evercentCategory.postingMonths[k];
          returnPostingMonths.push({
            postingMonth: currPM.month,
            included: categoriesForIDDB[0].IsIncluded,
            amountToPost: currPM.amount,
          });
        }

        returnCategories.push({
          categoryGUID: evercentCategory.guid,
          categoryID: evercentCategory.categoryID,
          categoryName: categoryName,
          categoryAmount: evercentCategory.amount,
          categoryExtraAmount: evercentCategory.extraAmount,
          categoryAdjustedAmount: evercentCategory.adjustedAmount,
          categoryAdjustedAmountPerPaycheck: getAmountByPayFrequency(
            evercentCategory.adjustedAmountPlusExtra,
            payFreq
          ),
          postingMonths: returnPostingMonths,
          included:
            evercentCategory.regularExpenseDetails == null
              ? true
              : evercentCategory.regularExpenseDetails.includeOnChart,
        });
      }
    }

    // If we have any past run data for categories that have since been hidden/deleted
    // from the user's budget, we'll go through one more time and make sure to add those
    // details, using the YNAB budget details gathered earlier, rather than relying on the
    // custom Evercent list of categories, since that will always exclude hidden/deleted
    // categories.
    if (getPastRuns && returnCategories.length < categoriesForGroupDB.length) {
      for (let j = 0; j < categoriesForGroupDB.length; j++) {
        const currCategory = categoriesForGroupDB[j];
        const categoryID = currCategory.CategoryID.toLowerCase();

        // If we already added this category, don't re-add it
        if (
          returnCategories.some(
            (rc) => rc.categoryID.toLowerCase() == categoryID
          )
        ) {
          continue;
        }

        const categoriesForIDDB = categoriesForGroupDB.filter(
          (cat) => cat.CategoryID.toLowerCase() == categoryID
        );

        // find the category name in the "budget" details, rather than
        // the "category" details, in the previous for loop
        let categoryName = "";
        const foundCategory = budgetMonths[0].groups
          .find(
            (g) =>
              g.categoryGroupID.toLowerCase() ==
              currCategory.CategoryGroupID.toLowerCase()
          )
          ?.categories.find((c) => c.categoryID.toLowerCase() == categoryID);
        if (foundCategory) {
          categoryName = foundCategory.name;
        }

        returnPostingMonths = [];
        for (let k = 0; k < categoriesForIDDB.length; k++) {
          const categoryDB = categoriesForIDDB[k];

          returnPostingMonths.push({
            postingMonth: categoryDB.PostingMonth,
            included: true,
            amountToPost: categoryDB.AmountToPost,
            amountPosted: categoryDB.AmountPosted,
            oldAmountBudgeted: categoryDB.OldAmountBudgeted,
            newAmountBudgeted: categoryDB.NewAmountBudgeted,
          });
        }

        returnCategories.push({
          categoryGUID: categoriesForIDDB[0].CategoryGUID,
          categoryID: categoriesForIDDB[0].CategoryID,
          categoryName,
          categoryAmount: categoriesForIDDB[0].CategoryAmount,
          categoryExtraAmount: categoriesForIDDB[0].CategoryExtraAmount,
          categoryAdjustedAmount: categoriesForIDDB[0].CategoryAdjustedAmount,
          categoryAdjustedAmountPerPaycheck:
            categoriesForIDDB[0].CategoryAdjAmountPerPaycheck,
          postingMonths: returnPostingMonths,
          included: categoriesForIDDB[0].IsIncluded,
        });
      }
    }

    returnGroups.push({
      groupID: groupID,
      groupName: groupName,
      categories: returnCategories,
    });
  }

  return returnGroups;
};

const generateAutoRunCategoryGroups = (
  categoriesDB: AutoRunCategoryDB[],
  categories: CategoryGroup[],
  payFreq: PayFrequency
) => {
  // log("GENERATING from", categories);

  let returnGroups: AutoRunCategoryGroup[] = [];
  let returnCategories: AutoRunCategory[] = [];
  let returnPostingMonths: AutoRunCategoryMonth[] = [];

  returnGroups = [];
  for (let i = 0; i < categories.length; i++) {
    const currGroup = categories[i];
    returnCategories = [];

    for (let j = 0; j < currGroup.categories.length; j++) {
      const currCategory = currGroup.categories[j];
      returnPostingMonths = [];

      if (currCategory.adjustedAmount > 0) {
        for (let k = 0; k < currCategory.postingMonths.length; k++) {
          const currPM = currCategory.postingMonths[k];
          const dbCats = categoriesDB.filter(
            (c) =>
              c.CategoryGUID?.toLowerCase() ==
                currCategory.guid.toLowerCase() &&
              c.PostingMonth &&
              new Date(currPM.month).toISOString() ==
                new Date(c.PostingMonth).toISOString()
          );

          const isIncluded = dbCats.at(0) ? dbCats[0].IsIncluded : true;

          returnPostingMonths.push({
            postingMonth: currPM.month,
            included: isIncluded,
            amountToPost: currPM.amount,
          });
        }

        returnCategories.push({
          categoryGUID: currCategory.guid,
          categoryID: currCategory.categoryID,
          categoryName: currCategory.name,
          categoryAmount: currCategory.amount,
          categoryExtraAmount: currCategory.extraAmount,
          categoryAdjustedAmount: currCategory.adjustedAmount,
          categoryAdjustedAmountPerPaycheck: getAmountByPayFrequency(
            currCategory.adjustedAmountPlusExtra,
            payFreq
          ),
          postingMonths: returnPostingMonths,
          included:
            currCategory.regularExpenseDetails == null
              ? true
              : currCategory.regularExpenseDetails.includeOnChart,
        });
      }
    }

    if (returnCategories.length > 0) {
      returnGroups.push({
        groupID: currGroup.groupID,
        groupName: currGroup.groupName,
        categories: returnCategories,
      });
    }
  }

  return returnGroups;
};

const getAutoRunDetails = (
  autoRunData: AutoRunDB[],
  autoRunCategoryData: AutoRunCategoryDB[],
  categories: CategoryGroup[],
  budgetMonths: BudgetMonth[],
  payFreq: PayFrequency,
  pastRuns: boolean
) => {
  log("Do i have autoRunData?", autoRunData);
  const autoRuns = autoRunData.map((ar) => {
    const { RunID, RunTime, IsLocked } = ar;

    const autoRunCategoriesDB = autoRunCategoryData.filter(
      (arc) => arc.RunID.toLowerCase() == RunID.toLowerCase()
    );

    log("Creating Groups for AutoRun");
    let autoRunCategoryGroups: AutoRunCategoryGroup[] = [];
    if (!pastRuns && !IsLocked) {
      autoRunCategoryGroups = generateAutoRunCategoryGroups(
        autoRunCategoriesDB,
        categories,
        payFreq
      );
    } else {
      autoRunCategoryGroups = createAutoRunCategoryGroups(
        autoRunCategoriesDB,
        categories,
        budgetMonths,
        payFreq,
        pastRuns
      );
    }

    return {
      runID: RunID,
      runTime: RunTime,
      isLocked: IsLocked,
      categoryGroups: autoRunCategoryGroups,
    } as AutoRun;
  });

  log("Returning all autoRuns");
  return autoRuns;
};

export const getAutoRunData = async (
  req: Request,
  next: NextFunction,
  userID: string,
  budgetID: string,
  budgetMonths: BudgetMonth[],
  payFreq: PayFrequency,
  categories: CategoryGroup[]
) => {
  log("What are my IDs?", userID, budgetID);

  const queryRes = await query(req, "spEV_GetAutoRunData", [
    { name: "UserID", value: userID },
    { name: "BudgetID", value: budgetID },
  ]);
  if (sqlErr(next, queryRes)) return null;

  log("queryRes", queryRes);

  // recalculate the posting months for each category, if the autoRuns are set
  // so that we use the correct "nextPaydate", when the user tries to calculate
  // their posting months for their next paydate, even when checking on their *current*
  // paydate.
  if (queryRes.resultData[0].at(0) != undefined) {
    categories = categories.map((cg) => {
      return {
        ...cg,
        categories: cg.categories.map((c) => {
          return {
            ...c,
            postingMonths: getPostingMonths(
              c,
              budgetMonths,
              payFreq,
              new Date(queryRes.resultData[0][0].RunTime).toISOString()
            ),
          };
        }),
      };
    });
  }

  log("GETTING AUTO RUN DETAILS - AutoRuns");
  const autoRuns = getAutoRunDetails(
    queryRes.resultData[0],
    queryRes.resultData[1],
    categories,
    budgetMonths,
    payFreq,
    false
  );

  log("GETTING AUTO RUN DETAILS - PastRuns");
  const pastRuns = getAutoRunDetails(
    queryRes.resultData[2],
    queryRes.resultData[3],
    categories,
    budgetMonths,
    payFreq,
    true
  );

  return { autoRuns, pastRuns, categoryGroups: categories };
};

export const getAutoRunCategories = (
  autoRuns: AutoRun[]
): AutoRunCategory[] => {
  if (!autoRuns[0]) return [];
  return autoRuns[0].categoryGroups.reduce((prev, curr) => {
    return [...prev, ...curr.categories];
  }, [] as AutoRunCategory[]);
};
