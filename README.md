# Chat SDK Wati Adapter

[![Agent Stack](https://img.shields.io/badge/Agent%20Stack-000?style=flat-square&logo=vercel&logoColor=FFF&labelColor=000&color=000)](https://vercel.com/kb/agent-stack)
[![WATI](https://img.shields.io/badge/WhatsApp%20Team%20Inbox-25D366?style=flat-square&logo=whatsapp&logoColor=white&labelColor=000&color=25D366)](https://docs.wati.io)
[![MIT License](https://img.shields.io/badge/License-MIT-000?style=flat-square&logo=opensourceinitiative&logoColor=white&labelColor=000&color=000)](LICENCE)

Chat SDK adapter for [Wati](https://docs.wati.io) (WhatsApp Team Inbox), built on the Wati WhatsApp Business API. **Write your bot logic once with Chat SDK, talk to WhatsApp users through Wati.**

## Installation

```bash
npm i chat
```

Install the Wati adapter:

```bash
npm install chat-adapter-wati
```

## CLI

Scaffold a minimal Next.js bot app with `create-chat-sdk`:

```bash
npx create-chat-sdk@latest my-bot
```

The CLI generates your `Chat` configuration, webhook route, `.env.example` file, dependencies, and optional Web adapter route from the adapter catalog. The Wati adapter is a community adapter, so add it manually after scaffolding:

```bash
npm install chat-adapter-wati
```

See the [CLI docs](https://chat-sdk.dev/docs/create-chat-sdk) for options and non-interactive usage.

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

bot.onDirectMessage(async (thread, message) => {
  await thread.post(`You said: ${message.text}`);
});
```

When calling `createWatiAdapter()` without arguments, credentials are auto-detected from `WATI_ACCESS_TOKEN`, `WATI_API_URL`, and `WATI_WEBHOOK_SECRET`. See the [package README](./packages/adapter-wati/README.md) for full configuration, webhook setup, and troubleshooting.

## Adapters

Browse official, vendor-official, and community adapters on [chat-sdk.dev/adapters](https://chat-sdk.dev/adapters). Learn how to [build your own adapter](https://chat-sdk.dev/docs/contributing/building).

## Features

- [**Event handlers**](https://chat-sdk.dev/docs/usage) — messages, actions, and button clicks through Chat SDK handlers
- [**AI streaming**](https://chat-sdk.dev/docs/streaming) — buffered LLM streaming with WhatsApp's 4096-character auto-chunking
- [**Cards**](https://chat-sdk.dev/docs/cards) — Chat SDK cards become Wati interactive button messages (≤3 buttons, 20-char titles) with formatted-text fallback
- [**Actions**](https://chat-sdk.dev/docs/actions) — handle button and list replies, with callback-token round-tripping
- [**Emoji**](https://chat-sdk.dev/docs/emoji) — type-safe, cross-platform emoji with WhatsApp placeholder conversion
- [**File uploads**](https://chat-sdk.dev/docs/files) — lazy inbound media downloads, multipart outbound uploads, URL and `fetchData()` attachments
- [**Direct messages**](https://chat-sdk.dev/docs/direct-messages) — implicit Wati DMs as `wati:{base64url(waId)}` threads, with BSUID support
- [**Message history**](https://chat-sdk.dev/docs/usage) — paginated server-side history via `fetchMessages`
- [**Templates**](https://chat-sdk.dev/docs/templates) — approved-template sends and scheduling with BSUID-aware recipients
- [**Management APIs**](https://chat-sdk.dev/docs/usage) — typed `adapter.v1`, `adapter.v2`, and `adapter.v3` namespaces covering Wati's full API index
- [**Webhooks**](https://chat-sdk.dev/docs/getting-started) — Message Received, `message_bsuid`, button/list replies, and reactions, with path-secret auth
- [**Overlapping messages**](https://chat-sdk.dev/docs/concurrency) — Chat SDK `channel` lock scope with queueing in your state adapter

## AI Coding Agents

If you use an AI coding agent such as OpenAI Codex, Claude Code, or Cursor, install the Chat SDK skill so it knows the SDK APIs, adapter patterns, and project conventions before writing code.

```bash
npx skills add vercel/chat
```

The skill references bundled documentation in `node_modules/chat/docs`, plus adapter guides and starter templates in the published package.

You can also install the [Vercel Plugin](https://vercel.com/plugin) for a broader agent toolkit. It includes the Chat SDK skill alongside specialist agents, slash commands, and more:

```bash
npx plugins add vercel/vercel-plugin
```

For agent-readable documentation, see [chat-sdk.dev/llms.txt](https://chat-sdk.dev/llms.txt) (page index), [chat-sdk.dev/llms-full.txt](https://chat-sdk.dev/llms-full.txt) (full text), and [docs.wati.io/llms.txt](https://docs.wati.io/llms.txt) (Wati endpoint index).

## Documentation

Full documentation is available at [chat-sdk.dev/docs](https://chat-sdk.dev/docs), the [Wati API reference](https://docs.wati.io/reference/introduction), and the [package README](./packages/adapter-wati/README.md). Guides are available in the [Vercel Knowledge Base](https://vercel.com/kb/chat-sdk).

## Contributing

This is a `bun` + `turbo` monorepo. Run `bun install` at the root, then use `bun run check`, `bun run typecheck`, and `bun run test` from `packages/adapter-wati`. Follow [Conventional Commits](https://www.conventionalcommits.org) per the repo's [commit instructions](./.github/commit-instructions.md).

## Support

For Chat SDK questions, see [chat-sdk.dev/support](https://chat-sdk.dev/support). For Wati platform questions, see the [Wati documentation](https://docs.wati.io). For issues with this adapter, open an issue in the [repository](https://github.com/krypt0nate/wati-adapter).

## License

MIT — see [LICENCE](./LICENCE).
