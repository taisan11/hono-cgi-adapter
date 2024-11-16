import type { GetConnInfo } from "hono/conninfo";
import type { Hono } from "hono";

/**
 * Get conninfo with Deno on CGI
 * @param c Context
 * @returns ConnInfo
 */
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

/**
 * 
 * @param Hono 
 * @param base 
 * @param deletepath 
 * @returns 
 * @example ```ts
 * import { Hono } from "hono";
 * import { handle } from "@taisan11/hono-cgi-adapter";
 * 
 * const app = new Hono();
 * 
 * app.get('/', (c) => {return c.text('Hono!')});
 * 
 * handle(app, "http://localhost:8080/");
 * ```
 */
export const handle = async (
  Hono: Hono,
  base: string,
) => {
  //取得
  const env = Deno.env.toObject();
  const method = env["REQUEST_METHOD"] || "GET";
  //header
  const headers = new Headers();
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("HTTP_")) {
      headers.set(key.replace("HTTP_", ""), value);
    }
  }
  //body
  let body: Uint8Array | undefined;
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const contentLength = parseInt(env["CONTENT_LENGTH"] || "0", 10);
    if (contentLength > 0) {
      body = new Uint8Array(contentLength);
      await Deno.stdin.read(body);
    }
  }
  // その他と設定
  const requestInit: RequestInit = {
    headers,
    method,
  };
  if (method !== "GET" && method !== "HEAD") {
    requestInit.body = body;
  }
  const request = new Request(
    new URL(env["PATH_INFO"] || "/", base),
    requestInit,
  );
  // 実行
  const response = await Hono.fetch(request, env);
  // 送信
  console.log(`Status: ${response.status}`);
  console.log(`Content-Type: ${response.headers.get("content-type") ?? "text/plain"}`);

  for (const [key, value] of response.headers) {
    if (key === "content-type") continue;
    console.log(`${key}: ${value}`);
  }
  console.log("");
  if (response.headers.get("Content-Type")=="text/event-stream" || response.headers.get("Transfer-Encoding") == "chunked") {
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        await Deno.stdout.write(value);
        //console.log("data: "+new TextDecoder().decode(value));
      }
      }
    }
    reader!.releaseLock();
    return;
  }
  console.log(await response.text());
};
