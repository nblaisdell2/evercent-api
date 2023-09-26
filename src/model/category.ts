import { NextFunction, Request } from "express";
import {
  addMonths,
  differenceInMonths,
  isEqual,
  parseISO,
  startOfMonth,
} from "date-fns";
import { log } from "../utils/log";
import { find, sum } from "../utils/util";
import { query, sqlErr } from "../utils/sql";
import { PayFrequency, getAmountByPayFrequency } from "./user";
import {
  Budget,
  BudgetMonth,
  BudgetMonthCategory,
  BudgetMonthCategoryGroup,
  getBudgetCategories,
  getBudgetCategory,
  getBudgetMonth,
} from "./budget";

// TODO: Can I extract this into its own generic type
//       when querying the database?
type CategoryDataDB = {
  BudgetID: string;
  CategoryGUID: string;
  CategoryGroupID: string;
  CategoryID: string;
  CategoryAmount: number;
  ExtraAmount: number;
  IsRegularExpense: boolean;
  IsUpcomingExpense: boolean;
  IsMonthly: boolean;
  NextDueDate: string;
  ExpenseMonthsDivisor: number;
  RepeatFreqNum: number;
  RepeatFreqType: string;
  IncludeOnChart: boolean;
  MultipleTransactions: boolean;
  TotalExpenseAmount: number;
};

export type CategoryGroup = {
  groupID: string;
  groupName: string;
  amount: number;
  extraAmount: number;
  adjustedAmount: number;
  adjustedAmountPlusExtra: number;
  categories: Category[];
};

export type Category = {
  guid: string;
  categoryGroupID: string;
  categoryID: string;
  groupName: string;
  name: string;
  amount: number;
  extraAmount: number;
  adjustedAmount: number;
  adjustedAmountPlusExtra: number;
  monthsAhead: number;
  postingMonths: PostingMonth[];
  regularExpenseDetails: RegularExpenses | null;
  upcomingDetails: UpcomingExpenses | null;
};

export type RegularExpenses = {
  guid: string;
  isMonthly: boolean;
  nextDueDate: string;
  monthsDivisor: number;
  repeatFreqNum: number;
  repeatFreqType: string;
  includeOnChart: boolean;
  multipleTransactions: boolean;
};

export type UpcomingExpenses = {
  guid: string;
  expenseAmount: number;
};

export type UpcomingExpenseDetails = {
  guid: string;
  categoryName: string;
  amountSaved: number;
  totalAmount: number;
  purchaseDate: string;
  daysAway: number;
  paychecksAway: number;
};

export type PostingMonth = {
  month: string;
  amount: number;
  percent: number;
};

export type ExcludedCategory = Pick<
  Category,
  "guid" | "categoryGroupID" | "categoryID"
>;

const calculateAdjustedAmount = (
  category: Category,
  months: BudgetMonth[],
  recalculate: boolean
): number => {
  // If it's not a regular expense, or if it is a regular expense,
  // and it's a monthly expense, simply return the user's entered category amount
  if (
    !category.regularExpenseDetails ||
    category.regularExpenseDetails.isMonthly
  ) {
    return category.amount;
  }

  // If we've excluded it from the chart, just return 0 here
  if (!category.regularExpenseDetails.includeOnChart) {
    return 0;
  }

  const catAmtByFreq = getAmountByFrequency(
    category.amount,
    category.regularExpenseDetails
  );

  let numMonths = 0;
  if (!recalculate) {
    numMonths = category.regularExpenseDetails.monthsDivisor;
  } else {
    // Get BudgetMonthCategory from the same month of
    // this category's next due date
    log("calculating adjusted amount");
    const budgetMonth = getBudgetMonth(
      months,
      parseISO(category.regularExpenseDetails.nextDueDate)
    );
    const budgetCategory = getBudgetCategory(
      budgetMonth,
      category.categoryGroupID,
      category.categoryID
    );

    if (budgetCategory.available >= category.amount) {
      numMonths = getNumberOfMonthsByFrequency(category.regularExpenseDetails);
    } else {
      // Calculate the # of months between today and the
      // category's next due date
      const dtThisMonth = startOfMonth(new Date());
      const dtDueDate = startOfMonth(
        parseISO(category.regularExpenseDetails.nextDueDate)
      );
      numMonths = differenceInMonths(dtThisMonth, dtDueDate);
    }
  }

  const catAmtDivided = category.amount / numMonths;

  // When we have fewer months than expected to pay something off, we'll
  // need to pay more per month, which is accounted for in the "catAmtDivided > catAmtByFreq"
  // statement. However, when we have many months ahead to pay it off, and the amount
  // would be much lower than expected per month, we'll still pay off the amount by
  // frequency, instead of that much lower amount, which can be difficult to keep
  // track of.
  if (catAmtDivided > catAmtByFreq) {
    return catAmtDivided;
  } else {
    return catAmtByFreq;
  }
};

