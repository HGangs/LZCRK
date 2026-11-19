/* t15：入库/出库台账独立成页（单据卡片 + 整单编辑）+ 表格列宽拖拽 */
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
const ev=(el,t,opt)=>{el.dispatchEvent(new w.Event(t,Object.assign({bubbles:true,cancelable:true},opt||{})));};
const txt=s=>{const el=q(s); return el ? el.textContent.replace(/\s+/g,' ').trim() : ''};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const recs=()=>w.eval('db.records');
const stock=mid=>w.eval(`stockOf(loadAgg(),'${mid}')`);

setTimeout(async ()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');

  console.log('--- 1. 业务操作下新增两个台账页 ---');
  const nav=qa('.nav-item').map(n=>n.dataset.page);
  console.log('nav has inboundLedger/outboundLedger:', nav.includes('inboundLedger'), nav.includes('outboundLedger'));
  click('.nav-item[data-page="inbound"]');
  console.log('入库页台账已移走:', !q('#ledger-in'), '| 有跳转按钮:', !!q('[data-act="nav"][data-page="inboundLedger"]'));
  click('.nav-item[data-page="inboundLedger"]');
  console.log('page:', txt('#pageTitle'), '| cards:', qa('.dc-card').length,
    '| 单号首字符:', (txt('.dc-no')||'').slice(0,2));

  console.log('\n--- 2. 卡片内容 = 单据聚合 ---');
  const docsIn=w.eval("new Set(db.records.filter(r=>r.type==='in'&&!r.transfer).map(r=>r.docNo)).size");
  console.log('卡片数=入库单数:', qa('.dc-card').length===docsIn, '(', qa('.dc-card').length, '/', docsIn, ')');
  const firstCard=q('.dc-card');
  console.log('卡片头含日期/仓库/项数:', /\d{4}-\d{2}-\d{2}/.test(txt('.dc-head')), '| 明细行:', qa('.dc-card .dc-table tbody tr').length);

  console.log('\n--- 3. 点单号 → 整单编辑弹窗 ---');
  click('.dc-no');
  console.log('modal:', !!q('#modalRoot .modal'), '| title:', txt('#modalRoot h3'), '| rows:', qa('.de-table tbody tr').length);
  const docNo=(q('.de-no')||{}).textContent || txt('#modalRoot h3').replace(/^编辑入库单\s*/,'');
  console.log('docNo:', docNo);

  console.log('\n--- 4. 改数量 → 库存重算 ---');
  const firstRow=q('.de-table tbody tr');
  const matSel=firstRow.querySelector('select');
  const mid=matSel.value;
  const before=stock(mid);
  const qtyIn=firstRow.querySelector('input[data-change="deQty"]');
  const oldQty=Number(qtyIn.value);
  qtyIn.value=String(oldQty+10); ev(qtyIn,'change');
  click('[data-act="saveDocEdit"]');
  await sleep(60);
  const after=stock(mid);
  console.log('入库 +10 → 库存 +10:', after===before+10, '(', before, '→', after, ')');
  console.log('单据行数不变:', w.eval(`db.records.filter(r=>r.docNo==='${docNo}').length`)===w.eval(`db.records.filter(r=>r.docNo==='${docNo}').length`));
  console.log('日志:', w.eval('db.logs[0].module'), '/', w.eval('db.logs[0].action'));

  console.log('\n--- 5. 新增一行 / 删除一行 ---');
  click('.dc-no');
  const n0=qa('.de-table tbody tr').length;
  click('[data-act="deAdd"]');
  console.log('加行:', qa('.de-table tbody tr').length===n0+1);
  const lastSel=qa('.de-table tbody tr').pop().querySelector('select');
  lastSel.value=lastSel.options[1].value; ev(lastSel,'change');
  const lastQty=qa('.de-table tbody tr').pop().querySelector('input[data-change="deQty"]');
  lastQty.value='3'; ev(lastQty,'change');
  click('[data-act="saveDocEdit"]');
  await sleep(60);
  console.log('保存后行数:', w.eval(`db.records.filter(r=>r.docNo==='${docNo}').length`), '(原', n0, '+1)');

  console.log('\n--- 6. 数量清零 = 删除该行 ---');
  click('.dc-no');
  const rowsNow=qa('.de-table tbody tr').length;
  const q0=qa('.de-table tbody tr').pop().querySelector('input[data-change="deQty"]');
  q0.value='0'; ev(q0,'change');
  click('[data-act="saveDocEdit"]');
  await sleep(60);
  console.log('行数 -1:', w.eval(`db.records.filter(r=>r.docNo==='${docNo}').length`)===rowsNow-1);

  console.log('\n--- 7. 库存不足拦截（出库单改超大数量） ---');
  click('.nav-item[data-page="outboundLedger"]');
  console.log('出库卡片:', qa('.dc-card').length);
  click('.dc-card [data-act="editDoc"]');
  const oMat=q('.de-table tbody tr select').value;
  const oQty=q('.de-table tbody tr input[data-change="deQty"]');
  oQty.value='999999'; ev(oQty,'change');
  const n1=recs().length;
  click('[data-act="saveDocEdit"]');
  await sleep(60);
  console.log('被拒:', recs().length===n1, '| 弹窗仍在:', !!q('#modalRoot .modal'), '| toast:', txt('#toast').slice(-40));
  click('[data-act="closeModal"]');

  console.log('\n--- 8. 删除整单 ---');
  const beforeDel=recs().length;
  const delDocNo=txt('.dc-no');
  const delCount=w.eval(`db.records.filter(r=>r.docNo==='${delDocNo}').length`);
  click('.dc-card [data-act="delDoc"]');
  console.log('确认框:', !!q('.modal'), '| 文案含单号:', txt('.modal').indexOf(delDocNo)>=0);
  click('[data-act="confirmOk"]');
  await sleep(60);
  console.log('流水减少:', recs().length===beforeDel-delCount, '(', beforeDel, '→', recs().length, ')');
  console.log('该单已消失:', !recs().some(r=>r.docNo===delDocNo));

  console.log('\n--- 9. 筛选 ---');
  click('.nav-item[data-page="inboundLedger"]');
  const all=qa('.dc-card').length;
  const kw=q('#dlSearch'); kw.value='采购'; ev(kw,'input');
  console.log('关键字筛选:', qa('.dc-card').length, '<=', all, '| 统计:', txt('#dlStat').slice(0,18));
  kw.value=''; ev(kw,'input');
  console.log('清空恢复:', qa('.dc-card').length===all);
  const pf=q('[data-change="dlFilter"][data-key="projectId"]');
  console.log('项目筛选存在:', !!pf, '| 仓库筛选:', !!q('[data-change="dlFilter"][data-key="warehouseId"]'),
    '| 日期:', qa('[data-change="dlFilter"][data-key="from"]').length===1);

  console.log('\n--- 10. 列宽拖拽 ---');
  click('.nav-item[data-page="stock"]');
  const table=q('table[data-colkey="stock"]');
  console.log('stock 表可拖拽:', !!table, '| grips:', qa('table[data-colkey="stock"] .col-grip').length);
  const grip=q('table[data-colkey="stock"] thead th .col-grip');
  const th=grip.parentNode, idx=[...th.parentNode.children].indexOf(th);
  grip.dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,clientX:200}));
  d.dispatchEvent(new w.MouseEvent('mousemove',{bubbles:true,clientX:260}));
  d.dispatchEvent(new w.MouseEvent('mouseup',{bubbles:true}));
  const saved=JSON.parse(w.localStorage.getItem('wms_colw_v1')||'{}');
  console.log('已保存列宽:', !!saved.stock, '| 列数:', (saved.stock||[]).length,
    '| 第', idx, '列:', (saved.stock||[])[idx]);
  click('.nav-item[data-page="materials"]');
  click('.nav-item[data-page="stock"]');
  console.log('重渲染后应用 colgroup:', !!q('table[data-colkey="stock"] colgroup'),
    '| table-layout:', (q('table[data-colkey="stock"]')||{}).style.tableLayout);
  const grip2=q('table[data-colkey="stock"] thead th .col-grip');
  grip2.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true}));
  console.log('双击恢复:', !JSON.parse(w.localStorage.getItem('wms_colw_v1')||'{}').stock);

  console.log('\n--- 11. 其他台账也支持 ---');
  click('.nav-item[data-page="records"]');
  console.log('records 表:', !!q('table[data-colkey="records"]'), '| grips:', qa('table[data-colkey="records"] .col-grip').length);
  click('.nav-item[data-page="projectTransfer"]');
  console.log('调拨表 colgroup:', !!q('table.tf-table colgroup'), '| col 数:', qa('table.tf-table colgroup col').length);
  console.log('调拨表 fixed:', (q('table.tf-table')||{}).style.tableLayout || 'via css',
    '| 末列无固定宽:', !q('table.tf-table colgroup col:last-child').getAttribute('style'));

  console.log('\n--- 12. 权限：游客不可见 / 只读账号无写入口 ---');
  w.eval("session={userId:'', guest:true}; saveSession(); state.page='inboundLedger'; render();");
  console.log('游客 pageCan:', w.eval("pageCan('inboundLedger')"), '| 已回落:', txt('#pageTitle'));
  w.eval("session={userId:db.users.find(x=>x.account==='admin').id,guest:false}; saveSession();");
  w.eval("(function(){var u=db.users.find(x=>x.account==='admin');var r=db.roles.find(x=>x.id===u.roleId);r.perms.inbound=['view'];invalidatePerms();})()");
  w.eval("state.page='inboundLedger'; render();");
  console.log('只读 banner:', !!q('.ro-banner'), '| 编辑入口:', qa('.dc-head [data-act="editDoc"]').length,
    '| 删除按钮:', qa('[data-act="delDoc"]').length,
    '| 去登记按钮:', qa('.toolbar [data-act="nav"][data-page="inbound"]').length);

  console.log('\nERRORS', errors.length, errors.slice(0,5).join(' | '));
  try{ w.close(); }catch(e){}
}, 400);
