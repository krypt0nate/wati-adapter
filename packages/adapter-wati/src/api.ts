/**
 * Namespaced clients for the Wati REST API.
 *
 * Three namespaces mirror the three API versions documented by Wati:
 *
 * - {@link WatiV1Api} — the legacy `/api/v1/...` endpoints
 * - {@link WatiV2Api} — updated variants within V1, using `/api/v2/...`
 * - {@link WatiV3Api} — the recommended `/api/ext/v3/...` endpoints
 *
 * All requests are authenticated with a Bearer token via the injected
 * {@link WatiApiTransport}.
 *
 * @see https://docs.wati.io/reference/introduction
 */

import {
  appendQuery,
  encodePath,
  jsonRequest,
  targetQuery,
  toIso,
  type WatiApiTransport,
  type WatiLegacyTarget,
} from "./shared";

import type {
  WatiApiPath,
  WatiContact,
  WatiConversationStatus,
  WatiCreateWebhooksResponse,
  WatiGetChannelsResponse,
  WatiGetContactsResponse,
  WatiGetMessagesResponse,
  WatiGetMessageTemplatesOptions,
  WatiGetMessageTemplatesResponse,
  WatiInteractiveMessage,
  WatiMessageResponse,
  WatiMessageTemplate,
  WatiOpaquePayload,
  WatiPageOptions,
  WatiTemplateParameter,
  WatiTemplateSendRequest,
  WatiTemplateSendResponse,
  WatiWebhookEndpointInput,
} from "./types";

// =============================================================================
// V1 Request Types
// =============================================================================

/**
 * Input for creating a new contact (V1).
 *
 * @see https://docs.wati.io/reference/post_api-v1-addcontact-whatsappnumber
 */
export interface WatiV1ContactInput {
  /** Custom parameters stored on the contact */
  customParams?: WatiTemplateParameter[];
  /** The contact's display name */
  name?: string;
}

/**
 * Contact update targeting a single contact (V1).
 *
 * Combines a {@link WatiLegacyTarget} selector with the custom parameters to
 * write. Unknown fields pass through via {@link WatiOpaquePayload}.
 *
 * @see https://docs.wati.io/reference/post_api-v1-updatecontactattributes-whatsappnumber
 */
export type WatiV1ContactUpdate = WatiOpaquePayload &
  WatiLegacyTarget & { customParams: WatiTemplateParameter[] };

/**
 * Body for sending a single template message (V1).
 *
 * @see https://docs.wati.io/reference/post_api-v1-sendtemplatemessage
 */
export interface WatiV1TemplateSendBody {
  /** The name of the broadcast to be created */
  broadcast_name: string;
  /** The channel number to send from */
  channel_number: string;
  /** Variable substitutions for the template's parameters */
  parameters: WatiTemplateParameter[];
  /** Name of the approved template */
  template_name: string;
}

/**
 * A single receiver in a bulk template send (V1).
 *
 * Combines a {@link WatiLegacyTarget} selector with per-recipient custom
 * parameters. Unknown fields pass through via {@link WatiOpaquePayload}.
 *
 * @see https://docs.wati.io/reference/post_api-v1-sendtemplatemessages
 */
export type WatiV1TemplateReceiver = WatiOpaquePayload &
  WatiLegacyTarget & { customParams: WatiTemplateParameter[] };

/**
 * Interactive list message payload (V1).
 *
 * @see https://docs.wati.io/reference/post_api-v1-sendinteractivelistmessage
 */
export interface WatiV1InteractiveListMessage {
  /** The body text of the message */
  body?: string;
  /** Label of the button that opens the list */
  buttonText?: string;
  /** The footer text of the message */
  footer?: string;
  /** The header text of the message */
  header?: string;
  /** The list sections */
  sections?: Array<{
    /** Rows in the section */
    rows?: Array<{ description?: string; title?: string }>;
    /** Section title */
    title?: string;
  }>;
}

/**
 * Interactive buttons message payload (V1).
 *
 * @see https://docs.wati.io/reference/post_api-v1-sendinteractivebuttonsmessage
 */
export interface WatiV1InteractiveButtonsMessage {
  /** The main body text of the message */
  body?: string;
  /** The list of up to three buttons */
  buttons?: Array<{ text?: string }>;
  /** The footer text of the message */
  footer?: string;
  /** Header of the buttons message */
  header?: {
    /** Media used in the header, e.g. for image headers */
    media?: { fileName?: string; url?: string };
    /** Header text */
    text?: string;
    /** Header type, e.g. "text" or "image" */
    type?: string;
  };
}

/**
 * Body for updating a conversation's chat status (V1).
 *
 * Combines a {@link WatiLegacyTarget} selector with the new ticket status.
 *
 * @see https://docs.wati.io/reference/post_api-v1-updatechatstatus
 */
export type WatiV1ChatStatusRequest = WatiOpaquePayload &
  WatiLegacyTarget & {
    /** Phone number of the channel the conversation belongs to */
    channelPhoneNumber: string;
    /** New status for the conversation ticket */
    ticketStatus: "BLOCK" | "OPEN" | "PENDING" | "SOLVED";
  };

/**
 * Input for creating a custom segment (V1).
 *
 * Segments group contacts by attribute conditions or uploaded contact lists.
 *
 * @see https://docs.wati.io/reference/create-custom-segment
 */
export interface WatiV1CustomSegmentInput {
  /** Contact IDs to include in the segment */
  contactIds?: string[];
  /** Segment rules based on contact attributes */
  groups?: Array<{
    conditions: Array<{ attribute: string; operator: string; value: unknown }>;
  }>;
  /** The segment name */
  name: string;
  /** How the segment is refreshed: 1 = automatic, 2 = manual */
  refreshType: 1 | 2;
  /** Use an uploaded contact list instead of conditions */
  useUploadedContact?: boolean;
}

