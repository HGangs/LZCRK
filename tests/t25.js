/* t25：游客权限跟随「项目只读」角色（含设备使用看板）、物料明细只显示名称、批量选料 */
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
const ev=(el,type)=>el.dispatchEvent(new w.Event(type,{bubbles:true}));
const navs=()=>qa('.nav-item').map(n=>n.dataset.page);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

setTimeout(async ()=>{
  /* ---------- 1. 游客默认权限 ---------- */
  console.log('--- 1. 未登录 = 项目只读角色权限 ---');
  let guestNav = navs();
  console.log('  初始游客导航:', guestNav.join(','));
  console.log('  含看板:', guestNav.includes('usageBoard'), '（角色未配时不应有）');

  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  await sleep(60);

  /* 管理员给「项目只读」勾上设备使用看板 */
  w.eval(`
    (function(){
      const r = db.roles.find(x => x.id === 'r_viewer');
      if(!r.perms) r.perms = {};
      r.perms.usageBoard = ['view'];
      invalidatePerms(); saveDB(); render();
    })();
  `);
  await sleep(40);
  console.log('  已给「项目只读」加 usageBoard:view');

  w.eval('doLogout()');
  await sleep(60);
  guestNav = navs();
  const hasBoard = guestNav.includes('usageBoard');
  console.log('  退出后游客导航:', guestNav.join(','));
  console.log('  含看板:', hasBoard, '| can(usageBoard,view):', w.eval("can('usageBoard','view')"));
  if(!hasBoard) errors.push('游客未显示设备使用看板');
  if(!w.eval("can('usageBoard','view')")) errors.push('游客无看板查看权限');

  /* 进入看板确认能渲染 */
  click('.nav-item[data-page="usageBoard"]');
  await sleep(60);
  console.log('  看板可打开:', w.eval("state.page === 'usageBoard'"), '| 有内容:', qa('table tbody tr').length > 0);

  /* ---------- 2. 游客只继承 view，不继承写 ---------- */
  console.log('\n--- 2. 游客只继承只读动作 ---');
  w.eval(`
    (function(){
      const r = db.roles.find(x => x.id === 'r_viewer');
      r.perms.usageBoard = ['view', 'create', 'edit'];
      invalidatePerms();
    })();
  `);
  w.eval('render()');
  await sleep(40);
  console.log('  角色给到 view+create+edit → 游客 create:', w.eval("can('usageBoard','create')"),
    '| edit:', w.eval("can('usageBoard','edit')"), '| view:', w.eval("can('usageBoard','view')"));
  if(w.eval("can('usageBoard','create')")) errors.push('游客不应继承写权限');
  if(!w.eval("can('usageBoard','view')")) errors.push('游客应保留查看权限');

  /* ---------- 3. 已登录状态不受影响 ---------- */
  console.log('\n--- 3. 已登录状态不受影响 ---');
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  await sleep(60);
  console.log('  管理员导航数:', navs().length, '| 含看板:', navs().includes('usageBoard'),
    '| 可新增入库:', w.eval("can('inbound','create')"));
  if(navs().length < 19) errors.push('管理员导航数异常');
  if(!w.eval("can('inbound','create')")) errors.push('管理员写权限丢失');

  /* ---------- 4. 物料明细只显示名称 ---------- */
  console.log('\n--- 4. 登记页物料明细 ---');
  click('.nav-item[data-page="inbound"]');
  await sleep(60);
  const sel = q('#lines-in select');
  const opts = sel ? [...sel.options].map(o => o.textContent.trim()) : [];
  const sample = opts.find(t => t && t !== '选择设备') || '';
  const m0 = JSON.parse(w.eval('JSON.stringify(db.materials[0])'));
  console.log('  首项占位:', opts[0], '| 样例选项:', sample);
  console.log('  仅名称:', sample === m0.name, '| 不含编码:', sample.indexOf(m0.code) < 0, '| 不含单位:', opts.join('|').indexOf(' · ' + m0.unit) < 0);
  if(opts[0] !== '选择设备') errors.push('占位文案不是「选择设备」');
  if(sample.indexOf(m0.code) >= 0) errors.push('选项仍含物料编码');
  if(!sample) errors.push('选项为空');

  /* ---------- 5. 批量选择多个物料 ---------- */
  console.log('\n--- 5. 批量选择物料 ---');
  const beforeLines = qa('#lines-in .line').length;
  click('[data-act="pickMaterials"][data-type="in"]');
  await sleep(60);
  const boxes = qa('#pmList input[type=checkbox]');
  console.log('  弹窗选项数:', boxes.length, '| 首批可选:', boxes.filter(b => !b.disabled).length);
  if(boxes.length < 3) { errors.push('批量弹窗数量不足'); }
  else{
    const pick = boxes.filter(b => !b.disabled).slice(0, 3);
    pick.forEach(b => b.click());
    console.log('  勾选:', pick.length);
    click('[data-act="pmConfirm"][data-type="in"]');
    await sleep(80);
    const afterLines = qa('#lines-in .line').length;
    const filled = qa('#lines-in .line select').filter(s => s.value).length;
    console.log('  明细行:', beforeLines, '→', afterLines, '| 已选物料的行程数:', filled);
    if(afterLines <= beforeLines) errors.push('批量添加未生效');
    if(filled < pick.length) errors.push('批量添加后物料未选中');
  }

  /* 已存在的物料在弹窗中置灰 */
  click('[data-act="pickMaterials"][data-type="in"]');
  await sleep(60);
  const disabled = qa('#pmList input[type=checkbox]').filter(b => b.disabled).length;
  console.log('  再次打开，已存在置灰数:', disabled);
  if(!disabled) errors.push('已存在的物料未置灰');
  click('[data-act="closeModal"]');
  await sleep(30);

  /* 出库页同样生效 */
  click('.nav-item[data-page="outbound"]');
  await sleep(60);
  const outOpts = [...(q('#lines-out select') || {options:[]}).options].map(o => o.textContent.trim());
  console.log('  出库页占位:', outOpts[0], '| 批量按钮:', !!q('[data-act="pickMaterials"][data-type="out"]'));
  if(outOpts[0] !== '选择设备') errors.push('出库页物料选项未同步');
  if(!q('[data-act="pickMaterials"][data-type="out"]')) errors.push('出库页缺少批量选择');

  console.log('\nERRORS', errors.length, errors.slice(0,6).join(' | '));
  try{ w.close(); }catch(e){}
}, 260);
