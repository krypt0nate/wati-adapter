[![WhatsApp Team Inbox adapter for Chat SDK](https://chat-sdk.dev/en/adapters/official/whatsapp/og)](https://github.com/krypt0nate/wati-adapter.git)

# chat-adapter-wati

> npm package: [`chat-adapter-wati`](https://www.npmjs.com/package/chat-adapter-wati)

[![Agent Stack](https://img.shields.io/badge/Agent%20Stack-000?style=flat-square&logo=vercel&logoColor=FFF&labelColor=000&color=000)](https://vercel.com/kb/agent-stack)
[![MIT License](https://img.shields.io/badge/License-MIT-000?style=flat-square&logo=opensourceinitiative&logoColor=white&labelColor=000&color=000)](../../LICENCE)

WhatsApp Team Inbox adapter for [Chat SDK](https://chat-sdk.dev), using the [Wati WhatsApp Business API](https://docs.wati.io/reference/introduction). Wati is a WhatsApp Business API platform that adds an inbox, broadcasts, templates, and multi-channel support on top of WhatsApp's Cloud API.

Documentation: [Wati API reference](https://docs.wati.io/reference/introduction) · Guides: [vercel.com/kb/chat-sdk](https://vercel.com/kb/chat-sdk)

## Installation

```bash
pnpm add chat-adapter-wati
```

## Usage

```typescript
import { Chat } from "chat";
import { createWatiAdapter } from "chat-adapter-wati";

const bot = new Chat({
  userName: "mybot",
  adapters: {
    wati: createWatiAdapter(),
  },
});

bot.onNewMention(async (thread, message) => {
  await thread.post("Hello from WhatsApp!");
});
```

When using `createWatiAdapter()` without arguments, credentials are auto-detected from environment variables.

## Wati setup

### 1. Create a Wati account

1. Sign up at [wati.io](https://www.wati.io)
2. Connect your WhatsApp Business number through the Wati onboarding
3. Note your **tenant API endpoint** (e.g. `https://live-mt-server-XXXXX.wati.io`) shown in your Wati API page

### 2. Generate an API token

1. In Wati, go to **Connector → API → Create API Token**
2. Click **Generate new token** and select the required scopes (e.g. `contacts:read`, `contacts:write`, `messagetemplate:read`)
3. Copy and securely store the token — it is only shown once

### 3. Configure webhooks

1. In Wati, go to **Settings → API → Webhooks** (or use `adapter.createWebhooks(...)`)
2. Set the **webhook URL** to `https://your-domain.com/api/webhooks/wati` and subscribe to the `message` event type
3. Protect the endpoint with a secret — the adapter accepts it in the `x-wati-webhook-secret` header or as a `/webhook/<secret>` path segment

## Configuration

All options are auto-detected from environment variables when not provided. You can call `createWatiAdapter()` with no arguments if the env vars are set.

| Option | Required | Description |
|--------|----------|-------------|
| `accessToken` | No* | Wati API token. Auto-detected from `WATI_ACCESS_TOKEN` |
| `apiUrl` | No* | Wati tenant API base URL. Auto-detected from `WATI_API_URL` |
| `webhookSecret` | No* | Secret used to verify inbound webhooks. Auto-detected from `WATI_WEBHOOK_SECRET` |
| `userName` | No | Bot username for self-message detection. Auto-detected from `WATI_BOT_USERNAME` (defaults to `wati-bot`) |
| `logger` | No | Logger instance (defaults to `ConsoleLogger("info")`) |

*Required at runtime — either via config or environment variable.

## Environment variables

```bash
WATI_ACCESS_TOKEN=...          # Wati API token (generate under Connector → API)
WATI_API_URL=...               # Tenant endpoint, e.g. https://live-mt-server-XXXXX.wati.io
WATI_WEBHOOK_SECRET=...        # Secret for webhook request verification
WATI_BOT_USERNAME=...          # Optional, defaults to "wati-bot"
```

## Webhook setup

Wati delivers events as POST requests. The adapter verifies them using a shared secret supplied in one of two ways:

1. **Header** — `x-wati-webhook-secret: <your-secret>`
2. **Path** — register a webhook URL ending in `/webhook/<your-secret>`

```typescript
// Next.js App Router example
import { bot } from "@/lib/bot";

export async function POST(request: Request) {
  return bot.webhooks.wati(request);
}
```

## Features

### Messaging

| Feature | Supported |
|---------|-----------|
| Post message | Yes |
| Edit message | No (Wati API limitation) |
| Delete message | No (Wati API limitation) |
| Streaming | Buffered (accumulates then sends) |
| Mark as read | No (not exposed by Wati API v3) |
| Auto-chunking | Yes (splits at 4096 chars) |
| Template messages | Yes (via `sendTemplate`) |
| Scheduled templates | Yes (via `scheduleTemplate`) |

### Rich content

| Feature | Supported |
|---------|-----------|
| Interactive buttons | Yes (up to 3) |
| Button title limit | 20 characters |
| List messages | Yes |
| Text fallback | Yes (for >3 buttons) |

### Conversations

| Feature | Supported |
|---------|-----------|
| Reactions | Inbound yes, outbound no |
| Typing indicator | No (not exposed by Wati API v3) |
| DMs | Yes |
| Open DM | Yes |
| Assign operator | Yes (via `assignOperator`) |
| Update conversation status | Yes (via `updateConversationStatus`) |

### Incoming message types

| Type | Supported |
|------|-----------|
| Text | Yes |
| Images | Yes (with captions) |
| Documents | Yes (with captions) |
| Audio / Voice | Yes |
| Video | Yes (with captions) |
| Stickers | Yes |
| Locations | Yes (converted to `[Location: lat, lng]`) |
| Interactive replies | Yes (button and list) |
| Reactions | Yes |

### Message history

| Feature | Supported |
|---------|-----------|
| Fetch messages | Yes (paginated via `fetchMessages`) |
| Fetch thread info | Yes |

### Admin APIs

Beyond the `Adapter` interface, the adapter exposes the Wati API namespaces for admin operations:

```typescript
const channels = await adapter.getChannels();
const contacts = await adapter.getContacts();
const templates = await adapter.getMessageTemplates();
await adapter.updateConversationStatus(threadId, "solved");
```

## Interactive messages

Card elements are automatically converted to Wati interactive messages:

- **3 or fewer buttons** — rendered as WhatsApp reply buttons (max 20 chars per title)
- **More than 3 buttons** — falls back to formatted text
- **Max body text** — 1024 characters

## Template messages

Outside the 24-hour customer service window, WhatsApp only accepts pre-approved [template messages](https://docs.wati.io/reference/post_api-ext-v3-messagetemplates-send). Use `sendTemplate` to start business-initiated conversations:

```typescript
const threadId = await adapter.openDM("15551234567");

await adapter.sendTemplate(threadId, {
  name: "appointment_reminder",
  broadcastName: "Reminder broadcast",
  parameters: [{ name: "1", value: "Tomorrow at 2pm" }],
});
```

Templates must be created and approved in WhatsApp Manager (via the Wati dashboard or the `POST /api/v1/whatsApp/templates` endpoint) before they can be sent. Quick reply button taps on a template arrive as button responses and are dispatched to your `onAction` handlers.

## Thread ID format

```
wati:{base64url(waId)}
```

Example: `wati:MTQxNTU1NTI2NzE` (decodes to `14155552671`)

## Troubleshooting

### Webhook requests returning 401

- Confirm the `x-wati-webhook-secret` header (or the `/webhook/<secret>` path segment) matches `WATI_WEBHOOK_SECRET`
- Ensure you subscribed to the webhook in the Wati dashboard and the endpoint is reachable

### "accessToken is required" from `createWatiAdapter()`

- Set `WATI_ACCESS_TOKEN` or pass `accessToken` in the config object

### API requests failing with 401 / 403

- Wati tokens can be revoked when the account password changes — generate a new token under **Connector → API**
- Confirm the token includes the scopes required by the endpoints you call
- Check `WATI_API_URL` points at your tenant endpoint (e.g. `https://live-mt-server-XXXXX.wati.io`)

### Messages not arriving

- Verify the webhook endpoint returns `200` and the `message` event type is selected
- Confirm your WhatsApp number is verified in Wati and Meta

### Buttons not triggering callbacks

- Wati's interactive schema only carries visible button text — it has no hidden ID field, so callback buttons are rejected with a `ValidationError` at post time. Use a regular `onAction` button with a visible label instead.

## AI Coding Agents

If you use an AI coding agent such as OpenAI Codex, Claude Code, or Cursor, install the Chat SDK skill so it knows the SDK APIs, adapter patterns, and project conventions before writing code.

```bash
npx skills add vercel/chat
```

The skill references bundled documentation in `node_modules/chat/docs`, plus adapter guides and starter templates in the published package.

You can also install the [Vercel Plugin](https://vercel.com/docs/agent-resources/vercel-plugin) for a broader agent toolkit — it includes the Chat SDK skill alongside specialist agents, agent slash commands, and more:

```bash
npx plugins add vercel/vercel-plugin
```

The plugin is optional; the skill alone is enough to build with Chat SDK.

For agent-readable documentation, see [chat-sdk.dev/llms.txt](https://chat-sdk.dev/llms.txt) (page index) or [chat-sdk.dev/llms-full.txt](https://chat-sdk.dev/llms-full.txt) (full text).

## License

MIT
