# QuickChat

A small real-time chat app: **Node/Express + MongoDB + Socket.IO** backend with an **Expo React Native** mobile client.

> ⚠️ **Prototype, not production-secure.** QuickChat has **no authentication**. Identity is a self-declared `displayName` that maps to a MongoDB `ObjectId`. See [Security limitations](#security-limitations).

---

## Features

- Passwordless name-based sign-in (prototype identity)
- 1:1 conversations, persisted in MongoDB
- Optimistic send with retry, rollback on permanent failure, and idempotent (client-generated ID) delivery
- Receipts: `sent → delivered → read` (monotonic, race-safe)
- Online / offline presence with `lastSeen` and a reconnect grace window
- Cursor-based message pagination (never loads a whole conversation at once)
- Reconnect sync: fetches only messages newer than the last known cursor
- Messages are stored server-side, so offline recipients receive them on return

---

## Repository layout

```
quickchat/
├─ package.json            root scripts (concurrently)
├─ server/                 Express + Socket.IO API (CommonJS)
│  ├─ server.js            HTTP + Socket.IO bootstrap
│  ├─ config/db.js         Mongoose connection
│  ├─ models/              User, Message schemas + indexes
│  ├─ routes/              health, users, messages (cursor pagination)
│  ├─ sockets/chat.socket.js  real-time handlers
│  ├─ middleware/error.js  asyncHandler, 404, error handler
│  ├─ utils/               conversation, serialize, cursor
│  ├─ presence.js          in-memory per-user socket registry
│  └─ scripts/             receipts, presence, reliability tests
└─ mobile/                 Expo + expo-router app (ESM/JSX)
   ├─ app/                 screens (_layout, index, users, chat/[id])
   ├─ hooks/               useIdentity, useChatSocket, useChat
   ├─ components/          MessageBubble, MessageComposer, OnlineDot
   ├─ services/            config, api, socket
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

Tests (server must be running; see env below):

```bash
cd server
npm run test:receipts     # sent/delivered/read + idempotency/ownership
npm run test:presence     # online/offline, grace, snapshot
npm run test:reliability  # duplicates, offline delivery, reconnect, pagination, races, errors
```

Point tests at a non-default port with `QUICKCHAT_URL`:

```bash
QUICKCHAT_URL=http://localhost:5055 npm run test:reliability
```

---

## Environment variables

Copy `server/.env.example` to `server/.env` and adjust (`.env` is git-ignored):

| Variable             | Default                                     | Purpose                                          |
| -------------------- | ------------------------------------------- | ------------------------------------------------ |
| `PORT`               | `5000`                                      | HTTP + Socket.IO port                            |
| `MONGO_URI`          | `mongodb://127.0.0.1:27017/quickchat`       | MongoDB connection string                        |
| `CLIENT_ORIGIN`      | `*`                                         | CORS origin for REST and Socket.IO               |
| `PRESENCE_GRACE_MS`  | `5000`                                      | Delay before marking a user offline (anti-flicker) |

Mobile (Expo public env, optional): `EXPO_PUBLIC_API_URL` overrides the auto-detected backend URL.

**Secrets:** no credentials are committed. `.env` is ignored; only `.env.example` is tracked. The Mongo URI may contain credentials — keep it in the environment, never in source.

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
2. Set `PORT`, `CLIENT_ORIGIN` (your app/site origin, not `*`), and `PRESENCE_GRACE_MS`.
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

```bash
cd mobile
npx expo start            # dev
npx expo run:android      # native build/run
npx expo run:ios          # native build/run
```

EAS builds (recommended for distribution):

```bash
npm install -g eas-cli
eas login
eas build --platform android     # or ios / all
eas build --platform android --profile preview
```

`app.json` defines the slug (`quickchat`), scheme (`quickchat`), Android package (`com.quickchat.app`), and iOS support. Configure `eas.json` profiles before your first cloud build.

---

## Testing checklist (manual, two devices)

Run two app sessions (two phones/emulators) signed in as different names.

- Send messages **simultaneously** from both — no duplicates, correct order.
- Observe ticks: ✓ sent, ✓✓ delivered, ✓✓ blue read.
- Background one app → it goes offline (after grace); foreground → online again.
- Kill Wi-Fi on one device → sends show a retryable failure, then flush on reconnect.
- Send while the other device is offline → message appears when it returns.
- Kill/restart the backend → clients reconnect and resync without losing messages.
- Server logs / MongoDB show each message exactly once.

Automated equivalents live in `server/scripts/`.

---

## Data model & reliability notes

- `Message` is idempotent via unique index `{ senderId, clientMessageId }`; duplicate sends return the existing document.
- Status transitions use atomic conditional updates, so concurrent delivered/read cannot regress.
- Message queries are indexed by `{ conversationId, createdAt, _id }` (keyset pagination) and `{ recipientId, status }`.
- Socket payloads are validated (ObjectId shape, self-send, recipient existence, non-empty text, message ownership).
- REST errors return JSON `{ message, code }` with a central handler.

---

## Security limitations

This version is **not production-secure** and must not be used for sensitive data.

- **No authentication or authorization.** Any client can claim any `userId` via `user:register`; there is no token, session, or password.
- **No transport security by default.** Run behind HTTPS/WSS; plain HTTP is used for local dev.
- **CORS defaults to `*`.** Restrict `CLIENT_ORIGIN` before deploying.
- **No rate limiting** on REST or Socket.IO — vulnerable to spam/abuse.
- **No message encryption** at rest or in transit beyond the transport layer.
- **No user enumeration protection**; the full user list is publicly readable.
- **Presence is in-memory and unauthenticated**; multi-instance deployments need a shared adapter.
- **Input validation is basic** (length/pattern/id checks), not a full sanitization policy.
- **No audit logging, blocklists, or abuse reporting.**

Treat QuickChat as a learning/demo project. Before production, add real auth (e.g., tokens/OTP), TLS, strict CORS, rate limiting, and access-control checks on every conversation and message.
