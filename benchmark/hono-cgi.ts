import { handle } from "../cgi.ts";
import {Hono} from "npm:hono";

const app = new Hono().basePath("/cgi-bin/aaa.js");

app.get('/', (c) => {return c.text('Hono!')});

handle(app);