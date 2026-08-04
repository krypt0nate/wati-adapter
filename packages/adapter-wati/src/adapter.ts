/**
 * Wati adapter for the Chat SDK.
 *
 * Implements the {@link Adapter} contract for Wati's WhatsApp Business API.
 * Inbound webhook events are normalized into {@link Message}s, outbound
 * postables are rendered through the Wati markdown dialect and sent via the
 * v3 API namespaces, and media, templates, channels, contacts, and webhook
 * provisioning are exposed through the v1/v2/v3 API clients.
 *
 * @see https://docs.wati.io/reference/introduction
 */

import {
  AdapterError,
  AdapterRateLimitError,
  AuthenticationError,
  extractCard,
  extractFiles,
  extractPostableAttachments,
  NetworkError,
  PermissionError,
  type PlatformName,
  ResourceNotFoundError,
  toBuffer,
  ValidationError,
} from "@chat-adapter/shared";

import type {
  Adapter,
  AdapterPostableMessage,
  Attachment,
  Author,
  ChatInstance,
  EmojiValue,
  FetchOptions,
  FetchResult,
  FileUpload,
  FormattedContent,
  Logger,
  RawMessage,
  StreamChunk,
  StreamOptions,
  ThreadInfo,
  WebhookOptions,
} from "chat";

import { convertEmojiPlaceholders, getEmoji, Message } from "chat";

import { WatiV1Api, WatiV2Api, WatiV3Api } from "./api";
import { CALLBACK_TOKEN_PREFIX, cardToWati } from "./cards";
import { WatiFormatConverter } from "./markdown";
import {
  eventDate,
  extractText,
  inboundAuthor,
  inferMimeType,
  isAllowedApiPath,
  isBsuid,
  isRecord,
  normalizeBearerCredential,
  normalizeWebhookEvents,
  opaqueString,
  parsePageCursor,
  redactWatiApiPath,
  redactWatiErrorBody,
  splitWatiMessage,
  webhookPathSecret,
  webhookString,
} from "./shared";
import type {
  WatiAdapterConfig,
  WatiApiPath,
  WatiConversationEvent,
  WatiConversationStatus,
  WatiCreateWebhooksResponse,
  WatiGetChannelsResponse,
  WatiGetContactsResponse,
  WatiGetMessageTemplatesOptions,
  WatiGetMessageTemplatesResponse,
  WatiInteractiveMessage,
  WatiMessageReceivedEvent,
  WatiMessageResponse,
  WatiRawMessage,
  WatiScheduleTemplateOptions,
  WatiTemplateMessage,
  WatiTemplateSendRequest,
  WatiTemplateSendResponse,
  WatiThreadId,
  WatiWebhookEndpointInput,
} from "./types";

