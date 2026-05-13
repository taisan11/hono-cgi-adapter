import { rmSync, existsSync, readdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"

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

await Bun.$`bun x tsc -p tsconfig.build.json`

for (const file of readdirSync(outdir)) {
  if (!file.endsWith(".d.ts")) continue
  const path = join(outdir, file)
  const content = readFileSync(path, "utf-8")
  const updated = content.replaceAll(/from\s+"(.*?)\.ts"/g, 'from "$1.js"')
  if (content !== updated) writeFileSync(path, updated)
}

console.log("Build successful")
