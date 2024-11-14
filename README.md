# Hono CGI Adapter
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

handle(app,"http://localhost:8080/","/cgi-bin/aaa.ts");
```
Plese bundle and add `#!C:\Users\USERNAME\.deno\bin\deno.EXE --allow-env` at the top.
Then place it in a folder like normal CGI.(ex.`./Apache/cgi-bin/aaa.ts`)