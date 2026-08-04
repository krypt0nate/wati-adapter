/**
 * Type definitions for the Wati WhatsApp adapter.
 *
 * Wati is a WhatsApp Business API platform. This file models the Wati API V3
 * endpoints (recommended) and webhook payloads used by the adapter.
 *
 * @see https://docs.wati.io/reference/introduction
 */

import type { Logger } from "chat";

// =============================================================================
// Configuration
// =============================================================================

/**
 * Wati adapter configuration.
 *
 * Wati APIs use Bearer Token authentication. Every API request must include a
 * valid API token in the HTTP `Authorization` header.
 *
 * @see https://docs.wati.io/reference/authentication
 */
export interface WatiAdapterConfig {
  /** Wati API access token. Defaults to the WATI_ACCESS_TOKEN env var. */
  accessToken?: string;
  /**
   * Wati API base URL, e.g. `https://live-mt-server-XXXXX.wati.io`.
   * Defaults to the WATI_API_URL env var.
   * @see https://docs.wati.io/reference/authentication
   */
  apiUrl?: string;
  /** Logger instance for error reporting */
  logger?: Logger;
  /** Bot display name used for identification */
  userName?: string;
  /** Secret used to verify incoming Wati webhook requests. Defaults to the WATI_WEBHOOK_SECRET env var. */
  webhookSecret?: string;
}

// =============================================================================
// Thread ID
// =============================================================================

/**
 * Decoded thread ID for Wati.
 *
 * Wati conversations are 1:1 between a business WhatsApp number and a user.
 * The thread is identified by the user's WhatsApp ID (waId), with the business
 * channel that received the message tracked separately.
 */
export interface WatiThreadId {
  /** User's WhatsApp ID (their phone number with country code) */
  waId: string;
}

// =============================================================================
// Message Types & Opaque Payloads
// =============================================================================

/**
 * Supported inbound message content types.
 *
 * @see https://docs.wati.io/reference/message-received
 */
export type WatiMessageType =
  | "audio"
  | "button"
  | "catalog"
  | "contacts"
  | "document"
  | "image"
  | "interactive"
  | "location"
  | "media_placeholder"
  | "order"
  | "reaction"
  | "sticker"
  | "text"
  | "video"
  | "voice"
  | string;

/**
 * Opaque payload used for message types whose shape is not modelled yet.
 *
 * Wati webhook events and contact objects are open-ended; unknown fields are
 * preserved rather than dropped.
 */
export type WatiOpaquePayload = Record<string, unknown>;

// =============================================================================
// Webhook Payloads
// =============================================================================

/**
 * "Message Received" webhook event.
 *
 * Fired when a customer sends a message to the business. The exact fields
 * present depend on the message type; unknown fields are preserved via the
 * index signature.
 *
 * @see https://docs.wati.io/reference/message-received
 */
export interface WatiMessageReceivedEvent {
  /** Unique identifier of the operator assigned to handle this conversation */
  assignedId?: string | null;
  /** URL to the sender's profile picture */
  avatarUrl?: string | null;
  /** Business Solution User ID — a stable cross-channel contact identifier. Only present when available. */
  bsuid?: string | null;
  /** Data for quick reply button responses */
  buttonReply?: WatiOpaquePayload | null;
  /** Identifier for the communication channel (multi-channel setup only) */
  channelId?: string | null;
  /** Phone number of the WhatsApp Business account receiving the message */
  channelPhoneNumber?: string | null;
  /** Unique identifier for the conversation thread */
  conversationId?: string | null;
  /** ISO 8601 timestamp when the message was created in the system */
  created?: string | null;
  /** Additional structured data for non-text message types */
  data?: WatiOpaquePayload | null;
  /** Type of event this record represents */
  eventType?: string | null;
  /** Indicates if this message was forwarded */
  forwarded?: boolean;
  /** WhatsApp flag indicating if the message has been forwarded multiple times */
  frequentlyForwarded?: boolean;
  /** Unique identifier for the message record */
  id: string;
  /** Data for interactive button replies */
  interactiveButtonReply?: WatiOpaquePayload | null;
  /** Data for list selection replies (WhatsApp interactive messages) */
  listReply?: WatiOpaquePayload | null;
  /** Contact information shared in the message (for contact message types) */
  messageContact?: WatiOpaquePayload | null;
  /** Email address of the assigned operator */
  operatorEmail?: string | null;
  /** Full name of the assigned operator */
  operatorName?: string | null;
  /** Indicates if the message was sent by the business owner */
  owner?: boolean;
  /** Parent BSUID — the enterprise-level identifier that groups related BSUIDs. Only present when available. */
  parentBsuid?: string | null;
  /** Reference ID for the message being replied to (empty if not a reply) */
  replyContextId?: string | null;
  /** Display name of the message sender */
  senderName?: string | null;
  /** Identifier for the message source (if applicable) */
  sourceId?: string | null;
  /** Numeric code indicating the message source type */
  sourceType?: number;
  /** URL reference for the message source (if applicable) */
  sourceUrl?: string | null;
  /** Current delivery status of the message (e.g. "SENT") */
  statusString?: string | null;
  /** The actual text content of the message (null for non-text messages) */
  text?: string | null;
  /** Unique identifier for the support ticket associated with this message */
  ticketId?: string | null;
  /** Unix timestamp when the message was sent */
  timestamp?: string | null;
  /** Type of message content */
  type?: WatiMessageType | null;
  /** Human-readable username handle for the contact (e.g. "@bob"). Only present when available. */
  username?: string | null;
  /** WhatsApp ID of the message sender */
  waId?: string | null;
  /** WhatsApp's unique message identifier (WAMID) */
  whatsappMessageId?: string | null;
  [key: string]: unknown;
}

