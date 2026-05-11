await Bun.build({
    entrypoints: ["./benchmark/hono-cgi.ts"],
    outfile: "./benchmark/hono-cgi.js",
  });