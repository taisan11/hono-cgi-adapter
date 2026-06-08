# Hono CGI Adapter
![NPM Version](https://img.shields.io/npm/v/hono-cgi-adapter)
[![GitHub commit activity](https://img.shields.io/github/commit-activity/m/taisan11/hono-cgi-adapter)](https://github.com/taisan11/hono-cgi-adapter/pulse)
[![GitHub last commit](https://img.shields.io/github/last-commit/taisan11/hono-cgi-adapter)](https://github.com/taisan11/hono-cgi-adapter/commits/main)
[![GitHub](https://img.shields.io/github/license/taisan11/hono-cgi-adapter)](https://github.com/taisan11/hono-cgi-adapter/blob/main/LICENSE)
## example
```ts
import {handlecgi,getConnInfoOnCGI} from "hono-cgi-adapter";
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

handlecgi(app,process.env);
```
Plese bundle and add interpreter setting (ex.`#!C:\Users\USERNAME\.deno\bin\deno.EXE --allow-env`) at the top.
Then place it in a folder like normal CGI.(ex.`./Apache/cgi-bin/aaa.ts`)