/**
 * Input for enabling broadcast auto-retry (V1).
 *
 * Exactly one of `retryDays` or `retryUntil` must be provided. Retries only
 * apply to contacts failing with error code "131049 - Meta chose not to
 * deliver".
 *
 * @see https://docs.wati.io/reference/enable-auto-retry
 */
export type WatiV1AutoRetryInput =
  | { retryDays: "1" | "2" | "3" | "4" | "5" | "6" | "7"; retryUntil?: never }
  | { retryDays?: never; retryUntil: string };

// =============================================================================
// V2 Request Types
// =============================================================================

/**
 * Query options for listing message templates (V2).
 *
 * @see https://docs.wati.io/reference/get_api-v2-getmessagetemplates
 */
export interface WatiV2TemplateQuery extends WatiPageOptions {
  /** Filter templates by name */
  name?: string;
  /** Filter templates by WABA ID */
  wabaId?: string;
}

/**
 * Body for sending a single template message (V2).
 *
 * Identical to {@link WatiV1TemplateSendBody}; aliased to keep a single
 * definition.
 *
 * @see https://docs.wati.io/reference/post_api-v2-sendtemplatemessage
 */
export type WatiV2TemplateSendBody = WatiV1TemplateSendBody;

/**
 * A single receiver in a bulk template send (V2).
 *
 * Combines a {@link WatiLegacyTarget} selector with per-recipient custom
 * parameters and a local message ID for delivery correlation.
 *
 * @see https://docs.wati.io/reference/post_api-v2-sendtemplatemessages
 */
export type WatiV2TemplateReceiver = WatiOpaquePayload &
  WatiLegacyTarget & {
    customParams: WatiTemplateParameter[];
    /** Client-side identifier echoed in the send response */
    localMessageId: string;
  };

/**
 * Body for sending template messages to multiple receivers (V2).
 *
 * @see https://docs.wati.io/reference/post_api-v2-sendtemplatemessages
 */
export interface WatiV2BatchTemplateSendBody {
  /** The name of the broadcast to be created */
  broadcast_name: string;
  /** The channel number to send from */
  channel_number: string;
  /** List of receivers */
  receivers: WatiV2TemplateReceiver[];
  /** Name of the approved template */
  template_name: string;
}

/**
 * A WhatsApp phone number linked to the account (V2).
 *
 * @see https://docs.wati.io/reference/get_api-v2-whatsapp-phonenumbers
 */
export interface WatiV2PhoneNumber {
  /** Meta Business Manager ID */
  bmId?: string;
  /** Channel ID, if any (shape depends on the channel type) */
  channelId?: unknown;
  /** The custom channel name */
  channelName?: string;
  /** Numeric code for the channel type */
  channelType?: number;
  /** Numeric code for the embedded signup type */
  embeddedSignupType?: number;
  /** The WhatsApp phone number */
  phoneNumber?: string;
  /** The WhatsApp phone number ID */
  phoneNumberId?: string;
  /** WABA context ID, if any */
  wabaContextId?: unknown;
  /** The WhatsApp Business Account ID */
  wabaId?: string;
}

/**
 * Profile details of a WhatsApp phone number (V2).
 *
 * @see https://docs.wati.io/reference/get_api-v2-whatsapp-wabaid-phonenumber-profile
 */
export interface WatiV2PhoneNumberProfile extends WatiOpaquePayload {
  /** The display phone number */
  displayPhoneNumber?: string;
  /** The phone number ID */
  phoneId?: string;
  /** The quality rating of the number (e.g. GREEN) */
  qualityRating?: string;
  /** The current status of the number */
  status?: string;
  /** The verified business name */
  verifiedName?: string;
  /** The WhatsApp Business Account ID */
  wabaId?: string;
}

// =============================================================================
// V3 Request/Response Types
// =============================================================================

/**
 * Query options for listing campaigns (V3).
 *
 * Same shape as {@link WatiGetMessageTemplatesOptions}; aliased to keep a
 * single definition.
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-broadcasts
 */
export type WatiV3CampaignQuery = WatiGetMessageTemplatesOptions;

/**
 * Query options for the campaign overview (V3).
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-broadcasts-overview
 */
export interface WatiV3CampaignOverviewQuery {
  /** Name or phone number of the channel (null for default channel) */
  channel?: string;
  /** Start of the reporting window (inclusive) */
  dateFrom: Date | string;
  /** End of the reporting window (inclusive) */
  dateTo: Date | string;
  /** Optional text to search campaigns by */
  searchString?: string;
}

/**
 * A broadcast campaign (V3).
 *
 * Unknown fields are preserved via the index signature.
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-broadcasts
 */
export interface WatiV3Campaign {
  /** The identifier of the channel the campaign was sent from */
  channel_id?: string | null;
  /** The creation timestamp of the campaign */
  created?: string;
  /** The unique identifier of the campaign */
  id?: string | null;
  /** The last update timestamp of the campaign */
  last_updated?: string;
  /** The campaign name */
  name?: string | null;
  /** The scheduled send time of the campaign */
  scheduled_at?: string;
  /** The current status of the campaign */
  status?: string | null;
  /** The identifier of the template used by the campaign */
  template_id?: string | null;
  [key: string]: unknown;
}

/**
 * A single recipient record of a campaign (V3).
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-broadcasts-broadcast-id-recipients
 */
