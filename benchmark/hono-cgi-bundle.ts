//@ts-ignore
await Bun.build({
  entrypoints: ["./benchmark/hono-cgi.ts"],
  outdir: "./benchmark/",
});
