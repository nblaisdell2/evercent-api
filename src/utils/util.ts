import { v4 } from "uuid";
export const generateUUID = v4;
import { writeFile } from "fs";
import path from "path";

export const roundNumber = (num: number, decimals: number = 0) => {
  const mul = Math.pow(10, decimals);
  return Math.round(Number(num) * mul) / mul;
};

export const sum = <T>(list: T[], prop: keyof T, start: number = 0): number => {
  return list.reduce((prev, curr) => prev + (curr[prop] as number), start);
};

export const find = <T>(
  list: T[],
  predicate: (value: T, index: number, obj: T[]) => unknown,
  thisArg?: any
): T => {
  return list.filter(predicate)[0];
};

export const writeDataToFile = (
  filename: string,
  data: any,
  cb: () => void
) => {
  writeFile(__dirname + "/" + filename, JSON.stringify(data), "utf-8", cb);
};

export const getDistinctValues = <T, V extends keyof T>(
  values: T[],
  key: V
): T[V][] => {
  let distinctValues: T[V][] = [];
  for (let i = 0; i < values.length; i++) {
    const val = values[i][key];
    if (!distinctValues.includes(val)) {
      distinctValues.push(val);
    }
  }
  return distinctValues;
};

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
