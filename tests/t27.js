/* t27：项目领用记录（列表 / 全字段编辑 / 撤销归还与数量联动） */
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
  click('.nav-item[data-page="projects"]');
  await sleep(60);

  const pid = w.eval('state.projectId');
  const mid = w.eval('db.materials[0].id');
  const wid = w.eval('db.warehouses[0].id');
  const mname = w.eval('db.materials[0].name');

  /* ---------- 1. 空态 ---------- */
  console.log('--- 1. 领用记录区块 ---');
  const hasBlock = qa('.proj-detail-body').length && /领用记录/.test(d.body.textContent);
  console.log('  区块存在:', hasBlock, '| 空态文案:', /还没有领用记录/.test(d.body.textContent));
  if(!hasBlock) errors.push('详情页缺少领用记录区块');

  console.log('\n--- 2. 仓库领用入列 ---');
  const stock0 = w.eval(`stockOf(loadAgg(), ${JSON.stringify(mid)})`);
  w.eval(`
    db.records.push({id:'r_t1', docNo:'CK-T-001', date:today(), type:'out',
      projectId:${JSON.stringify(pid)}, warehouseId:${JSON.stringify(wid)},
      materialId:${JSON.stringify(mid)}, qty:5, operator:'张三', remark:'测试领用'});
    saveDB(); render();
  `);
  await sleep(60);
  const rows1 = qa('[data-act="editIssue"]').length;
  const badge1 = /仓库领用/.test(d.body.textContent);
  const stock1 = w.eval(`stockOf(loadAgg(), ${JSON.stringify(mid)})`);
  console.log('  记录行:', rows1, '| 含「仓库领用」徽标:', badge1, '| 库存:', stock0, '→', stock1);
  if(!rows1) errors.push('领用记录未渲染');
  if(!badge1) errors.push('缺少仓库领用标识');
  if(stock1 !== stock0 - 5) errors.push('仓库领用未扣库存');

  /* ---------- 3. 编辑数量：库存与项目持有同步 ---------- */
  console.log('\n--- 3. 编辑数量 5 → 8 ---');
  const hold0 = w.eval(`projectTotal(loadAgg(), ${JSON.stringify(pid)})`);
  click('[data-act="editIssue"]');
  await sleep(60);
  const qtyInp = q('#ie-qty');
  console.log('  弹窗字段: 物料', !!q('#ie-mat'), '| 数量', !!qtyInp, '| 日期', !!q('#ie-date'),
    '| 仓库', !!q('#ie-wh'), '| 单位', !!q('#ie-unit'), '| 经办', !!q('#ie-op'), '| 备注', !!q('#ie-remark'));
  if(!qtyInp || !q('#ie-mat') || !q('#ie-date') || !q('#ie-unit')) errors.push('编辑字段不全');
  qtyInp.value = '8';
  click('[data-act="saveIssue"]');
  await sleep(80);
  const stock2 = w.eval(`stockOf(loadAgg(), ${JSON.stringify(mid)})`);
  const hold1 = w.eval(`projectTotal(loadAgg(), ${JSON.stringify(pid)})`);
  const recQty = w.eval("db.records.find(r=>r.id==='r_t1').qty");
  console.log('  记录数量:', recQty, '| 库存:', stock1, '→', stock2, '| 项目持有:', hold0, '→', hold1);
  if(recQty !== 8) errors.push('数量未保存');
  if(stock2 !== stock1 - 3) errors.push('改数量未同步扣库存');
  if(hold1 !== hold0 + 3) errors.push('改数量未同步项目持有');

  /* ---------- 4. 库存为负时拦截 ---------- */
  console.log('\n--- 4. 超额编辑拦截 ---');
  click('[data-act="editIssue"]');
  await sleep(50);
  q('#ie-qty').value = String(stock2 + 1000);
  click('[data-act="saveIssue"]');
  await sleep(60);
  const stillOpen = !!q('#ie-qty');
  const recQty2 = w.eval("db.records.find(r=>r.id==='r_t1').qty");
  console.log('  弹窗保持打开:', stillOpen, '| 记录数量仍为:', recQty2);
  if(!stillOpen) errors.push('超额时应阻止保存');
  if(recQty2 !== 8) errors.push('超额时不应写入');
  click('[data-act="closeModal"]');
  await sleep(30);

  /* ---------- 5. 删除：库存归还 ---------- */
  console.log('\n--- 5. 撤销领用，库存归还 ---');
  const stock3 = w.eval(`stockOf(loadAgg(), ${JSON.stringify(mid)})`);
  click('[data-act="delIssue"]');
  await sleep(50);
  const confirmTxt = (q('.modal') || {textContent:''}).textContent.replace(/\s+/g,' ');
  console.log('  确认文案含「退回仓库」:', /退回仓库/.test(confirmTxt));
  click('[data-act="confirmOk"]');
  await sleep(80);
  const stock4 = w.eval(`stockOf(loadAgg(), ${JSON.stringify(mid)})`);
  const rows2 = qa('[data-act="editIssue"]').length;
  console.log('  库存:', stock3, '→', stock4, '（应 +8）| 剩余行:', rows2);
  if(stock4 !== stock3 + 8) errors.push('撤销后库存未归还');
  if(rows2 !== rows1 - 1) errors.push('记录未移除');

  /* ---------- 6. 已出库领用：撤销退回单位额度 ---------- */
  console.log('\n--- 6. 已出库领用撤销 ---');
  w.eval(`
    db.orgUnits = [{id:'ou_t27', name:'广西霖翔科技有限公司', remark:'', contacts:[]}];
    db.records.push({id:'r_t2', docNo:'LY-T-001', date:today(), type:'out', transfer:true, alloc:true,
      projectId:${JSON.stringify(pid)}, unitId:'ou_t27', warehouseId:'',
      materialId:${JSON.stringify(mid)}, qty:10, operator:'李四', remark:'划拨'});
    saveDB(); render();
  `);
  await sleep(60);
  const allocRows = qa('[data-act="editIssue"]').length;
  const badge2 = /已出库领用/.test(d.body.textContent);
  const rest0 = w.eval(`(unitQuota('ou_t27').find(x=>x.m.id===${JSON.stringify(mid)})||{rest:0}).rest`);
  console.log('  记录行:', allocRows, '| 已出库领用标识:', badge2, '| 单位剩余:', rest0);
  if(!allocRows) errors.push('已出库领用未入列');
  if(!badge2) errors.push('缺少已出库领用标识');

  click('[data-act="delIssue"]');
  await sleep(50);
  const txt2 = (q('.modal') || {textContent:''}).textContent.replace(/\s+/g,' ');
  console.log('  确认文案含「退回」单位额度:', /可用额度/.test(txt2));
  click('[data-act="confirmOk"]');
  await sleep(80);
  const rest1 = w.eval(`(unitQuota('ou_t27').find(x=>x.m.id===${JSON.stringify(mid)})||{rest:0}).rest`);
  console.log('  单位剩余:', rest0, '→', rest1, '（应 +10）');
  if(rest1 !== rest0 + 10) errors.push('撤销划拨未退回单位额度');

  console.log('\nERRORS', errors.length, errors.slice(0,6).join(' | '));
  try{ w.close(); }catch(e){}
}, 260);