export interface WatiV3CampaignRecipient {
  /** Business Solution User ID of the recipient */
  bsuid?: string | null;
  /** The contact ID of the recipient */
  contact_id?: string | null;
  /** The contact name of the recipient */
  contact_name?: string | null;
  /** The contact phone of the recipient */
  contact_phone?: string | null;
  /** The creation timestamp of the record */
  created?: string;
  /** Custom parameters used in the template message */
  custom_params?: Array<{ name: string; value: string }> | null;
  /** The failure code, if the send failed */
  failed_code?: string | null;
  /** The unique identifier of the recipient record */
  id?: string | null;
  /** The local message identifier echoed back */
  local_message_id?: string | null;
  /** The WhatsApp message ID */
  message_id?: string | null;
  /** The delivery status of the message */
  status?: string | null;
}

/**
 * Delivery overview totals for a campaign (V3).
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-broadcasts-overview
 */
export interface WatiV3CampaignOverview {
  /** Number of messages delivered */
  total_delivered?: number;
  /** Number of messages failed */
  total_failed?: number;
  /** Number of link clicks */
  total_links?: number;
  /** Number of messages opened */
  total_open?: number;
  /** Number of messages processing */
  total_processing?: number;
  /** Number of messages queued */
  total_queued?: number;
  /** Number of messages replied to */
  total_replied?: number;
  /** Number of messages sending */
  total_sending?: number;
  /** Number of messages sent */
  total_sent?: number;
  /** Number of messages stopped */
  total_stopped?: number;
}

/**
 * Response from getting campaigns (V3).
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-broadcasts
 */
export interface WatiV3CampaignsResponse {
  /** The list of campaigns */
  broadcasts?: WatiV3Campaign[] | null;
  /** The current page number (1-based) */
  page_number?: number;
  /** The number of items per page */
  page_size?: number;
  /** The total number of campaigns */
  total?: number;
}

/**
 * Response from getting campaign recipients (V3).
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-broadcasts-broadcast-id-recipients
 */
export interface WatiV3CampaignRecipientsResponse {
  /** The current page number (1-based) */
  page_number?: number;
  /** The number of items per page */
  page_size?: number;
  /** The list of recipient records */
  recipients?: WatiV3CampaignRecipient[] | null;
  /** The total number of recipients */
  total_count?: number;
}

/**
 * Input for creating a new contact (V3).
 *
 * @see https://docs.wati.io/reference/post_api-ext-v3-contacts
 */
export interface WatiV3ContactInput {
  /** Custom parameters stored on the contact */
  custom_params?: Array<{ name: string; value: string }>;
  /** The contact's display name */
  name: string;
  /** The contact's WhatsApp phone number */
  whatsapp_number: string;
}

/**
 * Contact update targeting a single contact (V3).
 *
 * @see https://docs.wati.io/reference/put_api-ext-v3-contacts
 */
export interface WatiV3ContactUpdate {
  /** Custom parameters to write on the contact */
  customParams?: Array<{ name: string; value: string }>;
  /** Polymorphic identifier: phone number, contact ID, or BSUID */
  target: string;
}

/**
 * Query options for listing message templates (V3).
 *
 * Same shape as {@link WatiGetMessageTemplatesOptions}; aliased to keep a
 * single definition.
 *
 * @see https://docs.wati.io/reference/get_api-ext-v3-messagetemplates
 */
export type WatiV3TemplateQuery = WatiGetMessageTemplatesOptions;

/**
 * Request body for scheduling template messages (V3).
 *
 * Extends {@link WatiTemplateSendRequest} with the channel and send time.
 *
 * @see https://docs.wati.io/reference/post_api-ext-v3-messagetemplates-schedule
 */
export interface WatiV3ScheduleTemplateRequest extends WatiTemplateSendRequest {
  /** Name or phone number of the channel (null for default channel) */
  channel?: string;
  /** The scheduled send time in UTC */
  scheduled_at: string;
}

// =============================================================================
// V1 API
// =============================================================================

/**
 * Complete namespace for WATI's indexed `/api/v1` operations.
 *
 * Legacy API, still available but not recommended for new projects.
 *
 * @see https://docs.wati.io/reference/introduction
 */
export class WatiV1Api {
  private readonly transport: WatiApiTransport;

  /**
   * @param transport - Low-level transport for Wati API requests
   */
  constructor(transport: WatiApiTransport) {
    this.transport = transport;
  }

  /**
   * Update the WhatsApp Pay order status of an order (Private Beta).
   *
   * @see https://docs.wati.io/reference/post_api-v1-order-status
   */
  updatePaymentOrderStatus<
    TBody extends WatiOpaquePayload,
    TResponse = unknown,
  >(body: TBody): Promise<TResponse> {
    return this.post<TResponse>("/api/v1/order_status", body);
  }

  /**
   * Send a WhatsApp Pay order detail message to a customer (Private Beta).
   *
   * @see https://docs.wati.io/reference/post_api-v1-order-details
   */
  sendPaymentOrderDetails<TBody extends WatiOpaquePayload, TResponse = unknown>(
    body: TBody
  ): Promise<TResponse> {
    return this.post<TResponse>("/api/v1/order_details", body);
  }

  /**
   * Get WhatsApp Pay order details for a particular order (Private Beta).
   *
   * @see https://docs.wati.io/reference/get_api-v1-order-details-referenceid
   */
  getPaymentOrderDetails<T = unknown>(referenceId: string): Promise<T> {
    return this.transport.json<T>(
      `/api/v1/order_details/${encodePath(referenceId)}`
    );
  }

  /**
   * Get payment status information for a particular order (Private Beta).
   *
   * @see https://docs.wati.io/reference/get_api-v1-payment-status-referenceid
   */
  getPaymentStatus<T = unknown>(referenceId: string): Promise<T> {
    return this.transport.json<T>(
      `/api/v1/payment_status/${encodePath(referenceId)}`
    );
  }

