// End-to-end proof that a SERIES episode plays through the real UI: boots the
// built app, opens a title, presses Play, and asserts the <video> decodes a real
// episode with no Referer leak. Series resolve through the UGC fallback, so this
// is the regression test for anime/TV playback.
import { chromium } from 'playwright';
import https from 'node:https';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const ROOT='dist';
const appUa=JSON.parse(readFileSync('capacitor.config.json','utf8')).android.overrideUserAgent;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg'};
execSync('openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/e2e-series-key.pem -out /tmp/e2e-series-cert.pem -days 1 -subj "/CN=localhost" 2>/dev/null');
const server=https.createServer({key:readFileSync('/tmp/e2e-series-key.pem'),cert:readFileSync('/tmp/e2e-series-cert.pem')},(req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]); let f=join(ROOT,p);
  if(!existsSync(f)||statSync(f).isDirectory()) f=join(ROOT,'index.html');
  res.writeHead(200,{'content-type':MIME[extname(f)]||'application/octet-stream'}); res.end(readFileSync(f));
});
await new Promise(r=>server.listen(8445,r));
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--ignore-certificate-errors','--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({userAgent:appUa,ignoreHTTPSErrors:true});
const pg=await ctx.newPage();
const refs=[];
pg.on('request',r=>{if(/hakunaymatata\.com/.test(r.url()))refs.push(r.headers()['referer']??null);});
// Stable public subject id for "Naruto [Hindi] S1-S2" (S1=220 eps, S2=20).
await pg.goto('https://localhost:8445/#/detail/4360485895745717992',{waitUntil:'domcontentloaded'});
await pg.waitForFunction(()=>document.body.innerText.includes('Naruto'),{timeout:90000});
await pg.waitForTimeout(8000);
const play = pg.locator('.btn-primary', {hasText:/Play|Resume/});
await play.waitFor({timeout:60000});
console.log('detail ok:', (await pg.evaluate(()=>location.hash)).slice(0,50));
await play.click();
await pg.waitForSelector('.vp-inline video',{timeout:60000});
console.log('inline player:', await pg.evaluate(()=>location.hash));
const r=await pg.evaluate(async()=>{const v=document.querySelector('video');if(!v)return{missing:true};
 const d=Date.now()+60000; while(Date.now()<d){if(v.readyState>=2&&v.duration>0)break;if(v.error)return{err:v.error.code,rs:v.readyState};await new Promise(x=>setTimeout(x,500));}
 try{await v.play()}catch{} await new Promise(x=>setTimeout(x,4000));
 return{rs:v.readyState,err:v.error?v.error.code:null,dur:v.duration,cur:v.currentTime};});
console.log('video:',JSON.stringify(r));
console.log('referers:',JSON.stringify(refs.slice(-4)));
const pass=r&&!r.missing&&!r.err&&r.dur>600&&refs.every(x=>!x);
console.log(pass?'\nPASS series episode plays end-to-end':'\nFAIL');
await b.close();server.close();process.exit(pass?0:1);
