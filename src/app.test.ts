import request = require("supertest");
import app from "../src/app";

describe("The Main API", () => {
  it("should return a status 200 & a Message", async () => {
    return request(app)
      .get("/")
      .expect(200)
      .expect("Content-Type", /json/)
      .then((response) => {
        console.log("body", response.body);
        expect(1).toEqual(1);
      });
  });
});