const getNumberOfMonthsByFrequency = (
  regularExpenseDetails: RegularExpenses
): number => {
  return (
    regularExpenseDetails.repeatFreqNum *
    (regularExpenseDetails.repeatFreqType == "Months" ? 1 : 12)
  );
};

const getAmountByFrequency = (
  amount: number,
  regularExpenseDetails: RegularExpenses
) => {
  const numMonths = getNumberOfMonthsByFrequency(regularExpenseDetails);
  return amount / numMonths;
};

const getPostingMonths = (
  category: Category,
  months: BudgetMonth[],
  payFreq: PayFrequency,
  nextPaydate: string,
  overrideNum?: number | undefined
): PostingMonth[] => {
  const DEBUG = category.name == "Hulu";

  // if (DEBUG) log("category", { category, payFreq, nextPaydate });

  let postingMonths: PostingMonth[] = [];
  const useOverride = overrideNum != undefined;

  let totalAmt = getAmountByPayFrequency(
    category.adjustedAmountPlusExtra,
    payFreq
  );
  let totalDesired = category.adjustedAmount;

  let currMonth = parseISO(nextPaydate);

  // if (DEBUG) log("amounts", { totalAmt, totalDesired, currMonth });

  // Keep finding months until
  //  1. We run out of money (totalAmt)
  //  2. We override the # of months, and haven't reached that
  //     # of months yet
  while (
    (!useOverride && totalAmt > 0) ||
    (useOverride && postingMonths.length < overrideNum)
  ) {
    // if (DEBUG) log("getting budget month", { currMonth });
    // log("getPostingMonths");
    const bm = getBudgetMonth(months, currMonth);
    if (!bm) {
      // if (DEBUG) log("Gotta leave!");
      return postingMonths;
    }

    const bc = getBudgetCategory(
      bm,
      category.categoryGroupID,
      category.categoryID
    );

    let desiredPostAmt = -1;
    if (!useOverride) {
      // Get YNAB category "budgeted" amount
      // (use 0 if negative)
      if (bc.budgeted < totalDesired) {
        desiredPostAmt = totalDesired - bc.budgeted;
      }
    } else {
      desiredPostAmt = totalDesired;
    }

    // if (DEBUG) log("desiredPostAmt", { desiredPostAmt });

    if (desiredPostAmt !== -1) {
      const postAmt = useOverride
        ? desiredPostAmt
        : Math.min(totalAmt, desiredPostAmt);

      postingMonths.push({
        month: parseISO(bm.month).toISOString(),
        amount: postAmt,
        percent: 0,
      });

      totalAmt -= postAmt;

      // recalculate totalDesired using repeat frequency here
      // because of non-monthly regular expense && due date month is currMonth
      // && ynab available == category.amount
      if (
        dueDateAndAmountSet(
          category.regularExpenseDetails?.isMonthly,
          category.regularExpenseDetails?.nextDueDate,
          category.amount,
          bc,
          currMonth
        )
      ) {
        // log(
        //   "Recalculating totalDesired due to due date being met for category!"
        // );
        totalDesired = calculateAdjustedAmount(category, months, true);
      }
    }

    // if (DEBUG) log("ADVANCING TO NEXT MONTH");
    currMonth = addMonths(currMonth, 1);
  }

  return postingMonths;
};

