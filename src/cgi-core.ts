import type { GetConnInfo } from "hono/conninfo";
import type { Hono } from "hono";
import { convertIPv6ToBinary, distinctRemoteAddr } from "hono/utils/ipaddr";
import { once } from "node:events";

/**
 * @description Get conninfo on CGI
 * @param c Context
 * @returns ConnInfo
 */
export const getConnInfo: GetConnInfo = (c) => {
  const env = c.env;
  const port = env.REMOTE_PORT ? Number(env.REMOTE_PORT) : NaN;
  let addressType = distinctRemoteAddr(env.REMOTE_ADDR || "");
  if (addressType === "IPv6") {
    try {
      convertIPv6ToBinary(env.REMOTE_ADDR);
    } catch {
      addressType = undefined;
    }
  }
  return {
    remote: {
      address: env.REMOTE_ADDR,
      addressType,
      port: Number.isInteger(port) && port >= 0 && port <= 65535 ? port : undefined,
    },
  };
};

/**
 * @description Handle Hono on CGI
 * @param Hono
 * @param envObj
 * @returns
 * @example ```ts
 * import { Hono } from "hono";
 * import { handlecgi } from "hono-cgi-adapter";
 *
 * const app = new Hono();
 *
 * app.get('/', (c) => {return c.text('Hono!')});
 *
 * handle(app, process.env);
 * ```
 */
export const handle = async (
  Hono: Hono,
  envObj:Record<string, string|undefined>
) => {
  //初期設定
  let res = []
  //取得
  const env = envObj;
  const method = env["REQUEST_METHOD"] || "GET";
  //header
  const headers = new Headers();
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("HTTP_")) {
      headers.set(key.slice(5).replaceAll("_", "-"), value||"");
    }
  }
  if (env.CONTENT_TYPE) headers.set("Content-Type", env.CONTENT_TYPE);
  if (env.CONTENT_LENGTH) headers.set("Content-Length", env.CONTENT_LENGTH);
  //body
  let body: ReadableStream<Uint8Array> | undefined;
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const contentLength = Number(env.CONTENT_LENGTH || 0);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      throw new Error("Invalid CONTENT_LENGTH");
    }
    if (contentLength > 0) {
      let remaining = contentLength;
      const input = process.stdin[Symbol.asyncIterator]();
      body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          const { value, done } = await input.next();
          if (done) {
            controller.error(new Error("Incomplete request body"));
            return;
          }
          const part = (value as Buffer).subarray(0, remaining);
          remaining -= part.length;
          controller.enqueue(part);
          if (remaining === 0) controller.close();
        },
        async cancel() {
          await input.return?.();
        },
      });
    }
  }
  // その他と設定
  const requestInit: RequestInit = {
    headers,
    method,
  };
  if (body) {
    requestInit.body = body;
    // Node's Request requires duplex when the request body is a stream.
    (requestInit as RequestInit & { duplex: "half" }).duplex = "half";
  }
  const protocol = /^(on|1)$/i.test(env.HTTPS || "") ? "https" : "http";
  const serverName = env.SERVER_NAME || "localhost";
  const hostname = serverName.includes(":") && !serverName.startsWith("[") ? `[${serverName}]` : serverName;
  const port = env.SERVER_PORT && env.SERVER_PORT !== (protocol === "https" ? "443" : "80") ? `:${env.SERVER_PORT}` : "";
  const host = env.HTTP_HOST || `${hostname}${port}`;
  const url = new URL(env["PATH_INFO"] || "/", `${protocol}://${host}`);
  if (env["QUERY_STRING"]) {
    url.search = env["QUERY_STRING"]
  }
  const request = new Request(
    url.toString(),
    requestInit,
  );
  // 実行
  const response = await Hono.fetch(request, env);
  // 送信
  res.push(`Status: ${response.status}\r\n`)
  res.push(`Content-Type: ${response.headers.get("content-type") ?? "text/plain"}\r\n`)

  for (const [key, value] of response.headers) {
    if (key === "content-type") continue;
    res.push(`${key}: ${value}\r\n`)
  }
  res.push("\r\n")
  const write = async (chunk: string | Uint8Array) => {
    if (!process.stdout.write(chunk)) await once(process.stdout, "drain");
  };
  await write(res.join(""));
  const reader = response.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await write(value);
      }
    } catch (error) {
      await reader.cancel(error).catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
};
