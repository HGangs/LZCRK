const fs=require('fs');
const env=require('./_env');
const {JSDOM}=env.resolveJsdom();
const html=fs.readFileSync(env.HTML,'utf8');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,
  beforeParse(w){ try{ w.localStorage.clear(); }catch(e){} }});
const w=dom.window,d=w.document;
w.addEventListener('error',e=>errors.push('ERR: '+e.message));
const q=s=>d.querySelector(s), qa=s=>[...d.querySelectorAll(s)];
const click=s=>{const el=q(s); if(!el){errors.push('missing '+s);return false;} el.click(); return true;};
const db=()=>JSON.parse(w.localStorage.getItem('wms_workbench_v2'));
const bks=()=>JSON.parse(w.localStorage.getItem('wms_backups_v1')||'[]');
const ev=(el,t)=>{el.dispatchEvent(new w.Event(t,{bubbles:true,cancelable:true}));};
const toast=()=>{const a=qa('.toast'); return a.length? a[a.length-1].textContent : '';};
const SUP='sl'+'123456';
const logout=()=>{ click('[data-act="myAccount"]'); const el=q('.modal [data-act="logout"]'); if(el) el.click(); else errors.push('no logout btn'); if(!q('.login-wrap')) w.eval('showLogin()'); };
const login=(a,p)=>{ if(!q('.login-wrap')){ if(w.eval('!!session.userId')) logout(); else w.eval('showLogin()'); } q('#lg-account').value=a; q('#lg-pwd').value=p; click('[data-act="doLogin"]'); };
const chk=(name,cond)=>{ if(!cond) errors.push('FAIL: '+name); return cond; };

