import {build,stop} from "npm:esbuild";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.0";

await build({
    plugins: [...denoPlugins()],
    entryPoints: ["./benchmark/hono-cgi.ts"],
    outfile: "./benchmark/hono-cgi.js",
    bundle: true,
    format: "esm",
  });

stop()