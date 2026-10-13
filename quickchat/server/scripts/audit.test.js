const { io } = require('socket.io-client');

const BASE_URL = process.env.QUICKCHAT_URL || 'http://localhost:5000';
const ACK_TIMEOUT = 6000;
const GRACE_MS = Number(process.env.PRESENCE_GRACE_MS) || 5000;

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  return { status: res.status, body: json };
}

const register = (username, displayName, password = 'password123', secretKey = 'vaultkey123') =>
  api('/api/auth/register', {
    method: 'POST',
    body: { username, displayName, password, secretKey },
  });

const login = (username, password = 'password123') =>
  api('/api/auth/login', { method: 'POST', body: { username, password } });

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: ACK_TIMEOUT,
    });

    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(ACK_TIMEOUT).emit(event, payload, (err, res) => {
      if (err) reject(new Error(`no ack for ${event}`));
      else resolve(res);
    });
  });
}

function waitFor(socket, event, predicate, timeout = ACK_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeout);

    function handler(payload) {
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      }
    }

    socket.on(event, handler);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const send = (socket, recipientId, text, clientMessageId) =>
  emitAck(socket, 'message:send', { recipientId, text, clientMessageId });

async function main() {
  console.log(`QuickChat audit test against ${BASE_URL} (grace=${GRACE_MS}ms)\n`);

  const s = Date.now().toString(36);
  const aliceName = `alice_${s}`;
  const bobName = `bob_${s}`;
  const carolName = `carol_${s}`;

  console.log('A. Accounts');

  const aliceReg = await register(aliceName, 'Alice');
  check('register returns a token', Boolean(aliceReg.body.token));
  check('register returns the profile', aliceReg.body.user && aliceReg.body.user.username === aliceName);
  check('register never returns passwordHash', !('passwordHash' in (aliceReg.body.user || {})));
  const alice = aliceReg.body.user;
  const aliceToken = aliceReg.body.token;

  const noToken = await api('/api/auth/me');
  check('me without token is 401', noToken.status === 401);

  const dup = await register(aliceName, 'Alice Again');
  check('duplicate username is rejected', dup.status === 409 && dup.body.code === 'USERNAME_TAKEN');

  const badLogin = await login(aliceName, 'wrongpass1');
  check('wrong password is rejected', badLogin.status === 401);

  const goodLogin = await login(aliceName.toUpperCase());
  check('login is case-insensitive for username', goodLogin.status === 200 && Boolean(goodLogin.body.token));

  const bobReg = await register(bobName, 'Bob');
  const bob = bobReg.body.user;
  const bobToken = bobReg.body.token;
  const carolReg = await register(carolName, 'Carol');
  const carol = carolReg.body.user;
  const carolToken = carolReg.body.token;

  const patched = await api('/api/auth/me', {
    method: 'PATCH',
    token: aliceToken,
    body: { displayName: 'Alice Renamed' },
  });
  check('user can edit their own profile', patched.status === 200 && patched.body.user.displayName === 'Alice Renamed');

  console.log('\nB. Search and chat requests');

  const search = await api(`/api/users/search?q=${bobName.slice(0, 6)}`, { token: aliceToken });
  const found = search.body.users.find((u) => u._id === bob._id);
  check('search finds the user', Boolean(found));
  check('search result has username and displayName', Boolean(found && found.username && found.displayName));
  check('search result has no passwordHash', !('passwordHash' in (found || {})));
  check('search excludes self', !search.body.users.some((u) => u._id === alice._id));

  const shortSearch = await api('/api/users/search?q=a', { token: aliceToken });
  check('search requires a minimum query length', shortSearch.body.users.length === 0);

  const selfReq = await api('/api/requests', { method: 'POST', token: aliceToken, body: { userId: alice._id } });
  check('self request is rejected', selfReq.status === 400);

  const req1 = await api('/api/requests', { method: 'POST', token: aliceToken, body: { userId: bob._id } });
  check('a chat request can be created', req1.status === 201 && req1.body.request.status === 'pending');
  const requestId = req1.body.request._id;

  const reqDup = await api('/api/requests', { method: 'POST', token: aliceToken, body: { userId: bob._id } });
  check('duplicate request is rejected', reqDup.status === 409);

  const incomingBob = await api('/api/requests', { token: bobToken });
  check('recipient sees the incoming request', incomingBob.body.incoming.some((r) => r._id === requestId));

  const carolAccept = await api(`/api/requests/${requestId}/accept`, { method: 'POST', token: carolToken });
  check('non-recipient cannot accept a request', carolAccept.status === 403);

  const aliceSocket = await connect(aliceToken);
  const pendingSend = await send(aliceSocket, bob._id, 'too soon', `too_soon_${s}`);
  check('cannot message while request is pending', pendingSend.ok === false && pendingSend.error === 'NOT_CONNECTED');

  const accept = await api(`/api/requests/${requestId}/accept`, { method: 'POST', token: bobToken });
  check('recipient can accept the request', accept.status === 200 && accept.body.conversationId);

  const acceptAgain = await api(`/api/requests/${requestId}/accept`, { method: 'POST', token: bobToken });
  check('repeated accept is idempotent', acceptAgain.status === 200);

  const aliceConvs = await api('/api/conversations', { token: aliceToken });
  check('conversation appears for requester', aliceConvs.body.conversations.some((c) => c.user._id === bob._id));
  const bobConvs = await api('/api/conversations', { token: bobToken });
  check('conversation appears for recipient', bobConvs.body.conversations.some((c) => c.user._id === alice._id));

  console.log('\nC. Messaging and receipts');

  const bobSocket = await connect(bobToken);

  const firstSend = await send(aliceSocket, bob._id, 'hello 👋', `m1_${s}`);
  check('connected user can send after acceptance', firstSend.ok === true);
  check('emoji is preserved', firstSend.message.text === 'hello 👋');
  check('stored status is sent', firstSend.message.status === 'sent');

  const deliveredP = waitFor(aliceSocket, 'message:status', (e) => e.messageId === firstSend.message._id && e.status === 'delivered');
  await emitAck(bobSocket, 'message:delivered', { messageId: firstSend.message._id });
  check('delivered receipt reaches sender', (await deliveredP).status === 'delivered');

  const readP = waitFor(aliceSocket, 'message:status', (e) => e.messageId === firstSend.message._id && e.status === 'read');
  await emitAck(bobSocket, 'conversation:read', { otherId: alice._id });
  check('read receipt reaches sender', (await readP).status === 'read');

  const dupSend = await send(aliceSocket, bob._id, 'retry me', `dup_${s}`);
  const dupSend2 = await send(aliceSocket, bob._id, 'retry me', `dup_${s}`);
  check('duplicate send returns same id', dupSend.message._id === dupSend2.message._id);

  const history = await api(`/api/conversations/${bob._id}/messages?limit=100`, { token: aliceToken });
  check('history dedupes client message ids', history.body.messages.filter((m) => m.clientMessageId === `dup_${s}`).length === 1);
  check('read status persisted', history.body.messages.find((m) => m._id === firstSend.message._id).status === 'read');

  const carolRead = await api(`/api/conversations/${bob._id}/messages`, { token: carolToken });
  check('non-participant cannot read conversation', carolRead.status === 403);

  const carolSocket = await connect(carolToken);
  const carolSend = await send(carolSocket, alice._id, 'hi stranger', `stranger_${s}`);
  check('unconnected user cannot message', carolSend.ok === false && carolSend.error === 'NOT_CONNECTED');

  const badDeliver = await emitAck(carolSocket, 'message:delivered', { messageId: firstSend.message._id });
  check('non-recipient cannot set delivered', badDeliver.ok === false);

  console.log('\nC2. Offline delivery and pagination');

  bobSocket.disconnect();
  await sleep(300);

  const offlineMsg = await send(aliceSocket, bob._id, 'while offline', `off_${s}`);
  check('message to offline recipient is accepted', offlineMsg.ok === true);

  await Promise.all(
    Array.from({ length: 12 }, (_, i) => send(aliceSocket, bob._id, `page ${i}`, `pg_${i}_${s}`))
  );

  const page1 = await api(`/api/conversations/${bob._id}/messages?limit=5`, { token: aliceToken });
  check('page 1 respects limit', page1.body.messages.length === 5);
  check('page 1 reports hasMore', page1.body.hasMore === true);

  const page2 = await api(`/api/conversations/${bob._id}/messages?limit=5&before=${encodeURIComponent(page1.body.nextCursor)}`, { token: aliceToken });
  const ids1 = page1.body.messages.map((m) => m._id);
  const ids2 = page2.body.messages.map((m) => m._id);
  check('pages do not overlap', ids1.every((id) => !ids2.includes(id)));
  check('page 2 is older', new Date(page2.body.messages.at(-1).createdAt) <= new Date(page1.body.messages[0].createdAt));

  const full = await api(`/api/conversations/${bob._id}/messages?limit=100`, { token: aliceToken });
  const ordered = full.body.messages.map((m) => new Date(m.createdAt).getTime());
  check('messages are ordered ascending', ordered.every((t, i) => i === 0 || ordered[i - 1] <= t));
  check('offline message persisted', full.body.messages.some((m) => m.clientMessageId === `off_${s}`));

  const bobReconnect = await connect(bobToken);
  const bobHistory = await api(`/api/conversations/${alice._id}/messages?limit=100`, { token: bobToken });
  check('offline recipient sees message on return', bobHistory.body.messages.some((m) => m.clientMessageId === `off_${s}`));

  console.log('\nD. Presence');

  const presenceEvents = [];
  const observer = await connect(carolToken);
  observer.on('presence:update', (p) => presenceEvents.push(p));

  const extraBob = await connect(bobToken);
  const offlineObserved = () => presenceEvents.filter((e) => e.userId === bob._id && e.online === false).length;

  bobReconnect.disconnect();
  await sleep(300);
  check('one socket disconnecting keeps user online', offlineObserved() === 0);

  extraBob.disconnect();
  await sleep(GRACE_MS + 700);
  check('final disconnect marks user offline after grace', offlineObserved() === 1);

  const bobProfile = await api(`/api/users/${bob._id}`, { token: aliceToken });
  check('offline user exposes lastSeen', Boolean(bobProfile.body.user.lastSeen));

  console.log('\nD2. Notepad vault and notes');

  const badUnlock = await api('/api/vault/unlock', {
    method: 'POST',
    token: aliceToken,
    body: { secretKey: 'wrongkey999' },
  });
  check('unlock with wrong key is rejected', badUnlock.status === 401);

  const goodUnlock = await api('/api/vault/unlock', {
    method: 'POST',
    token: aliceToken,
    body: { secretKey: 'vaultkey123' },
  });
  check('unlock with correct key succeeds', goodUnlock.status === 200 && goodUnlock.body.ok === true);

  const noteCreate = await api('/api/notes', {
    method: 'POST',
    token: aliceToken,
    body: { title: 'Groceries', content: 'milk, eggs' },
  });
  check('user can create a note', noteCreate.status === 201 && noteCreate.body.note.title === 'Groceries');
  const noteId = noteCreate.body.note._id;

  const noteList = await api('/api/notes', { token: aliceToken });
  check('user sees their own note', noteList.body.notes.some((n) => n._id === noteId));

  const bobNotes = await api('/api/notes', { token: bobToken });
  check('notes are isolated per user', !bobNotes.body.notes.some((n) => n._id === noteId));

  const otherUpdate = await api(`/api/notes/${noteId}`, {
    method: 'PATCH',
    token: bobToken,
    body: { title: 'hijack' },
  });
  check('another user cannot update a note', otherUpdate.status === 404);

  const noteUpdate = await api(`/api/notes/${noteId}`, {
    method: 'PATCH',
    token: aliceToken,
    body: { title: 'Groceries', content: 'milk, eggs, bread' },
  });
  check('owner can update a note', noteUpdate.status === 200 && noteUpdate.body.note.content.includes('bread'));

  const noteDelete = await api(`/api/notes/${noteId}`, { method: 'DELETE', token: aliceToken });
  check('owner can delete a note', noteDelete.status === 200);

  console.log('\nE. Unauthenticated socket');

  let rejected = false;
  try {
    await connect('');
  } catch (err) {
    rejected = true;
  }
  check('socket without a valid token is rejected', rejected);
  try {
    await connect('invalid.token.value');
    rejected = false;
  } catch (err) {
    rejected = true;
  }
  check('socket with an invalid token is rejected', rejected);

  aliceSocket.disconnect();
  carolSocket.disconnect();
  observer.disconnect();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('\nTest run failed:', err.message);
  process.exitCode = 1;
});
