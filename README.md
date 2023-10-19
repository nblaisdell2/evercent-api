# Evercent API

This is an ExpressJS API which is used in conjunction with EverCent, an automated budgeting tool.
In its current state, this API is meant to be used internally for EverCent, and is <u>not</u> a general-purpose API for multiple applications.

> To learn more about Evercent:
>
> - Github Repo - https://github.com/nblaisdell2/evercent-app
> - Evercent Documentation - https://nblaisdell.atlassian.net/wiki/spaces/E/overview

<br/>

## Overview

This API is the backend server which services the Evercent application. This API is hosted on AWS via a Lambda function containing our entire Express API. It mainly works by interacting with various tables (through stored procedures) in a SQL Server database.

User's will gather all of their Evercent details using the `/user` endpoint, and if a new user is connecting, their details will be added to the database before returning the details back to the user.

Next, the user should connect their Evercent account to their budget using the `/budget/connect` endpoint, which will redirect users to the YNAB authorization page, where they can allow access to their budget on Evercent's behalf. From there, we'll be able to make use of the YNAB API to gather budget details from their YNAB account.

Once connected, the user will be able to adjust various elements of their Evercent account, such as their user details, category details, and auto run details.
<br/>

#### YNAB Connection

When the user connects their budget, Evercent will redirect them to the YNAB authorization page, where after they log into their YNAB account, they're able to select a budget from their YNAB account to allow access to via their API. Once the user selects authorize, our API will load that budget's details into the database before redirecting the user back to the Evercent app, where those new budget details can be loaded appropriately.

When using the YNAB API, we are given a set of Access/Refresh tokens that can be used on behalf of our authorized user, and these tokens have a time limit of 2 hours that they can be used, at which point they need to be refreshed using the refresh token provided. When we do so, we'll be given a new set of Access/Refresh tokens, in order to continually repeat the process.

Our API will take measures to ensure that these tokens are always kept updated appropriately, so that the user will only ever have to connect and authorize their YNAB account once, and the refreshing of these tokens will happen automatically in the background.

<br/>

---

## Endpoints

**API Base URL:** https://fg20cv9eg4.execute-api.us-east-1.amazonaws.com/dev

| Method                                                                  | Endpoint                       | Description                                                                                                                                                    |
| ----------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span style="color:#6BDD9A;font-weight:bold;font-size:18px">GET</span>  | `/user`                        | Gets all the Evercent data for a particular user, given a user's email                                                                                         |
| <span style="color:#74AEF6;font-weight:bold;font-size:18px">PUT</span>  | `/user/userData`               | Updates the `Monthly Income`, `Pay Frequency` & `Next Paydate` for a given Evercent user                                                                       |
| <span style="color:#74AEF6;font-weight:bold;font-size:18px">PUT</span>  | `/user/monthsAhead`            | Updates the `Months Ahead Target` for a given Evercent user                                                                                                    |
| <span style="color:#74AEF6;font-weight:bold;font-size:18px">PUT</span>  | `/user/categoryData`           | Updates the Evercent category details, including which categories are excluded from their Evercent category list                                               |
| <span style="color:#6BDD9A;font-weight:bold;font-size:18px">GET</span>  | `/budget/getBudgetsList`       | Gets the list of available budgets from the user's connected budget software (YNAB)                                                                            |
| <span style="color:#FFD93E;font-weight:bold;font-size:18px">POST</span> | `/budget/connect`              | Sends the user to the YNAB authorization page, and loads the user's budget details for their selected budget                                                   |
| <span style="color:#FFD93E;font-weight:bold;font-size:18px">POST</span> | `/budget/switchBudget`         | Updates the Evercent user's default budget, and loads the new budget details into the database, if switching for the first time                                |
| <span style="color:#FFD93E;font-weight:bold;font-size:18px">POST</span> | `/budget/updateCategoryAmount` | Updates the currently budgeted amount for a particular category/month in the user's _real_ budget (YNAB)                                                       |
| <span style="color:#FFD93E;font-weight:bold;font-size:18px">POST</span> | `/autoRun`                     | Updates the AutoRun details for a given Evercent user, including any toggled category/months for the upcoming run                                              |
| <span style="color:#FFD93E;font-weight:bold;font-size:18px">POST</span> | `/autoRun/cancel`              | Cancels the upcoming auto run for the given Evercent user                                                                                                      |
| <span style="color:#FFD93E;font-weight:bold;font-size:18px">POST</span> | `/autoRun/lock`                | Locks the upcoming auto run details for the next hour, and loads the details for the amounts to be posted to their budget                                      |
| <span style="color:#FFD93E;font-weight:bold;font-size:18px">POST</span> | `/autoRun/run`                 | Reads the information loaded from the `/autoRun/lock` endpoint, and posts new amounts to each user's connected budget based on their Evercent category details |
