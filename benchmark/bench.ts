import { run, bench, boxplot  } from 'npm:mitata';

const hono = new Deno.Command(Deno.execPath(),{args:["run","-A","--unstable","./benchmark/hono.ts"],stdout:"inherit",stderr:"inherit"});

const honochild = hono.spawn()

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