setTimeout(()=>{
  // ── 1. 超管账号
  login('admin', SUP);
  console.log('super login:', !q('.login-wrap'), '| user:', q('.user-chip .un').textContent, '| log act:', db().logs[0].action);
  chk('super login ok', !q('.login-wrap'));
  console.log('account in db:', db().users[0].account, '| pwd is hash:', db().users[0].pwd.slice(0,1)==='p');
  // 旧账号 useradmin 应已不存在
  login('useradmin','123456');
  console.log('legacy useradmin blocked:', q('#lg-error').textContent);
  login('admin', SUP);

  // ── 2. 自助修改密码
  click('[data-act="myAccount"]');
  console.log('pwd inputs:', !!q('#pw-old'), !!q('#pw-new'), !!q('#pw-new2'));
  q('#pw-old').value='wrongone'; q('#pw-new').value='abc123456'; q('#pw-new2').value='abc123456';
  click('[data-act="changePwd"]');
  console.log('wrong old ->', toast());
  q('#pw-old').value=SUP; q('#pw-new').value='abc'; q('#pw-new2').value='abc';
  click('[data-act="changePwd"]');
  console.log('short new ->', toast());
  q('#pw-new').value='abc123456'; q('#pw-new2').value='abc123457';
  click('[data-act="changePwd"]');
  console.log('mismatch ->', toast());
  q('#pw-new2').value='abc123456';
  click('[data-act="changePwd"]');
  console.log('changed ->', toast(), '| modal closed:', !q('.modal'));
  console.log('pwd log:', db().logs[0].module, db().logs[0].action, db().logs[0].detail);
  // 退出后用新密码登录
  logout();
  login('admin','abc123456');
  console.log('login with new pwd:', !q('.login-wrap'));
  chk('new pwd works', !q('.login-wrap'));
  logout();
  login('admin', SUP);
  console.log('old pwd rejected:', q('#lg-error').textContent);
  chk('old pwd rejected', !!q('#lg-error'));
  login('admin','abc123456');

  // ── 3. 备份设置
  click('.nav-item[data-page="backups"]');
  console.log('cfg card:', !!q('#bk-time'), !!q('#bk-on'), !!q('#bk-apath'), !!q('#bk-mpath'), '| remind:', !!q('#bk-mremind'));
  q('#bk-time').value='03:30';
  q('#bk-gap').value='45';
  q('#bk-thr').value='5';
  q('#bk-akeep').value='2';
  q('#bk-apath').value='D:/WMS/auto';
  q('#bk-mkeep').value='3';
  q('#bk-mremind').value='10';
  q('#bk-mpath').value='D:/WMS/manual';
  click('[data-act="saveBackupCfg"]');
  const cfg=db().settings.bk;
  console.log('saved cfg:', JSON.stringify(cfg));
  console.log('toast:', toast());
  chk('cfg persisted', cfg.autoTime==='03:30' && cfg.autoIntervalMin===45 && cfg.autoThreshold===5 && cfg.autoKeep===2 && cfg.manualKeep===3 && cfg.autoPath==='D:/WMS/auto' && cfg.manualPath==='D:/WMS/manual');
  console.log('summary text has 03:30/45/5:', q('#view').textContent.includes('03:30'), q('#view').textContent.includes('45'), q('#view').textContent.includes('5'));
  // 手动备份带路径
  click('[data-act="newBackup"]');
  q('#bk-note').value='t5 手动备份';
  click('[data-act="doBackup"]');
  const mb=bks().find(b=>b.note==='t5 手动备份');
  console.log('manual backup path:', mb && mb.path, '| type:', mb && mb.type);
  chk('manual path recorded', mb && mb.path==='D:/WMS/manual');
  // 保留份数生效：manualKeep=3
  for(let i=0;i<5;i++) w.eval("createBackup('manual','溢出测试"+i+"')");
  const mcount=bks().filter(b=>b.type==='manual').length;
  console.log('manual kept <= keep(3):', mcount, mcount<=3);
  chk('manual trim', mcount<=3);

  // ── 4. 自动备份：关闭后不触发
  q('#bk-on').checked=false; click('[data-act="saveBackupCfg"]');
  const before=bks().length;
  for(let i=0;i<10;i++) w.eval("dirtyCount=0;noteChange()");
  console.log('auto off, backups unchanged:', bks().length===before, '| enabled:', db().settings.bk.autoEnabled);
  chk('auto off respected', bks().length===before);
  // 打开并设定已过时刻 → 定时补一份
  q('#bk-on').checked=true; q('#bk-time').value='00:01'; click('[data-act="saveBackupCfg"]');
  w.eval("backups=backups.filter(b=>b.type!=='auto');saveBackups();");
  w.eval("checkScheduledBackup()");
  const autoAfter=bks().filter(b=>b.type==='auto');
  console.log('scheduled backup created:', autoAfter.length, '| note:', autoAfter[0] && autoAfter[0].note);
  chk('scheduled backup', autoAfter.length===1);
  // 自动保留份数=2
  for(let i=0;i<4;i++) w.eval("createBackup('auto','自动溢出"+i+"')");
  console.log('auto kept <= 2:', bks().filter(b=>b.type==='auto').length);

  // ── 5. 登录背景图渲染
  w.eval("db.settings.loginBg='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';saveDB();");
  click('.nav-item[data-page="settings"]');
  console.log('settings preview:', !!q('.login-bg-prev'), q('.login-bg-prev').className.includes('has'), '| clear btn:', !!q('[data-act="clearLoginBg"]'));
  logout();
  const wrap=q('.login-wrap');
  console.log('login bg applied:', wrap.className.includes('has-bg'), '| style:', (wrap.getAttribute('style')||'').slice(0,42));
  chk('login bg applied', wrap.className.includes('has-bg'));
  // 移除背景
  login('admin','abc123456');
  click('.nav-item[data-page="settings"]');
  click('[data-act="clearLoginBg"]');
  click('[data-act="confirmOk"]');
  console.log('bg cleared:', db().settings.loginBg==='', '| login bg gone:', (()=>{ logout(); const x=q('.login-wrap'); const ok=!x.className.includes('has-bg'); login('admin','abc123456'); return ok; })());
  chk('bg cleared', db().settings.loginBg==='');

  // ── 6. 旧数据迁移：useradmin -> admin
  w.eval("db.users[0].account='useradmin';db.users[0].pwd=hashPw('123456');db.users[0].status='启用';saveDB();");
  console.log('before migrate:', db().users[0].account);
  w.eval("normalizeDB();saveDB();");
  const su=db().users.find(u=>u.account==='admin');
  console.log('after migrate:', !!su, '| pwd == SUPER:', su && su.pwd===w.eval('hashPw(SUPER_PASSWORD)'), '| role:', su && su.roleId, '| status:', su && su.status);
  chk('migrated to admin', !!su && su.pwd===w.eval('hashPw(SUPER_PASSWORD)'));

  console.log('=== ERRORS(',errors.length,'):',errors.slice(0,8).join(' ; '));
  try{ w.close(); }catch(e){}
},700);
