import type { GetConnInfo } from "npm:hono/conninfo";
import type { Hono } from "npm:hono";
export const getConnInfo: GetConnInfo = (c) => {
  const env = c.env;
  return {
    remote: {
      address: env.REMOTE_ADDR,
      addressType: env.REMOTE_ADDR_TYPE as "IPv6" | "IPv4" | undefined,
      port: env.REMOTE_PORT,
    },
  };
};
export const handle = async (
  Hono: Hono,
  base: string,
  deletepath: string = "",
) => {
  const method = Deno.env.get("REQUEST_METHOD") || "GET";
  Deno.env.get("QUERY_STRING") || "";
  const env = Deno.env.toObject();
  const headers = new Headers();
  for (const key in env) {
    if (key.startsWith("HTTP_")) {
      const value = env[key];
      headers.set(key.replace("HTTP_", ""), value);
    }
  }
  let body = "";
  if (method === "POST") {
    const contentLength = parseInt(Deno.env.get("CONTENT_LENGTH") || "0", 10);
    if (contentLength > 0) {
      const buf = new Uint8Array(contentLength);
      await Deno.stdin.read(buf);
      body = new TextDecoder().decode(buf);
    }
  }
  const REQUEST_URI = Deno.env.get("REQUEST_URI") || "/";
  const requestInit: RequestInit = {
    headers,
    method,
  };
  if (method !== "GET" && method !== "HEAD") {
    requestInit.body = body;
  }
  const request = new Request(
    new URL(REQUEST_URI, base).toString().replace(deletepath, ""),
    requestInit,
  );
  const response = await Hono.fetch(request, Deno.env.toObject());
  console.log(`Status: ${response.status}`);
  console.log(
    `Content-Type: ${response.headers.get("content-type") ?? "text/plain"}`,
  );
  if (response.headers.has("Location")) {
    console.log(`Location: ${response.headers.get("Location")}`);
  }

  for (const [key, value] of response.headers) {
    if (key === "Location" || key === "content-type") continue;
    console.log(`${key}: ${value}`);
  }
  console.log("");
  if (
    response.headers.get("Content-Type")?.startsWith("text/event-stream") ||
    response.headers.get("Transfer-Encoding") == "chunked"
  ) {
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("data: [DONE]");
          break;
        }
        if (value) {
          const text = new TextDecoder().decode(value);
          console.log("data: " + text);
          console.log("");
        }
      }
    }
    reader!.releaseLock();
    return;
  }
  console.log(await response.text());
};