  /**
   * Get the existing chatbots.
   *
   * @see https://docs.wati.io/reference/get_api-v1-chatbots
   */
  getChatbots<
    T = Array<{ created?: string; id?: string; name?: string }>,
  >(): Promise<T> {
    return this.transport.json<T>("/api/v1/chatbots");
  }

  /**
   * Start a chatbot for a recipient.
   *
   * @see https://docs.wati.io/reference/post_api-v1-chatbots-start
   */
  startChatbot<T = unknown>(
    chatbotId: string,
    recipient: WatiLegacyTarget
  ): Promise<T> {
    return this.transport.json<T>(
      appendQuery("/api/v1/chatbots/start", {
        chatbotId,
        ...targetQuery(recipient),
      }),
      { method: "POST" }
    );
  }

  /**
   * Get a media file by file name.
   *
   * Returns the raw response, since the payload is binary.
   *
   * @see https://docs.wati.io/reference/get_api-v1-getmedia
   */
  getMedia(fileName: string): Promise<Response> {
    return this.transport.raw(appendQuery("/api/v1/getMedia", { fileName }));
  }

  /**
   * Get the contacts list.
   *
   * @see https://docs.wati.io/reference/get_api-v1-getcontacts
   */
  getContacts<T = WatiOpaquePayload>(
    query?: WatiPageOptions & {
      /** Filter contacts by attribute name */
      attribute?: string;
      /** Filter contacts by creation date */
      createdDate?: string;
      /** Filter contacts by name */
      name?: string;
    }
  ): Promise<T> {
    return this.transport.json<T>(
      appendQuery("/api/v1/getContacts", {
        pageSize: query?.pageSize,
        pageNumber: query?.pageNumber,
        name: query?.name,
        attribute: query?.attribute,
        createdDate: query?.createdDate,
      })
    );
  }

  /**
   * Add a new contact.
   *
   * @see https://docs.wati.io/reference/post_api-v1-addcontact-whatsappnumber
   */
  addContact<T = WatiOpaquePayload>(
    whatsappNumber: string,
    body: WatiV1ContactInput
  ): Promise<T> {
    return this.post<T>(
      `/api/v1/addContact/${encodePath(whatsappNumber)}`,
      body
    );
  }

  /**
   * Update contact attributes for multiple contacts at once.
   *
   * @see https://docs.wati.io/reference/post_api-v1-updatecontactattributesformulticontacts
   */
  updateContactsAttributes<T = { result?: boolean }>(
    contacts: WatiV1ContactUpdate[]
  ): Promise<T> {
    return this.post<T>("/api/v1/updateContactAttributesForMultiContacts", {
      contacts,
    });
  }

  /**
   * Update contact attributes for a single contact.
   *
   * @see https://docs.wati.io/reference/post_api-v1-updatecontactattributes-whatsappnumber
   */
  updateContactAttributes<T = { result?: boolean }>(
    target: string,
    customParams: WatiTemplateParameter[]
  ): Promise<T> {
    return this.post<T>(
      `/api/v1/updateContactAttributes/${encodePath(target)}`,
      { customParams }
    );
  }

  /**
   * Rotate the API token, blocking the provided token.
   *
   * @see https://docs.wati.io/reference/post_api-v1-rotatetoken
   */
  rotateToken<T = unknown>(tokenToBlock: string): Promise<T> {
    return this.transport.json<T>(
      appendQuery("/api/v1/rotateToken", { token: tokenToBlock }),
      { method: "POST" }
    );
  }

  /**
   * Assign an operator (user) to a conversation.
   *
   * @see https://docs.wati.io/reference/post_api-v1-assignoperator
   */
  assignOperator<T = { result?: boolean }>(
    recipient: WatiLegacyTarget,
    email?: string
  ): Promise<T> {
    return this.transport.json<T>(
      appendQuery("/api/v1/assignOperator", {
        email,
        ...targetQuery(recipient),
      }),
      { method: "POST" }
    );
  }

  /**
   * Update the chat status of a conversation.
   *
   * @see https://docs.wati.io/reference/post_api-v1-updatechatstatus
   */
  updateChatStatus<T = unknown>(body: WatiV1ChatStatusRequest): Promise<T> {
    return this.post<T>("/api/v1/updateChatStatus", body);
  }

  /**
   * Get the message templates.
   *
   * @see https://docs.wati.io/reference/get_api-v1-getmessagetemplates
   */
  getMessageTemplates<T = WatiOpaquePayload>(
    query?: WatiPageOptions & {
      /** The channel phone number to filter templates by */
      channelPhoneNumber?: string;
    }
  ): Promise<T> {
    return this.transport.json<T>(
      appendQuery("/api/v1/getMessageTemplates", {
        pageSize: query?.pageSize,
        pageNumber: query?.pageNumber,
        channelPhoneNumber: query?.channelPhoneNumber,
      })
    );
  }

  /**
   * Create a message template.
   *
   * The body schema depends on the template type; pass the documented
   * template object as-is.
   *
   * @see https://docs.wati.io/reference/post_api-v1-whatsapp-templates
   */
  createMessageTemplate<T = WatiOpaquePayload>(
    body: WatiOpaquePayload
  ): Promise<T> {
    return this.post<T>("/api/v1/whatsApp/templates", body);
  }

