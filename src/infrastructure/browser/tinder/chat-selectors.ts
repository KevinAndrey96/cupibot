/**
 * CSS selectors for Tinder's messaging UI.
 *
 * The messages section is accessed via a sidebar tab (not a separate URL).
 * Conversation items appear in the sidebar list below the "Messages" tab.
 * Clicking a conversation opens the chat in the main content area.
 */
export const CHAT_SELECTORS = {
  // Sidebar "Messages" tab - works for English and Portuguese UIs
  messagesTabEn: 'button:has-text("Messages")',
  messagesTabPt: 'button:has-text("Mensagens")',
  messagesTabFallback: 'text=/messages|mensagens/i',

  // Each conversation in the sidebar (may be an <a> or a clickable element)
  conversationLink: 'a[href*="/app/messages/"]',

  // Chat text input at the bottom of an open conversation
  chatTextarea: 'textarea',

  // Send button
  chatSendButton: 'button[type="submit"]',
} as const;

export type ChatSelectorKey = keyof typeof CHAT_SELECTORS;
