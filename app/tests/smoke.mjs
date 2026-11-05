import { chromium } from 'playwright';
const routes = ['/', '/novels', '/fight', '/downloads', '/me', '/detail/t01', '/detail/tv01', '/player/t01', '/search', '/shorts', '/live', '/browse/movie', '/addons', '/settings', '/history', '/favorites', '/novels/n1'];
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
pg.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
for (const r of routes) {
  await pg.goto('http://localhost:5173/#' + r, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(600);
  const bodyLen = (await pg.textContent('body'))?.length || 0;
  const errCount = await pg.locator('text=Not found').count();
  console.log(`${r.padEnd(16)} len=${String(bodyLen).padStart(5)} notfound=${errCount}`);
}
console.log('\n=== CONSOLE ERRORS (' + errors.length + ') ===');
[...new Set(errors)].slice(0, 30).forEach(e => console.log('- ' + e));
await b.close();
