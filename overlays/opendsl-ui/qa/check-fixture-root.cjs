// A copied fixture must serve the copied assets, never the original checkout.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../../..');
(async () => {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'opendsl-qa-root-'));
  let host;
  try {
    for (const file of ['overlays/opendsl-ui/legacy-contracts.json',
      'overlays/native-english/userfs/EN.dict',
      ...['host-fixture', 'native-menu-fixture', 'native-footer-fixture'].map(name => 'overlays/opendsl-ui/qa/' + name + '.cjs')]) {
      const target = path.join(copy, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(ROOT, file), target);
    }
    const asset = path.join(copy, 'overlays/opendsl-ui/boaroot/html/opendsl/legacy.js');
    fs.mkdirSync(path.dirname(asset), { recursive: true });
    fs.writeFileSync(asset, 'copied-checkout-asset');
    host = await require(path.join(copy, 'overlays/opendsl-ui/qa/host-fixture.cjs')).start();
    const response = await fetch(host.base + '/opendsl/legacy.js');
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'copied-checkout-asset');
    console.log('PASS: relocated fixture serves only its own checkout asset');
  } finally {
    if (host) await new Promise(resolve => host.server.close(resolve));
    fs.rmSync(copy, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
