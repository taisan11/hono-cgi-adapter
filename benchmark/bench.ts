import { run, bench, boxplot  } from 'mitata';

const honochild = Bun.spawn([process.execPath, "run", "./benchmark/hono.ts"], { stdout: "inherit", stderr: "inherit" })

async function normalhono(): Promise<void> {
  await fetch("http://localhost:8081/");
}
async function cgi(): Promise<void> {
    await fetch("http://localhost:8080/cgi-bin/aaa.js");
}
boxplot (() => {
    bench("Hono",()=>normalhono())
    bench("CGI",()=>cgi())
})


await run();
honochild.kill();
