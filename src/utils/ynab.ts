import { NextFunction, Request } from "express";
import { AxiosResponseHeaders } from "axios";
import { log, logError } from "./log";
import { roundNumber } from "./util";
import { getAPIResponse } from "./api";
import { execute, query } from "./sql";

import { config } from "dotenv";
import { throwExpressError } from "../app";
import { FAKE_BUDGET_ID } from "../model/budget";
config();

type TokenDetails = {
  accessToken: string;
  refreshToken: string;
  expirationDate: string;
};

export type YNABTokenData = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
};

export type YNABBudget = {
  id: string;
  name: string;
  category_groups: YNABCategoryGroup[];
  categories: YNABCategory[];
  months: YNABBudgetMonth[];
};

export type YNABCategoryGroup = {
  id: string;
  name: string;
  hidden: boolean;
  deleted: boolean;
};

export type YNABCategory = {
  id: string;
  category_group_id: string;
  category_group_name: string;
  name: string;
  budgeted: number;
  activity: number;
  balance: number;
  hidden: boolean;
  deleted: boolean;
};

export type YNABBudgetMonth = {
  month: string;
  categories: YNABCategory[];
  to_be_budgeted: number;
};

const CLIENT_ID = process.env.YNAB_CLIENT_ID;
const CLIENT_SECRET = process.env.YNAB_CLIENT_SECRET;
const REDIRECT_URI =
  (process.env.API_BASE_URL as string) +
  (process.env.YNAB_REDIRECT_URI as string);

const APP_BASE_URL = "https://app.ynab.com";
const OAUTH_URL = APP_BASE_URL + "/oauth";
const API_URL = "https://api.ynab.com/v1";

const RATE_LIMIT_THRESHOLD = 180;

const IGNORED_CATEGORY_GROUPS = [
  "Internal Master Category", // Used internally by YNAB, not necessary for me
  "Credit Card Payments", // Special category within YNAB which works with Credit Cards
  "Hidden Categories", // Any categories hidden by the user in their budget, don't include them
];

const isOverRateLimitThreshold = (headers: AxiosResponseHeaders): boolean => {
  let rateLim = headers["x-rate-limit"];
  // log("Rate Limit:", rateLim);
  let rateLimLeft = parseInt(rateLim.substring(0, rateLim.indexOf("/")));
  // log("Rate Limit Left", rateLimLeft);
  return rateLimLeft >= RATE_LIMIT_THRESHOLD;
};

const getYNABAllBudgetsData = async (
  req: Request,
  next: NextFunction,
  userID: string,
  budgetID: string,
  accessToken: string,
  refreshToken: string
): Promise<YNABBudget[] | null> => {
  if (budgetID == FAKE_BUDGET_ID) {
    budgetID = "default";
  }

  const { data, headers, error } = await getAPIResponse({
    method: "GET",
    url: API_URL + "/budgets",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });

  if (error) return ynabErr(next, error);

  if (isOverRateLimitThreshold(headers)) {
    getRefreshedAccessTokens(req, next, userID, refreshToken);
  }

  return data.data.budgets as YNABBudget[];
};

const getYNABBudgetData = async (
  req: Request,
  next: NextFunction,
  userID: string,
  budgetID: string,
  accessToken: string,
  refreshToken: string
): Promise<YNABBudget | null> => {
  if (budgetID == FAKE_BUDGET_ID) {
    budgetID = "default";
  }

  const { data, headers, error } = await getAPIResponse({
    method: "GET",
    url: API_URL + "/budgets/" + budgetID.toLowerCase(),
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });

  if (error) return ynabErr(next, error);

  if (isOverRateLimitThreshold(headers)) {
    getRefreshedAccessTokens(req, next, userID, refreshToken);
  }

  let budgetData = data.data.budget as YNABBudget;

  // Filter unwanted category groups BEFORE sending back to the user, so I don't
  // have to remember to do it everywhere else
  budgetData.category_groups = budgetData.category_groups.filter(
    (grp) =>
      !IGNORED_CATEGORY_GROUPS.includes(grp.name) && !grp.hidden && !grp.deleted
  );

  budgetData.categories = budgetData.categories.filter(
    (c) =>
      budgetData.category_groups.find((grp) => grp.id == c.category_group_id) &&
      !c.hidden &&
      !c.deleted
  );

  return budgetData;
};

export const getNewAccessTokens = async (
  next: NextFunction,
  authCode: string
): Promise<TokenDetails | null> => {
  // An auth code was provided, so this request is attempting to
  // connect to a user's budget for the first time, after they visited
  // the YNAB auth page where they select their default budget
  const { data, error } = await getAPIResponse({
    method: "POST",
    url: OAUTH_URL + "/token",
    params: {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      code: authCode,
    },
  });

  if (error) return ynabErr(next, error);

  return await getYNABTokenData(data as YNABTokenData);
};

