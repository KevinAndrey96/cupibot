/**
 * Centralized CSS selectors for Tinder's web UI (2025/2026 version).
 * Update these when Tinder changes their DOM structure.
 *
 * Swipe actions use keyboard shortcuts (ArrowRight / ArrowLeft) instead
 * of button clicks, since Tinder's keyboard shortcuts are more stable
 * across DOM changes than button aria-labels or class names.
 */
export const SELECTORS = {
  // Swipe action button area (used only for detection, not for clicking)
  actionBar: '[class*="Bdrs(50%)"]',
  recsCardBoard: '[class*="recsCardboard"]',
  gamepadContainer: '[class*="gamepad"]',
  profileCard: '[class*="Expand"]',

  // Match popup - Tinder shows a full-screen overlay on match
  matchDialog: '[role="dialog"]',
  matchPopupAnchor: 'a[href*="/app/matches"]',
  matchText: 'text=/it.*s a match/i',

  // Match popup message input and send button
  matchMessageInput: 'textarea[placeholder*="Say something nice"]',
  matchSendButton: 'button:has-text("Send")',
  matchCloseButton: '[role="dialog"] button:first-child',

  // Generic popup/modal dismissal buttons (broadened for latest Tinder)
  noThanksButton: 'button:has-text("No Thanks")',
  maybeLaterButton: 'button:has-text("Maybe Later")',
  notNowButton: 'button:has-text("Not now")',
  notInterestedButton: 'button:has-text("Not interested")',
  closeButton: 'button:has-text("Close")',
  backToTinderButton: 'button:has-text("Back to Tinder")',
  keepSwipingButton: 'button:has-text("Keep Swiping")',

  // Out-of-likes detection
  outOfLikesText: 'text=/out of likes/i',
  getMoreLikesButton: 'button:has-text("Get More Likes")',
  subscribeButton: 'a:has-text("Subscribe")',

  // Profile card container (for screenshotting the photo area)
  cardPhotoContainer: '[class*="keen-slider"]',
  cardPhotoContainerAlt: '[class*="recsCardboard"] > div:first-child',
  cardPhotoContainerAlt2: '[class*="gamepad"] [class*="Expand"]',

  // Cookie consent and permission dialogs
  allowCookiesButton: 'button:has-text("I Accept")',
  locationDismiss: 'button:has-text("Maybe Later")',
} as const;

export type SelectorKey = keyof typeof SELECTORS;
