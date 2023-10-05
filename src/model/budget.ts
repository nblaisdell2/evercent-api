import { Request, NextFunction } from "express";
import { addMonths, isEqual, parseISO, startOfMonth } from "date-fns";

import { find, generateUUID, sum } from "../utils/util";
import ynab, {
  YNABBudget,
  YNABBudgetMonth,
  YNABCategory,
  YNABCategoryGroup,
  YnabReq,
} from "../utils/ynab";
import { log } from "../utils/log";

export const FAKE_BUDGET_ID = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEFFFFFF";

export type Budget = {
  id: string;
  name: string;
  months: BudgetMonth[];
};

export type BudgetMonth = {
  month: string;
  tbb: number;
  groups: BudgetMonthCategoryGroup[];
};

export type BudgetMonthCategoryGroup = {
  categoryGroupID: string;
  categoryGroupName: string;
  budgeted: number;
  activity: number;
  available: number;
  categories: BudgetMonthCategory[];
};

export type BudgetMonthCategory = {
  categoryGroupID: string;
  categoryGroupName: string;
  categoryID: string;
  name: string;
  budgeted: number;
  activity: number;
  available: number;
};

const createBudgetCategories = (
  groupID: string,
  groupName: string,
  monthCategories: YNABCategory[],
  sortedCategories: YNABCategory[]
): BudgetMonthCategory[] => {
  const filteredSortedCategories = sortedCategories.filter(
    (c) =>
      !c.deleted &&
      !c.hidden &&
      c.category_group_id.toLowerCase() == groupID.toLowerCase()
  );

  const newCategories = filteredSortedCategories.map((c) => {
    const monthCategory = find(
      monthCategories,
      (mc) => mc.id.toLowerCase() == c.id.toLowerCase()
    );
    return {
      categoryGroupID: groupID,
      categoryGroupName: groupName,
      categoryID: monthCategory.id,
      name: monthCategory.name,
      budgeted: monthCategory.budgeted / 1000,
      activity: monthCategory.activity / 1000,
      available: monthCategory.balance / 1000,
    };
  });

  return newCategories;
};

const createBudgetCategoryGroups = (
  groups: YNABCategoryGroup[],
  monthCategories: YNABCategory[],
  sortedCategories: YNABCategory[]
): BudgetMonthCategoryGroup[] => {
  return groups.map((curr) => {
    const newCategories = createBudgetCategories(
      curr.id,
      curr.name,
      monthCategories,
      sortedCategories
    );
    const totalActivity = sum(newCategories, "activity");
    const totalBudgeted = sum(newCategories, "budgeted");
    const totalAvailable = sum(newCategories, "available");

    return {
      categoryGroupID: curr.id,
      categoryGroupName: curr.name,
      activity: totalActivity,
      budgeted: totalBudgeted,
      available: totalAvailable,
      categories: newCategories,
    };
  });
};

const createBudgetMonths = (
  months: YNABBudgetMonth[],
  category_groups: YNABCategoryGroup[],
  categories: YNABCategory[]
): BudgetMonth[] => {
  const thisMonth = startOfMonth(new Date());

  let tbb = 0;
  const newMonths = months.reduce((prev, curr, i) => {
    const ynabMonth = parseISO(curr.month as string);
    if (i == 0) tbb = curr.to_be_budgeted / 1000;

    if (ynabMonth > thisMonth || isEqual(ynabMonth, thisMonth)) {
      const groups = createBudgetCategoryGroups(
        category_groups,
        curr.categories,
        categories
      );
      return [
        ...prev,
        {
          groups,
          month: curr.month,
          tbb: 0,
        },
      ];
    } else {
      return prev;
    }
  }, [] as BudgetMonth[]);

  // Data comes from YNAB in reverse order, to reverse the order again
  // to get the months data in ascending order
  newMonths.sort((a: BudgetMonth, b: BudgetMonth) => {
    return new Date(a.month).getTime() - new Date(b.month).getTime();
  });

  newMonths[0].tbb = tbb;

  // Append 25 more months at the end of the list, in case I need them
  // for calculating "posting months" into the future
  let lastMonth = newMonths[newMonths.length - 1];
  let currMonth = parseISO(lastMonth.month);
  for (let i = 0; i < 25; i++) {
    currMonth = addMonths(currMonth, 1);
    newMonths.push({
      ...lastMonth,
      month: currMonth.toISOString().substring(0, 10),
    });
  }

  return newMonths;
};

const createBudget = (budgetData: YNABBudget) => {
  return {
    id: budgetData.id,
    name: budgetData.name,
    months: createBudgetMonths(
      budgetData.months,
      budgetData.category_groups,
      budgetData.categories
    ),
  };
};

export const createCategories = (categories: YNABCategory[]) => {
  // Convert the YNAB category format into the minimal amount
  // of data required to save the results to the database
  return categories.map((c) => {
    return {
      guid: generateUUID(),
      categoryGroupID: c.category_group_id,
      categoryID: c.id,
      amount: 0,
      extraAmount: 0,
      isRegularExpense: false,
      isUpcomingExpense: false,
    };
  });
};

export const getBudget = async (
  req: Request,
  next: NextFunction,
  userID: string,
  budgetID: string
) => {
  // Get Budget details from YNAB using their API
  const budget = await ynab(req, next, userID, budgetID, YnabReq.getBudget);
  if (!budget) return null;

  // If we got the YNAB Budget data, convert it into our own
  // Budget object before sending to the user
  return createBudget(budget);
};

export const getBudgetCategories = (budget: Budget) => {
  return budget.months[0].groups.reduce((prev, curr) => {
    return [...prev, ...curr.categories];
  }, [] as BudgetMonthCategory[]);
};

export const getBudgetMonth = (months: BudgetMonth[], dt: Date) => {
  const dtNextDueDateMonth = startOfMonth(dt);
  const monthStr = dtNextDueDateMonth.toISOString().substring(0, 10);

  // Get BudgetMonthCategory from the same month of
  // this category's next due date
  return find(months, (bm) => bm.month == monthStr);
};

export const getBudgetCategory = (
  month: BudgetMonth,
  groupID: string,
  categoryID: string
) => {
  const budgetGroup = find(
    month.groups,
    (grp) => grp.categoryGroupID.toLowerCase() == groupID.toLowerCase()
  );
  const budgetCategory = find(
    budgetGroup.categories,
    (cat) => cat.categoryID.toLowerCase() == categoryID.toLowerCase()
  );
  return budgetCategory;
};

export const updateBudgetCategoryAmount = async (
  req: Request,
  next: NextFunction,
  userID: string,
  budgetID: string,
  categoryID: string,
  month: string,
  newBudgetedAmount: number
) => {
  const updatedCategory = await ynab(
    req,
    next,
    userID,
    budgetID,
    YnabReq.updateYNABCategoryAmount,
    categoryID,
    month,
    newBudgetedAmount
  );

  if (!updatedCategory) return null;

  return (
    "(" +
    userID +
    "/" +
    budgetID +
    ") // Updated amount for '" +
    updatedCategory.name +
    " (" +
    categoryID +
    ")' on '" +
    month +
    "' to '$" +
    Number(newBudgetedAmount).toFixed(2) +
    "'"
  );
};
