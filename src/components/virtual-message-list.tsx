import { FixedSizeList as List } from 'react-window';
import { memo, useCallback } from 'react';
import { Message } from '~/lib/message-utils';
import { MessageComponent } from './message-component';
import { Id } from 'convex/_generated/dataModel';

interface VirtualMessageListProps {
  messages: Message[];
  height: number;
  userId: Id<"users">;
  channelId: Id<"channels">;
  channel?: { isDM: boolean };
  targetMessageId?: Id<"messages">;
  onRegisterElement?: (element: HTMLElement, messageId: Id<"messages">) => void;
  onReply?: (message: Message) => void;
}

interface MessageItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    messages: Message[];
    userId: Id<"users">;
    channelId: Id<"channels">;
    channel?: { isDM: boolean };
    targetMessageId?: Id<"messages">;
    onRegisterElement?: (element: HTMLElement, messageId: Id<"messages">) => void;
    onReply?: (message: Message) => void;
  };
}

const MessageItem = memo(({ index, style, data }: MessageItemProps) => {
  const { messages, userId, channelId, channel, targetMessageId, onRegisterElement, onReply } = data;
  const message = messages[index];
  
  if (!message) return null;
  
  const isTargetMessage = message._id === targetMessageId;
  
  return (
    <div 
      style={style} 
      data-message-id={message._id}
      className={isTargetMessage ? 'bg-yellow-100/50 dark:bg-yellow-900/20' : ''}
    >
      <div className="px-4 py-2">
        <MessageComponent
          message={message}
          userId={userId}
          channelId={channelId}
          channel={channel}
          onRegisterElement={onRegisterElement}
          onReply={onReply}
        />
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export const VirtualMessageList = memo(({
  messages,
  height,
  userId,
  channelId,
  channel,
  targetMessageId,
  onRegisterElement,
  onReply
}: VirtualMessageListProps) => {
  const itemData = {
    messages,
    userId,
    channelId,
    channel,
    targetMessageId,
    onRegisterElement,
    onReply
  };
  
  const scrollToTargetMessage = useCallback(() => {
    if (!targetMessageId) return;
    
    const targetIndex = messages.findIndex(msg => msg._id === targetMessageId);
    if (targetIndex !== -1 && listRef.current) {
      listRef.current.scrollToItem(targetIndex, 'center');
    }
  }, [messages, targetMessageId]);
  
  const listRef = useRef<List>(null);
  
  return (
    <List
      ref={listRef}
      height={height}
      itemCount={messages.length}
      itemSize={120} // Approximate message height
      itemData={itemData}
      overscanCount={10}
    >
      {MessageItem}
    </List>
  );
});

VirtualMessageList.displayName = 'VirtualMessageList';