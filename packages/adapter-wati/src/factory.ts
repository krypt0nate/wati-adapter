import { ValidationError } from "@chat-adapter/shared";
import { ConsoleLogger } from "chat";
import { WatiAdapter } from "./adapter";
import type { WatiAdapterConfig } from "./types";

const DEFAULT_USER_NAME = "wati-bot";

export function createWatiAdapter(config?: WatiAdapterConfig): WatiAdapter {
  const logger = config?.logger ?? new ConsoleLogger("info").child("wati");
  const accessToken = config?.accessToken ?? process.env.WATI_ACCESS_TOKEN;
  const apiUrl = config?.apiUrl ?? process.env.WATI_API_URL;
  const webhookSecret =
    config?.webhookSecret ?? process.env.WATI_WEBHOOK_SECRET;
  if (!accessToken) {
    throw new ValidationError(
      "wati",
      "accessToken is required. Set WATI_ACCESS_TOKEN or provide it in config."
    );
  }
  if (!apiUrl) {
    throw new ValidationError(
      "wati",
      "apiUrl is required. Set WATI_API_URL or provide it in config."
    );
  }
  if (!webhookSecret) {
    throw new ValidationError(
      "wati",
      "webhookSecret is required. Set WATI_WEBHOOK_SECRET or provide it in config."
    );
  }
  return new WatiAdapter({
    accessToken,
    apiUrl,
    webhookSecret,
    userName:
      config?.userName ?? process.env.WATI_BOT_USERNAME ?? DEFAULT_USER_NAME,
    logger,
  });
}
