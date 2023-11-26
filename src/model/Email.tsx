import React from "react";
import {
  Html,
  Body,
  Container,
  Text,
  Img,
  Tailwind,
  Section,
  Row,
  Column,
  Hr,
} from "@react-email/components";
import { roundNumber } from "../utils/util";
import { format, parseISO } from "date-fns";

type EmailPropsMonth = {
  monthName: string;
  amountPosted: number;
  newAmtBudgeted: number;
};
type EmailPropsCategory = {
  categoryID: string;
  categoryName: string;
  months: EmailPropsMonth[];
};
export type EmailPropsGroup = {
  groupID: string;
  groupName: string;
  categories: EmailPropsCategory[];
};

export type EmailProps = {
  runTime: string;
  groups: EmailPropsGroup[];
};

function Email(results: EmailProps) {
  let totalPosted = 0;
  for (let i = 0; i < results.groups.length; i++) {
    for (let j = 0; j < results.groups[i].categories.length; j++) {
      for (let k = 0; k < results.groups[i].categories[j].months.length; k++) {
        totalPosted += results.groups[i].categories[j].months[k].amountPosted;
      }
    }
  }

  return (
    <Tailwind config={{}}>
      <Html lang="en" dir="ltr">
        <Body>
          <Container>
            <Section style={{ borderBottom: "5px solid white" }}>
              <Row>
                <Column style={{ width: "20%" }}>
                  <Img src="cid:logo" alt="Logo" width="100" height="120" />
                </Column>
                <Column
                  style={{
                    width: "75%",
                    textAlign: "center",
                  }}
                >
                  <Text>
                    <span
                      style={{
                        fontFamily: "Roboto",
                        fontSize: "36px",
                        fontWeight: "bold",
                      }}
                    >
                      EverCent
                    </span>
                    <br />
                    <span
                      style={{
                        fontFamily: "Roboto",
                        fontSize: "24px",
                        fontStyle: "italic",
                      }}
                    >
                      Automation Results
                    </span>
                  </Text>
                </Column>
              </Row>
            </Section>

            <Section style={{ borderBottom: "5px solid white" }}>
              <Row>
                <Column
                  style={{
                    textAlign: "center",
                    fontWeight: "bold",
                    backgroundColor: "#eee",
                    border: "1px solid gray",
                    borderRadius: "10px",
                  }}
                >
                  <Text>
                    <span
                      style={{
                        fontFamily: "Roboto",
                        fontSize: "24px",
                        fontWeight: "bold",
                        textDecoration: "underline",
                      }}
                    >
                      Total Amount Posted
                    </span>
                    <br />
                    <span
                      style={{
                        fontFamily: "Roboto",
                        fontSize: "24px",
                        color: "green",
                      }}
                    >
                      {"$" + roundNumber(totalPosted, 2)}
                    </span>
                  </Text>
                </Column>
                <Column style={{ width: "2%" }}></Column>
                <Column
                  style={{
                    textAlign: "center",
                    fontWeight: "bold",
                    backgroundColor: "#eee",
                    border: "1px solid gray",
                    borderRadius: "10px",
                  }}
                >
                  <Text>
                    <span
                      style={{
                        fontFamily: "Roboto",
                        fontSize: "24px",
                        fontWeight: "bold",
                        textDecoration: "underline",
                      }}
                    >
                      Run Time
                    </span>
                    <br />
                    <span
                      style={{
                        fontFamily: "Roboto",
                        fontSize: "20px",
                        fontStyle: "italic",
                      }}
                    >
                      {results.runTime}
                    </span>
                  </Text>
                </Column>
              </Row>
            </Section>

            <Section style={{ margin: "20px" }}>
              <table
                style={{
                  width: "100%",
                  backgroundColor: "#eee",
                  border: "1px solid gray",
                  borderRadius: "10px",
                }}
              >
                <thead style={{ borderBottom: "2px solid black" }}>
                  <tr style={{ borderBottom: "2px solid black" }}>
                    <th style={{ width: "40%", textAlign: "left" }}>
                      Category/Month
                    </th>
                    <th style={{ width: "30%", textAlign: "right" }}>
                      Amount Posted
                    </th>
                    <th style={{ width: "30%", textAlign: "right" }}>
                      New Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.groups.map((g) => {
                    return (
                      <div key={g.groupName}>
                        <tr style={{ fontSize: "125%", fontWeight: "bold" }}>
                          <td style={{ paddingTop: "5px" }}>
                            <u>{g.groupName}</u>
                          </td>
                        </tr>
                        {g.categories.map((c) => {
                          return (
                            <div key={c.categoryName}>
                              <tr style={{ fontSize: "110%" }}>
                                <td
                                  style={{
                                    paddingLeft: "15px",
                                  }}
                                >
                                  {c.categoryName}
                                </td>
                              </tr>
                              {c.months.map((m) => {
                                return (
                                  <tr
                                    key={m.monthName}
                                    style={{
                                      borderBottom: "8px solid transparent",
                                    }}
                                  >
                                    <td
                                      style={{
                                        width: "40%",
                                        textAlign: "left",
                                        paddingLeft: "30px",
                                        color: "#aaa",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {format(
                                        parseISO(
                                          new Date(m.monthName)
                                            .toISOString()
                                            .substring(0, 10)
                                        ),
                                        "MMM yyyy"
                                      ).toUpperCase()}
                                    </td>
                                    <td
                                      style={{
                                        width: "30%",
                                        textAlign: "right",
                                      }}
                                    >
                                      {"$" +
                                        roundNumber(
                                          m.amountPosted,
                                          2
                                        ).toString()}
                                    </td>
                                    <td
                                      style={{
                                        width: "30%",
                                        textAlign: "right",
                                      }}
                                    >
                                      <span
                                        style={{
                                          backgroundColor: "green",
                                          color: "white",
                                          borderRadius: "10px",
                                          fontWeight: "bold",
                                          padding: "3px",
                                          margin: "2px",
                                        }}
                                      >
                                        {"$" +
                                          roundNumber(
                                            m.newAmtBudgeted,
                                            2
                                          ).toString()}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </tbody>
              </table>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

export default Email;