  /**
   * Delete all templates with the given name under a WABA.
   *
   * @see https://docs.wati.io/reference/delete_api-v1-whatsapp-templates-wabaid-name
   */
  deleteMessageTemplatesByName<T = { ok?: boolean }>(
    wabaId: string,
    name: string
  ): Promise<T> {
    return this.transport.json<T>(
      `/api/v1/whatsApp/templates/${encodePath(wabaId)}/${encodePath(name)}`,
      { method: "DELETE" }
    );
  }

  /**
   * Delete a single template by name and language under a WABA.
   *
   * @see https://docs.wati.io/reference/delete_api-v1-whatsapp-templates-wabaid-name-language
   */
  deleteMessageTemplate<T = { ok?: boolean }>(
    wabaId: string,
    name: string,
    language: string
  ): Promise<T> {
    return this.transport.json<T>(
      `/api/v1/whatsApp/templates/${encodePath(wabaId)}/${encodePath(name)}/${encodePath(language)}`,
      { method: "DELETE" }
    );
  }

  /**
   * Send a single template message.
   *
   * @see https://docs.wati.io/reference/post_api-v1-sendtemplatemessage
   */
  sendTemplateMessage<T = WatiOpaquePayload>(
    recipient: WatiLegacyTarget,
    body: WatiV1TemplateSendBody
  ): Promise<T> {
    return this.transport.json<T>(
      appendQuery("/api/v1/sendTemplateMessage", targetQuery(recipient)),
      jsonRequest("POST", body)
    );
  }

  /**
   * Send template messages to multiple receivers.
   *
   * @see https://docs.wati.io/reference/post_api-v1-sendtemplatemessages
   */
  sendTemplateMessages<T = WatiOpaquePayload>(body: {
    /** The name of the broadcast to be created */
    broadcast_name: string;
    /** The channel number to send from */
    channel_number: string;
    /** List of receivers */
    receivers: WatiV1TemplateReceiver[];
    /** Name of the approved template */
    template_name: string;
  }): Promise<T> {
    return this.post<T>("/api/v1/sendTemplateMessages", body);
  }

  /**
   * Send template messages from a CSV of phone numbers.
   *
   * @see https://docs.wati.io/reference/post_api-v1-sendtemplatemessagecsv
   */
  sendTemplateMessagesCsv<T = WatiOpaquePayload>(
    templateName: string,
    broadcastName: string,
    csv: Blob,
    filename = "recipients.csv"
  ): Promise<T> {
    const form = new FormData();
    form.append("whatsapp_numbers_csv", csv, filename);
    return this.transport.json<T>(
      appendQuery("/api/v1/sendTemplateMessageCSV", {
        template_name: templateName,
        broadcast_name: broadcastName,
      }),
      { method: "POST", body: form }
    );
  }

  /**
   * Send an interactive list message to an opened session.
   *
   * @see https://docs.wati.io/reference/post_api-v1-sendinteractivelistmessage
   */
  sendInteractiveListMessage<T = { ok?: boolean }>(
    recipient: WatiLegacyTarget,
    body: WatiV1InteractiveListMessage
  ): Promise<T> {
    return this.transport.json<T>(
      appendQuery("/api/v1/sendInteractiveListMessage", targetQuery(recipient)),
      jsonRequest("POST", body)
    );
  }

  /**
   * Get messages by WhatsApp number.
   *
   * @see https://docs.wati.io/reference/get_api-v1-getmessages-whatsappnumber
   */
  getMessages<T = WatiOpaquePayload>(
    target: string,
    page?: WatiPageOptions
  ): Promise<T> {
    return this.transport.json<T>(
      appendQuery(`/api/v1/getMessages/${encodePath(target)}`, {
        pageSize: page?.pageSize,
        pageNumber: page?.pageNumber,
      })
    );
  }

  /**
   * Send an interactive buttons message to an opened session.
   *
   * @see https://docs.wati.io/reference/post_api-v1-sendinteractivebuttonsmessage
   */
  sendInteractiveButtonsMessage<T = unknown>(
    recipient: WatiLegacyTarget,
    body: WatiV1InteractiveButtonsMessage
  ): Promise<T> {
    return this.transport.json<T>(
      appendQuery(
        "/api/v1/sendInteractiveButtonsMessage",
        targetQuery(recipient)
      ),
      jsonRequest("POST", body)
    );
  }

  /**
   * Send a file to an opened session.
   *
   * @see https://docs.wati.io/reference/post_api-v1-sendsessionfile-whatsappnumber
   */
  sendSessionFile<T = WatiOpaquePayload>(
    target: string,
    file: Blob,
    options?: { caption?: string; filename?: string }
  ): Promise<T> {
    const form = new FormData();
    form.append("file", file, options?.filename);
    return this.transport.json<T>(
      appendQuery(`/api/v1/sendSessionFile/${encodePath(target)}`, {
        caption: options?.caption,
      }),
      { method: "POST", body: form }
    );
  }

  /**
   * Send a message to an opened session.
   *
   * @see https://docs.wati.io/reference/post_api-v1-sendsessionmessage-whatsappnumber
   */
  sendSessionMessage<T = WatiOpaquePayload>(
    target: string,
    options: {
      /** The channel phone number to send from */
      channelPhoneNumber?: string;
      /** Client-side identifier echoed in webhooks */
      localMessageId?: string;
      /** The message text */
      messageText: string;
      /** Reference ID of the message being replied to */
      replyContextId?: string;
    }
  ): Promise<T> {
    return this.transport.json<T>(
      appendQuery(`/api/v1/sendSessionMessage/${encodePath(target)}`, options),
      { method: "POST" }
    );
  }

