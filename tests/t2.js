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
const ev=(el,t)=>{el.dispatchEvent(new w.Event(t,{bubbles:true,cancelable:true}));};
const logout=()=>{ click('[data-act="myAccount"]'); const el=q('.modal [data-act="logout"]'); if(el) el.click(); else errors.push('no logout btn'); if(!q('.login-wrap')) w.eval('showLogin()'); };
const loginAs=(a,p)=>{ if(!q('.login-wrap')){ if(w.eval('!!session.userId')) logout(); else w.eval('showLogin()'); } q('#lg-account').value=a; q('#lg-pwd').value=p; click('[data-act="doLogin"]'); };
const grantInbound=(view,create)=>{
  click('.nav-item[data-page="accounts"]');
  click('[data-act="acctTab"][data-t="roles"]');
  click('[data-act="editRole"][data-id="r_viewer"]');
  const cv=q('input[data-change="rolePerm"][data-mod="inbound"][data-p="view"]');
  cv.checked=view; ev(cv,'change');
  const cc=q('input[data-change="rolePerm"][data-mod="inbound"][data-p="create"]');
  cc.checked=create; ev(cc,'change');
  click('[data-act="saveRole"]');
};
setTimeout(()=>{
  // ── 1. 只读账号（项目只读角色，6 项 view）
  loginAs('zhangwei','123456');
  console.log('viewer:', q('.user-chip .un').textContent, '| nav:', qa('.nav-item').map(n=>n.dataset.page).join(','));
  console.log('no sys nav:', !qa('.nav-item').some(n=>['accounts','logs','backups','settings'].includes(n.dataset.page)));
  click('.nav-item[data-page="stock"]');
  console.log('stock banner:', !!q('.ro-banner'), '| note disabled:', q('#stockTable input[data-change="stockNote"]').disabled, '| drag off:', q('.drag-handle').className.includes('off'));
  click('.nav-item[data-page="materials"]');
  console.log('add form hidden:', !q('#nm-code'), '| note:', q('#view').textContent.includes('无「新增物料」权限'));
  click('.nav-item[data-page="records"]');
  console.log('records export hidden:', !q('[data-act="exportRecords"]'), '| rows:', qa('#view tbody tr').length);
  click('.nav-item[data-page="projects"]');
  console.log('proj new/import/del hidden:', !q('[data-act="newProject"]'), !q('[data-act="pickProjFile"]'), !q('[data-act="delProject"]'), '| banner:', !!q('.ro-banner'));
  // ── 2. 越权直调
  w.eval('submitMovement("in")');
  console.log('direct submit blocked:', db().records.length, '|', qa('.toast').pop().textContent);
  // ── 3. 我的账号 / 退出 / 错误密码 / 停用账号
  click('[data-act="myAccount"]');
  console.log('my account modal:', q('.modal-head h3').textContent, '| rows:', qa('.modal tbody tr').length);
  click('.modal [data-act="closeModal"]');
  logout();
  console.log('logout -> login screen:', !!q('.login-wrap'));
  q('#lg-account').value='admin'; q('#lg-pwd').value='bad';
  click('[data-act="doLogin"]');
  console.log('wrong pwd err:', q('#lg-error').textContent, '| still login:', !!q('.login-wrap'));
  q('#lg-account').value='lisi'; q('#lg-pwd').value='123456'; click('[data-act="doLogin"]');
  console.log('disabled err:', q('#lg-error').textContent);
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456'); click('[data-act="doLogin"]');
  console.log('admin back:', q('.user-chip .un').textContent);
  // ── 4. 只给 inbound.view（无 create）→ 只读表单
  grantInbound(true, false);
  loginAs('zhangwei','123456');
  click('.nav-item[data-page="inbound"]');
  console.log('view-only: nav has inbound:', qa('.nav-item').some(n=>n.dataset.page==='inbound'),
    '| banner:', !!q('.ro-banner'), '| zone:', !!q('.ro-zone'), '| submit btn:', !!q('[data-act="submitMovement"]'),
    '| ro pill:', q('#view').textContent.includes('只读 · 无提交权限'));
  const b0=db().records.length;
  w.eval('submitMovement("in")');
  console.log('view-only submit still blocked:', db().records.length-b0, '|', qa('.toast').pop().textContent);
  // ── 5. 再给 create → 可提交
  logout();
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456'); click('[data-act="doLogin"]');
  grantInbound(true, true);
  loginAs('zhangwei','123456');
  click('.nav-item[data-page="inbound"]');
  console.log('submit visible now:', !!q('[data-act="submitMovement"]'), '| banner:', !!q('.ro-banner'));
  const b=db().records.length;
  const s=q('#lines-in .line select'); s.value=s.options[2].value; ev(s,'change');
  const qi=q('#lines-in .line input[data-change="lineQty"]'); qi.value='2'; ev(qi,'input');
  click('[data-act="submitMovement"][data-type="in"]');
  console.log('viewer submit ok:', db().records.length-b, '|', qa('.toast').pop().textContent);
  console.log('log user:', db().logs[0].userName, db().logs[0].module, db().logs[0].action);
  // ── 6. 撤销 create → 立即失效
  logout();
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456'); click('[data-act="doLogin"]');
  grantInbound(true, false);
  loginAs('zhangwei','123456');
  click('.nav-item[data-page="inbound"]');
  console.log('create revoked, submit hidden:', !q('[data-act="submitMovement"]'));
  console.log('=== ERRORS(',errors.length,'):',errors.slice(0,8).join(' ; '));
  try{ w.close(); }catch(e){}
},700);
