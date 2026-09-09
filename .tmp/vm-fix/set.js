const { Voicemeeter } = require('voicemeeter-connector');
(async () => {
  const vm = await Voicemeeter.init('basic');
  vm.connect();
  const g = (p) => { try { return vm.getParameter(p); } catch { return 'n/a'; } };
  for (let s = 0; s < 3; s++) {
    console.log(`strip${s} label=${g(`Strip[${s}].Label`)} comp=${Number(g(`Strip[${s}].Comp`)).toFixed(2)} gate=${Number(g(`Strip[${s}].Gate`)).toFixed(2)} mute=${g(`Strip[${s}].Mute`)}`);
  }
  console.log('A1=', g('Bus[0].device.name'), '| B1=', g('Bus[1].device.name'));
  vm.disconnect();
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
