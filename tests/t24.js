/* t24：项目视图平铺左栏与拖拽调宽、已出库领用划拨、看板双子页、顶栏缩放 */
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
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

setTimeout(async ()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  await sleep(60);

  /* ---------- 1. 左栏平铺 ---------- */
  console.log('--- 1. 项目视图左栏：平铺单行 ---');
  click('.nav-item[data-page="projects"]');
  await sleep(60);
  const rows = qa('.plist .pcard');
  const firstTxt = rows.length ? rows[0].textContent.replace(/\s+/g,' ').trim() : '';
  const firstCode = w.eval("(db.projects.find(p=>p.id===" + JSON.stringify(rows[0] && rows[0].dataset.id) + ")||{}).code||''");
  console.log('  行数:', rows.length, '| 首行:', firstTxt);
  const nameOf = rows[0] ? rows[0].querySelector('.pname').textContent : '';
  console.log('  行内仅编号-名称:', firstTxt === firstCode + '-' + nameOf, '| 编号:', firstCode, '| 名称:', nameOf);
  console.log('  行内多余信息(应无):', qa('.plist .pcard .pm').length, qa('.plist .pcard .chip').length,
    qa('.plist .pcard [data-act="gotoTransfer"]').length);
  if(!rows.length) errors.push('左栏无行');
  if(qa('.plist .pcard .pm').length) errors.push('平铺行仍含副信息');
  if(firstTxt !== firstCode + '-' + nameOf) errors.push('行文本不是 编号-名称');

  /* ---------- 2. 分栏拖拽宽度 ---------- */
  console.log('\n--- 2. 分栏宽度记忆 ---');
  const box = q('.proj-split');
  const resizer = q('.pl-resizer');
  console.log('  手柄存在:', !!resizer, '| 初始 --pl-w:', box ? (box.style.getPropertyValue('--pl-w') || '252px') : '-');
  if(!resizer) errors.push('缺少拖拽手柄');
  // 模拟拖拽落库
  w.eval("applyProjSplitWidth(360); saveProjSplitWidth(360);");
  await sleep(20);
  console.log('  设为 360 后:', q('.proj-split').style.getPropertyValue('--pl-w'),
    '| localStorage:', w.eval('localStorage.getItem("wms_proj_split_w")'));
  if(w.eval('localStorage.getItem("wms_proj_split_w")') !== '360') errors.push('宽度未持久化');
  w.eval('render()'); await sleep(40);
  console.log('  重新渲染后仍生效:', q('.proj-split').style.getPropertyValue('--pl-w'));
  if(q('.proj-split').style.getPropertyValue('--pl-w') !== '360px') errors.push('重新渲染后宽度丢失');

  /* ---------- 3. 造一条单位领用 ---------- */
  console.log('\n--- 3. 已出库领用划拨 ---');
  const pid = w.eval('state.projectId');
  const mid = w.eval('db.materials[0].id');
  const mname = w.eval('db.materials[0].name');
  w.eval(`
    db.orgUnits = [{id:'ou_t', name:'广西霖翔科技有限公司', remark:'', contacts:[{name:'李工',phone:'13800001111'}]}];
    db.records.push({id:'r_alloc_src', docNo:'CK-TEST-001', date:today(), type:'out',
      projectId:'', unitId:'ou_t', warehouseId:db.warehouses[0].id, materialId:${JSON.stringify(mid)},
      qty:34, operator:'测试', remark:'单位领用'});
    saveDB(); render();
  `);
  await sleep(60);
  const stockBefore = w.eval(`stockOf(loadAgg(), ${JSON.stringify(mid)})`);
  const holdBefore = w.eval(`projectTotal(loadAgg(), ${JSON.stringify(pid)})`);
  console.log('  单位领用 34 个「' + mname + '」| 仓库库存:', stockBefore, '| 项目持有:', holdBefore);

  const q0 = JSON.parse(w.eval(`JSON.stringify(unitQuota('ou_t').map(r=>({n:r.m.name,got:r.got,used:r.used,rest:r.rest})))`));
  console.log('  单位额度:', JSON.stringify(q0));

  click('[data-act="allocFromUnit"]');
  await sleep(60);
  const qtyInput = q('#allocBody .alloc-qty');
  console.log('  弹窗打开:', !!q('#allocModal') || !!q('#allocBody'), '| 数量输入框:', !!qtyInput,
    '| 表格行数:', qa('#allocBody tbody tr').length);
  if(!qtyInput) errors.push('划拨弹窗无数量输入');

  qtyInput.value = '10'; ev(qtyInput, 'input');
  await sleep(20);
  console.log('  合计显示:', (q('#allocSum') || {textContent:'-'}).textContent);
  click('[data-act="saveAlloc"]');
  await sleep(40);
  click('[data-act="confirmOk"]');
  await sleep(80);

  const allocRecs = JSON.parse(w.eval(`JSON.stringify(db.records.filter(r=>r.alloc))`));
  const stockAfter = w.eval(`stockOf(loadAgg(), ${JSON.stringify(mid)})`);
  const holdAfter = w.eval(`projectTotal(loadAgg(), ${JSON.stringify(pid)})`);
  const q1 = JSON.parse(w.eval(`JSON.stringify(unitQuota('ou_t').map(r=>({n:r.m.name,got:r.got,used:r.used,rest:r.rest})))`));
  console.log('  划拨记录:', allocRecs.length, '条 | qty:', allocRecs[0] && allocRecs[0].qty, '| transfer:', allocRecs[0] && allocRecs[0].transfer);
  console.log('  仓库库存:', stockBefore, '→', stockAfter, '（应不变）');
  console.log('  项目持有:', holdBefore, '→', holdAfter, '（应 +10）');
  console.log('  单位额度:', JSON.stringify(q1));
  if(allocRecs.length !== 1) errors.push('未生成划拨记录');
  if(stockAfter !== stockBefore) errors.push('划拨不应改变仓库库存');
  if(holdAfter !== holdBefore + 10) errors.push('项目持有未 +10');
  if(!q1[0] || q1[0].rest !== 24) errors.push('单位剩余应为 24');

  /* ---------- 4. 超额拦截 ---------- */
  console.log('\n--- 4. 超过可领用量时按上限处理 ---');
  click('[data-act="allocFromUnit"]');
  await sleep(50);
  const qty2 = q('#allocBody .alloc-qty');
  qty2.value = '999'; ev(qty2, 'input');
  await sleep(20);
  console.log('  输入 999 后控件值:', q('#allocBody .alloc-qty').value, '（max=24）');
  click('[data-act="closeModal"]');
  await sleep(30);

  /* ---------- 5. 看板双子页 ---------- */
  console.log('\n--- 5. 设备使用看板拆分为两个子页 ---');
  click('.nav-item[data-page="usageBoard"]');
  await sleep(60);
  const tabs = qa('.tabs button').map(b => b.textContent.trim());
  console.log('  Tab:', tabs.join(' / '), '| 当前:', w.eval('state.ubTab'));
  console.log('  总览存在:', !!q('.ub-grid') === false, '| 总览表行数:', qa('table tbody tr').length);
  if(tabs.length < 2) errors.push('看板缺少子页 tab');
  click('[data-act="ubTab"][data-m="units"]');
  await sleep(60);
  const cards = qa('.ub-card').length;
  const cardsTxt = qa('.ub-card').map(c=>c.textContent.replace(/\s+/g,' ')).join(' | ');
  console.log('  切换到单位子页:', w.eval('state.ubTab'), '| 单位卡片:', cards, '| 含霖翔:', cardsTxt.indexOf('霖翔') >= 0);
  if(w.eval('state.ubTab') !== 'units') errors.push('tab 切换无效');
  if(!cards) errors.push('单位子页无卡片');

  /* ---------- 6. 顶栏缩放 ---------- */
  console.log('\n--- 6. 顶栏字体缩放 ---');
  const label0 = (q('#zoomLabel') || {textContent:''}).textContent;
  click('[data-act="zoomStep"][data-v="10"]');
  await sleep(30);
  click('[data-act="zoomStep"][data-v="10"]');
  await sleep(30);
  const s1 = w.eval('displayCfg().scale');
  console.log('  起始:', label0, '→ 两次放大:', s1 + '%', '| 顶栏标签:', (q('#zoomLabel')||{textContent:''}).textContent,
    '| 根 zoom:', d.documentElement.style.zoom);
  if(s1 !== 120) errors.push('放大两次应为 120%');
  click('[data-act="zoomReset"]');
  await sleep(40);
  console.log('  重置后:', w.eval('displayCfg().scale') + '%', '| zoom:', d.documentElement.style.zoom || '(空)');
  if(w.eval('displayCfg().scale') !== 100) errors.push('重置未回到 100%');

  console.log('\nERRORS', errors.length, errors.slice(0,6).join(' | '));
  try{ w.close(); }catch(e){}
}, 260);
