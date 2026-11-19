/* t20：删除出库单时连带清理关联调拨 + 失效调拨清理入口 */
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

setTimeout(async ()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  await sleep(60);

  const XH = w.eval("db.projects[0].id"), YC = w.eval("db.projects[1].id");
  const M1 = w.eval("db.materials[0].id");
  const stock0 = w.eval(`stockOf(loadAgg(),'${M1}')`);
  const hold0 = { XH: w.eval(`projectTotal(loadAgg(),'${XH}')`), YC: w.eval(`projectTotal(loadAgg(),'${YC}')`) };
  const tf0 = w.eval("db.records.filter(r=>r.transfer).length");

  console.log('--- 1. 造一张出库单并调拨 ---');
  w.eval(`draft.out.warehouseId=db.warehouses[0].id;draft.out.projectId='${XH}';` +
    `draft.out.unitId='';draft.out.lines=[{materialId:'${M1}',qty:'20',remark:''}];submitMovement('out');`);
  await sleep(50);
  const docNo = w.eval("db.records[db.records.length-1].docNo");
  const tf1 = w.eval("db.records.filter(r=>r.transfer).length");
  console.log('新单:', docNo, '| 出库后库存:', w.eval(`stockOf(loadAgg(),'${M1}')`),
    '| 项目持有:', w.eval(`projectTotal(loadAgg(),'${XH}')`));
  if(tf1 !== tf0) errors.push('出库不应产生调拨记录');

  w.eval(`state.tfProjectId='${XH}';state.tfCart={};`);
  w.eval(`state.tfCart['${docNo}|${M1}']=[{to:'${YC}',qty:'10'}];`);
  w.eval(`submitTransfer('${docNo}')`);
  await sleep(50);
  const tf2 = w.eval("db.records.filter(r=>r.transfer).length");
  const tfDocs = w.eval("Array.from(new Set(db.records.filter(r=>r.transfer).map(r=>r.docNo))).join(',')");
  console.log('调拨流水:', tf2, '| 调拨单:', tfDocs,
    '| XH 持有:', w.eval(`projectTotal(loadAgg(),'${XH}')`),
    '| YC 持有:', w.eval(`projectTotal(loadAgg(),'${YC}')`),
    '| 仓库库存不变:', w.eval(`stockOf(loadAgg(),'${M1}')`) === (stock0 - 20));
  if(tf2 - tf0 !== 2) errors.push('调拨应生成 2 条流水（调出+接收）');

  console.log('\n--- 2. 删除该出库单 ---');
  // 从出库台账的删除入口走 UI
  click('.nav-item[data-page="outboundLedger"]');
  await sleep(60);
  const delBtn = qa('[data-act="delDoc"]').find(b => b.dataset.doc === docNo);
  console.log('找到删除按钮:', !!delBtn);
  if(!delBtn) errors.push('台账缺少删除入口');
  else{
    delBtn.click();
    await sleep(40);
    const modalTxt = txt('.modal');
    console.log('确认弹窗提示含调拨说明:', modalTxt.indexOf('调拨') >= 0, '|', modalTxt.slice(0, 90));
    if(modalTxt.indexOf('调拨') < 0) errors.push('删除确认未提示关联调拨');
    click('[data-act="confirmOk"]');
    await sleep(70);
  }

  const left = w.eval(`db.records.filter(r=>r.docNo==='${docNo}').length`);
  const tf3 = w.eval("db.records.filter(r=>r.transfer).length");
  console.log('该单残留流水:', left, '| 剩余调拨流水:', tf3, '（删除前 ' + tf2 + '）');
  if(left !== 0) errors.push('单据流水未删净');
  if(tf3 !== tf0) errors.push('关联调拨未一并清理');

  const stock1 = w.eval(`stockOf(loadAgg(),'${M1}')`);
  const holdX = w.eval(`projectTotal(loadAgg(),'${XH}')`), holdY = w.eval(`projectTotal(loadAgg(),'${YC}')`);
  console.log('库存回滚:', stock1, '= 原始', stock0, ':', stock1 === stock0);
  console.log('XH 持有回到:', holdX, '(原', hold0.XH, ') | YC 到:', holdY, '(原', hold0.YC, ')');
  if(stock1 !== stock0) errors.push('删单后仓库库存未回滚');
  if(holdX !== hold0.XH || holdY !== hold0.YC) errors.push('删单后项目持有未回滚');

  console.log('\n--- 3. 失效调拨清理入口 ---');
  // 手工造一条来源单据已删除的调拨
  w.eval("db.records.push({id:'r_orphan1',docNo:'DB-ORPH-001',type:'in',inType:'transfer',isReturn:false," +
    "transfer:true,transferId:'tf_orphan',srcDocNo:'CK-NOT-EXIST',fromProjectId:'" + XH + "',toProjectId:'" + YC + "'," +
    "projectId:'" + XH + "',warehouseId:'',materialId:'" + M1 + "',qty:3,date:today(),operator:'test',remark:'孤儿',createdAt:nowTs()});");
  w.eval("db.records.push({id:'r_orphan2',docNo:'DB-ORPH-001',type:'out',inType:'',isReturn:false," +
    "transfer:true,transferId:'tf_orphan',srcDocNo:'CK-NOT-EXIST',fromProjectId:'" + XH + "',toProjectId:'" + YC + "'," +
    "projectId:'" + YC + "',warehouseId:'',materialId:'" + M1 + "',qty:3,date:today(),operator:'test',remark:'孤儿',createdAt:nowTs()});");
  w.eval('saveDB();');
  const orphN = w.eval("orphanTransferRecords().length");
  console.log('失效调拨条数:', orphN);
  if(orphN !== 2) errors.push('失效调拨检测数量不对');

  // 打开调拨记录页，应出现清理按钮
  w.eval("state.page='projectTransfer';state.tfTab='history';render();");
  await sleep(60);
  const cleanBtn = q('[data-act="tfCleanOrphan"]');
  console.log('清理按钮出现:', !!cleanBtn, '| 文案:', cleanBtn ? cleanBtn.textContent.trim() : '-');
  if(!cleanBtn) errors.push('缺少失效调拨清理入口');
  else{
    cleanBtn.click();
    await sleep(40);
    click('[data-act="confirmOk"]');
    await sleep(70);
    const orphAfter = w.eval("orphanTransferRecords().length");
    const tfAfter = w.eval("db.records.filter(r=>r.transfer).length");
    console.log('清理后失效调拨:', orphAfter, '| 剩余调拨流水:', tfAfter, '（应等于 ' + tf0 + '）');
    if(orphAfter !== 0) errors.push('失效调拨未清理');
    if(tfAfter !== tf0) errors.push('清理时误删了正常调拨');
  }

  console.log('\n--- 4. 调拨历史仍可正常查看 ---');
  w.eval("state.tfTab='history';render();");
  await sleep(40);
  console.log('调拨记录页渲染:', txt('#view').indexOf('调拨记录') >= 0, '| 清理按钮已消失:', !q('[data-act="tfCleanOrphan"]'));

  console.log('\nERRORS', errors.length, errors.slice(0,6).join(' | '));
  try{ w.close(); }catch(e){}
}, 260);
