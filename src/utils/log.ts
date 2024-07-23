const getDateString = () => {
  const currDate = new Date();
  return (
    "[" +
    currDate.getFullYear() +
    "-" +
    (currDate.getMonth() + 1).toString().padStart(2, "0") +
    "-" +
    currDate.getDate().toString().padStart(2, "0") +
    "T" +
    currDate.getHours().toString().padStart(2, "0") +
    ":" +
    currDate.getMinutes().toString().padStart(2, "0") +
    ":" +
    currDate.getSeconds().toString().padStart(2, "0") +
    "." +
    currDate.getMilliseconds().toString().padStart(3, "0") +
    "Z]"
  );
};

export const log = console.log.bind(console, getDateString());
export const logError = console.error.bind(
  console,
  getDateString(),
  "\x1b[31mERROR\x1b[0m:"
);