/**
 * A conversation event returned by the conversation endpoints (Get messages,
 * Send message responses) and used as the message shape in API responses.
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-conversations-target-messages
 */
export interface WatiConversationEvent {
  /** The assigned operator ID */
  assigned_id?: string | null;
  /** The avatar URL of the sender */
  avatar_url?: string | null;
  /** The type of bot, if applicable */
  bot_type?: string | null;
  /** The associated conversation identifier */
  conversation_id?: string | null;
  /** The creation timestamp of the event */
  created?: string | null;
  /** The type of event (e.g. message, ticket, broadcast) */
  event_type?: string | null;
  /** Details of a failed message delivery, if any */
  failed_detail?: string | null;
  /** The unique identifier of the conversation event */
  id?: string | null;
  /** Display name of the operator who sent the message */
  operator_name?: string | null;
  /** Indicates whether the message was sent by the owner */
  owner?: boolean;
  /** The current status of the message */
  status?: string | null;
  /** The text content of the message */
  text?: string | null;
  /** The associated ticket identifier */
  ticket_id?: string | null;
  /** The timestamp string of the message */
  timestamp?: string | null;
  /** The message type */
  type?: WatiMessageType | null;
  [key: string]: unknown;
}

/**
 * Platform-specific raw message type for Wati.
 *
 * Wraps a webhook event together with the identity information the adapter
 * needs to route it to a thread.
 */
export interface WatiRawMessage {
  /** Phone number of the WhatsApp Business channel that received the message */
  channelPhoneNumber?: string;
  /** The raw webhook event or conversation event */
  event: WatiMessageReceivedEvent | WatiConversationEvent;
  /** WhatsApp ID of the contact (their phone number) */
  waId: string;
}

// =============================================================================
// Conversation API
// =============================================================================

/**
 * Response from sending a text, file, or interactive message to an active
 * conversation (V3).
 *
 * @see https://docs.wati.io/reference/post_api-ext-v3-conversations-messages-text
 */
export interface WatiMessageResponse {
  /** The conversation event created by the send */
  message?: WatiConversationEvent | null;
}

/**
 * Response from getting the message list of a conversation (V3).
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-conversations-target-messages
 */
export interface WatiGetMessagesResponse {
  /** The list of conversation messages */
  message_list?: WatiConversationEvent[] | null;
  /** The current page number (1-based) */
  page_number?: number;
  /** The number of items per page */
  page_size?: number;
}

// =============================================================================
// Interactive Messages
// =============================================================================

/**
 * Buttons message payload for sending to an active conversation (V3).
 *
 * @see https://docs.wati.io/reference/post_api-ext-v3-conversations-messages-interactive
 */
export interface WatiButtonMessage {
  /** The main body text of the message (up to 1024 chars) */
  body?: string;
  /** The list of up to three buttons (each up to 20 chars) */
  buttons: Array<{ text: string }>;
  /** The footer text of the message (up to 60 chars) */
  footer?: string;
  /** Header of the buttons message (up to 60 chars for text) */
  header?: {
    /** Header type, e.g. "text" or "image" */
    type?: string;
    /** Header text (up to 60 chars) */
    text?: string;
    /** Media used in the header, e.g. for image headers */
    media?: { url?: string; file_name?: string };
  };
}

