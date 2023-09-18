import axios, {
  AxiosHeaders,
  AxiosResponseHeaders,
  Method,
  ResponseType,
} from "axios";
import { log } from "./log";

// Global Axios config used for every request
const instance = axios.create({
  timeout: 30000, // 30 sec timeout
  responseType: "json",
});

function getAxiosError(err: any): APIResponse {
  const errMsg =
    "AxiosError (" +
    err.response.status +
    " - " +
    err.code +
    ") // " +
    (typeof err.response.data.error === "object"
      ? err.response.data.error.detail
      : err.response.data.error);
  return {
    data: null,
    headers: AxiosHeaders.from({}),
    error: errMsg,
  };
}

type APIConfig = {
  method: Method;
  url: string;
  params?: any;
  headers?: any;
  responseType?: ResponseType;
};

type APIResponse = {
  data: any;
  headers: AxiosResponseHeaders;
  error: string | null;
};

export async function getAPIResponse({
  method,
  url,
  params,
  headers,
  responseType,
}: APIConfig): Promise<APIResponse> {
  if (!params) params = {};
  if (!responseType) responseType = "json";
  if (!headers) {
    headers = AxiosHeaders.from({});
  } else {
    headers = AxiosHeaders.from(headers);
  }

  log("API Running:", method, url);

  if (method == "GET") {
    return instance({
      url,
      method,
      responseType,
      params,
      headers,
    })
      .then((response) => {
        return {
          data: response.data,
          headers: response.headers as AxiosResponseHeaders,
          error: null,
        };
      })
      .catch(getAxiosError);
  } else {
    return instance({
      url,
      method,
      responseType,
      data: params,
      headers,
    })
      .then((response) => {
        return {
          data: response.data,
          headers: response.headers as AxiosResponseHeaders,
          error: null,
        };
      })
      .catch(getAxiosError);
  }
}
