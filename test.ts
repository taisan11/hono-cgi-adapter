import { handlecgi } from "./src/index"
import { Hono } from "hono"

const app = new Hono()

app.get("/", (c) => {
  return c.text("hello fastcgi from hono")
})

app.get("/text", (c) => {
  return c.text(c.req.url)
})

app.post("/", async (c) => {
  return c.text(await c.req.text())
})

handlecgi(app, process.env)
