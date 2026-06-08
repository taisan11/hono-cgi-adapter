import { handlecgi } from "../src/index";
import {Hono} from "hono";

const app = new Hono().basePath("/cgi-bin/aaa.js");

app.get('/', (c) => {return c.text('Hono!')});

handlecgi(app,process.env);
