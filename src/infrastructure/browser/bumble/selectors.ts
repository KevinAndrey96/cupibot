/**
 * Centralized CSS selectors for Bumble's web UI.
 * Update these when Bumble changes their DOM structure.
 *
 * Swipe actions use keyboard shortcuts (ArrowRight / ArrowLeft) as the
 * primary mechanism, since Bumble supports arrow-key swiping and direct
 * .click() on Bumble buttons is unreliable.
 */
export const SELECTORS = {
  encountersStory: '.encounters-story-profile',
  encountersCard: '[class*="encounters-story"]',
  encountersAction: '.encounters-action',

  likeButton: '.encounters-action--like',
  dislikeButton: '.encounters-action--dislike',
  superSwipeButton: '.encounters-action--superswipe',
  likeButtonData: '[data-qa-role="encounters-action-like"]',

  profileName: '.encounters-story-profile__name',
  profileAge: '.encounters-story-profile__age',
  profileAbout: '.encounters-story-about__text',
  profilePhoto: '.media-box__picture-image',
  photoContainer: '.encounters-story-profile__gallery',

  matchDialog: '[class*="connection"]',
  matchText: 'text=/you.*matched/i',
  matchKeepSwiping: 'button:has-text("Keep Swiping")',

  noThanksButton: 'button:has-text("No, thanks")',
  maybeLaterButton: 'button:has-text("Maybe Later")',
  notNowButton: 'button:has-text("Not now")',
  closeButton: 'button:has-text("Close")',
  gotItButton: 'button:has-text("Got it")',
  continueButton: 'button:has-text("Continue")',

  outOfVotesText: 'text=/out of.*votes/i',
  outOfLikesText: 'text=/out of.*likes/i',
  getMoreButton: 'button:has-text("Get More")',
  upgradeButton: 'button:has-text("Upgrade")',

  allowCookiesButton: 'button:has-text("Accept")',
  locationDismiss: 'button:has-text("Maybe Later")',
} as const;

export type SelectorKey = keyof typeof SELECTORS;
