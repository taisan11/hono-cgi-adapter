import { handleFast } from "./src/index"
import { Hono } from "hono"

const app = new Hono()

app.get("/", (c) => {
  return c.text("hello fastcgi from hono")
})

handleFast(app,{ port:9000 })
