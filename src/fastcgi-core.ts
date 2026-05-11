import type { Hono } from "hono"
import * as net from "node:net"

const FCGI_VERSION_1 = 1
const FCGI_HEADER_LEN = 8

const FCGI_BEGIN_REQUEST = 1
const FCGI_ABORT_REQUEST = 2
const FCGI_END_REQUEST = 3
const FCGI_PARAMS = 4
const FCGI_STDIN = 5
const FCGI_STDOUT = 6
const FCGI_STDERR = 7
const FCGI_DATA = 8
const FCGI_GET_VALUES = 9
const FCGI_GET_VALUES_RESULT = 10
const FCGI_UNKNOWN_TYPE = 11

const FCGI_RESPONDER = 1

const FCGI_KEEP_CONN = 1

const FCGI_REQUEST_COMPLETE = 0

const pad = (n: number) => (8 - (n % 8)) % 8

function readn(socket: net.Socket, n: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    if (socket.destroyed || socket.readableEnded) {
      resolve(null)
      return
    }
    const chunks: Buffer[] = []
    let remaining = n
    const onReadable = () => {
      while (remaining > 0) {
        const chunk = socket.read(remaining)
        if (chunk === null) return
        chunks.push(chunk)
        remaining -= chunk.length
      }
      cleanup()
      resolve(Buffer.concat(chunks))
    }
    const onEnd = () => {
      cleanup()
      resolve(null)
    }
    const onError = () => {
      cleanup()
      resolve(null)
    }
    const onClose = () => {
      cleanup()
      resolve(null)
    }
    const cleanup = () => {
      socket.removeListener("readable", onReadable)
      socket.removeListener("end", onEnd)
      socket.removeListener("error", onError)
      socket.removeListener("close", onClose)
    }
    socket.on("readable", onReadable)
    socket.on("end", onEnd)
    socket.on("error", onError)
    socket.on("close", onClose)
    onReadable()
  })
}

function parseHeader(buf: Buffer): { type: number; requestId: number; contentLength: number; paddingLength: number } {
  return {
    type: buf[1]!,
    requestId: buf.readUInt16BE(2),
    contentLength: buf.readUInt16BE(4),
    paddingLength: buf[6]!,
  }
}

function writeHeader(type: number, requestId: number, contentLength: number): Buffer {
  const paddingLength = pad(FCGI_HEADER_LEN + contentLength)
  const h = Buffer.alloc(FCGI_HEADER_LEN)
  h[0] = FCGI_VERSION_1
  h[1] = type
  h.writeUInt16BE(requestId, 2)
  h.writeUInt16BE(contentLength, 4)
  h[6] = paddingLength
  h[7] = 0
  return h
}

function writeRecord(type: number, requestId: number, content: Buffer): Buffer {
  const header = writeHeader(type, requestId, content.length)
  const padBuf = Buffer.alloc(header[6]!)
  return Buffer.concat([header, content, padBuf])
}

function encodeLength(len: number): Buffer {
  if (len <= 127) {
    return Buffer.from([len])
  }
  const b = Buffer.alloc(4)
  b[0] = (len >>> 24) | 0x80
  b[1] = (len >>> 16) & 0xff
  b[2] = (len >>> 8) & 0xff
  b[3] = len & 0xff
  return b
}

function decodeLength(buf: Buffer, pos: number): [number, number] {
  const first = buf[pos] as number
  if (first & 0x80) {
    return [
      ((first & 0x7f) << 24) | ((buf[pos + 1] as number) << 16) | ((buf[pos + 2] as number) << 8) | (buf[pos + 3] as number),
      4,
    ]
  }
  return [first, 1]
}

function parseParams(data: Buffer): Record<string, string> {
  const params: Record<string, string> = {}
  let pos = 0
  while (pos < data.length) {
    const [nameLen, nlb] = decodeLength(data, pos)
    pos += nlb
    const [valueLen, vlb] = decodeLength(data, pos)
    pos += vlb
    const name = data.toString("utf8", pos, pos + nameLen)
    pos += nameLen
    const value = data.toString("utf8", pos, pos + valueLen)
    pos += valueLen
    params[name] = value
  }
  return params
}

function encodeNameValues(params: Record<string, string>): Buffer {
  const parts: Buffer[] = []
  for (const [name, value] of Object.entries(params)) {
    parts.push(encodeLength(name.length))
    parts.push(encodeLength(value.length))
    parts.push(Buffer.from(name, "utf-8"))
    parts.push(Buffer.from(value, "utf-8"))
  }
  return Buffer.concat(parts)
}