/**
 * List message payload for sending to an active conversation (V3).
 *
 * @see https://docs.wati.io/reference/post_api-ext-v3-conversations-messages-interactive
 */
export interface WatiListMessage {
  /** The body text of the message (up to 1024 chars) */
  body?: string;
  /** Label of the button that opens the list */
  button_text?: string;
  /** The footer text of the message (up to 60 chars) */
  footer?: string;
  /** The header text (up to 60 chars) */
  header?: string;
  /** The list sections, each containing up to 10 rows */
  sections: Array<{
    /** Section title (up to 24 chars) */
    title?: string;
    /** Rows in the section (title up to 24 chars, description up to 72 chars) */
    rows: Array<{ title: string; description?: string }>;
  }>;
}

/**
 * Interactive message payload for sending buttons or lists (V3).
 *
 * @see https://docs.wati.io/reference/post_api-ext-v3-conversations-messages-interactive
 */
export type WatiInteractiveMessage =
  | { button_message: WatiButtonMessage; type: "buttons" }
  | { list_message: WatiListMessage; type: "list" };

// =============================================================================
// Template Messages
// =============================================================================

/**
 * A custom parameter substituted into a template message.
 */
export interface WatiTemplateParameter {
  /** The name of the template parameter (matches the placeholder) */
  name: string;
  /** The value to substitute */
  value: string;
}

/**
 * A pre-approved template message.
 *
 * Templates are the only message type Wati can send outside the 24-hour
 * customer service window, so they are required for business-initiated
 * conversations.
 *
 * @see https://docs.wati.io/reference/post_api-ext-v3-messagetemplates-send
 */
export interface WatiTemplateMessage {
  /** Name of the broadcast campaign created for this send */
  broadcastName?: string;
  /** Name of the approved template */
  name: string;
  /** Variable substitutions for the template's parameters */
  parameters?: WatiTemplateParameter[];
}

/**
 * Response from sending or scheduling template messages (V3).
 *
 * @see https://docs.wati.io/reference/post_api-ext-v3-messagetemplates-send
 */
export interface WatiTemplateSendResponse {
  /** The ID of the created broadcast */
  broadcast_id?: string | null;
  /** An error message, if any */
  error?: string | null;
  /** A list of results for each recipient */
  recipients?: Array<{
    /** The local message identifier echoed back */
    local_message_id?: string | null;
    /** The recipient's phone number */
    phone_number?: string | null;
    /** A list of errors encountered while sending, if any */
    errors?: string[] | null;
  }> | null;
  /** Indicates whether the operation was successful */
  success?: boolean;
}

/**
 * A single recipient of a template message send.
 *
 * Each recipient must provide at least one of `phone_number` or `target`.
 * `target` is a polymorphic identifier: a phone number, a contact ID, or a
 * BSUID.
 *
 * @see https://docs.wati.io/reference/bsuid-target-format
 */
export type WatiTemplateRecipient =
  | {
      /** The recipient's WhatsApp phone number */
      phone_number: string;
      target?: never;
      /** The local message identifier */
      local_message_id?: string;
      /** Custom parameters used in the template message */
      custom_params?: Array<{ name: string; value: string }>;
    }
  | {
      phone_number?: never;
      /** Polymorphic identifier: Phone Number, Contact ID, or BSUID */
      target: string;
      /** The local message identifier */
      local_message_id?: string;
      /** Custom parameters used in the template message */
      custom_params?: Array<{ name: string; value: string }>;
    };

/**
 * Request body for sending template messages to multiple recipients (V3).
 *
 * @see https://docs.wati.io/reference/post_api-ext-v3-messagetemplates-send
 */
export interface WatiTemplateSendRequest {
  /** The name of the broadcast to be created */
  broadcast_name: string;
  /** List of recipients (1 to 10,000 items) */
  recipients: WatiTemplateRecipient[];
  /** The name of the template to be used */
  template_name: string;
}

// =============================================================================
// API Paths & Pagination
// =============================================================================

/**
 * Wati API paths accepted by the adapter.
 *
 * API V3 (recommended) uses `/api/ext/v3/...`; some legacy V1 variants use
 * `/api/v1/...` and `/api/v2/...`.
 *
 * @see https://docs.wati.io/reference/introduction
 */
export type WatiApiPath =
  | `/api/ext/v3/${string}`
  | `/api/v1/${string}`
  | `/api/v2/${string}`;

