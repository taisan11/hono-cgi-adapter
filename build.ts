import { rmSync, existsSync } from "fs"

const entrypoints = ["./src/index.ts"]
const external = ["hono"]
const outdir = "./dist"

if (existsSync(outdir)) {
  rmSync(outdir, { recursive: true })
}

const results = await Promise.all([
  Bun.build({
    entrypoints,
    outdir,
    target: "node",
    format: "esm",
    external,
    sourcemap: "external",
    minify: true,
    naming: "[dir]/[name].js",
  }),
  Bun.build({
    entrypoints,
    outdir,
    target: "node",
    format: "cjs",
    external,
    sourcemap: "external",
    minify: true,
    naming: "[dir]/[name].cjs",
  }),
])

for (const result of results) {
  if (!result.success) {
    console.error("Build failed")
    for (const msg of result.logs) {
      console.error(msg)
    }
    process.exit(1)
  }
}

await Bun.$`bun x tsc --emitDeclarationOnly --declaration`

console.log("Build successful")
