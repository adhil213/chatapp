# QuickChat

A small real-time chat app: **Node/Express + MongoDB + Socket.IO** backend with an **Expo React Native** mobile client. Accounts are protected with **passwords (bcrypt) and JWT**, and messaging is gated behind an explicit **chat-request / acceptance** flow.

> ⚠️ **Prototype.** Auth, rate limiting, and authorization are in place, but this is still a learning project. See [Security notes](#security-notes).

---

## Features

- **Username accounts**: register / sign in with a username + password; JWT session persisted on device
- **Profile**: edit display name; view `@username`
- **User search**: prefix search by username, with live relationship state
- **Chat requests**: send / accept / reject; a conversation is only created once accepted
- **Authorization**: every REST call and socket event is scoped to the authenticated user; messaging requires an accepted relationship
- 1:1 conversations, persisted in MongoDB
- Optimistic send with retry, rollback on permanent failure, idempotent (client-generated ID) delivery
- Receipts: `sent → delivered → read` (monotonic, race-safe)
- Online / offline presence with `lastSeen` and a reconnect grace window
- Cursor-based message pagination + reconnect sync (only newer messages are fetched)
- Unread counts per conversation; messages are stored server-side so offline recipients receive them on return

---

## Repository layout

```
quickchat/
├─ package.json            root scripts (concurrently)
├─ server/                 Express + Socket.IO API (CommonJS)
│  ├─ server.js            HTTP + Socket.IO bootstrap (CORS, shutdown, JWT guard)
│  ├─ config/db.js         Mongoose connection
│  ├─ models/              User, ChatRequest, Conversation, Message
│  ├─ routes/              health, auth, users, requests, conversations
│  ├─ sockets/chat.socket.js  authenticated real-time handlers
│  ├─ middleware/          auth (JWT), error, rateLimit
│  ├─ utils/               conversation, token, username, relationship, serialize, cursor
│  ├─ presence.js          in-memory per-user socket registry
│  └─ scripts/audit.test.js   end-to-end auth/requests/messaging/presence suite
└─ mobile/                 Expo + expo-router app (ESM/JSX)
   ├─ app/                 screens (index/auth, chats, search, requests, profile, chat/[id])
   ├─ hooks/               useIdentity (auth), useChatSocket, useChat
   ├─ components/          MessageBubble, MessageComposer (emoji bar), OnlineDot
   ├─ services/            config, api (Bearer token), socket (token handshake)
   └─ utils/               uuid, presence
```

---

## Development commands

Requires **Node 18+**, npm, and a reachable MongoDB.

```bash
# from the repository root
npm install            # installs root + server + mobile (postinstall)
npm run dev            # runs backend (nodemon) + Expo together
npm run server         # backend only  -> http://localhost:5000
npm run mobile         # Expo dev server only
npm test               # end-to-end backend suite (server must be running)
```

Backend only:

```bash
cd server
npm install
npm run dev            # nodemon
npm start              # plain node
```

Mobile only:

```bash
cd mobile
npm install
npm start              # Expo
npm run android        # open on Android
npm run ios            # open on iOS
npm run web            # web build
```

### Tests

`server/scripts/audit.test.js` boots **no** server of its own — start the backend first, then run it against that URL:

```bash
cd server
npm run dev                                  # or: npm start
# in another shell:
QUICKCHAT_URL=http://localhost:5055 npm run test:audit
```

The suite (47 checks) covers: account creation/login/token rules, profile edits, user search, request creation/accept/reject and their authorization rules, messaging gating, delivery/read receipts, idempotent resend, offline delivery, non-participant access denial, cursor pagination, presence (multi-socket + grace), and rejection of unauthenticated socket connections.

---

## Environment variables

Copy `server/.env.example` to `server/.env` and adjust (`.env` is git-ignored):

| Variable            | Default                                 | Purpose                                            |
| ------------------- | --------------------------------------- | -------------------------------------------------- |
| `PORT`              | `5000`                                  | HTTP + Socket.IO port                              |
| `MONGO_URI`         | `mongodb://127.0.0.1:27017/quickchat`   | MongoDB connection string                          |
| `CLIENT_ORIGIN`     | `*`                                     | CORS origin(s); comma-separated list, or `*`       |
| `JWT_SECRET`        | *(dev fallback)*                        | **Required in production.** Signing secret         |
| `JWT_EXPIRES_IN`    | `30d`                                   | Token lifetime                                      |
| `PRESENCE_GRACE_MS` | `5000`                                  | Delay before marking a user offline (anti-flicker) |

Mobile (Expo public env, optional): `EXPO_PUBLIC_API_URL` overrides the auto-detected backend URL.

**Secrets:** no credentials are committed. `.env` is ignored; only `.env.example` is tracked. Set a long random `JWT_SECRET` in production — the server **refuses to start** with `NODE_ENV=production` unless one is provided.

---

## Physical-device network setup

The mobile app auto-detects the backend host:

1. `EXPO_PUBLIC_API_URL` (highest priority), else
2. the Expo dev server host from `hostUri` (your machine's LAN IP — works on a real phone), else
3. `10.0.2.2` on Android emulator, `localhost` on iOS simulator.

For a physical phone:

1. Connect the phone and computer to the **same Wi-Fi network**.
2. Start the backend (`npm run server`) so it listens on `0.0.0.0:<PORT>`.
3. Allow the port through the OS firewall (e.g., Windows Defender inbound rule for TCP 5000).
4. Run `npm run mobile` and scan the QR code with Expo Go.
5. If auto-detection fails, set `EXPO_PUBLIC_API_URL=http://<your-lan-ip>:5000` before starting Expo.

MongoDB must be reachable from the backend host at `MONGO_URI`.

---

## Backend deployment

1. Provision MongoDB (Atlas or self-hosted) and set `MONGO_URI`.
2. Set `PORT`, `CLIENT_ORIGIN` (your app/site origin, not `*`), `JWT_SECRET`, and `PRESENCE_GRACE_MS`.
3. Install and start:

   ```bash
   cd server
   npm install --omit=dev
   NODE_ENV=production npm start
   ```

4. Put a TLS-terminating reverse proxy (nginx/Caddy) in front for **wss/https**.
5. Ensure the platform can hold persistent WebSocket connections (disable idle timeouts / enable sticky sessions if scaling to multiple instances).
6. Create indexes on first boot (Mongoose builds schema indexes automatically).

> Presence state is **in-memory**. Running more than one backend instance requires a Socket.IO adapter (e.g., Redis) to share rooms/broadcasts.

---

## Building the Expo app

### Local development

```bash
cd mobile
npm install
cp .env.example .env       # then set EXPO_PUBLIC_API_URL to your backend
npx expo start             # dev server
npx expo run:android       # native build/run
npx expo run:ios
```

The backend URL comes from `EXPO_PUBLIC_API_URL` (`services/config.js`); the Expo CLI loads it from `mobile/.env` locally. **`.env` is git-ignored**, so it is **not** uploaded to cloud builds.

### Configuration for EAS cloud builds

Expo inlines every `EXPO_PUBLIC_*` variable into the JS bundle **at build time**. Since the developer's `.env` never reaches the cloud builder, the URL must be supplied by the build environment. This project sets it per profile in `eas.json`:

```json
{ "build": { "preview": { "env": { "EXPO_PUBLIC_API_URL": "https://chatapp-w9n1.onrender.com" } } } }
```

To change it without editing `eas.json`, use a **hosted environment variable** in the Expo dashboard — *Project → Configuration → Environment Variables → environment `preview` → add `EXPO_PUBLIC_API_URL`* — or the CLI:

```bash
eas env:create --name EXPO_PUBLIC_API_URL \
  --value https://chatapp-w9n1.onrender.com \
  --environment preview --visibility plaintext
```

`EXPO_PUBLIC_*` values are **not secret**: they are embedded in the shipped bundle. Never put `MONGO_URI`, `JWT_SECRET`, or any server credential here.

### Android APK (internal distribution)

```bash
npm install -g eas-cli
eas login
eas init                   # link this folder to an Expo project (first time only)
eas build --platform android --profile preview
```

The `preview` profile builds an installable **APK** (`distribution: internal`); `production` builds an AAB for the Play Store (`eas.json`). On the first build EAS offers to generate an Android keystore — accept it (it is stored by Expo; back it up). When the build finishes, EAS prints a URL + QR code; share that link with friends, or download the `.apk` and open it on the phone (allow "install from unknown sources").

`app.json` defines the name (`QuickChat`), slug (`quickchat`), scheme (`quickchat`), Android package (`com.quickchat.app`), and iOS bundle id (`com.quickchat.app`).

---

## Testing checklist (manual, two devices)

Register two accounts (e.g. `alice`, `bob`) on two app sessions.

- Search for the other account, **send a request**; the other device sees it under **Requests**.
- Try to open a chat before acceptance → messaging is blocked; after **Accept**, the conversation appears for both.
- Send messages **simultaneously** from both — no duplicates, correct order.
- Observe ticks: ✓ sent, ✓✓ delivered, ✓✓ blue read; unread badge on the chats list.
- Background one app → it goes offline (after grace); foreground → online again.
- Kill Wi-Fi on one device → sends show a retryable failure, then flush on reconnect.
- Send while the other device is offline → message appears when it returns.
- Kill/restart the backend → clients reconnect and resync without losing messages.
- Edit your display name in **Profile**; it updates on the other device.
- Sign out → the session is cleared and the sign-in screen returns.

Automated equivalent: `server/scripts/audit.test.js`.

---

## Data model & reliability notes

- `User` has a unique `username` and a `passwordHash` (`select:false`); public serializers never expose it.
- `ChatRequest` (`pairKey` unique) tracks `pending / accepted / rejected`; `Conversation` (`pairKey` unique) exists only after acceptance.
- `Message` is idempotent via unique index `{ senderId, clientMessageId }`; duplicate sends return the existing document.
- Status transitions use atomic conditional updates, so concurrent delivered/read cannot regress.
- Message queries are indexed by `{ conversationId, createdAt, _id }` (keyset pagination) and `{ recipientId, status }`.
- Socket connections require a valid JWT (`handshake.auth.token`); identity is taken from the token, never the client payload.
- REST errors return JSON `{ message, code }` with a central handler; rate limiters guard auth and search.

---

## Security notes

Authentication and authorization are implemented, but this is still **not** a hardened production service.

- **Implemented:** bcrypt password hashing, JWT sessions, `requireAuth` on all data routes, per-socket JWT handshake auth, relationship-gated messaging, participant checks on history/receipts, rate limiting on auth/search, CORS configurable, basic security headers, `middleware/error.js` central error handling.
- **Still missing for production:** HTTPS/WSS termination (run behind a reverse proxy), refresh-token rotation / revocation, email or phone verification, password reset, account lockout, CSRF considerations for web clients, blocklists/abuse reporting, audit logging, and stricter input sanitization.
- **CORS** defaults to `*`; restrict `CLIENT_ORIGIN` before deploying.
- **Presence is in-memory**; multi-instance deployments need a shared Socket.IO adapter.
- **No message encryption** beyond the transport layer.

Treat QuickChat as a learning/demo project. Before production, add the items above and review the authorization checks on every conversation and message path.
