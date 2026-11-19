/* t19：v4.18 四项优化 —— 台账导出 / 施工单位管理 / 项目施工单位 / 设备使用看板 */
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
const txt=s=>{const el=q(s); return el ? el.textContent.replace(/\s+/g,' ').trim() : '';};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const navs=()=>qa('.nav-item').map(n=>n.dataset.page);
const has=(s,sub,label)=>{ if(s.indexOf(sub)<0) errors.push(label+': 缺少「'+sub+'」'); };

setTimeout(async ()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  await sleep(60);

  /* ---------- 1. 模块注册 ---------- */
  console.log('--- 1. 新模块注册与导航 ---');
  const modIds = w.eval("MODULES.map(m=>m.id).join(',')").split(',');
  const pageIds = w.eval("Object.keys(PAGES).join(',')").split(',');
  console.log('含 orgUnits / usageBoard:', modIds.indexOf('orgUnits')>=0 && modIds.indexOf('usageBoard')>=0,
    '| 模块数:', modIds.length, '| 页面数:', pageIds.length);
  if(modIds.length !== pageIds.length) errors.push('模块数与页面数不一致');
  console.log('导航含施工单位管理:', navs().indexOf('orgUnits')>=0, '| 含设备使用看板:', navs().indexOf('usageBoard')>=0);
  console.log('导航顺序:', navs().join(','));

  /* ---------- 2. 施工单位管理：新增 / 编辑 / 联系人 ---------- */
  console.log('\n--- 2. 施工单位管理（多联系人）---');
  click('.nav-item[data-page="orgUnits"]');
  await sleep(40);
  console.log('页面标题:', txt('#view').slice(0,12), '| 新增按钮:', !!q('[data-act="newOrgUnit"]'));
  click('[data-act="newOrgUnit"]');
  await sleep(30);
  q('#ou-name').value='柳州测试工程有限公司';
  q('#ou-remark').value='系统集成';
  q('#ouContacts .ou-contact .ou-c-name').value='李工';
  q('#ouContacts .ou-contact .ou-c-phone').value='13800001111';
  click('[data-act="ouAddContact"]');
  await sleep(20);
  const rows2 = qa('#ouContacts .ou-contact');
  rows2[1].querySelector('.ou-c-name').value='王工';
  rows2[1].querySelector('.ou-c-phone').value='13900002222';
  console.log('联系人行数:', rows2.length);
  click('[data-act="saveOrgUnit"]');
  await sleep(50);
  const units = JSON.parse(w.eval('JSON.stringify(db.orgUnits)'));
  console.log('已保存单位:', units.length, '| 名称:', units[0] && units[0].name,
    '| 联系人数:', (units[0].contacts || []).length, '| 首个联系人:', JSON.stringify((units[0].contacts || [])[0]));
  if(units.length !== 1) errors.push('施工单位未保存');
  if((units[0].contacts || []).length !== 2) errors.push('联系人数不是 2');
  if(!txt('#ouBody').includes('13800001111')) errors.push('列表未显示联系人电话');
  const ouId = units[0].id;

  // 编辑：改电话
  click('[data-act="editOrgUnit"]');
  await sleep(30);
  console.log('编辑弹窗联系人行:', qa('#ouContacts .ou-contact').length);
  q('#ouContacts .ou-contact .ou-c-phone').value='13800009999';
  click('[data-act="saveOrgUnit"]');
  await sleep(40);
  console.log('编辑后电话:', w.eval("db.orgUnits[0].contacts[0].phone"));

  /* ---------- 3. 项目表单：施工单位在负责人之前 ---------- */
  console.log('\n--- 3. 项目施工单位字段与筛选 ---');
  click('.nav-item[data-page="projectList"]');
  await sleep(40);
  click('[data-act="newProject"]');
  await sleep(30);
  const unitEl = q('#np-unit'), ownerEl = q('#np-owner');
  const before = !!(unitEl && ownerEl &&
    (unitEl.compareDocumentPosition(ownerEl) & w.Node.DOCUMENT_POSITION_FOLLOWING));
  console.log('#np-unit 存在:', !!unitEl, '| 在 #np-owner 之前:', before);
  if(!before) errors.push('施工单位不在负责人之前');
  q('#np-code').value='PRJ-T19'; q('#np-name').value='测试园所';
  q('#np-district').value = w.eval('districtList()[0]');
  q('#np-unit').value = ouId;
  q('#np-owner').value='张工';
  click('[data-act="saveProject"]');
  await sleep(50);
  const newP = JSON.parse(w.eval("JSON.stringify(db.projects.find(p=>p.code==='PRJ-T19')||null)"));
  console.log('新项目 unitId:', newP && newP.unitId, '| 与所选一致:', !!newP && newP.unitId === ouId);
  if(!newP || newP.unitId !== ouId) errors.push('项目未保存施工单位');

  // 列表筛选
  const uSel = q('[data-change="plUnit"]');
  console.log('列表筛选框存在:', !!uSel, '| 选项数:', uSel ? uSel.options.length : 0);
  if(!uSel) errors.push('缺少施工单位筛选框');
  else{
    uSel.value = ouId;
    w.eval("state.pl.unit='" + ouId + "';refreshPlBody();");
    await sleep(30);
    const filtered = qa('#plBody tbody tr').length;
    const total = w.eval('db.projects.length');
    console.log('筛选后行数:', filtered, '| 项目总数:', total, '| 全带该单位:',
      w.eval("plFiltered().every(p=>p.unitId==='" + ouId + "')"));
    if(!w.eval("plFiltered().every(p=>p.unitId==='" + ouId + "')")) errors.push('筛选未生效');
    w.eval("state.pl.unit='all';");
  }
  console.log('表头含施工单位列:', txt('#plBody thead').indexOf('施工单位')>=0);

  /* ---------- 4. 出库登记：领用施工单位 ---------- */
  console.log('\n--- 4. 出库登记领用施工单位 ---');
  click('.nav-item[data-page="outbound"]');
  await sleep(40);
  const outSel = q('select[data-type="out"][data-key="unitId"]');
  console.log('出库表单单位下拉:', !!outSel, '| 选项含该单位:',
    outSel ? [...outSel.options].some(o => o.value === ouId) : false);
  if(!outSel) errors.push('出库登记缺少领用施工单位');
  const beforeRec = w.eval('db.records.length');
  w.eval("draft.out.warehouseId=db.warehouses[0].id;" +
    "draft.out.unitId='" + ouId + "';" +
    "draft.out.projectId=(db.projects.find(p=>p.code==='PRJ-T19')||{}).id||'';" +
    "draft.out.lines=[{materialId:db.materials[0].id,qty:'5',remark:''}];" +
    "submitMovement('out');");
  await sleep(40);
  const lastRec = JSON.parse(w.eval("JSON.stringify(db.records[db.records.length-1])"));
  console.log('新增流水:', w.eval('db.records.length') - beforeRec, '| unitId:', lastRec.unitId,
    '| 与所选一致:', lastRec.unitId === ouId);
  if(lastRec.unitId !== ouId) errors.push('出库流水未带 unitId');

  /* ---------- 4b. 历史单据补录单位（整单编辑） ---------- */
  console.log('\n--- 4b. 整单编辑补录领用施工单位 ---');
  w.eval("draft.out.unitId='';draft.out.warehouseId=db.warehouses[0].id;" +
    "draft.out.projectId='';draft.out.lines=[{materialId:db.materials[1].id,qty:'2',remark:''}];" +
    "submitMovement('out');");
  await sleep(40);
  const docNo2 = w.eval('db.records[db.records.length-1].docNo');
  const unitBefore = w.eval("db.records.filter(r=>r.docNo===" + JSON.stringify(docNo2) + ").every(r=>!r.unitId)");
  click('.nav-item[data-page="outboundLedger"]');
  await sleep(60);
  const editBtn = qa('[data-act="editDoc"]').find(b => b.dataset.doc === docNo2);
  console.log('无单位单:', docNo2, '| 补录前为空:', unitBefore, '| 找到编辑入口:', !!editBtn);
  if(!editBtn) errors.push('台账缺少编辑入口');
  else{
    editBtn.click();
    await sleep(40);
    const unitSel = q('select[data-key="unitId"]');
    console.log('整单编辑含单位下拉:', !!unitSel);
    if(!unitSel) errors.push('整单编辑缺少领用施工单位');
    else{
      unitSel.value = ouId;
      w.eval("docEdit.head.unitId=" + JSON.stringify(ouId));
      click('[data-act="saveDocEdit"]');
      await sleep(60);
      const after = w.eval("db.records.filter(r=>r.docNo===" + JSON.stringify(docNo2) + ").every(r=>r.unitId===" + JSON.stringify(ouId) + ")");
      console.log('补录后该单全部带单位:', after);
      if(!after) errors.push('整单编辑未写入单位');
    }
  }

  /* ---------- 5. 台账导出按钮 ---------- */
  console.log('\n--- 5. 入库 / 出库台账导出 ---');
  for(const [page, label] of [['inboundLedger','入库台账'],['outboundLedger','出库台账']]){
    click('.nav-item[data-page="' + page + '"]');
    await sleep(50);
    const btn = q('[data-act="exportDocLedger"]');
    console.log(label + ' 导出按钮:', !!btn, '| data-type:', btn && btn.dataset.type);
    if(!btn) errors.push(label + ' 缺少导出按钮');
  }
  // 调用导出（jsdom 无 Blob 下载，走 toast 分支即可，不应抛错）
  let expOk = true;
  try{ w.eval("exportDocLedger('out')"); }catch(e){ expOk = false; errors.push('导出抛错: ' + e.message); }
  console.log('调用导出未抛错:', expOk, '| toast:', txt('#toast').slice(0, 30));

  /* ---------- 6. 设备使用看板 ---------- */
  console.log('\n--- 6. 设备使用看板 ---');
  click('.nav-item[data-page="usageBoard"]');
  await sleep(60);
  const viewTxt = txt('#view');
  console.log('总览标题:', viewTxt.indexOf('设备使用总览')>=0, '| 单位卡片:', qa('.ub-card').length);
  if(viewTxt.indexOf('设备使用总览')<0) errors.push('看板未渲染总览');
  const totals = JSON.parse(w.eval('JSON.stringify(usageTotals(loadAgg()))'));
  const t0 = totals[0];
  const handIn = w.eval("db.records.filter(r=>!r.transfer&&r.type==='in'&&r.materialId==='" + t0.m.id + "').reduce((s,r)=>s+Number(r.qty),0)");
  const handOut = w.eval("db.records.filter(r=>!r.transfer&&r.type==='out'&&r.materialId==='" + t0.m.id + "').reduce((s,r)=>s+Number(r.qty),0)");
  console.log('总览首行 [' + t0.m.name + '] 入库:', t0.inQ, '手算:', handIn,
    '| 出库:', t0.outQ, '手算:', handOut, '| 剩余:', t0.stock, '| 项目使用:', t0.used, '| 差异:', t0.diff);
  if(t0.inQ !== handIn) errors.push('入库总数与流水不一致');
  if(t0.outQ !== handOut) errors.push('出库总数与流水不一致');
  if(t0.stock !== (Number(t0.m.initialStock||0) + t0.inQ - t0.outQ)) errors.push('剩余总数口径错误');
  if(t0.diff !== t0.outQ - t0.used) errors.push('差异口径错误');

  const uStats = JSON.parse(w.eval("JSON.stringify(usageUnitStats(loadAgg()))"));
  const mine = uStats.find(x => x.uid === ouId);
  console.log('单位卡片数:', uStats.length, '| 该单位领用次数:', mine && mine.docs,
    '| 领用合计:', mine && mine.qty, '| 明细行:', mine && mine.rows.length);
  if(!mine) errors.push('看板缺少该单位卡片');
  else{
    const handDocs = w.eval("new Set(db.records.filter(r=>!r.transfer&&r.type==='out'&&r.unitId==='" + ouId + "').map(r=>r.docNo)).size");
    const handQty = w.eval("db.records.filter(r=>!r.transfer&&r.type==='out'&&r.unitId==='" + ouId + "').reduce((s,r)=>s+Number(r.qty),0)");
    console.log('领用次数手算:', handDocs, '| 领用合计手算:', handQty);
    if(mine.docs !== handDocs) errors.push('单位领用次数不一致');
    if(mine.qty !== handQty) errors.push('单位领用合计不一致');
    const row0 = mine.rows[0];
    if(row0 && row0.rest !== row0.got - row0.used) errors.push('单位剩余口径错误');
    console.log('首行物料:', row0 && row0.m.name, '| 领用:', row0 && row0.got,
      '| 项目用量:', row0 && row0.used, '| 剩余:', row0 && row0.rest);
  }

  /* ---------- 7. 删除单位：不删流水 ---------- */
  console.log('\n--- 7. 删除施工单位：引用置空、流水保留 ---');
  click('.nav-item[data-page="orgUnits"]');
  await sleep(40);
  const recBeforeDel = w.eval('db.records.length');
  const projBeforeDel = w.eval('db.projects.length');
  click('[data-act="delOrgUnit"]');
  await sleep(30);
  console.log('确认弹窗:', !!q('[data-act="confirmOk"]'), '| 提示含「不会删除」:', txt('.modal').indexOf('不会删除')>=0);
  click('[data-act="confirmOk"]');
  await sleep(50);
  console.log('剩余单位:', w.eval('db.orgUnits.length'),
    '| 流水数不变:', w.eval('db.records.length') === recBeforeDel,
    '| 项目数不变:', w.eval('db.projects.length') === projBeforeDel,
    '| 流水 unitId 已置空:', w.eval("db.records.every(r=>!r.unitId)"),
    '| 项目 unitId 已置空:', w.eval("db.projects.every(p=>!p.unitId)"));
  if(w.eval('db.records.length') !== recBeforeDel) errors.push('删除单位后流水减少');
  if(w.eval('db.projects.length') !== projBeforeDel) errors.push('删除单位后项目减少');
  if(!w.eval("db.records.every(r=>!r.unitId)")) errors.push('删除单位后流水仍指向已删单位');

  /* ---------- 8. 只读账号不可见 ---------- */
  console.log('\n--- 8. 项目只读角色不包括新模块 ---');
  const viewer = JSON.parse(w.eval("JSON.stringify(db.roles.find(r=>r.id==='r_viewer').perms)"));
  console.log('r_viewer 含 orgUnits:', JSON.stringify(viewer.orgUnits||[]),
    '| usageBoard:', JSON.stringify(viewer.usageBoard||[]));
  if((viewer.orgUnits||[]).length || (viewer.usageBoard||[]).length) errors.push('项目只读不应获得新模块权限');
  const keeper = JSON.parse(w.eval("JSON.stringify(db.roles.find(r=>r.id==='r_keeper').perms)"));
  console.log('r_keeper orgUnits:', JSON.stringify(keeper.orgUnits||[]),
    '| usageBoard:', JSON.stringify(keeper.usageBoard||[]));
  if(!(keeper.orgUnits||[]).includes('create')) errors.push('仓管应可新增施工单位');
  if(!(keeper.usageBoard||[]).includes('view')) errors.push('仓管应可查看看板');

  console.log('\nERRORS', errors.length, errors.slice(0,6).join(' | '));
  try{ w.close(); }catch(e){}
}, 260);
