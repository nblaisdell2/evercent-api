import { Request, NextFunction } from "express";
import { log } from "../utils/log";
import { query, sqlErr } from "../utils/sql";
import { find, getDistinctValues } from "../utils/util";
import { PayFrequency, getAmountByPayFrequency } from "./user";
import { Budget, BudgetMonthCategory, getBudgetCategories } from "./budget";
import { CategoryGroup } from "./category";

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
  budgetCategories: BudgetMonthCategory[],
  categories: CategoryGroup[],
  payFreq: PayFrequency,
  getPastRuns: boolean
): AutoRunCategoryGroup[] => {
  const returnGroups: AutoRunCategoryGroup[] = [];

  const groupIDs = getDistinctValues(categoriesDB, "CategoryGroupID");
  for (let i = 0; i < groupIDs.length; i++) {
    const groupID = groupIDs[i].toLowerCase();
    let groupName = "";

    const categoriesForGroupDB = categoriesDB.filter(
      (cat) => cat.CategoryGroupID.toLowerCase() == groupID
    );

    const returnCategories: AutoRunCategory[] = [];
    const categoryIDs = getDistinctValues(categoriesForGroupDB, "CategoryID");
    for (let j = 0; j < categoryIDs.length; j++) {
      const categoryID = categoryIDs[j].toLowerCase();
      let categoryName = "";

      const returnPostingMonths: AutoRunCategoryMonth[] = [];
      const categoriesForIDDB = categoriesForGroupDB.filter(
        (cat) => cat.CategoryID.toLowerCase() == categoryID
      );
      if (getPastRuns) {
        for (let k = 0; k < categoriesForIDDB.length; k++) {
          const categoryDB = categoriesForIDDB[k];

          const budgetCategory = find(
            budgetCategories,
            (bc) =>
              bc.categoryGroupID.toLowerCase() == groupID &&
              bc.categoryID.toLowerCase() == categoryID
          );
          groupName = budgetCategory.categoryGroupName;
          categoryName = budgetCategory.name;

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
  log("GENERATING from", categories);

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
  budget: Budget,
  categories: CategoryGroup[],
  payFreq: PayFrequency,
  pastRuns: boolean
) => {
  const budgetCategories = getBudgetCategories(budget);
  const autoRuns: AutoRun[] = autoRunData.map((ar) => {
    const { RunID, RunTime, IsLocked } = ar;

    const autoRunCategoriesDB = autoRunCategoryData.filter(
      (arc) => arc.RunID.toLowerCase() == RunID.toLowerCase()
    );

    let autoRunCategoryGroups: AutoRunCategoryGroup[] = [];
    // if (pastRuns)
    if (!pastRuns && !IsLocked) {
      autoRunCategoryGroups = generateAutoRunCategoryGroups(
        autoRunCategoriesDB,
        categories,
        payFreq
      );
    } else {
      autoRunCategoryGroups = createAutoRunCategoryGroups(
        autoRunCategoriesDB,
        budgetCategories,
        categories,
        payFreq,
        pastRuns
      );
    }

    return {
      runID: RunID,
      runTime: RunTime,
      isLocked: IsLocked,
      categoryGroups: autoRunCategoryGroups,
    };
  });

  return autoRuns;
};

export const getAutoRunData = async (
  req: Request,
  next: NextFunction,
  userID: string,
  budgetID: string,
  payFreq: PayFrequency,
  budget: Budget,
  categories: CategoryGroup[]
) => {
  const queryRes = await query(req, "spEV_GetAutoRunData", [
    { name: "UserID", value: userID },
    { name: "BudgetID", value: budgetID },
  ]);
  if (sqlErr(next, queryRes)) return null;

  log("GETTING AUTO RUN DETAILS - AutoRuns");
  const autoRuns = getAutoRunDetails(
    queryRes.resultData[0],
    queryRes.resultData[1],
    budget,
    categories,
    payFreq,
    false
  );

  log("GETTING AUTO RUN DETAILS - PastRuns");
  const pastRuns = getAutoRunDetails(
    queryRes.resultData[2],
    queryRes.resultData[3],
    budget,
    categories,
    payFreq,
    true
  );

  return { autoRuns, pastRuns };
};

export const getAutoRunCategories = (
  autoRuns: AutoRun[]
): AutoRunCategory[] => {
  if (!autoRuns[0]) return [];
  return autoRuns[0].categoryGroups.reduce((prev, curr) => {
    return [...prev, ...curr.categories];
  }, [] as AutoRunCategory[]);
};
