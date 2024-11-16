import { handle } from "../cgi.ts";
import {Hono} from "npm:hono";

const app = new Hono();

app.get('/', (c) => {return c.text('Hono!')});

handle(app,"http://localhost:8080/");