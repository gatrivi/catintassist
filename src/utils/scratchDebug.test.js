import {
  detectSentinelContext,
  maskDateUnits,
  stitchSingleDigitSequences,
  looksLikeDateFragment,
  looksLikeAddressFragment,
} from './sensitiveDataProtector';

describe('scratch debug Phase G ES', () => {
  it('logs intermediates', () => {
    const raw = 'viene el número de afiliado 1 0 1 3 1 5 9 5 1 6';
    console.log('sentinel:', JSON.stringify(detectSentinelContext(raw, 'es')));
    const { text: masked } = maskDateUnits(raw);
    console.log('masked:', JSON.stringify(masked));
    console.log('stitched:', JSON.stringify(stitchSingleDigitSequences(masked)));
    const runStart = raw.indexOf('1 0');
    const before = raw.slice(Math.max(0, runStart - 40), runStart);
    console.log('before:', JSON.stringify(before));
    console.log('dateFrag:', looksLikeDateFragment(before, ''));
    console.log('addrFrag:', looksLikeAddressFragment(before, ''));
  });
});
