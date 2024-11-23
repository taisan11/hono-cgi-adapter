# Hono CGI Adapter
[![JSR](https://jsr.io/badges/@taisan11/hono-cgi-adapter)](https://jsr.io/@taisan11/hono-cgi-adapter)
[![GitHub commit activity](https://img.shields.io/github/commit-activity/m/taisan11/hono-cgi-adapter)](https://github.com/taisan11/hono-cgi-adapter/pulse)
[![GitHub last commit](https://img.shields.io/github/last-commit/taisan11/hono-cgi-adapter)](https://github.com/taisan11/hono-cgi-adapter/commits/main)
[![GitHub](https://img.shields.io/github/license/taisan11/hono-cgi-adapter)](https://github.com/taisan11/hono-cgi-adapter/blob/main/LICENSE)
On Deno.
## example
```ts
import {handle,getConnInfo} from "hono-cgi-adapter";
import {Hono} from "hono"

const app = new Hono();

app.get("/",(c)=>{
    return c.text("Hello CGI");
});

app.get("/info",(c)=>{
    return c.json(getConnInfo());
});

app.notFound((c)=>{
  return c.text("Not Found");
})

handle(app,"http://localhost:8080/");
```
Plese bundle and add `#!C:\Users\USERNAME\.deno\bin\deno.EXE --allow-env` at the top.
Then place it in a folder like normal CGI.(ex.`./Apache/cgi-bin/aaa.ts`)