/**
 * Pagination options for list endpoints.
 *
 * Both `page_number` and `page_size` are 1-based / count based, with
 * `page_size` capped at 100.
 */
export interface WatiPageOptions {
  /** Page number (1-based) */
  pageNumber?: number;
  /** Number of items per page (max 100) */
  pageSize?: number;
}

// =============================================================================
// Channels
// =============================================================================

/**
 * A WhatsApp channel (business phone number) in Wati.
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-channels
 */
export interface WatiChannel {
  /** The platform of the channel (e.g. "Whatsapp") */
  channel?: string | null;
  /** The identifier of the channel */
  id?: string | null;
  /** The custom name of the channel */
  name?: string | null;
}

/**
 * Response from getting the channels list (V3).
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-channels
 */
export interface WatiGetChannelsResponse {
  /** The list of channel info (excluding the default channel) */
  channels?: WatiChannel[] | null;
}

// =============================================================================
// Contacts
// =============================================================================

/**
 * A contact object returned by the Wati API (V3).
 *
 * The `phone` field is now nullable and `id` (contact ID) is always present.
 * Contact responses may also include `bsuid`, `parentBsuid`, and `username`
 * identifiers. Unknown fields are preserved via the index signature.
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-contacts
 */
export interface WatiContact {
  /** Indicates whether the contact allows broadcast messages */
  allow_broadcast?: boolean;
  /** Indicates whether the contact allows SMS messages */
  allow_sms?: boolean;
  /** Business Solution User ID — a stable cross-channel identifier */
  bsuid?: string | null;
  /** The identifier of the channel associated with the contact */
  channel_id?: string | null;
  /** The type of channel (e.g. whatsapp, instagram, messenger) */
  channel_type?: string | null;
  /** The current status of the contact */
  contact_status?: string | null;
  /** The date and time when the contact was created */
  created?: string | null;
  /** List of custom parameters associated with the contact */
  custom_params?: WatiTemplateParameter[] | null;
  /** The display name for the contact */
  display_name?: string | null;
  /** Unique identifier for the contact (always present) */
  id?: string | null;
  /** The date and time when the contact was last updated */
  last_updated?: string | null;
  /** The contact's name */
  name?: string | null;
  /** Indicates whether the contact has opted in for communications */
  opted_in?: boolean;
  /** Parent BSUID — the enterprise-level identifier */
  parentBsuid?: string | null;
  /** The contact's phone number (nullable; omitted when null) */
  phone?: string | null;
  /** URL or path to the contact's photo */
  photo?: string | null;
  /** List of segments the contact belongs to */
  segments?: string[] | null;
  /** The source where the contact originated from */
  source?: string | null;
  /** List of teams associated with the contact */
  teams?: string[] | null;
  /** Human-readable username handle for the contact */
  username?: string | null;
  /** WhatsApp identifier for the contact */
  wa_id?: string | null;
  [key: string]: unknown;
}

/**
 * Response from getting the contact list (V3).
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-contacts
 */
export interface WatiGetContactsResponse {
  /** The list of contacts */
  contact_list?: WatiContact[] | null;
  /** The current page number (1-based) */
  page_number?: number;
  /** The number of items per page */
  page_size?: number;
}

// =============================================================================
// Message Templates (read)
// =============================================================================

/**
 * A message template as returned by the template list endpoints (V3).
 *
 * Templates are pre-approved by Meta and used for business-initiated messages.
 * Unknown fields are preserved via the index signature.
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-messagetemplates
 */
export interface WatiMessageTemplate {
  /** The body content of the template */
  body?: string | null;
  /** The list of button components */
  buttons?: WatiOpaquePayload[] | null;
  /** The category of the template (e.g. MARKETING) */
  category?: string | null;
  /** The method used to create the template (e.g. HUMAN) */
  creation_method?: string | null;
  /** The list of custom parameters associated with this template */
  custom_params?: WatiTemplateParameter[] | null;
  /** The footer content of the template */
  footer?: string | null;
  /** The HSM (Highly Structured Message) content */
  hsm?: string | null;
  /** The unique identifier of the message template */
  id?: string | null;
  /** The language option for the template */
  language_option?: WatiOpaquePayload | null;
  /** The last modification date of the template */
  last_modified?: string | null;
  /** The name of the message template */
  name?: string | null;
  /** The quality rating of the template (e.g. GREEN) */
  quality?: string | null;
  /** The current status of the template (e.g. APPROVED) */
  status?: string | null;
  /** The subcategory of the template (e.g. STANDARD) */
  sub_category?: string | null;
  /** The type of the message template (e.g. TEXT) */
  type?: string | null;
  [key: string]: unknown;
}

