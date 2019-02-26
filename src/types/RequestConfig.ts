type RequestConfig = {
  method: string;
  hostname: string;
  port: number;
  path: string;
  headers?: { [prop: string]: string };
  tlsEnabled: boolean;
};

export { RequestConfig };
