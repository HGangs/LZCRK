/* t13：时间校准（HTTPS 时间源） + 全模块时间戳一致性 */
const fs=require('fs');
const env=require('./_env');
const {JSDOM}=env.resolveJsdom();
const html=fs.readFileSync(env.HTML,'utf8');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,
  beforeParse(w){ try{ w.localStorage.clear(); w.fetch = async () => ({ok:true, json:async()=>({unixtime: Math.floor(Date.now()/1000) + 3600})}); }catch(e){} }});
const w=dom.window,d=w.document;
w.addEventListener('error',e=>errors.push('ERR: '+e.message));
const q=s=>d.querySelector(s), qa=s=>[...d.querySelectorAll(s)];
const click=s=>{const el=q(s); if(!el){errors.push('missing '+s);return false;} el.click(); return true;};
const db=()=>JSON.parse(w.localStorage.getItem('wms_workbench_v2'));
const txt=s=>{const el=q(s); return el ? el.textContent.replace(/\s+/g,' ').trim() : ''};
const pad=n=>String(n).padStart(2,'0');
const fmt=ms=>{const x=new Date(ms);return x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate())+' '+pad(x.getHours())+':'+pad(x.getMinutes());};

setTimeout(async ()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');

  console.log('--- 1. 初始化：未校准 ---');
  console.log('offset:', w.eval('timeCfg().offset'), '| nowTs:', w.eval('nowTs()'), '| local:', fmt(Date.now()));

  console.log('\n--- 2. 校准（时间源 +3600s） ---');
  const ok = await w.eval('syncClock(false)');
  const off = w.eval('timeCfg().offset');
  console.log('sync ok:', ok, '| offset(ms):', off, '| ≈1h:', Math.abs(off - 3600000) < 5000,
    '| source:', w.eval('timeCfg().source'), '| syncedAt:', w.eval('timeCfg().syncedAt'));
  console.log('校准后 nowTs:', w.eval('nowTs()'), '| 本机:', fmt(Date.now()));
  const diffH = (w.eval('nowMs()') - Date.now()) / 3600000;
  console.log('时间差(小时):', diffH.toFixed(2));

  console.log('\n--- 3. 备份时间戳跟随校准 ---');
  w.eval("window.__dl=null; download=function(n,t){ window.__dl={name:n,text:t}; return true; };");
  click('.nav-item[data-page="backups"]');
  click('[data-act="newBackup"]');
  q('#bk-note').value='时间测试';
  click('[data-act="doBackup"]');
  await new Promise(r=>setTimeout(r,120));
  const b=JSON.parse(w.localStorage.getItem('wms_backups_v1'))[0];
  console.log('backup createdAt:', b.createdAt, '| filename:', (w.__dl||{}).name);
  const sameHour = b.createdAt.slice(11,13) === pad(new Date(Date.now()+off).getHours());
  console.log('createdAt 用校准时间:', sameHour, '| at-local ≈1h:', Math.round((b.at-Date.now())/1000) >= 3595);

  console.log('\n--- 4. 日志 / 单据默认日期 ---');
  const logTs = db().logs[0] ? db().logs[0].ts : '';
  console.log('latest log ts:', logTs, '| 与校准时间同小时:', logTs.slice(11,13) === pad(new Date(Date.now()+off).getHours()));
  click('.nav-item[data-page="inbound"]');
  console.log('inbound default date:', (q('#view input[type="date"]')||{}).value, '| today():', w.eval('today()'));

  console.log('\n--- 5. 设置页时间卡片 ---');
  click('.nav-item[data-page="settings"]');
  console.log('card:', txt('#view').indexOf('时间校准')>=0, '| sync btn:', !!q('[data-act="syncClock"]'),
    '| reset btn:', !!q('[data-act="resetClock"]'), '| auto chk:', !!(q('[data-change="clockAuto"]')||{}).checked);
  const cardTxt=txt('#view');
  console.log('card shows offset:', /偏差\s*\+?\d+(\.\d+)? 秒/.test(cardTxt), '|', (cardTxt.match(/偏差\s*\S+/)||[''])[0]);

  console.log('\n--- 6. 手动校准（外网接口不可用时的兜底） ---');
  click('[data-act="manualClock"]');
  console.log('manual modal:', !!q('#tm-now'), '| title:', ((q('.modal-head h3')||{}).textContent||''));
  const p2=n=>String(n).padStart(2,'0');
  const tgt=new Date(Date.now()+2*3600*1000);
  q('#tm-now').value = tgt.getFullYear()+'-'+p2(tgt.getMonth()+1)+'-'+p2(tgt.getDate())+' '+p2(tgt.getHours())+':'+p2(tgt.getMinutes())+':'+p2(tgt.getSeconds());
  click('[data-act="saveClockManual"]');
  const off2 = w.eval('timeCfg().offset');
  console.log('manual offset ≈+2h:', Math.abs(off2-7200000)<3000, '| source:', w.eval('timeCfg().source'),
    '| diag:', w.eval('timeCfg().diag').slice(0,30));
  console.log('nowTs 前进约 2h:', (w.eval('nowMs()')-Date.now())/3600000 >= 1.9);
  click('[data-act="manualClock"]');
  q('#tm-now').value = '2026/13/45 99:99';
  click('[data-act="saveClockManual"]');
  console.log('invalid rejected:', w.eval('timeCfg().offset')===off2, '| toast:', txt('#toast').slice(-26));
  click('[data-act="closeModal"]');

  console.log('\n--- 7. 恢复本机时间 ---');
  click('[data-act="resetClock"]');
  console.log('offset after reset:', w.eval('timeCfg().offset'), '| nowMs-local(ms):', w.eval('nowMs()') - Date.now());

  console.log('\n--- 8. 校准失败回退 ---');
  w.fetch = async () => { throw new Error('offline'); };
  const bad = await w.eval('syncClock(false)');
  console.log('offline sync:', bad, '| offset kept:', w.eval('timeCfg().offset'), '| toast:', txt('#toast').slice(-30));

  console.log('\nERRORS', errors.length, errors.slice(0,5).join(' | '));
  try{ w.close(); }catch(e){}
}, 900);
