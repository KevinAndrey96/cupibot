/**
 * CSS selectors for Bumble's messaging UI.
 *
 * Bumble's chat is accessed via a sidebar or top-level navigation.
 * Conversations appear in a list; clicking one opens the chat view.
 */
export const CHAT_SELECTORS = {
  messagesTabEn: 'a[href*="/app/connections"]',
  messagesTabAlt: 'button:has-text("Chats")',
  messagesTabFallback: 'text=/chats|connections|messages/i',

  conversationItem: '.contact',
  conversationName: '.contact__name',
  conversationLink: 'a[href*="/app/chat/"]',

  chatHeaderName: '.messages-header__name',
  chatTextarea: 'textarea',
  chatSendButton: 'button[type="submit"]',

  messageElement: '.message',
  messageIncoming: '.message--in',
  messageOutgoing: '.message--out',
} as const;

export type ChatSelectorKey = keyof typeof CHAT_SELECTORS;
