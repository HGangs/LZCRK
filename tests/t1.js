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
const login=(a,p)=>{ click('[data-act="myAccount"]'); click('.modal [data-act="logout"]'); q('#lg-account').value=a; q('#lg-pwd').value=p; click('[data-act="doLogin"]'); };
const logout=()=>{ click('[data-act="myAccount"]'); const el=q('.modal [data-act="logout"]'); if(el) el.click(); else errors.push('no logout btn'); if(!q('.login-wrap')) w.eval('showLogin()'); };
setTimeout(()=>{
  console.log('--- boot（默认游客浏览，无登录墙）---');
  console.log('boot guest:', !q('.login-wrap'), '| chip:', q('.user-chip .un').textContent, '| sub:', q('.user-chip .ur').textContent);
  const gnav=qa('.nav-item').map(n=>n.dataset.page);
  console.log('guest nav:', gnav.join(','), '| count:', gnav.length);
  console.log('no 业务操作:', !gnav.includes('inbound') && !gnav.includes('outbound'),
    '| no 系统管理:', !['accounts','logs','backups','settings'].some(p=>gnav.includes(p)));
  console.log('ro pill:', !!q('.ro-pill'), '| 登录入口:', !!q('[data-act="showLogin"]'), '| chip:', q('.user-chip').tagName);
  // 未登录直接访问受限页 → 回落到可访问页
  w.eval("state.page='inbound';render();");
  console.log('guest forced inbound →', q('#pageTitle').textContent);
  // 只读浏览
  click('.nav-item[data-page="stock"]');
  console.log('guest stock:', q('#pageTitle').textContent, '| note disabled:', !!(q('#stockTable input[data-change="stockNote"]')||{}).disabled);
  click('.nav-item[data-page="projects"]');
  console.log('guest project banner:', !!q('.ro-banner'), '| new btn:', !!q('[data-act="newProject"]'), '| del btn:', !!q('[data-act="delProject"]'));
  // 右上角打开登录浮层 → 可关闭返回浏览
  w.eval('showLogin()');
  console.log('login overlay:', !!q('.login-wrap'), '| card:', !!q('.login-card'), '| title:', q('.login-brand h1').textContent,
    '| close btn:', !!q('[data-act="closeLogin"]'));
  console.log('inputs in card:', qa('.login-card input').length, '| account/pwd:', !!q('#lg-account'), !!q('#lg-pwd'),
    '| guest link:', q('.login-guest').textContent.replace(/\s+/g, ''));
  click('[data-act="closeLogin"]');
  console.log('close login → overlay gone:', !q('.login-wrap'), '| still guest:', q('.user-chip .un').textContent);
  // 登录 admin
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  console.log('admin login:', !q('.login-wrap'), '| user:', q('.user-chip .un').textContent, '| nav:', qa('.nav-item').length);
  console.log('system nav:', ['accounts','logs','backups','settings'].map(p=>!!q('.nav-item[data-page="'+p+'"]')).join(','));
  console.log('log entry:', db().logs[0].module, db().logs[0].action);

  console.log('--- 项目删除 ---');
  const before=db().projects.length;
  click('.nav-item[data-page="projects"]');
  const pid=q('.pcard').dataset.id;
  click('[data-act="delProject"]');
  console.log('confirm modal:', !!q('.modal'), '| checkbox:', !!q('#cf-chk'));
  click('[data-act="confirmOk"]');
  console.log('blocked without check:', db().projects.length===before, '|', qa('.toast').pop().textContent);
  q('#cf-chk').checked=true; click('[data-act="confirmOk"]');
  console.log('deleted:', before-db().projects.length, '| modal closed:', !q('.modal'));
  console.log('orphan cleared:', db().records.filter(r=>r.projectId===pid).length===0);
  // 无流水项目删除
  click('[data-act="newProject"]');
  q('#np-code').value='PRJ-DEL'; q('#np-name').value='待删除项目'; q('#np-owner').value='测试负责人';
  click('[data-act="saveProject"]');
  console.log('created new project:', db().projects.some(p=>p.code==='PRJ-DEL'));
  click('[data-act="delProject"]');
  click('[data-act="confirmOk"]');
  console.log('no-record project deleted (no checkbox):', !db().projects.some(p=>p.code==='PRJ-DEL'));

  console.log('--- 负责人筛选 ---');
  const owners=[...q('#ownerFilter').options].map(o=>o.value);
  console.log('owner options:', owners.join(','));
  const own=owners.find(o=>o!=='all');
  const of=q('#ownerFilter'); of.value=own; ev(of,'change');
  console.log('owner=' + own + ' cards:', qa('.pcard').length, '| all owner match:', qa('.pcard').every(c=>c.textContent.includes(own)));
  console.log('summary cols follow filter:', qa('#sumWrap thead th').length);
  // 与行政区组合：选一个该负责人项目不在的行政区 → 空态 + 清除按钮
  const pj=db().projects.find(p=>p.owner===own);
  const other=[...q('#districtFilter').options].map(o=>o.value).filter(v=>v!=='all'&&v!==pj.district)[0];
  const df=q('#districtFilter'); df.value=other; ev(df,'change');
  console.log('owner+district(' + other + ') empty:', qa('.pcard').length===0, '| empty text:', q('#view').textContent.includes('当前筛选条件下没有项目'), '| reset btn:', !!q('[data-act="resetProjFilter"]'));
  click('[data-act="resetProjFilter"]');
  console.log('after reset cards:', qa('.pcard').length, '| district:', q('#districtFilter').value, '| owner:', q('#ownerFilter').value);

  console.log('--- 账号管理 ---');
  click('.nav-item[data-page="accounts"]');
  console.log('users rows:', qa('#view tbody tr').length, '| tabs:', qa('.tabs button').map(b=>b.textContent).join('|'));
  click('[data-act="newUser"]');
  q('#au-name').value='测试员工'; q('#au-account').value='test01'; q('#au-phone').value='13800001111';
  q('#au-role').value='r_viewer';
  click('[data-act="saveUser"]');
  const nu=db().users.find(u=>u.account==='test01');
  console.log('user created:', !!nu, '| role:', nu && nu.roleId, '| pwd hashed:', nu && nu.pwd.slice(0,1)==='p');
  // 编辑
  click('[data-act="editUser"][data-id="'+nu.id+'"]');
  q('#au-role').value='r_keeper'; q('#au-status').value='停用';
  click('[data-act="saveUser"]');
  console.log('user edited:', db().users.find(u=>u.id===nu.id).roleId, db().users.find(u=>u.id===nu.id).status);
  // 重置密码
  click('[data-act="resetPwd"][data-id="'+nu.id+'"]');
  click('[data-act="confirmOk"]');
  console.log('pwd reset:', !!db().users.find(u=>u.id===nu.id).pwd);
  // 删除
  click('[data-act="delUser"][data-id="'+nu.id+'"]');
  click('[data-act="confirmOk"]');
  console.log('user deleted:', !db().users.some(u=>u.id===nu.id));
  // 角色
  click('[data-act="acctTab"][data-t="roles"]');
  console.log('role cards:', qa('.role-card').length, '| builtin delete btns:', qa('[data-act="delRole"]').length);
  click('[data-act="newRole"]');
  q('#ar-name').value='仅台账查看'; q('#ar-desc').value='只能看库存台账';
  click('[data-act="permNone"]');
  const cb=q('input[data-change="rolePerm"][data-mod="stock"][data-p="view"]');
  cb.checked=true; ev(cb,'change');
  console.log('perm count label:', q('#permCount').textContent);
  click('[data-act="saveRole"]');
  const nr=db().roles.find(r=>r.name==='仅台账查看');
  console.log('role created:', !!nr, '| perms:', JSON.stringify(nr && nr.perms));
  console.log('role cards after:', qa('.role-card').length);

  console.log('--- 备份 ---');
  click('.nav-item[data-page="backups"]');
  console.log('backups:', bks().length, '| auto policy text:', q('#view').textContent.includes('累计数据变更达到'));
  click('[data-act="newBackup"]');
  q('#bk-note').value='测试手动备份';
  click('[data-act="doBackup"]');
  console.log('after manual:', bks().length, '|', bks()[0].note, bks()[0].type);
  const bid=bks()[0].id;
  click('[data-act="restoreBackup"][data-id="'+bid+'"]');
  console.log('restore modal checkbox:', !!q('#cf-chk'));
  q('#cf-chk').checked=true; click('[data-act="confirmOk"]');
  console.log('restored, backups now:', bks().length, '| toast:', qa('.toast').pop().textContent);
  click('[data-act="delBackup"][data-id="'+bks()[0].id+'"]');
  click('[data-act="confirmOk"]');
  console.log('backup deleted:', bks().length);

  console.log('--- 设置 ---');
  click('.nav-item[data-page="settings"]');
  q('#st-name').value='城东仓储中心'; q('#st-sub').value='WAREHOUSE HUB';
  click('[data-act="saveSettings"]');
  console.log('brand:', q('#brandName').textContent, '|', q('#brandSub').textContent, '| title:', d.title);
  console.log('persisted:', db().settings.appName);

  console.log('--- 日志 ---');
  click('.nav-item[data-page="logs"]');
  console.log('log rows:', qa('#logTable tbody tr').length, '| total:', db().logs.length);
  const lf=q('select[data-change="lf"][data-key="module"]'); lf.value='项目管理'; ev(lf,'change');
  console.log('filter module rows:', qa('#logTable tbody tr').length);
  click('[data-act="clearLogFilters"]');
  const kw=q('#logKw'); kw.value='城东'; ev(kw,'input');
  console.log('kw filter:', q('#logCnt').textContent);
  click('[data-act="clearLogFilters"]');

  console.log('--- 只读账号登录 ---');
  logout();
  console.log('login shown:', !!q('.login-wrap'));
  q('#lg-account').value='zhangwei'; q('#lg-pwd').value='123456';
  click('[data-act="doLogin"]');
  console.log('viewer login:', q('.user-chip .un').textContent, '| nav:', qa('.nav-item').map(n=>n.dataset.page).join(','));
  click('.nav-item[data-page="projects"]');
  console.log('proj new/import hidden:', !q('[data-act="newProject"]'), !q('[data-act="pickProjFile"]'), '| banner:', !!q('.ro-banner'));
  click('.nav-item[data-page="stock"]');
  console.log('stock note disabled:', q('#stockTable input[data-change="stockNote"]').disabled, '| drag off:', q('.drag-handle').className.includes('off'));
  click('.nav-item[data-page="materials"]');
  console.log('material add form:', !!q('#nm-code'), '| no-perm note:', q('#view').textContent.includes('无「新增物料」权限'));

  console.log('--- 权限实时生效 ---');
  // 管理员登录改角色
  logout();
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456'); click('[data-act="doLogin"]');
  click('.nav-item[data-page="accounts"]');
  click('[data-act="acctTab"][data-t="roles"]');
  click('[data-act="editRole"][data-id="r_viewer"]');
  const c2=q('input[data-change="rolePerm"][data-mod="inbound"][data-p="view"]');
  c2.checked=true; ev(c2,'change');
  const c3=q('input[data-change="rolePerm"][data-mod="inbound"][data-p="create"]');
  c3.checked=true; ev(c3,'change');
  click('[data-act="saveRole"]');
  console.log('admin role perms saved');
  logout();
  q('#lg-account').value='zhangwei'; q('#lg-pwd').value='123456'; click('[data-act="doLogin"]');
  console.log('viewer nav after grant:', qa('.nav-item').map(n=>n.dataset.page).join(','));
  click('.nav-item[data-page="inbound"]');
  console.log('viewer can see submit now:', !!q('[data-act="submitMovement"]'), '| banner:', !!q('.ro-banner'));

  console.log('=== ERRORS(',errors.length,'):',errors.slice(0,8).join(' ; '));
  try{ w.close(); }catch(e){}
},800);
