import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { User, Score, Match } from '../server/models.js';
import { connect, disconnect } from 'mongoose';
import Army from '../games/automate/setup.js';

const output = 'demo/out'; mkdirSync(output,{recursive:true});
const browser=await chromium.launch();
const eventLog=[], apiLog=[];
const base='http://127.0.0.1:5173', apiBase='http://127.0.0.1:3000';
const userA='demoA'+Date.now().toString().slice(-7), userB='demoB'+Date.now().toString().slice(-7);
const pass='demo-password-123';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function context(){return browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,recordVideo:{dir:output,size:{width:1920,height:1080}}})}
async function capture(page,key,ms=900){await page.screenshot({path:output+'/'+key+'.png'});eventLog.push({key,url:page.url()});await pause(ms)}
async function formRegister(page,user){
 await page.goto(base+'/register'); await page.locator('input[name=name]').fill(user);
 await page.locator('input[name=password]').fill(pass);
 await capture(page,'register-'+user,400);
 await page.getByRole('button',{name:'Register'}).click();
 await page.locator('.user-name').getByText(user).waitFor();
}
let aCtx,bCtx;
try {
 aCtx=await context();const a=await aCtx.newPage();
 await a.goto(base);await a.getByRole('link',{name:'Scarab 21'}).waitFor();await capture(a,'01-home',2400);
 await formRegister(a,userA);await capture(a,'02-registered',1600);
 await a.getByRole('button',{name:'Log out'}).click();
 await a.getByRole('link',{name:'Log in'}).click();
 await a.locator('input[name=name]').fill(userA);
 await a.locator('input[name=password]').fill('wrong-pass');
 await a.getByRole('button',{name:'Log in'}).click();
 await a.getByRole('alert').waitFor();await capture(a,'03-invalid-login',1300);
 await a.locator('input[name=password]').fill(pass);
 await a.getByRole('button',{name:'Log in'}).click();
 await a.locator('.user-name').getByText(userA).waitFor();
 await a.reload();await a.locator('.user-name').getByText(userA).waitFor();await capture(a,'04-session-refresh',2400);
 await a.getByRole('link',{name:'Scarab 21'}).click();
 const g=a.frameLocator('iframe');await g.locator('.place').first().waitFor();await capture(a,'05-scarab-in-site',1800);
 for(let i=0;i<220;i++){
  if(await g.locator('#again').isVisible())break;
  const legal=g.locator('.place:not([disabled])');
  if(!await legal.count())break;
  const clears=g.locator('.place[data-result=column],.place[data-result=board]');
  await (await clears.count()?clears.first():legal.first()).click();
  if(i%14===0)await pause(100);
 }
 if(!await g.locator('#again').isVisible())throw Error('Scarab run did not finish');
 await capture(a,'06-scarab-finished',2000);
 await a.getByRole('heading',{name:'Leaderboard'}).scrollIntoViewIfNeeded();
 for(let i=0;i<18;i++){if((await a.locator('table').innerText()).includes(userA))break;await pause(300)}
 if(!(await a.locator('table').innerText()).includes(userA))throw Error('Score missing from leaderboard');
 await capture(a,'07-score-on-leaderboard',1800);
 await a.goto(base+'/play/automate');
 await a.getByRole('button',{name:'New online match'}).click();
 await a.getByRole('button',{name:'Cancel match'}).waitFor();await capture(a,'08-match-waiting',1000);
 a.once('dialog',d=>d.accept());
 await a.getByRole('button',{name:'Cancel match'}).click();
 await a.getByRole('button',{name:'New online match'}).waitFor();await capture(a,'09-cancelled',1300);
 await a.getByRole('button',{name:'New online match'}).click();
 const invite=a.url();await capture(a,'10-match-invite',1600);
 bCtx=await context();const b=await bCtx.newPage();await formRegister(b,userB);
 await b.goto(invite);await b.getByRole('button',{name:'Join this match'}).click();
 await b.getByText('in progress').waitFor();
 await a.getByText('in progress').waitFor({timeout:15000});
 await capture(a,'11-match-player-A',1600);
 await capture(b,'12-match-player-B',1600);
 await bCtx.close();bCtx=null;await aCtx.close();aCtx=null;
 const cookies={owner:'',opponent:'',guest:''};
 async function req(who,method,uri,body){
  const headers={};if(cookies[who])headers.Cookie=cookies[who];
  if(body!==undefined)headers['Content-Type']='application/json';
  const r=await fetch(apiBase+uri,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const cookie=r.headers.get('set-cookie');if(cookie)cookies[who]=cookie.split(';')[0];
  const t=await r.text();const data=t?JSON.parse(t):null;
  apiLog.push({method,path:uri,request:body===undefined?null:JSON.parse(JSON.stringify(body,(k,v)=>k==='password'?'[redacted]':v)),status:r.status,response:data});
  return {status:r.status,data};
 }
 const apiUser='apiA'+Date.now().toString().slice(-7),apiOpponent='apiB'+Date.now().toString().slice(-7);
 const check=(r,s)=>{if(r.status!==s)throw Error('Expected '+s+', received '+JSON.stringify(r))};
 check(await req('owner','POST','/api/auth/register',{name:apiUser,password:pass}),201);
 check(await req('owner','POST','/api/auth/logout'),204);
 check(await req('owner','POST','/api/auth/login',{name:apiUser,password:'wrong'}),401);
 check(await req('owner','POST','/api/auth/login',{name:apiUser,password:pass}),200);
 check(await req('owner','GET','/api/me'),200);
 check(await req('guest','POST','/api/games/scarab-21/scores',{score:87}),401);
 check(await req('owner','POST','/api/games/scarab-21/scores',{score:87}),201);
 check(await req('owner','GET','/api/games/scarab-21/leaderboard'),200);
 const cancelled=await req('owner','POST','/api/games/automate/matches');check(cancelled,201);
 const cancelId=cancelled.data.id;
 check(await req('owner','GET','/api/matches/'+cancelId),200);
 check(await req('owner','DELETE','/api/matches/'+cancelId),204);
 check(await req('owner','GET','/api/matches/'+cancelId),404);
 check(await req('opponent','POST','/api/auth/register',{name:apiOpponent,password:pass}),201);
 const active=await req('owner','POST','/api/games/automate/matches');check(active,201);
 const joined=await req('opponent','POST','/api/matches/'+active.data.id+'/join');check(joined,200);
 const draft=Army.perform(Army.create(),'K',60).state;
 check(await req('owner','PUT','/api/matches/'+active.data.id,{version:joined.data.version,turn:1,state:{phase:'draft',draft:Army.snapshot(draft),runner:null,moves:[]}}),200);
 await connect(process.env.MONGODB_URI);
 const docs={users:await User.find({name:{$in:[userA,userB,apiUser,apiOpponent]}}).select('name createdAt').lean(),scores:await Score.find({game:'scarab-21'}).select('user game score createdAt').lean(),matches:await Match.find({game:'automate'}).select('players game status turn version state').lean(),cancelledMatchCount:await Match.countDocuments({_id:cancelId})};
 if(docs.cancelledMatchCount!==0)throw Error('Cancelled match remains in DB');
 writeFileSync(output+'/db-documents.json',JSON.stringify(docs,null,2));
 writeFileSync(output+'/api-responses.json',JSON.stringify(apiLog,null,2));
 writeFileSync(output+'/timeline.json',JSON.stringify(eventLog,null,2));
 await disconnect();
 console.log('Captured real browser sessions, live API requests, and MongoDB data.');
} finally {if(bCtx)await bCtx.close().catch(()=>{});if(aCtx)await aCtx.close().catch(()=>{});await browser.close()}
