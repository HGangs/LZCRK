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
const login=(a,p)=>{ w.eval('showLogin()'); q('#lg-account').value=a; q('#lg-pwd').value=p; click('[data-act="doLogin"]'); };
setTimeout(()=>{
  login('admin',('sl'+'123456'));
  console.log('session persisted:', w.localStorage.getItem('wms_session_v1'));
  console.log('boot backups:', bks().length);
  // 自动备份：20 次变更
  w.eval('for(let i=0;i<19;i++) saveDB();');
  console.log('after 19 saves:', bks().length);
  w.eval('saveDB();');
  console.log('after 20 saves:', bks().length, '| latest:', bks()[0].note);
  // 重置保留账号
  click('.nav-item[data-page="accounts"]');
  click('[data-act="newUser"]');
  q('#au-name').value='保留测试'; q('#au-account').value='keep01'; click('[data-act="saveUser"]');
  const un=db().users.length;
  click('[data-act="nav"][data-page="settings"]');
  click('[data-act="resetDB"]');
  q('#cf-chk') && (q('#cf-chk').checked=true);
  click('[data-act="confirmOk"]');
  console.log('reset: users kept', db().users.length===un, '| projects', db().projects.length, '| logs', db().logs.length, '| name', db().settings.appName);
  // 游客直接访问系统页
  w.eval("session={userId:'',guest:true};saveSession();state.page='accounts';render();");
  console.log('guest forced accounts ->', q('#pageTitle').textContent, '| login overlay:', !!q('.login-wrap'));
  // 未授权角色（空权限）
  w.eval("var u=db.users.find(x=>x.account==='zhangwei');db.roles.find(r=>r.id===u.roleId).perms={};saveDB();invalidatePerms();");
  login('zhangwei','123456');
  click('.nav-item[data-page="stock"]');
  console.log('empty-role fallback nav:', qa('.nav-item').length, '| stock banner:', !!q('.ro-banner'), '| note disabled:', q('#stockTable input[data-change="stockNote"]').disabled);
  // 删除角色保护
  w.eval("session={userId:'u_admin',guest:false};saveSession();state.page='accounts';state.acctTab='roles';render();");
  click('[data-act="editRole"][data-id="r_keeper"]');
  click('[data-act="permAll"]');
  console.log('permAll count:', q('#permCount').textContent);
  click('[data-act="permRow"][data-mod="logs"]');
  console.log('permRow toggled:', q('#permCount').textContent);
  click('[data-act="saveRole"]');
  console.log('role saved, logs perms:', JSON.stringify(db().roles.find(r=>r.id==='r_keeper').perms.logs));
  // 还原 r_keeper 权限? 不需要
  // 备份恢复含账号
  click('[data-act="nav"][data-page="backups"]');
  console.log('backup cards:', qa('.bk-card').length);
  console.log('=== ERRORS(',errors.length,'):',errors.slice(0,8).join(' ; '));
  try{ w.close(); }catch(e){}
},700);
