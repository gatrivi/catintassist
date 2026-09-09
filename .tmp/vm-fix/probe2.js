const { Voicemeeter } = require('voicemeeter-connector');
const clean = (v) => (typeof v === 'string' ? v.replace(/\0.*$/,'').trim() : v);
(async () => {
  const vm = await Voicemeeter.init('basic');
  vm.connect();
  const g = (n) => { try { return clean(vm.getParameter(n)); } catch { return 'ERR'; } };
  for (const s of [0,1,2]) {
    console.log(`strip${s}: dev=${g(`Strip[${s}].device.name`)} comp=${g(`Strip[${s}].Comp`)} gate=${g(`Strip[${s}].Gate`)} gain=${g(`Strip[${s}].Gain`)} A1=${g(`Strip[${s}].A1`)} B1=${g(`Strip[${s}].B1`)} mute=${g(`Strip[${s}].Mute`)}`);
  }
  console.log('A1 dev =', g('Bus[0].device.name'), '| sr =', g('Bus[0].device.sr'));
  console.log('A2 dev =', g('Bus[1].device.name'));
  vm.disconnect(); process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
