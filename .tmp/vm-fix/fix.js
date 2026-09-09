const { Voicemeeter } = require('voicemeeter-connector');
(async () => {
  const vm = await Voicemeeter.init('basic');
  vm.connect();
  // Zero out Comp/Gate on all hardware input strips (0-2) — kills the can-of-tuna compression.
  for (let s = 0; s < 3; s++) {
    vm.setParameter(`Strip[${s}].Comp`, 0);
    vm.setParameter(`Strip[${s}].Gate`, 0);
  }
  // Give the DLL a moment to apply, then read back.
  await new Promise(r => setTimeout(r, 800));
  for (let s = 0; s < 3; s++) {
    const comp = Number(vm.getParameter(`Strip[${s}].Comp`));
    const gate = Number(vm.getParameter(`Strip[${s}].Gate`));
    console.log(`strip${s}: comp=${comp} gate=${gate}`);
  }
  vm.disconnect();
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
