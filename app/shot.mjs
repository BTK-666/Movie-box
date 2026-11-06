import { chromium } from 'playwright';
const shots = [
  ['home', '/'],
  ['detail', '/detail/tv01'],
  ['player', '/player/t01'],
  ['search', '/search'],
  ['downloads', '/downloads'],
  ['me', '/me'],
  ['novels', '/novels'],
  ['fight', '/fight'],
  ['shorts', '/shorts'],
  ['live', '/live'],
  ['settings', '/settings'],
  ['browse', '/browse/movie'],
];
const b = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const [name, r] of shots) {
  await pg.goto('http://localhost:5173/#' + r, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(2500);
  await pg.screenshot({ path: `/workspace/shots/${name}.png` });
  console.log('shot', name);
}
await b.close();
