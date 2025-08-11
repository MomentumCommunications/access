import { Id } from "convex/_generated/dataModel";

export type Message = {
  _id: Id<"messages">;
  _creationTime: number;
  body: string;
  date?: string;
  author: Id<"users">;
  image?: string;
  format?: string;
  channel: string;
  reactions?: string;
  edited?: boolean;
  replyToId?: Id<"messages">;
};

/**
 * Sorts messages in chronological order (oldest first)
 * Uses _creationTime for reliable ordering
 */
export function sortMessagesByTime(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => a._creationTime - b._creationTime);
}

/**
 * Removes duplicate messages based on _id
 */
export function deduplicateMessages(messages: Message[]): Message[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message._id)) {
      return false;
    }
    seen.add(message._id);
    return true;
  });
}

/**
 * Merges new messages with existing messages, maintaining chronological order
 * Handles deduplication, proper sorting, and message deletions
 * Treats newMessages as the authoritative source of truth for real-time updates
 */
export function mergeMessages(
  existingMessages: Message[],
  newMessages: Message[],
): Message[] {
  // Create a set of new message IDs for fast lookup
  const newMessageIds = new Set(newMessages.map((m) => m._id));

  // Filter existing messages to only include those that still exist in newMessages
  // This properly handles deletions by removing messages not in the authoritative data
  const filteredExisting = existingMessages.filter((msg) =>
    newMessageIds.has(msg._id),
  );

  // Combine filtered existing with new messages
  const allMessages = [...filteredExisting, ...newMessages];

  // Remove duplicates
  const uniqueMessages = deduplicateMessages(allMessages);

  // Sort chronologically
  return sortMessagesByTime(uniqueMessages);
}

/**
 * Merges older messages (for pagination) with existing messages
 * Maintains chronological order and prevents duplicates
 */
export function mergeOlderMessages(
  existingMessages: Message[],
  olderMessages: Message[],
): Message[] {
  // Combine messages (older first, then existing)
  const allMessages = [...olderMessages, ...existingMessages];

  // Remove duplicates
  const uniqueMessages = deduplicateMessages(allMessages);

  // Sort chronologically to ensure perfect order
  return sortMessagesByTime(uniqueMessages);
}

/**
 * Finds the oldest message time for pagination
 */
export function getOldestMessageTime(messages: Message[]): number | undefined {
  if (messages.length === 0) return undefined;

  return Math.min(...messages.map((m) => m._creationTime));
}

/**
 * Checks if two message arrays are equal (same messages in same order)
 * Useful for preventing unnecessary re-renders
 */
export function areMessageArraysEqual(a: Message[], b: Message[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i]._id !== b[i]._id || a[i]._creationTime !== b[i]._creationTime) {
      return false;
    }
  }

  return true;
}

/**
 * Merges newer messages (for forward pagination) with existing messages
 * Maintains chronological order and prevents duplicates
 */
export function mergeNewerMessages(
  existingMessages: Message[],
  newerMessages: Message[],
): Message[] {
  // Combine messages (existing first, then newer)
  const allMessages = [...existingMessages, ...newerMessages];

  // Remove duplicates
  const uniqueMessages = deduplicateMessages(allMessages);

  // Sort chronologically to ensure perfect order
  return sortMessagesByTime(uniqueMessages);
}

/**
 * Finds the newest message time for forward pagination
 */
export function getNewestMessageTime(messages: Message[]): number | undefined {
  if (messages.length === 0) return undefined;

  return Math.max(...messages.map((m) => m._creationTime));
}

/**
 * Context for message linking with bidirectional pagination state
 */
export interface MessageContext {
  messages: Message[];
  targetMessageId: Id<"messages">;
  targetMessageIndex: number;
  channelId: string;
}

/**
 * Bidirectional pagination state for message context
 */
export interface BidirectionalPaginationState {
  canLoadOlder: boolean;
  canLoadNewer: boolean;
  loadingOlder: boolean;
  loadingNewer: boolean;
  targetMessageId: Id<"messages">;
  hasScrolledToTarget: boolean;
}

/**
 * Generates a message link URL for the given channel and message
 */
export function generateMessageLink(
  channelId: string,
  messageId: Id<"messages">,
  isDM: boolean = false,
): string {
  const route = isDM ? "dm" : "channel";
  return `/${route}/${channelId}?messageId=${messageId}`;
}

/**
 * Generates a shareable message link URL (for external sharing)
 */
export function generateShareableMessageLink(
  channelId: string,
  messageId: Id<"messages">,
  isDM: boolean = false,
  baseUrl?: string,
): string {
  const path = generateMessageLink(channelId, messageId, isDM);
  return baseUrl
    ? `${baseUrl}${path}`
    : `${window?.location?.origin || ""}${path}`;
}

/**
 * Extracts message and channel IDs from a message link URL with query parameters
 */
export function parseMessageLink(
  url: string,
): { channelId?: string; messageId?: Id<"messages">; isDM?: boolean } | null {
  try {
    const urlObj = new URL(url, window?.location?.origin);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    if (
      (pathParts[0] === "channel" || pathParts[0] === "dm") &&
      pathParts.length >= 2
    ) {
      const messageId = urlObj.searchParams.get("messageId");
      if (messageId) {
        return {
          channelId: pathParts[1],
          messageId: messageId as Id<"messages">,
          isDM: pathParts[0] === "dm",
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}