const calculateMonthsAhead = (
  category: Category,
  months: BudgetMonth[],
  payFreq: PayFrequency,
  nextPaydate: string
): number => {
  if (category.adjustedAmountPlusExtra == 0) return 0;

  let monthsAhead = 0;
  let postingMonths = getPostingMonths(
    category,
    months,
    payFreq,
    nextPaydate,
    25
  );

  // We don't consider the current month when referencing our "months ahead"
  // number, so remove the current month if it's there
  if (isEqual(parseISO(postingMonths[0].month), startOfMonth(new Date()))) {
    postingMonths.shift();
  }

  // Loop through each posting month and determine if we've already budgeted
  // the expected amount in our actual budget. If so, increment the monthsAhead
  // value and continue to the next month until either all months are exhausted,
  // or we find a month where we haven't budgeted enough yet
  for (let i = 0; i < postingMonths.length; i++) {
    const currPM = postingMonths[i];
    // log("calculating months ahead");
    const bm = getBudgetMonth(months, parseISO(currPM.month));
    const bc = getBudgetCategory(
      bm,
      category.categoryGroupID,
      category.categoryID
    );

    if (bc.budgeted < currPM.amount) break;

    monthsAhead += 1;
  }

  return monthsAhead;
};

const getRegularExpenses = (dbCat: CategoryDataDB): RegularExpenses | null => {
  if (dbCat.IsMonthly == null) return null;
  return {
    guid: dbCat.CategoryGUID,
    isMonthly: dbCat.IsMonthly,
    nextDueDate: dbCat.NextDueDate,
    monthsDivisor: dbCat.ExpenseMonthsDivisor,
    repeatFreqNum: dbCat.RepeatFreqNum,
    repeatFreqType: dbCat.RepeatFreqType,
    includeOnChart: dbCat.IncludeOnChart,
    multipleTransactions: dbCat.MultipleTransactions,
  };
};

const getUpcomingExpenses = (
  dbCat: CategoryDataDB
): UpcomingExpenses | null => {
  if (dbCat.TotalExpenseAmount == null) return null;
  return {
    guid: dbCat.CategoryGUID,
    expenseAmount: dbCat.TotalExpenseAmount,
  };
};

const sameCategory = (
  dbCat: CategoryDataDB,
  budgetCat: BudgetMonthCategory
) => {
  return (
    dbCat.CategoryGroupID.toLowerCase() ==
      budgetCat.categoryGroupID.toLowerCase() &&
    dbCat.CategoryID.toLowerCase() == budgetCat.categoryID.toLowerCase()
  );
};

const createCategory = (
  dbCat: CategoryDataDB,
  budgetCategory: BudgetMonthCategory,
  months: BudgetMonth[],
  payFreq: PayFrequency,
  nextPaydate: string
): Category => {
  const category: Category = {
    guid: dbCat.CategoryGUID,
    categoryGroupID: dbCat.CategoryGroupID,
    categoryID: dbCat.CategoryID,
    groupName: budgetCategory.categoryGroupName,
    name: budgetCategory.name,
    amount: dbCat.CategoryAmount,
    extraAmount: dbCat.ExtraAmount,
    adjustedAmount: 0,
    adjustedAmountPlusExtra: 0,
    regularExpenseDetails: getRegularExpenses(dbCat),
    upcomingDetails: getUpcomingExpenses(dbCat),
    monthsAhead: 0,
    postingMonths: [],
  };
  const adjAmount = calculateAdjustedAmount(category, months, false);
  category.adjustedAmount = adjAmount;
  category.adjustedAmountPlusExtra = adjAmount + category.extraAmount;

  const postingMonths = getPostingMonths(
    category,
    months,
    payFreq,
    nextPaydate
  );
  const monthsAhead = calculateMonthsAhead(
    category,
    months,
    payFreq,
    nextPaydate
  );

  return {
    ...category,
    monthsAhead: monthsAhead,
    postingMonths: postingMonths,
  };
};