function buildRequest(params: Record<string, string>, body: Buffer): Request {
  const method = params["REQUEST_METHOD"] ?? "GET"
  const headers = new Headers()
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith("HTTP_")) {
      headers.set(key.slice(5).replace(/_/g, "-"), value)
    }
  }
  if (params["CONTENT_TYPE"]) {
    headers.set("content-type", params["CONTENT_TYPE"])
  }
  if (params["CONTENT_LENGTH"]) {
    headers.set("content-length", params["CONTENT_LENGTH"])
  }
  const host = params["HTTP_HOST"] ?? "localhost"
  const uri = params["REQUEST_URI"] ?? params["PATH_INFO"] ?? "/"
  const url = new URL(uri, `http://${host}`)
  if (params["QUERY_STRING"]) {
    url.search = params["QUERY_STRING"]
  }
  const init: RequestInit = { method, headers }
  if (body.length > 0 && method !== "GET" && method !== "HEAD") {
    init.body = body
  }
  return new Request(url.href, init)
}

async function handleRequest(app: Hono, params: Record<string, string>, body: Buffer, socket: net.Socket, requestId: number): Promise<void> {
  const env = { ...params }
  const request = buildRequest(params, body)
  const response = await app.fetch(request, env)

  const headerLines: string[] = []
  headerLines.push(`Status: ${response.status} ${response.statusText}`)
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "status") {
      headerLines.push(`${key}: ${value}`)
    }
  })
  headerLines.push("")
  headerLines.push("")

  const headerBuf = Buffer.from(headerLines.join("\r\n"), "utf-8")
  socket.write(writeRecord(FCGI_STDOUT, requestId, headerBuf))

  if (response.body) {
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      socket.write(writeRecord(FCGI_STDOUT, requestId, Buffer.from(value)))
    }
  }

  socket.write(writeRecord(FCGI_STDOUT, requestId, Buffer.alloc(0)))

  const endBody = Buffer.alloc(8)
  endBody.writeUInt32BE(0, 0)
  endBody[4] = FCGI_REQUEST_COMPLETE
  socket.write(writeRecord(FCGI_END_REQUEST, requestId, endBody))
}

async function handleConnection(app: Hono, socket: net.Socket): Promise<void> {
  let currentId = 0
  let params: Record<string, string> = {}
  let bodyChunks: Buffer[] = []
  let keepConn = false

  while (true) {
    const raw = await readn(socket, FCGI_HEADER_LEN)
    if (!raw) break
    const h = parseHeader(raw)

    let content: Buffer = Buffer.from([])
    if (h.contentLength > 0) {
      const c = await readn(socket, h.contentLength)
      if (!c) break
      content = c
    }
    if (h.paddingLength > 0) {
      const p = await readn(socket, h.paddingLength)
      if (!p) break
    }

    switch (h.type) {
      case FCGI_BEGIN_REQUEST: {
        if (content.length < 8) break
        currentId = h.requestId
        params = {}
        bodyChunks = []
        keepConn = ((content[2] as number) & FCGI_KEEP_CONN) !== 0
        break
      }
      case FCGI_PARAMS: {
        if (content.length > 0) {
          Object.assign(params, parseParams(content))
        }
        break
      }
      case FCGI_STDIN: {
        if (content.length === 0) {
          if (currentId > 0) {
            const body = Buffer.concat(bodyChunks)
            await handleRequest(app, params, body, socket, currentId)
          }
          currentId = 0
          if (!keepConn) {
            socket.end()
            return
          }
        } else {
          bodyChunks.push(content)
        }
        break
      }
      case FCGI_GET_VALUES: {
        const req = parseParams(content)
        const res: Record<string, string> = {}
        if ("FCGI_MAX_CONNS" in req) res.FCGI_MAX_CONNS = "1"
        if ("FCGI_MAX_REQS" in req) res.FCGI_MAX_REQS = "1"
        if ("FCGI_MPXS_CONNS" in req) res.FCGI_MPXS_CONNS = "0"
        socket.write(writeRecord(FCGI_GET_VALUES_RESULT, 0, encodeNameValues(res)))
        break
      }
      case FCGI_ABORT_REQUEST: {
        const endBody = Buffer.alloc(8)
        endBody.writeUInt32BE(0, 0)
        endBody[4] = FCGI_REQUEST_COMPLETE
        socket.write(writeRecord(FCGI_END_REQUEST, h.requestId, endBody))
        break
      }
      default: {
        if (h.requestId === 0) {
          const body = Buffer.alloc(8)
          body[0] = h.type as number
          socket.write(writeRecord(FCGI_UNKNOWN_TYPE, 0, body))
        }
        break
      }
    }
  }
}

export const handle = async (app: Hono, _options?: { rootUrl?: string }): Promise<void> => {
  return new Promise((resolve, reject) => {
    const server = net.createServer({ pauseOnConnect: false }, (socket) => {
      handleConnection(app, socket).catch(() => socket.destroy())
    })
    server.on("error", reject)
    server.listen({ fd: 0 }, () => {
      server.on("error", (err) => console.error("FastCGI:", err))
    })
  })
}