  /**
   * Get a message by phone number and local message ID.
   *
   * @see https://docs.wati.io/reference/get_api-v1-whatsapp-messages-phonenumber-localmessageid
   */
  getMessageByLocalId<T = WatiOpaquePayload>(
    channelPhoneNumber: string,
    localMessageId: string
  ): Promise<T> {
    return this.transport.json<T>(
      `/api/v1/whatsApp/messages/${encodePath(channelPhoneNumber)}/${encodePath(localMessageId)}`
    );
  }

  /**
   * Get the list of WhatsApp phone numbers.
   *
   * @see https://docs.wati.io/reference/get_api-v1-whatsapp-phonenumbers
   */
  getPhoneNumbers<T = WatiOpaquePayload>(): Promise<T> {
    return this.transport.json<T>("/api/v1/whatsApp/phoneNumbers");
  }

  /**
   * Get the WhatsApp business accounts.
   *
   * @see https://docs.wati.io/reference/get_api-v1-whatsapp-businessaccounts
   */
  getBusinessAccounts<T = WatiOpaquePayload>(): Promise<T> {
    return this.transport.json<T>("/api/v1/whatsApp/businessAccounts");
  }

  /**
   * Create a custom segment.
   *
   * WATI's current page documents the body but omits the route. Supply the
   * tenant's documented v1 path explicitly rather than relying on a guess.
   *
   * @see https://docs.wati.io/reference/create-custom-segment
   */
  createCustomSegment<T = unknown>(
    path: `/api/v1/${string}`,
    body: WatiV1CustomSegmentInput
  ): Promise<T> {
    return this.post<T>(path, body);
  }

  /**
   * Send a file to an opened session via a URL.
   *
   * The route is indexed by WATI, but the request body schema is unpublished.
   *
   * @see https://docs.wati.io/reference/post_api-v1-sendsessionfileviaurl-whatsappnumber
   */
  sendSessionFileViaUrl<T = unknown>(
    target: string,
    body: WatiOpaquePayload
  ): Promise<T> {
    return this.post<T>(
      `/api/v1/sendSessionFileViaUrl/${encodePath(target)}`,
      body
    );
  }

  /**
   * Enable auto-retry for a campaign broadcast.
   *
   * @see https://docs.wati.io/reference/enable-auto-retry
   */
  enableBroadcastAutoRetry<T = unknown>(
    broadcastId: string,
    body: WatiV1AutoRetryInput
  ): Promise<T> {
    return this.post<T>(
      `/api/v1/broadcast/${encodePath(broadcastId)}/retry`,
      body
    );
  }

  private post<T>(path: WatiApiPath, body: unknown): Promise<T> {
    return this.transport.json<T>(path, jsonRequest("POST", body));
  }
}

// =============================================================================
// V2 API
// =============================================================================

/**
 * Complete namespace for the six `/api/v2` operations in WATI's current index.
 *
 * These are updated variants within the legacy V1 API, not a separate API
 * version.
 *
 * @see https://docs.wati.io/reference/introduction
 */
export class WatiV2Api {
  private readonly transport: WatiApiTransport;

  /**
   * @param transport - Low-level transport for Wati API requests
   */
  constructor(transport: WatiApiTransport) {
    this.transport = transport;
  }

  /**
   * Get the message templates.
   *
   * @see https://docs.wati.io/reference/get_api-v2-getmessagetemplates
   */
  getMessageTemplates<T = WatiOpaquePayload>(
    query?: WatiV2TemplateQuery
  ): Promise<T> {
    return this.transport.json<T>(
      appendQuery("/api/v2/getMessageTemplates", {
        pageSize: query?.pageSize,
        pageNumber: query?.pageNumber,
        name: query?.name,
        wabaId: query?.wabaId,
      })
    );
  }

  /**
   * Send a template message (Beta).
   *
   * @see https://docs.wati.io/reference/post_api-v2-sendtemplatemessage
   */
  sendTemplateMessage<T = WatiOpaquePayload>(
    recipient: WatiLegacyTarget,
    body: WatiV2TemplateSendBody
  ): Promise<T> {
    return this.transport.json<T>(
      appendQuery("/api/v2/sendTemplateMessage", targetQuery(recipient)),
      jsonRequest("POST", body)
    );
  }

  /**
   * Send template messages to multiple receivers (Beta).
   *
   * @see https://docs.wati.io/reference/post_api-v2-sendtemplatemessages
   */
  sendTemplateMessages<T = WatiOpaquePayload>(
    body: WatiV2BatchTemplateSendBody
  ): Promise<T> {
    return this.transport.json<T>(
      "/api/v2/sendTemplateMessages",
      jsonRequest("POST", body)
    );
  }

  /**
   * List the multi WhatsApp phone numbers.
   *
   * @see https://docs.wati.io/reference/get_api-v2-whatsapp-phonenumbers
   */
  listWhatsAppPhoneNumbers(): Promise<WatiV2PhoneNumber[]> {
    return this.transport.json<WatiV2PhoneNumber[]>(
      "/api/v2/whatsapp/phoneNumbers"
    );
  }

  /**
   * Get the profile details of a WhatsApp phone number.
   *
   * @see https://docs.wati.io/reference/get_api-v2-whatsapp-wabaid-phonenumber-profile
   */
  getWhatsAppPhoneNumberProfile(
    wabaId: string,
    phoneNumber: string
  ): Promise<WatiV2PhoneNumberProfile> {
    return this.transport.json<WatiV2PhoneNumberProfile>(
      `/api/v2/whatsapp/${encodePath(wabaId)}/${encodePath(phoneNumber)}/profile`
    );
  }