/**
 * Options for getting message templates, including an optional channel.
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-messagetemplates
 */
export interface WatiGetMessageTemplatesOptions extends WatiPageOptions {
  /** Name or phone number of the channel (null for default channel) */
  channel?: string;
}

/**
 * Response from getting message templates (V3).
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-messagetemplates
 */
export interface WatiGetMessageTemplatesResponse {
  /** The current page number (1-based) */
  page_number?: number;
  /** The number of items per page */
  page_size?: number;
  /** The list of message templates */
  templates?: WatiMessageTemplate[] | null;
  /** The total number of message templates available */
  total?: number;
}

// =============================================================================
// Conversation Status
// =============================================================================

/**
 * Result of a boolean operation (e.g. updating conversation status).
 *
 * @see https://docs.wati.io/reference/put_api-ext-v3-conversations-target-status
 */
export interface WatiOperationResult {
  /** Whether the operation succeeded */
  result?: boolean;
}

/**
 * New status for a conversation.
 *
 * - `open`: the conversation is open and active
 * - `solved`: the conversation has been resolved
 * - `pending`: the conversation is pending further action
 * - `block`: the conversation is blocked
 *
 * @see https://docs.wati.io/reference/put_api-ext-v3-conversations-target-status
 */
export type WatiConversationStatus = "block" | "open" | "pending" | "solved";

// =============================================================================
// Schedule Templates
// =============================================================================

/**
 * Options for scheduling template messages (V3).
 *
 * @see https://docs.wati.io/reference/post_api-ext-v3-messagetemplates-schedule
 */
export interface WatiScheduleTemplateOptions extends WatiTemplateMessage {
  /** Name or phone number of the channel (null for default channel) */
  channel?: string;
  /** The scheduled time to send the template messages in UTC */
  scheduledAt: Date | string;
}

// =============================================================================
// Webhook Endpoints
// =============================================================================

/**
 * Status of a webhook endpoint.
 *
 * - `0`: Disabled
 * - `1`: Enabled
 * - `2`: Defective
 *
 * @see https://docs.wati.io/reference/post_api-v2-webhookendpoints
 */
export type WatiWebhookStatus = 0 | 1 | 2;

/**
 * Input for creating a webhook endpoint (V2).
 *
 * @see https://docs.wati.io/reference/post_api-v2-webhookendpoints
 */
export interface WatiWebhookEndpointInput {
  /** List of event types that will trigger this webhook (e.g. "message") */
  eventTypes: string[];
  /** Phone number of the channel to subscribe to */
  phoneNumber: string;
  /** Webhook status type: 0 = Disabled, 1 = Enabled, 2 = Defective */
  status: WatiWebhookStatus;
  /** Destination URL where webhook events will be delivered */
  url: string;
}

/**
 * A configured webhook endpoint as returned by the create webhooks endpoint.
 *
 * @see https://docs.wati.io/reference/post_api-v2-webhookendpoints
 */
export interface WatiWebhookEndpoint {
  /** Channel ID associated with this webhook */
  channelId?: string;
  /** Phone number of the channel for which this webhook is configured */
  channelPhoneNumber?: string;
  /** Creation timestamp of the webhook endpoint */
  created?: string;
  /** List of event types that will trigger this webhook */
  eventTypes?: string[];
  /** Number of consecutive failed attempts for this webhook */
  failedIterationCount?: number;
  /** Unique identifier of the webhook endpoint */
  id?: string;
  /** Indicates whether a failure notification has been sent */
  isSentNotify?: boolean;
  /** Last update timestamp of the webhook endpoint */
  lastUpdated?: string;
  /** Status code of the webhook endpoint (e.g. 0 for active) */
  status?: number;
  /** Tenant identifier that owns this webhook endpoint */
  tenantId?: string;
  /** Destination URL where webhook events will be delivered */
  url?: string;
}

/**
 * Response from creating webhook endpoints (V2).
 *
 * @see https://docs.wati.io/reference/post_api-v2-webhookendpoints
 */
export interface WatiCreateWebhooksResponse {
  /** Indicates whether webhook creation was successful */
  ok?: boolean;
  /** List of created or existing webhook endpoint configurations */
  result?: WatiWebhookEndpoint[];
}
