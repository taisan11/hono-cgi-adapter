import { handleFast } from "./src/index"
import { Hono } from "hono"

const app = new Hono()

app.get("/", (c) => {
  return c.text("hello fastcgi from hono")
})

app.post("/", async (c) => {
  return c.text(await c.req.text())
})

handleFast(app,{ bind:9000 })
