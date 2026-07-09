import splitSiblingFailure from './split-sibling-failure.json';
import garbageFiller from './garbage-filler.json';
import rateLimitFallback from './rate-limit-fallback.json';
import refreshRecovery from './refresh-recovery.json';
import sensitiveTokenLoss from './sensitive-token-loss.json';
import staleLateResponse from './stale-late-response.json';
import longMonologue from './long-monologue.json';
import previousGoodSurvivesBlank from './previous-good-survives-blank.json';
import siblingGoodSurvivesOtherFail from './sibling-good-survives-other-fail.json';
import sameCaptionNewSourceInvalidatesOld from './same-caption-new-source-invalidates-old.json';
import userOverrideWins from './user-override-wins.json';
import numberPresentButReformatted from './number-present-but-reformatted.json';
import quotaBlackoutPassthrough from './quota-blackout-passthrough.json';

export const TRANSLATION_FIXTURES = [
  splitSiblingFailure,
  garbageFiller,
  rateLimitFallback,
  refreshRecovery,
  sensitiveTokenLoss,
  staleLateResponse,
  longMonologue,
  previousGoodSurvivesBlank,
  siblingGoodSurvivesOtherFail,
  sameCaptionNewSourceInvalidatesOld,
  userOverrideWins,
  numberPresentButReformatted,
  quotaBlackoutPassthrough,
];

export default TRANSLATION_FIXTURES;
