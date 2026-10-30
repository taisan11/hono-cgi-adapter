import { bench, boxplot, run } from 'mitata';
import { Hono } from 'hono';
import { handlecgi } from '../src/index';

const app = new Hono();
app.get('/', (c) => c.text('Hono!'));

// Prepare equivalent GET inputs outside the measured functions.
const env = { REQUEST_METHOD: 'GET', HTTP_HOST: 'localhost', PATH_INFO: '/' };
const request = new Request('http://localhost/');

// CGI writes the response to stdout; discard it without hiding mitata's output.
const write = process.stdout.write;
let cgiOutput = '';
let checking = true;
process.stdout.write = function (chunk: any, ...args: any[]) {
  if (typeof chunk === 'string' && chunk.startsWith('Status: ')) {
    if (checking) cgiOutput = chunk;
    return true;
  }
  return (write as any).call(this, chunk, ...args);
} as typeof process.stdout.write;

try {
  const response = await app.fetch(request, env);
  if (response.status !== 200 || await response.text() !== 'Hono!') {
    throw new Error('Unexpected Hono response');
  }
  await handlecgi(app, env);
  if (!cgiOutput.startsWith('Status: 200\r\n') || !cgiOutput.endsWith('\r\n\r\nHono!')) {
    throw new Error(`Unexpected CGI response: ${cgiOutput}`);
  }
  checking = false;

  boxplot(() => {
    bench('Hono fetch', async () => {
      const response = await app.fetch(request, env);
      await response.text();
    });
    bench('CGI handle', async () => {
      await handlecgi(app, env);
    });
  });

  await run({ throw: true });
} finally {
  process.stdout.write = write;
}