/** Platform name used by the shared buffer conversion utilities. */
const WATI_BUFFER_PLATFORM = "whatsapp" as PlatformName;
/** Trailing slashes stripped from the configured legacy API base URL. */
const TRAILING_SLASH_PATTERN = /\/+$/;
/** Leading `{` or `[` used to sniff JSON response bodies. */
const JSON_SNIFF_PATTERN = /^[[{]/;

/**
 * Wati adapter for the Chat SDK.
 *
 * Wati conversations are 1:1 between a business WhatsApp number and a user;
 * thread IDs encode the contact's `waId` as `wati:<waId>` (or a BSUID where
 * available). The adapter authenticates all API traffic with a Bearer token
 * and restricts outbound API paths to Wati's documented prefixes.
 */
export class WatiAdapter implements Adapter<WatiThreadId, WatiRawMessage> {
  /** Adapter name used by the Chat SDK. */
  readonly name = "wati";
  /** Conversations are locked per WhatsApp channel. */
  readonly lockScope = "channel" as const;
  /** Thread history is owned by the Wati platform, not the adapter. */
  readonly persistThreadHistory = false;
  /** Display name of the bot on Wati. */
  readonly userName: string;
  /** Client for the legacy `/api/v1` endpoints. */
  readonly v1: WatiV1Api;
  /** Client for the `/api/v2` endpoints. */
  readonly v2: WatiV2Api;
  /** Client for the recommended `/api/ext/v3` endpoints. */
  readonly v3: WatiV3Api;

  /** Bearer token used to authenticate API requests. */
  private readonly accessToken: string;
  /** Base URL for legacy v1/v2 requests. */
  private readonly legacyApiUrl: string;
  /** Base URL for v3 requests. */
  private readonly v3ApiUrl: string;
  /** Secret required to authenticate inbound webhooks. */
  private readonly webhookSecret: string;
  /** Logger instance, replaced by the Chat SDK's on initialize. */
  private logger: Logger;
  /** Converts between the Chat SDK AST and Wati's markdown dialect. */
  private readonly formatConverter = new WatiFormatConverter();
  /** Chat SDK instance, set during {@link initialize}. */
  private chat: ChatInstance | null = null;

  /**
   * @param config - Adapter configuration with all required fields resolved
   *   (accessToken, apiUrl, logger, userName, and webhookSecret).
   */
  constructor(
    config: WatiAdapterConfig & {
      accessToken: string;
      apiUrl: string;
      logger: Logger;
      userName: string;
      webhookSecret: string;
    }
  ) {
    this.accessToken = normalizeBearerCredential(config.accessToken);
    const configuredUrl = new URL(config.apiUrl);
    this.legacyApiUrl =
      `${configuredUrl.origin}${configuredUrl.pathname}`.replace(
        TRAILING_SLASH_PATTERN,
        ""
      );
    this.v3ApiUrl = configuredUrl.origin;
    this.webhookSecret = config.webhookSecret;
    this.userName = config.userName;
    this.logger = config.logger;
    const transport = {
      json: <T>(path: WatiApiPath, init?: RequestInit) =>
        this.requestApi<T>(path, init),
      raw: (path: WatiApiPath, init?: RequestInit) =>
        this.requestApiResponse(path, init),
    };
    this.v1 = new WatiV1Api(transport);
    this.v2 = new WatiV2Api(transport);
    this.v3 = new WatiV3Api(transport);
  }

  /** Bot user ID as reported by the Chat SDK. */
  get botUserId(): string {
    return this.userName;
  }

  /**
   * Bind the adapter to the Chat SDK instance.
   *
   * Switches to the SDK's logger when available.
   */
  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat;
    if (typeof chat.getLogger === "function") {
      this.logger = chat.getLogger("wati");
    }
    this.logger.info("WATI adapter initialized", {
      legacyApiUrl: this.legacyApiUrl,
      v3ApiUrl: this.v3ApiUrl,
    });
  }

  /**
   * Handle an inbound Wati webhook request.
   *
   * Authenticates the request via the `x-wati-webhook-secret` header or a
   * `/webhook/<secret>` path segment, normalizes the payload into message
   * events, and dispatches each one (skipping bot-owned messages). Returns
   * `405`/`401`/`400` responses for invalid requests and `200 ok` otherwise.
   */
  async handleWebhook(
    request: Request,
    options?: WebhookOptions
  ): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "POST" },
      });
    }

    const suppliedSecret =
      request.headers.get("x-wati-webhook-secret") ??
      webhookPathSecret(new URL(request.url).pathname);
    if (suppliedSecret !== this.webhookSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const events = normalizeWebhookEvents(parsed);
    for (const event of events) {
      if (!event.id || event.owner === true) {
        continue;
      }
      this.dispatchWebhookEvent(event, options);
    }

    return new Response("ok", { status: 200 });
  }

  /**
   * Send a postable message to a thread.
   *
   * Cards with no media are converted to Wati interactive buttons when they
   * fit the schema, otherwise to text. Mixed content (text/media/cards) is
   * sent as a text message followed by one file message per attachment.
   *
   * @throws {ValidationError} When the message has no sendable content.
   */
  async postMessage(
    threadId: string,
    message: AdapterPostableMessage
  ): Promise<RawMessage<WatiRawMessage>> {
    const { waId } = this.decodeThreadId(threadId);
    const media = [
      ...extractFiles(message),
      ...extractPostableAttachments(message),
    ];

    const card = extractCard(message);
    if (card && media.length === 0) {
      const converted = cardToWati(card);
      if (converted.type === "interactive") {
        return this.sendInteractive(threadId, waId, converted.interactive);
      }
      return this.sendText(threadId, waId, converted.text);
    }

    let result: RawMessage<WatiRawMessage> | undefined;
    const convertedCard = card ? cardToWati(card) : undefined;
    let text: string;
    if (convertedCard?.type === "text") {
      text = convertedCard.text;
    } else if (card) {
      text = "";
    } else {
      text = this.renderPostableText(message);
    }

    if (text) {
      result = await this.sendText(threadId, waId, text);
    }
    for (const item of media) {
      result = await this.sendFile(threadId, waId, item);
    }

    if (!result && card) {
      const converted = cardToWati(card);
      if (converted.type === "interactive") {
        result = await this.sendInteractive(
          threadId,
          waId,
          converted.interactive
        );
      }
    }

    if (!result) {
      throw new ValidationError("wati", "Message has no sendable content");
    }
    return result;
  }

  /**
   * Send a pre-approved template message.
   *
   * Builds a v3 template send request for the thread's `waId` (using a BSUID
   * `target` when the ID is one), with emoji placeholders converted to
   * WhatsApp format, and fails fast when the send reports per-recipient
   * errors.
   */
  async sendTemplate(
    threadId: string,
    template: WatiTemplateMessage
  ): Promise<RawMessage<WatiRawMessage>> {
    const { waId } = this.decodeThreadId(threadId);
    const localMessageId = crypto.randomUUID();
    const request: WatiTemplateSendRequest = {
      template_name: template.name,
      broadcast_name:
        template.broadcastName ?? `chat-sdk-${template.name}-${Date.now()}`,
      recipients: [
        {
          ...(isBsuid(waId) ? { target: waId } : { phone_number: waId }),
          local_message_id: localMessageId,
          ...(template.parameters?.length
            ? {
                custom_params: template.parameters.map((parameter) => ({
                  name: parameter.name,
                  value: convertEmojiPlaceholders(parameter.value, "whatsapp"),
                })),
              }
            : {}),
        },
      ],
    };
    const response = await this.v3.sendTemplateMessages(request);
    const errors = response.recipients?.[0]?.errors;
    if (response.success === false || errors?.length) {
      throw new AdapterError(
        `WATI template send failed: ${response.error ?? errors?.join(", ") ?? "unknown error"}`,
        "wati"
      );
    }
    return this.outboundRaw(threadId, waId, localMessageId, "template");
  }

  /** List WATI channels using the preferred v3 API. */
  async getChannels(options?: {
    pageNumber?: number;
    pageSize?: number;
  }): Promise<WatiGetChannelsResponse> {
    return this.v3.getChannels(options);
  }

  /** List contacts using the preferred v3 API. */
  async getContacts(options?: {
    pageNumber?: number;
    pageSize?: number;
  }): Promise<WatiGetContactsResponse> {
    return this.v3.getContacts(options);
  }

  /** List approved and pending message templates using the preferred v3 API. */
  async getMessageTemplates(
    options?: WatiGetMessageTemplatesOptions
  ): Promise<WatiGetMessageTemplatesResponse> {
    return this.v3.getMessageTemplates(options);
  }

  /** Assign a conversation to an operator, or to the bot when email is null. */
  async assignOperator(
    target: string,
    assigneeEmail: string | null
  ): Promise<{ result?: boolean }> {
    return this.v3.assignConversationOperator(
      this.resolveTarget(target),
      assigneeEmail
    );
  }

  /** Update a WATI conversation's ticket status using the preferred v3 API. */
  async updateConversationStatus(
    target: string,
    status: WatiConversationStatus
  ): Promise<{ result?: boolean }> {
    return this.v3.updateConversationStatus(this.resolveTarget(target), status);
  }

  /** Schedule a template through WATI's v3 broadcast scheduler. */
  async scheduleTemplate(
    threadId: string,
    template: WatiScheduleTemplateOptions
  ): Promise<WatiTemplateSendResponse> {
    const { waId } = this.decodeThreadId(threadId);
    const scheduledAt =
      template.scheduledAt instanceof Date
        ? template.scheduledAt
        : new Date(template.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new ValidationError("wati", "scheduledAt must be a valid date");
    }
    const request = {
      ...(template.channel ? { channel: template.channel } : {}),
      template_name: template.name,
      broadcast_name:
        template.broadcastName ?? `chat-sdk-${template.name}-${Date.now()}`,
      scheduled_at: scheduledAt.toISOString(),
      recipients: [
        {
          ...(isBsuid(waId) ? { target: waId } : { phone_number: waId }),
          local_message_id: crypto.randomUUID(),
          ...(template.parameters?.length
            ? { custom_params: template.parameters }
            : {}),
        },
      ],
    };
    return this.v3.scheduleTemplateMessages(request);
  }

  /**
   * Create or update webhook endpoints through WATI's v2 management API.
   *
   * WATI does not currently expose webhook provisioning in v3. Validates that
   * at least one endpoint is provided, each has a phone number and event
   * types, and URLs are HTTPS.
   */
  async createWebhooks(
    endpoints: WatiWebhookEndpointInput[]
  ): Promise<WatiCreateWebhooksResponse> {
    if (endpoints.length === 0) {
      throw new ValidationError(
        "wati",
        "At least one webhook endpoint is required"
      );
    }
    for (const endpoint of endpoints) {
      if (!(endpoint.phoneNumber && endpoint.eventTypes.length)) {
        throw new ValidationError(
          "wati",
          "Each webhook requires a phoneNumber and at least one event type"
        );
      }
      let url: URL;
      try {
        url = new URL(endpoint.url);
      } catch {
        throw new ValidationError("wati", "Webhook URLs must be valid URLs");
      }
      if (url.protocol !== "https:") {
        throw new ValidationError("wati", "Webhook URLs must use HTTPS");
      }
    }
    return this.v2.createWebhookEndpoints(endpoints);
  }

  /**
   * Fetch the message history of a conversation.
   *
   * Cursors are 1-based page numbers; a `nextCursor` is returned when the
   * page is full. Messages are sorted by send time ascending.
   */
  async fetchMessages(
    threadId: string,
    options?: FetchOptions
  ): Promise<FetchResult<WatiRawMessage>> {
    const { waId } = this.decodeThreadId(threadId);
    const pageNumber = parsePageCursor(options?.cursor);
    const pageSize = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    const response = await this.v3.getConversationMessages(waId, {
      pageNumber,
      pageSize,
    });
    const events = response.message_list ?? [];
    const messages = events
      .map((event) => this.parseMessage({ event, waId }))
      .sort(
        (left, right) =>
          left.metadata.dateSent.getTime() - right.metadata.dateSent.getTime()
      );

    return {
      messages,
      ...(events.length === pageSize
        ? { nextCursor: String(pageNumber + 1) }
        : {}),
    };
  }

  /**
   * Fetch thread metadata.
   *
   * Wati conversations are always 1:1 DMs, so the thread is described as a
   * DM against the encoded thread ID.
   */
  async fetchThread(threadId: string): Promise<ThreadInfo> {
    const { waId } = this.decodeThreadId(threadId);
    return {
      id: threadId,
      channelId: threadId,
      channelName: `WATI: ${waId}`,
      isDM: true,
      metadata: { waId },
    };
  }

  /** Open a DM with a user by encoding their WhatsApp ID as a thread ID. */
  async openDM(userId: string): Promise<string> {
    return this.encodeThreadId({ waId: userId });
  }

  /**
   * Encode a thread ID as `wati:<waId>`.
   *
   * @throws {ValidationError} When the `waId` is empty or contains a colon.
   */
  encodeThreadId(data: WatiThreadId): string {
    const waId = data.waId.trim();
    if (!waId || waId.includes(":")) {
      throw new ValidationError("wati", `Invalid WATI user ID: ${data.waId}`);
    }
    return `wati:${waId}`;
  }

  /**
   * Decode a `wati:<waId>` thread ID.
   *
   * @throws {ValidationError} When the thread ID is not prefixed with `wati:`
   *   or the encoded `waId` is empty or contains a colon.
   */
  decodeThreadId(threadId: string): WatiThreadId {
    if (!threadId.startsWith("wati:")) {
      throw new ValidationError("wati", `Invalid WATI thread ID: ${threadId}`);
    }
    const waId = threadId.slice("wati:".length);
    if (!waId || waId.includes(":")) {
      throw new ValidationError("wati", `Invalid WATI thread ID: ${threadId}`);
    }
    return { waId };
  }

  /** Return the thread ID as the channel ID (each thread is its own channel). */
  channelIdFromThreadId(threadId: string): string {
    this.decodeThreadId(threadId);
    return threadId;
  }

  /** Wati conversations are always DMs. */
  isDM(threadId: string): boolean {
    this.decodeThreadId(threadId);
    return true;
  }

  /**
   * Parse a raw Wati message into a Chat SDK {@link Message}.
   *
   * Determines the author from the event's `owner` flag, extracts text via
   * {@link extractText}, converts it to the canonical AST, and attaches any
   * media attachments.
   */
  parseMessage(raw: WatiRawMessage): Message<WatiRawMessage> {
    const event = raw.event;
    const owner = event.owner === true;
    const text = extractText(event);
    const author: Author = owner
      ? {
          userId: this.userName,
          userName: this.userName,
          fullName: this.userName,
          isBot: true,
          isMe: true,
        }
      : {
          userId: raw.waId,
          userName: webhookString(event, "username") ?? raw.waId,
          fullName:
            webhookString(event, "senderName") ??
            webhookString(event, "operator_name") ??
            raw.waId,
          isBot: false,
          isMe: false,
        };

    return new Message<WatiRawMessage>({
      id: event.id ?? crypto.randomUUID(),
      threadId: this.encodeThreadId({ waId: raw.waId }),
      text,
      formatted: this.formatConverter.toAst(text),
      author,
      metadata: { dateSent: eventDate(event), edited: false },
      attachments: this.buildAttachments(event),
      raw,
    });
  }

  /** Render formatted content (AST) to Wati's markdown dialect. */
  renderFormatted(content: FormattedContent): string {
    return this.formatConverter.fromAst(content);
  }

  /**
   * Stream a response into a thread.
   *
   * Collects all string and `markdown_text` chunks and posts the combined
   * text as a single message (split into chunks if it exceeds WhatsApp's
   * length limit).
   */
  async stream(
    threadId: string,
    textStream: AsyncIterable<string | StreamChunk>,
    _options?: StreamOptions
  ): Promise<RawMessage<WatiRawMessage>> {
    let text = "";
    for await (const chunk of textStream) {
      if (typeof chunk === "string") {
        text += chunk;
      } else if (chunk.type === "markdown_text") {
        text += chunk.text;
      }
    }
    return this.postMessage(threadId, { markdown: text });
  }

  /**
   * Editing sent messages is not supported by Wati.
   *
   * @throws {ValidationError} Always.
   */
  async editMessage(
    _threadId: string,
    _messageId: string,
    _message: AdapterPostableMessage
  ): Promise<RawMessage<WatiRawMessage>> {
    throw new ValidationError(
      "wati",
      "WATI API v3 does not support editing sent messages."
    );
  }

  /**
   * Deleting sent messages is not supported by Wati.
   *
   * @throws {ValidationError} Always.
   */
  async deleteMessage(_threadId: string, _messageId: string): Promise<void> {
    throw new ValidationError(
      "wati",
      "WATI API v3 does not support deleting sent messages."
    );
  }

  /** Wati does not expose outbound reactions; logs a warning instead. */
  async addReaction(
    _threadId: string,
    _messageId: string,
    _emoji: EmojiValue | string
  ): Promise<void> {
    this.logger.warn("WATI API v3 does not expose outbound reactions");
  }

  /** Wati does not expose outbound reactions; logs a warning instead. */
  async removeReaction(
    _threadId: string,
    _messageId: string,
    _emoji: EmojiValue | string
  ): Promise<void> {
    this.logger.warn("WATI API v3 does not expose outbound reactions");
  }

  /** Wati does not expose typing indicators; logs a debug message instead. */
  async startTyping(threadId: string, _status?: string): Promise<void> {
    this.logger.debug("WATI API v3 does not expose typing indicators", {
      threadId,
    });
  }

  /** Wati does not expose mark-as-read; logs a debug message instead. */
  async markAsRead(messageId: string): Promise<void> {
    this.logger.debug("WATI API v3 does not expose mark-as-read", {
      messageId,
    });
  }

  /**
   * Download a media file by message ID.
   *
   * @returns The raw media bytes as a Buffer.
   */
  async downloadMedia(messageId: string): Promise<Buffer> {
    const response = await this.v3.getMessageFile(messageId);
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Rehydrate an attachment with a fresh download function.
   *
   * Attachments fetched in a previous process are re-bound to
   * {@link downloadMedia} using their stored message ID.
   */
  rehydrateAttachment(attachment: Attachment): Attachment {
    const messageId = attachment.fetchMetadata?.messageId;
    if (!messageId) {
      return attachment;
    }
    return {
      ...attachment,
      fetchData: () => this.downloadMedia(messageId),
    };
  }

  /**
   * Authenticated escape hatch for documented WATI v1, v2, and v3 endpoints.
   *
   * Only relative WATI API paths are accepted so the bearer token cannot be
   * forwarded to another origin. JSON responses (by content type or leading
   * brace/bracket) are parsed; empty bodies resolve to `undefined`.
   */
  async requestApi<T = unknown>(
    path: WatiApiPath,
    init?: RequestInit
  ): Promise<T> {
    const response = await this.requestApiResponse(path, init);
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("json") || JSON_SNIFF_PATTERN.test(text.trim())) {
      return JSON.parse(text) as T;
    }
    return text as T;
  }

  /**
   * Raw-response variant for binary media, CSV, and other non-JSON APIs.
   *
   * Validates the path prefix and sets a JSON content type for JSON bodies
   * that do not declare one (except multipart form data).
   */
  async requestApiResponse(
    path: WatiApiPath,
    init?: RequestInit
  ): Promise<Response> {
    if (!isAllowedApiPath(path)) {
      throw new ValidationError(
        "wati",
        "API path must start with /api/v1/, /api/v2/, or /api/ext/v3/"
      );
    }
    const headers = new Headers(init?.headers);
    if (
      init?.body &&
      !(init.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }
    return this.fetchApi(path, { ...init, headers });
  }

  /**
   * Dispatch a webhook event to the Chat SDK.
   *
   * Ignores non-message events and messages without a `waId`/BSUID. Button
   * replies are deduplicated and processed as actions (preserving callback
   * tokens verbatim); reactions are processed as reactions; everything else
   * is processed as a message. Uses `waitUntil` when provided.
   */
  private dispatchWebhookEvent(
    event: WatiMessageReceivedEvent,
    options?: WebhookOptions
  ): void {
    if (!this.chat) {
      this.logger.warn("WATI webhook received before adapter initialization");
      return;
    }
    if (event.eventType && !event.eventType.startsWith("message")) {
      return;
    }

    const waId =
      event.eventType === "message_bsuid"
        ? (event.bsuid ?? event.waId)
        : (event.waId ?? event.bsuid);
    if (!waId) {
      this.logger.warn("WATI message has no waId or BSUID", {
        messageId: event.id,
      });
      return;
    }
    const threadId = this.encodeThreadId({ waId });
    const reply =
      event.interactiveButtonReply ?? event.listReply ?? event.buttonReply;
    if (reply) {
      const actionId =
        opaqueString(reply, "id", "payload", "title", "text") ?? "wati_action";
      const value = actionId.startsWith(CALLBACK_TOKEN_PREFIX)
        ? actionId
        : (opaqueString(reply, "title", "text", "description", "id") ??
          actionId);
      const chat = this.chat;
      const task = (async () => {
        const isFirst = await chat
          .getState()
          .setIfNotExists(
            `dedupe:wati:action:${event.id}`,
            true,
            7 * 24 * 60 * 60 * 1000
          );
        if (!isFirst) {
          return;
        }
        await chat.processAction(
          {
            adapter: this,
            actionId,
            value,
            user: inboundAuthor(event, waId),
            messageId: event.id,
            threadId,
            raw: {
              event,
              waId,
              channelPhoneNumber: event.channelPhoneNumber ?? undefined,
            },
          },
          undefined
        );
      })().catch((error) =>
        this.logger.error("Failed to process WATI action", {
          error,
          messageId: event.id,
        })
      );
      if (options?.waitUntil) {
        options.waitUntil(task);
      }
      return;
    }

    if (event.type === "reaction" && event.data) {
      const rawEmoji = opaqueString(event.data, "emoji", "reaction") ?? "";
      const messageId =
        opaqueString(event.data, "messageId", "message_id", "id") ??
        event.replyContextId;
      if (messageId) {
        this.chat.processReaction(
          {
            adapter: this,
            emoji: getEmoji(rawEmoji),
            rawEmoji,
            added: rawEmoji !== "",
            user: inboundAuthor(event, waId),
            messageId,
            threadId,
            raw: { event, waId },
          },
          options
        );
      }
      return;
    }

    const raw: WatiRawMessage = {
      event,
      waId,
      ...(event.channelPhoneNumber
        ? { channelPhoneNumber: event.channelPhoneNumber }
        : {}),
    };
    this.chat
      .processMessage(this, threadId, this.parseMessage(raw), options)
      .catch((error) =>
        this.logger.error("Failed to process WATI message", {
          error,
          messageId: event.id,
        })
      );
  }

  /**
   * Send a text message, splitting content that exceeds WhatsApp's length
   * limit into multiple messages.
   *
   * @returns The raw message of the last chunk sent.
   */
  private async sendText(
    threadId: string,
    waId: string,
    text: string
  ): Promise<RawMessage<WatiRawMessage>> {
    let result: RawMessage<WatiRawMessage> | undefined;
    for (const chunk of splitWatiMessage(
      convertEmojiPlaceholders(text, "whatsapp")
    )) {
      const response = await this.v3.sendTextMessage(waId, chunk);
      result = this.responseRaw(threadId, waId, response, "text", chunk);
    }
    return result as RawMessage<WatiRawMessage>;
  }

  /** Send an interactive buttons/list message to an active conversation. */
  private async sendInteractive(
    threadId: string,
    waId: string,
    interactive: WatiInteractiveMessage
  ): Promise<RawMessage<WatiRawMessage>> {
    const response = await this.v3.sendInteractiveMessage(waId, interactive);
    return this.responseRaw(threadId, waId, response, "interactive");
  }

  /** Resolve and upload a file message to an active conversation. */
  private async sendFile(
    threadId: string,
    waId: string,
    item: FileUpload | Attachment
  ): Promise<RawMessage<WatiRawMessage>> {
    const file = await this.resolveFile(item);
    const response = await this.v3.sendFileMessage(
      waId,
      new Blob([new Uint8Array(file.data)], { type: file.mimeType }),
      file.filename
    );
    return this.responseRaw(threadId, waId, response, "document");
  }

  /**
   * Resolve a file upload or attachment into buffer data.
   *
   * Uploads use their inline data; attachments prefer inline data, then
   * `fetchData`, then download from `url`. MIME types are inferred from the
   * file name when not provided.
   *
   * @throws {ValidationError} When the file data is empty or unavailable.
   * @throws {NetworkError} When downloading an attachment URL fails.
   */
  private async resolveFile(
    item: FileUpload | Attachment
  ): Promise<{ data: Buffer; filename: string; mimeType: string }> {
    if ("filename" in item) {
      const data = await toBuffer(item.data, {
        platform: WATI_BUFFER_PLATFORM,
      });
      if (!data) {
        throw new ValidationError("wati", "File data is empty");
      }
      return {
        data,
        filename: item.filename,
        mimeType: item.mimeType ?? inferMimeType(item.filename),
      };
    }

    let input =
      item.data ?? (item.fetchData ? await item.fetchData() : undefined);
    if (!input && item.url) {
      let response: Response;
      try {
        response = await fetch(item.url);
      } catch (cause) {
        throw new NetworkError(
          "wati",
          `Failed to download attachment URL: ${item.url}`,
          cause instanceof Error ? cause : undefined
        );
      }
      if (!response.ok) {
        throw new NetworkError(
          "wati",
          `Failed to download attachment URL: ${response.status}`
        );
      }
      input = Buffer.from(await response.arrayBuffer());
    }
    if (!input) {
      throw new ValidationError(
        "wati",
        "Attachment requires data, fetchData, or a URL"
      );
    }
    const data = await toBuffer(input, { platform: WATI_BUFFER_PLATFORM });
    if (!data) {
      throw new ValidationError("wati", "Attachment data is empty");
    }
    const filename = item.name ?? "attachment";
    return {
      data,
      filename,
      mimeType: item.mimeType ?? inferMimeType(filename),
    };
  }

  /**
   * Build attachment metadata for a media webhook event.
   *
   * Only audio, document, image, sticker, video, and voice events with an ID
   * produce attachments; the attachment type is mapped from the event type.
   */
  private buildAttachments(
    event: WatiMessageReceivedEvent | WatiConversationEvent
  ): Attachment[] {
    const type = event.type;
    if (
      !(
        event.id &&
        type &&
        ["audio", "document", "image", "sticker", "video", "voice"].includes(
          type
        )
      )
    ) {
      return [];
    }
    const data =
      "data" in event && isRecord(event.data) ? event.data : undefined;
    const mimeType = data
      ? opaqueString(data, "mimeType", "mime_type")
      : undefined;
    const name = data
      ? opaqueString(data, "fileName", "filename", "name")
      : undefined;
    let attachmentType: Attachment["type"] = "file";
    if (type === "image" || type === "sticker") {
      attachmentType = "image";
    } else if (type === "video") {
      attachmentType = "video";
    } else if (type === "audio" || type === "voice") {
      attachmentType = "audio";
    }
    return [
      {
        type: attachmentType,
        ...(mimeType ? { mimeType } : {}),
        ...(name ? { name } : {}),
        fetchMetadata: { messageId: event.id },
        fetchData: () => this.downloadMedia(event.id as string),
      },
    ];
  }

  /**
   * Render a postable to Wati markdown text.
   *
   * Strings pass through; raw, markdown, and AST postables go through the
   * format converter; other postable shapes render as empty.
   */
  private renderPostableText(message: AdapterPostableMessage): string {
    if (typeof message === "string") {
      return message;
    }
    if ("raw" in message || "markdown" in message || "ast" in message) {
      return this.formatConverter.renderPostable(message);
    }
    return "";
  }

  /**
   * Build an outbound raw message from a Wati send response.
   *
   * @throws {AdapterError} When the API response contains no message ID.
   */
  private responseRaw(
    threadId: string,
    waId: string,
    response: WatiMessageResponse,
    type: string,
    text?: string
  ): RawMessage<WatiRawMessage> {
    const event = response.message;
    if (!event?.id) {
      throw new AdapterError("WATI API did not return a message ID", "wati");
    }
    return {
      id: event.id,
      threadId,
      raw: {
        waId,
        event: {
          ...event,
          type: event.type ?? type,
          text: event.text ?? text,
          owner: true,
        },
      },
    };
  }

  /**
   * Build an outbound raw message for sends without a Wati response event
   * (e.g. template sends), using the local message ID.
   */
  private outboundRaw(
    threadId: string,
    waId: string,
    id: string,
    type: string
  ): RawMessage<WatiRawMessage> {
    return {
      id,
      threadId,
      raw: {
        waId,
        event: {
          id,
          type,
          owner: true,
          created: new Date().toISOString(),
        },
      },
    };
  }

  /** Strip a `wati:` prefix from a target when present. */
  private resolveTarget(target: string): string {
    return target.startsWith("wati:")
      ? this.decodeThreadId(target).waId
      : target;
  }

  /**
   * Perform an authenticated Wati API fetch.
   *
   * Selects the base URL by API version, attaches the Bearer token, redacts
   * secrets from logs, and maps HTTP errors onto the Chat SDK error types
   * (401 auth, 403 permission, 404 not found, 429 rate limit).
   *
   * @throws {NetworkError} When the request cannot be completed.
   * @throws {AuthenticationError | PermissionError | ResourceNotFoundError |
   *   AdapterRateLimitError | AdapterError} For non-OK responses.
   */
  private async fetchApi(path: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${this.accessToken}`);
    const baseUrl = path.startsWith("/api/ext/v3/")
      ? this.v3ApiUrl
      : this.legacyApiUrl;
    const safePath = redactWatiApiPath(path);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    } catch (cause) {
      this.logger.error("WATI API network error", {
        path: safePath,
        error: cause instanceof Error ? cause.message : String(cause),
      });
      throw new NetworkError(
        "wati",
        `Failed to reach WATI API: ${safePath}`,
        cause instanceof Error ? cause : undefined
      );
    }
    if (!response.ok) {
      const body = await response.text();
      const safeBody = redactWatiErrorBody(body);
      this.logger.error("WATI API error", {
        status: response.status,
        body: safeBody,
        path: safePath,
      });
      const message = `WATI API error: ${response.status}${safeBody ? ` ${safeBody}` : ""}`;
      switch (response.status) {
        case 401:
          throw new AuthenticationError("wati", message);
        case 403:
          throw new PermissionError("wati", message);
        case 404:
          throw new ResourceNotFoundError(
            "wati",
            "WATI API resource",
            safePath
          );
        case 429: {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfter = retryAfterHeader
            ? Number(retryAfterHeader)
            : undefined;
          throw new AdapterRateLimitError(
            "wati",
            Number.isFinite(retryAfter) ? retryAfter : undefined
          );
        }
        default:
          throw new AdapterError(message, "wati");
      }
    }
    return response;
  }
}
