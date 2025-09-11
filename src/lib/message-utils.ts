import { Id } from "convex/_generated/dataModel";
import { format, isToday, isYesterday, isSameDay } from "date-fns";

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

/**
 * Groups messages by date, returning an array of date groups
 */
export interface MessageDateGroup {
  date: Date;
  dateLabel: string;
  messages: MessageGroup[];
}

/**
 * Represents a group of consecutive messages from the same author
 */
export interface MessageGroup {
  author: Id<"users">;
  messages: MessageInGroup[];
  startTime: number;
  endTime: number;
}

/**
 * A message within a group, with additional grouping metadata
 */
export interface MessageInGroup {
  message: Message;
  isFirstInGroup: boolean;
  showTimestamp: boolean; // For hover timestamp display
}

/**
 * Time threshold for breaking message groups (5 minutes in milliseconds)
 */
const MESSAGE_GROUP_TIME_THRESHOLD = 5 * 60 * 1000; // 5 minutes

/**
 * Groups consecutive messages from the same author within a date group
 */
export function groupConsecutiveMessages(messages: Message[]): MessageGroup[] {
  if (messages.length === 0) return [];

  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const message of messages) {
    const shouldStartNewGroup =
      !currentGroup ||
      currentGroup.author !== message.author ||
      message._creationTime - currentGroup.endTime >
        MESSAGE_GROUP_TIME_THRESHOLD;

    if (shouldStartNewGroup) {
      // Finish the previous group
      if (currentGroup) {
        groups.push(currentGroup);
      }

      // Start a new group
      currentGroup = {
        author: message.author,
        messages: [
          {
            message,
            isFirstInGroup: true,
            showTimestamp: false,
          },
        ],
        startTime: message._creationTime,
        endTime: message._creationTime,
      };
    } else {
      // Add to current group
      currentGroup.messages.push({
        message,
        isFirstInGroup: false,
        showTimestamp: true, // Subsequent messages can show timestamp on hover
      });
      currentGroup.endTime = message._creationTime;
    }
  }

  // Don't forget the last group
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

export function groupMessagesByDate(messages: Message[]): MessageDateGroup[] {
  if (messages.length === 0) return [];

  const groups: MessageDateGroup[] = [];
  let currentDateGroup: {
    date: Date;
    dateLabel: string;
    messages: Message[];
  } | null = null;

  // First, group by date (existing logic)
  for (const message of messages) {
    const messageDate = new Date(message._creationTime);

    // Check if we need to start a new date group
    if (!currentDateGroup || !isSameDay(currentDateGroup.date, messageDate)) {
      // Finish the previous group
      if (currentDateGroup) {
        groups.push({
          date: currentDateGroup.date,
          dateLabel: currentDateGroup.dateLabel,
          messages: groupConsecutiveMessages(currentDateGroup.messages),
        });
      }

      // Start a new date group
      currentDateGroup = {
        date: messageDate,
        dateLabel: formatDateSeparator(messageDate),
        messages: [message],
      };
    } else {
      // Add to current date group
      currentDateGroup.messages.push(message);
    }
  }

  // Don't forget the last group
  if (currentDateGroup) {
    groups.push({
      date: currentDateGroup.date,
      dateLabel: currentDateGroup.dateLabel,
      messages: groupConsecutiveMessages(currentDateGroup.messages),
    });
  }

  return groups;
}

/**
 * Formats a date for display in date separators
 * Returns "Today", "Yesterday", or a formatted date
 */
export function formatDateSeparator(date: Date): string {
  if (isToday(date)) {
    return "Today";
  }

  if (isYesterday(date)) {
    return "Yesterday";
  }

  // For other dates, show the full date
  return format(date, "EEEE, MMMM d, yyyy");
}

/**
 * Formats a timestamp for hover display in grouped messages
 * Returns time in "h:mm a" format (e.g., "3:45 PM")
 */
export function formatHoverTime(timestamp: number): string {
  return format(new Date(timestamp), "h:mm");
}
