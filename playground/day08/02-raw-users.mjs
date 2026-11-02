// Day 8 · The same kind of API with NO framework, only node:http, to see what Nest does for you.
// It starts on a free port, sends a few requests to itself, prints the results and stops. Run:
//   node playground/day08/02-raw-users.mjs

import http from 'node:http';

const users = [{ id: 1, email: 'asha@shop.dev' }];

const server = http.createServer(async (req, res) => {
  const send = (status, data) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  const url = new URL(req.url, 'http://localhost');
  const idMatch = url.pathname.match(/^\/users\/(\d+)$/); // our own "router" + "ParseIntPipe"

  if (req.method === 'GET' && url.pathname === '/users') return send(200, users);

  if (req.method === 'GET' && idMatch) {
    const user = users.find((u) => u.id === Number(idMatch[1]));
    return user ? send(200, user) : send(404, { message: 'User not found' });
  }

  if (req.method === 'POST' && url.pathname === '/users') {
    let raw = '';
    for await (const chunk of req) raw += chunk; // the body arrives in pieces (it's a stream)
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return send(400, { message: 'Invalid JSON' });
    }
    if (typeof body.email !== 'string' || !body.email.includes('@')) {
      return send(400, { message: 'email must be an email' }); // our own "ValidationPipe"
    }
    const user = { id: users.length + 1, email: body.email };
    users.push(user);
    return send(201, user);
  }

  send(404, { message: `Cannot ${req.method} ${url.pathname}` });
});

server.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, body });
    console.log(`${`${method} ${path} ${body ?? ''}`.padEnd(36)} → ${res.status} ${await res.text()}`);
  };
  await call('GET', '/users');
  await call('GET', '/users/1');
  await call('GET', '/users/abc');
  await call('POST', '/users', '{"email":"ravi@shop.dev"}');
  await call('POST', '/users', '{"email":"nope"}');
  await call('POST', '/users', '{bad json');
  await call('DELETE', '/users/1');
  server.close();
});
