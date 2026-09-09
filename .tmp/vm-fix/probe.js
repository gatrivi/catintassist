const { Voicemeeter } = require('voicemeeter-connector');
(async () => {
  const vm = await Voicemeeter.init('basic');
  vm.connect();
  const names = [
    'Strip[0].Comp','Strip[0].Gate','Strip[0].Gain','Strip[0].Mute','Strip[0].Solo',
    'Strip[0].Limit','Strip[0].A1','Strip[0].B1','Strip[0].EQGain1',
    'Bus[0].Gain','Bus[0].Mute','Bus[1].Gain',
    'vban.in[0].sr','vban.out[0].sr',
  ];
  for (const n of names) {
    let v; try { v = vm.getParameter(n); } catch(e){ v = 'ERR '+e.message; }
    console.log(n, '=', typeof v === 'string' ? JSON.stringify(v.slice(0,20)) : v);
  }
  vm.disconnect(); process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