const createCategoryList = (
  group: BudgetMonthCategoryGroup,
  categoryDataDB: CategoryDataDB[],
  months: BudgetMonth[],
  payFreq: PayFrequency,
  nextPaydate: string
): Category[] => {
  return group.categories.map((cat) => {
    const currCatDB = find(categoryDataDB, (c) => sameCategory(c, cat));
    return createCategory(currCatDB, cat, months, payFreq, nextPaydate);
  });
};

const createCategoryGroupList = (
  categoryDataDB: CategoryDataDB[],
  budget: Budget,
  payFreq: PayFrequency,
  nextPaydate: string
): CategoryGroup[] => {
  const budgetCategoryGroups = budget.months[0].groups;
  return budgetCategoryGroups.map((grp) => {
    const newCategories = createCategoryList(
      grp,
      categoryDataDB,
      budget.months,
      payFreq,
      nextPaydate
    );

    return {
      groupID: grp.categoryGroupID.toUpperCase(),
      groupName: grp.categoryGroupName,
      amount: sum(newCategories, "amount"),
      extraAmount: sum(newCategories, "extraAmount"),
      adjustedAmount: sum(newCategories, "adjustedAmount"),
      adjustedAmountPlusExtra: sum(newCategories, "adjustedAmountPlusExtra"),
      categories: newCategories,
    } as CategoryGroup;
  });
};

const getExcludedCategories = (dbData: any): ExcludedCategory[] => {
  return dbData.map((d: any) => {
    return {
      guid: d.CategoryGUID,
      categoryGroupID: d.CategoryGroupID,
      categoryID: d.CategoryID,
    } as ExcludedCategory;
  });
};

export const getCategoryData = async (
  req: Request,
  next: NextFunction,
  budget: Budget,
  userID: string,
  budgetID: string,
  payFreq: PayFrequency,
  nextPaydate: string
) => {
  const budgetCategories = getBudgetCategories(budget);
  // log(JSON.stringify({ details: budgetCategories }));

  // ========================
  // 1. Refresh and return categories from database
  // ========================
  const queryRes = await query(req, "spEV_GetCategoryData", [
    { name: "UserID", value: userID },
    { name: "BudgetID", value: budgetID },
    { name: "Details", value: JSON.stringify({ details: budgetCategories }) },
  ]);
  if (sqlErr(next, queryRes)) return null;

  // ========================
  // 2. Assemble category list(s)
  // ========================
  const categoryDetails = createCategoryGroupList(
    queryRes.resultData[0],
    budget,
    payFreq,
    nextPaydate
  );
  const excludedCategories = getExcludedCategories(queryRes.resultData[1]);

  return {
    categoryGroups: categoryDetails,
    excludedCategories,
  };
};

export const dueDateAndAmountSet = (
  isMonthly: boolean | undefined,
  nextDueDate: string | undefined,
  categoryAmount: number,
  budgetCategory: BudgetMonthCategory,
  currMonth: Date
) => {
  // We have a non-monthly regular expense, we've posted an amount
  // to this category AND not only is the month we posted to the same
  // as this category's next due date, but the amount available on
  // this budget category has reached the expected "category.amount",
  // so this check will allow us to re-calculate accordingly.
  if (isMonthly == undefined || isMonthly) return false;
  const dtNextDueDate = parseISO(nextDueDate as string);
  return (
    startOfMonth(dtNextDueDate) == currMonth &&
    budgetCategory.available >= categoryAmount
  );
};
