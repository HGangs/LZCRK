/* t11：免登录游客浏览 + 右上角登录浮层 + 登录后按权限进入 */
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
const txt=s=>{const el=q(s); return el ? el.textContent.replace(/\s+/g,' ').trim() : ''};
const navs=()=>qa('.nav-item').map(n=>n.dataset.page);

setTimeout(()=>{
  console.log('--- 1. 打开即游客，无登录墙 ---');
  console.log('no login wall:', !q('.login-wrap'), '| chip:', txt('.user-chip .un'), '/', txt('.user-chip .ur'));
  const g=navs();
  console.log('nav:', g.join(','));
  console.log('5 板块齐全:', ['dashboard','stock','materials','projects','records'].every(p=>g.includes(p)),
    '| 无业务操作:', !g.includes('inbound') && !g.includes('outbound'),
    '| 无系统管理:', !['accounts','logs','backups','settings'].some(p=>g.includes(p)));
  console.log('guest perms:', JSON.stringify(w.eval('Object.keys(GUEST_PERMS).sort()')));
  console.log('右上角有登录按钮:', !!q('[data-act="showLogin"]'), '| 点击可开浮层:', (()=>{ click('[data-act="showLogin"]'); const ok=!!q('.login-wrap'); w.eval("$('#loginRoot').innerHTML=''"); return ok; })(),
    '| 含调拨只读:', w.eval("can('projectTransfer','view')"));
  console.log('can(inbound,create):', w.eval("can('inbound','create')"), '| can(projects,create):', w.eval("can('projects','create')"),
    '| can(records,view):', w.eval("can('records','view')"));

  console.log('\n--- 2. 只读页面无写入口 ---');
  click('.nav-item[data-page="materials"]');
  console.log('materials → 新增表单:', !!q('#nm-name'), '| 批量导入:', !!q('[data-act="matImport"]'),
    '| 行内编辑:', !!q('[data-act="editMaterial"]'));
  click('.nav-item[data-page="records"]');
  console.log('records → 导出按钮:', !!q('[data-act="exportRecords"]'), '| 表格行:', qa('#recordTable tbody tr').length);
  click('.nav-item[data-page="projectList"]');
  console.log('projectList → banner:', !!q('.ro-banner'), '| 导出:', !!q('[data-act="exportPl"]'), '| 查看:', !!q('[data-act="openProjectInView"]'));

  console.log('\n--- 3. 直达受限页回落 ---');
  ['inbound','outbound','accounts','backups'].forEach(p=>{
    w.eval("state.page='"+p+"';render();");
    console.log('  #/'+p+' →', w.eval('state.page'), '|', txt('#pageTitle'));
  });

  console.log('\n--- 4. 右上角登录浮层 ---');
  w.eval('showLogin()');
  console.log('overlay:', !!q('.login-wrap'), '| close btn:', !!q('[data-act="closeLogin"]'), '| guest link:', txt('.login-guest'));
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  console.log('Esc 关闭:', !q('.login-wrap'), '| 仍是游客:', txt('.user-chip .un'));
  w.eval('showLogin()');
  click('[data-act="closeLogin"]');
  console.log('× 关闭:', !q('.login-wrap'));

  console.log('\n--- 5. 登录后按权限进入 ---');
  w.eval('showLogin()');
  q('#lg-account').value='zhouming'; q('#lg-pwd').value='123456';
  click('[data-act="doLogin"]');
  console.log('keeper login:', txt('.user-chip .un'), '| nav:', navs().join(','));
  console.log('有业务操作:', navs().includes('inbound') && navs().includes('outbound'),
    '| 无系统管理:', !['accounts','logs','backups','settings'].some(p=>navs().includes(p)));
  console.log('can(inbound,create):', w.eval("can('inbound','create')"), '| can(settings,view):', w.eval("can('settings','view')"));

  console.log('\n--- 6. 退出 → 回项目只读 ---');
  click('[data-act="myAccount"]'); click('.modal [data-act="logout"]');
  console.log('logout → 无登录浮层:', !q('.login-wrap'), '| session guest:', w.eval('session.guest'),
    '| chip:', txt('.user-chip .un'));
  console.log('回只读 → nav:', navs().join(','), '| 记录数不变:', db().records.length,
    '| 无写入口:', !q('[data-act="newProject"]'));

  console.log('\nERRORS', errors.length, errors.slice(0,5).join(' | '));
  try{ w.close(); }catch(e){}
}, 900);
