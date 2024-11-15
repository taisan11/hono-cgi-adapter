import {Hono} from "npm:hono";

const app = new Hono();

app.get('/', (c) => {return c.text('Hono!')});

Deno.serve({ port: 8081 },app.fetch);