  /**
   * Create webhook endpoints for receiving Wati events.
   *
   * @see https://docs.wati.io/reference/post_api-v2-webhookendpoints
   */
  createWebhookEndpoints(
    endpoints: WatiWebhookEndpointInput[]
  ): Promise<WatiCreateWebhooksResponse> {
    return this.transport.json<WatiCreateWebhooksResponse>(
      "/api/v2/webhookEndpoints",
      jsonRequest("POST", endpoints)
    );
  }
}

// =============================================================================
// V3 API
// =============================================================================

/**
 * Complete namespace for the 25 `/api/ext/v3` references in WATI's index.
 *
 * Recommended for all new integrations.
 *
 * @see https://docs.wati.io/reference/introduction
 */
export class WatiV3Api {
  private readonly transport: WatiApiTransport;

  /**
   * @param transport - Low-level transport for Wati API requests
   */
  constructor(transport: WatiApiTransport) {
    this.transport = transport;
  }

  /**
   * Get the broadcast campaigns.
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-broadcasts
   */
  getCampaigns(query?: WatiV3CampaignQuery): Promise<WatiV3CampaignsResponse> {
    return this.transport.json<WatiV3CampaignsResponse>(
      appendQuery("/api/ext/v3/broadcasts", {
        channel: query?.channel,
        page_number: query?.pageNumber ?? 1,
        page_size: query?.pageSize ?? 50,
      })
    );
  }

  /**
   * Get the details of a campaign by ID.
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-broadcasts-broadcast-id
   */
  getCampaignById(broadcastId: string): Promise<WatiV3Campaign> {
    return this.transport.json<WatiV3Campaign>(
      `/api/ext/v3/broadcasts/${encodePath(broadcastId)}`
    );
  }

  /**
   * Get the recipients of a campaign by ID.
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-broadcasts-broadcast-id-recipients
   */
  getCampaignRecipients(
    broadcastId: string,
    page?: WatiPageOptions
  ): Promise<WatiV3CampaignRecipientsResponse> {
    return this.transport.json<WatiV3CampaignRecipientsResponse>(
      appendQuery(
        `/api/ext/v3/broadcasts/${encodePath(broadcastId)}/recipients`,
        { page_number: page?.pageNumber ?? 1, page_size: page?.pageSize ?? 50 }
      )
    );
  }

  /**
   * Get the campaign overview totals.
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-broadcasts-overview
   */
  getCampaignOverview(
    query: WatiV3CampaignOverviewQuery
  ): Promise<WatiV3CampaignOverview> {
    return this.transport.json<WatiV3CampaignOverview>(
      appendQuery("/api/ext/v3/broadcasts/overview", {
        channel: query.channel,
        date_from: toIso(query.dateFrom),
        date_to: toIso(query.dateTo),
        search_string: query.searchString,
      })
    );
  }

  /**
   * Get the channels (excluding the default channel).
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-channels
   */
  getChannels(page?: WatiPageOptions): Promise<WatiGetChannelsResponse> {
    return this.transport.json<WatiGetChannelsResponse>(
      appendQuery("/api/ext/v3/channels", {
        page_number: page?.pageNumber ?? 1,
        page_size: page?.pageSize ?? 50,
      })
    );
  }

  /**
   * Get the chatbots (available in Pro plan).
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-chatbots
   */
  getChatbots<T = WatiOpaquePayload>(page?: WatiPageOptions): Promise<T> {
    return this.transport.json<T>(
      appendQuery("/api/ext/v3/chatbots", {
        page_number: page?.pageNumber ?? 1,
        page_size: page?.pageSize ?? 50,
      })
    );
  }

  /**
   * Start a chatbot for a target (available in Pro plan).
   *
   * @see https://docs.wati.io/reference/post_api-ext-v3-chatbots-start
   */
  startChatbot<T = { result?: boolean }>(
    target: string,
    chatbotId: string
  ): Promise<T> {
    return this.transport.json<T>(
      "/api/ext/v3/chatbots/start",
      jsonRequest("POST", { target, chatbot_id: chatbotId })
    );
  }

  /**
   * Add a new contact.
   *
   * @see https://docs.wati.io/reference/post_api-ext-v3-contacts
   */
  createContact(input: WatiV3ContactInput): Promise<WatiContact> {
    return this.transport.json<WatiContact>(
      "/api/ext/v3/contacts",
      jsonRequest("POST", input)
    );
  }

  /**
   * Get the contacts list.
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-contacts
   */
  getContacts(page?: WatiPageOptions): Promise<WatiGetContactsResponse> {
    return this.transport.json<WatiGetContactsResponse>(
      appendQuery("/api/ext/v3/contacts", {
        page_number: page?.pageNumber ?? 1,
        page_size: page?.pageSize ?? 50,
      })
    );
  }

  /**
   * Update contacts in bulk.
   *
   * @see https://docs.wati.io/reference/put_api-ext-v3-contacts
   */
  updateContacts(
    updates: WatiV3ContactUpdate[]
  ): Promise<{ contact_list?: WatiContact[] | null }> {
    return this.transport.json(
      "/api/ext/v3/contacts",
      jsonRequest("PUT", { contacts: updates })
    );
  }

  /**
   * Get the details of a single contact.
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-contacts-target
   */
  getContact(target: string): Promise<WatiContact> {
    return this.transport.json<WatiContact>(
      `/api/ext/v3/contacts/${encodePath(target)}`
    );
  }

  /**
   * Assign a contact to teams.
   *
   * @see https://docs.wati.io/reference/put_api-ext-v3-contacts-teams
   */
  assignContactToTeams(
    target: string,
    teams: string[]
  ): Promise<{ result?: boolean }> {
    return this.transport.json(
      "/api/ext/v3/contacts/teams",
      jsonRequest("PUT", { target, teams })
    );
  }