const getRefreshedAccessTokens = async (
  req: Request,
  next: NextFunction,
  userID: string,
  refreshToken: string
): Promise<TokenDetails | null> => {
  log("Attempting to refresh access tokens");

  const { data, error } = await getAPIResponse({
    method: "POST",
    url: OAUTH_URL + "/token",
    params: {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
  });

  if (error) {
    logError("YNAB Error", error);
    return null;
  }

  const newTokenDetails = await getYNABTokenData(data as YNABTokenData);

  // Don't await, since we can update asynchronously without needing to wait
  // for the result. This will happen in the background, and the rest of the
  // code will execute without having to wait.
  execute(req, "spEV_YNAB_SaveTokenDetails", [
    { name: "UserID", value: userID },
    { name: "AccessToken", value: newTokenDetails.accessToken },
    { name: "RefreshToken", value: newTokenDetails.refreshToken },
    { name: "ExpirationDate", value: newTokenDetails.expirationDate },
  ]);

  return newTokenDetails;
};

const validateTokens = async (
  req: Request,
  next: NextFunction,
  userID: string,
  tokenDetails: any
) => {
  let { RefreshToken, ExpirationDate } = tokenDetails;

  // If the expiration isn't past due, return the existing token details
  // and don't attempt to refresh
  if (new Date() < ExpirationDate) return tokenDetails;

  // Otherwise, if the expiration date on our tokens are past due,
  // we'll request a new access/refresh token combination
  const newTokenDetails = await getRefreshedAccessTokens(
    req,
    next,
    userID,
    RefreshToken
  );
  if (!newTokenDetails) return null;

  // Return the newly-refreshed tokens to use for
  // any subsequent requests
  return {
    AccessToken: newTokenDetails.accessToken,
    RefreshToken: newTokenDetails.refreshToken,
    ExpirationDate: newTokenDetails.expirationDate,
  };
};

const getYNABTokenData = async (data: YNABTokenData) => {
  let newExpirDate = new Date();
  newExpirDate.setSeconds(newExpirDate.getSeconds() + data.expires_in);

  const newTokenDetails: TokenDetails = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expirationDate: newExpirDate.toISOString(),
  };

  return newTokenDetails;
};

export function GetURL_YNABAuthorizationPage(userID: string) {
  return (
    OAUTH_URL +
    "/authorize?client_id=" +
    CLIENT_ID +
    "&redirect_uri=" +
    REDIRECT_URI +
    "&response_type=code" +
    "&state=" +
    userID
  );
}

export function GetURL_YNABBudget(budgetID: string) {
  return APP_BASE_URL + "/" + budgetID.toLowerCase() + "/budget";
}

const ynabErr = (next: NextFunction, errMsg: string) => {
  throwExpressError(next, "YNAB Error: " + errMsg);
  return null;
};

// ============================================
// ============================================
// ============================================

const updateYNABCategoryAmount = async (
  req: Request,
  next: NextFunction,
  userID: string,
  budgetID: string,
  accessToken: string,
  refreshToken: string,
  categoryID: string | undefined,
  month: string | undefined,
  newBudgetedAmount: number | undefined
): Promise<YNABCategory | null> => {
  if (
    categoryID == undefined ||
    month == undefined ||
    newBudgetedAmount == undefined
  ) {
    return null;
  }

  const { data, headers, error } = await getAPIResponse({
    method: "PATCH",
    url:
      API_URL +
      "/budgets/" +
      budgetID.toLowerCase() +
      "/months/" +
      month +
      "/categories/" +
      categoryID.toLowerCase(),
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    params: {
      category: {
        budgeted: roundNumber(newBudgetedAmount, 2) * 1000,
      },
    },
  });

  if (error) return ynabErr(next, error);

  if (isOverRateLimitThreshold(headers)) {
    getRefreshedAccessTokens(req, next, userID, refreshToken);
  }

  return data.data.category as YNABCategory;
};

const getBudgetsList = async (
  req: Request,
  next: NextFunction,
  userID: string,
  budgetID: string,
  accessToken: string,
  refreshToken: string
): Promise<Pick<YNABBudget, "id" | "name">[] | null> => {
  const budgets = await getYNABAllBudgetsData(
    req,
    next,
    userID,
    budgetID,
    accessToken,
    refreshToken
  );

  if (!budgets) return ynabErr(next, "Could not get budgets list");

  return budgets.map((b) => {
    return { id: b.id, name: b.name };
  });
};

const getBudget = async (
  req: Request,
  next: NextFunction,
  userID: string,
  budgetID: string,
  accessToken: string,
  refreshToken: string
): Promise<YNABBudget | null> => {
  return await getYNABBudgetData(
    req,
    next,
    userID,
    budgetID,
    accessToken,
    refreshToken
  );
};

const ynab = async <T>(
  req: Request,
  next: NextFunction,
  userID: string,
  budgetID: string,
  ynabFn: (
    req: Request,
    next: NextFunction,
    userID: string,
    budgetID: string,
    accessToken: string,
    refreshToken: string,
    categoryID?: string,
    month?: string,
    newBudgetedAmount?: number
  ) => Promise<T | null>,
  categoryID?: string,
  month?: string,
  newBudgetedAmount?: number
): Promise<T | null> => {
  // First, query the DB for the user's access/refresh tokens, to ensure
  // that they are still valid before running any queries against the
  // YNAB API
  const queryRes = await query(req, "spEV_YNAB_GetTokenDetails", [
    { name: "UserID", value: userID },
  ]);

  if (queryRes.error || !queryRes.resultData) {
    return ynabErr(
      next,
      queryRes.error || "Could not get token details from database"
    );
  }

  // Next, see if the tokens are still valid before continuing
  // If the expiration date is past due, refresh the tokens and
  // return the new tokens to use for our request
  const validatedTokens = await validateTokens(
    req,
    next,
    userID,
    queryRes.resultData
  );
  if (!validatedTokens) return ynabErr(next, "Could not validate YNAB tokens");

  // Run our YNAB request, and return the data
  return await ynabFn(
    req,
    next,
    userID,
    budgetID,
    validatedTokens.AccessToken,
    validatedTokens.RefreshToken,
    categoryID,
    month,
    newBudgetedAmount
  );
};

export const YnabReq = {
  getBudget,
  getBudgetsList,
  updateYNABCategoryAmount,
};

export default ynab;
