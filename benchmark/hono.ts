import {Hono} from "hono";

const app = new Hono();

app.get('/', (c) => {return c.text('Hono!')});

Bun.serve({
  port:8081,
  fetch:app.fetch
})