  /**
   * Get the number of contacts, optionally filtered by creation date.
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-contacts-count
   */
  getContactCount(options?: {
    /** Start of the creation-date window */
    dateFrom?: string;
    /** End of the creation-date window */
    dateTo?: string;
  }): Promise<{ contact_count?: number }> {
    return this.transport.json(
      appendQuery("/api/ext/v3/contacts/count", {
        date_from: options?.dateFrom,
        date_to: options?.dateTo,
      })
    );
  }

  /**
   * Get the messages of a conversation.
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-conversations-target-messages
   */
  getConversationMessages(
    target: string,
    page?: WatiPageOptions
  ): Promise<WatiGetMessagesResponse> {
    return this.transport.json<WatiGetMessagesResponse>(
      appendQuery(`/api/ext/v3/conversations/${encodePath(target)}/messages`, {
        page_number: page?.pageNumber ?? 1,
        page_size: page?.pageSize ?? 50,
      })
    );
  }

  /**
   * Send a text message to an active conversation.
   *
   * @see https://docs.wati.io/reference/post_api-ext-v3-conversations-messages-text
   */
  sendTextMessage(target: string, text: string): Promise<WatiMessageResponse> {
    return this.transport.json(
      "/api/ext/v3/conversations/messages/text",
      jsonRequest("POST", { target, text })
    );
  }

  /**
   * Send a file message to an active conversation.
   *
   * @see https://docs.wati.io/reference/post_api-ext-v3-conversations-messages-file
   */
  sendFileMessage(
    target: string,
    file: Blob,
    filename?: string
  ): Promise<WatiMessageResponse> {
    const form = new FormData();
    form.append("target", target);
    form.append("file", file, filename);
    return this.transport.json("/api/ext/v3/conversations/messages/file", {
      method: "POST",
      body: form,
    });
  }

  /**
   * Get a media file by message ID.
   *
   * Returns the raw response, since the payload is binary.
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-conversations-messages-file-message-id
   */
  getMessageFile(messageId: string): Promise<Response> {
    return this.transport.raw(
      `/api/ext/v3/conversations/messages/file/${encodePath(messageId)}`
    );
  }

  /**
   * Assign an operator to a conversation.
   *
   * @see https://docs.wati.io/reference/put_api-ext-v3-conversations-target-operator
   */
  assignConversationOperator(
    target: string,
    assigneeEmail: string | null
  ): Promise<{ result?: boolean }> {
    return this.transport.json(
      `/api/ext/v3/conversations/${encodePath(target)}/operator`,
      jsonRequest("PUT", { assignee_email: assigneeEmail })
    );
  }

  /**
   * Update the status of a conversation.
   *
   * @see https://docs.wati.io/reference/put_api-ext-v3-conversations-target-status
   */
  updateConversationStatus(
    target: string,
    status: WatiConversationStatus
  ): Promise<{ result?: boolean }> {
    return this.transport.json(
      `/api/ext/v3/conversations/${encodePath(target)}/status`,
      jsonRequest("PUT", { new_status: status })
    );
  }

  /**
   * Send an interactive message (buttons or list) to an active conversation.
   *
   * @see https://docs.wati.io/reference/post_api-ext-v3-conversations-messages-interactive
   */
  sendInteractiveMessage(
    target: string,
    message: WatiInteractiveMessage
  ): Promise<WatiMessageResponse> {
    return this.transport.json(
      "/api/ext/v3/conversations/messages/interactive",
      jsonRequest("POST", { target, ...message })
    );
  }

  /**
   * Send a file message to an active conversation via a URL.
   *
   * WATI indexes this endpoint but currently publishes no request schema.
   *
   * @see https://docs.wati.io/reference/post_api-ext-v3-conversations-messages-fileviaurl
   */
  sendFileMessageViaUrl<T = unknown>(body: WatiOpaquePayload): Promise<T> {
    return this.transport.json<T>(
      "/api/ext/v3/conversations/messages/fileViaUrl",
      jsonRequest("POST", body)
    );
  }

  /**
   * Get a message template by ID.
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-messagetemplates-template-id
   */
  getMessageTemplate(templateId: string): Promise<WatiMessageTemplate> {
    return this.transport.json<WatiMessageTemplate>(
      `/api/ext/v3/messageTemplates/${encodePath(templateId)}`
    );
  }

  /**
   * Get the message templates.
   *
   * @see https://docs.wati.io/reference/get_api-ext-v3-messagetemplates
   */
  getMessageTemplates(
    query?: WatiV3TemplateQuery
  ): Promise<WatiGetMessageTemplatesResponse> {
    return this.transport.json<WatiGetMessageTemplatesResponse>(
      appendQuery("/api/ext/v3/messageTemplates", {
        channel: query?.channel,
        page_number: query?.pageNumber ?? 1,
        page_size: query?.pageSize ?? 50,
      })
    );
  }

  /**
   * Send template messages to multiple recipients.
   *
   * @see https://docs.wati.io/reference/post_api-ext-v3-messagetemplates-send
   */
  sendTemplateMessages(
    request: WatiTemplateSendRequest
  ): Promise<WatiTemplateSendResponse> {
    return this.transport.json(
      "/api/ext/v3/messageTemplates/send",
      jsonRequest("POST", request)
    );
  }

  /**
   * Schedule template messages for later delivery.
   *
   * @see https://docs.wati.io/reference/post_api-ext-v3-messagetemplates-schedule
   */
  scheduleTemplateMessages(
    request: WatiV3ScheduleTemplateRequest
  ): Promise<WatiTemplateSendResponse> {
    return this.transport.json(
      "/api/ext/v3/messageTemplates/schedule",
      jsonRequest("POST", request)
    );
  }
}
