/* t16：权限矩阵核对 + 调拨独立台账 + 整单全字段编辑 + 调拨页行政区筛选 */
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
const ev=(el,t)=>{el.dispatchEvent(new w.Event(t,{bubbles:true,cancelable:true}));};
const txt=s=>{const el=q(s); return el ? el.textContent.replace(/\s+/g,' ').trim() : ''};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const dbv=k=>w.eval(`JSON.stringify(${k})`);

setTimeout(async ()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');

  console.log('--- 1. 权限矩阵核对 ---');
  console.log('PERM_ACTS:', w.eval("PERM_ACTS.map(a=>a.id).join(',')"));
  console.log('projects acts:', w.eval("MODULES.find(m=>m.id==='projects').acts.join(',')"));
  console.log('内置角色:', w.eval("db.roles.map(r=>r.id+':'+Object.keys(r.perms).length).join(' | ')"));
  console.log('仓库管理员 projects:', w.eval("db.roles.find(r=>r.id==='r_keeper').perms.projects").join(','));
  console.log('项目只读 warehouses:', (w.eval("db.roles.find(r=>r.id==='r_viewer').perms.warehouses")||[]).join(','));
  console.log('超管含 transfer:', w.eval("can('projects','transfer')"));
  const pages=w.eval("Object.keys(PAGES).join(',')").split(',');
  const unmapped=pages.filter(p=>{ const m=w.eval(`PAGE_MOD['${p}']||'${p}'`); return !w.eval(`MODULES.some(x=>x.id==='${m}')`); });
  console.log('页面总数:', pages.length, '| 无权限模块映射的页面:', unmapped.length ? unmapped.join(',') : '无');
  console.log('每页 pageCan(admin):', pages.every(p=>w.eval(`pageCan('${p}')`)));

  console.log('\n--- 2. 台账不含调拨流水 ---');
  const XH=w.eval("db.projects.find(x=>x.name.indexOf('星河湾')>=0).id");
  const YC=w.eval("db.projects.find(x=>x.name.indexOf('云创')>=0).id");
  click('.nav-item[data-page="projectTransfer"]');
  w.eval(`(function(){var p=db.projects.find(x=>x.id==='${XH}');state.tfProjectId=p.id;state.tfTab='new';
    var d=tfDocs(p.id)[0];var mid=Object.keys(d.items)[0];
    state.tfCart[d.docNo+'|'+mid]=[{to:'${YC}',qty:'10'}];render();})()`);
  const docNo=w.eval(`tfDocs('${XH}')[0].docNo`);
  const beforeIn=w.eval("groupDocs(docLedgerFilter('in')).length");
  const beforeOut=w.eval("groupDocs(docLedgerFilter('out')).length");
  click(`[data-act="tfSubmit"][data-doc="${docNo}"]`);
  await sleep(80);
  const tfDocsCount=w.eval("new Set(db.records.filter(r=>r.transfer).map(r=>r.docNo)).size");
  console.log('已生成调拨单:', tfDocsCount, '| transfer 流水:', w.eval("db.records.filter(r=>r.transfer).length"));
  click('.nav-item[data-page="inboundLedger"]');
  const afterIn=qa('.dc-card').length;
  click('.nav-item[data-page="outboundLedger"]');
  const afterOut=qa('.dc-card').length;
  console.log('入库台账卡片 前后:', beforeIn, '→', afterIn, '(不变:', afterIn===beforeIn, ')');
  console.log('出库台账卡片 前后:', beforeOut, '→', afterOut, '(不变:', afterOut===beforeOut, ')');
  console.log('台账里调拨单号:', txt('#view').indexOf('DB-')>=0, '(应为 false)');

  console.log('\n--- 3. 调拨记录独立台账 ---');
  click('.nav-item[data-page="projectTransfer"]');
  click('[data-act="tfTab"][data-m="history"]');
  console.log('tab 激活:', (q('[data-act="tfTab"][data-m="history"]')||{}).className);
  console.log('调拨卡片:', qa('.tf-card').length, '| 表头列:', qa('.tf-hist-table thead th').length,
    '| 箭头行:', qa('.tf-arrow').length);
  console.log('卡片头:', txt('.tf-card .tf-card-head').slice(0,50));
  console.log('记录行含项目流向:', txt('.tf-hist-table tbody tr').indexOf('→')>=0 || qa('.tf-arrow').length>0);
  const hkw=q('#tfHistSearch'); hkw.value='不存在xyz'; ev(hkw,'input');
  console.log('记录搜索过滤:', qa('.tf-card').length, '(应为 0)');
  hkw.value=''; ev(hkw,'input');
  console.log('清空恢复:', qa('.tf-card').length>0);
  click('[data-act="tfTab"][data-m="new"]');

  console.log('\n--- 4. 调拨页行政区筛选（模糊） ---');
  console.log('行政区输入框:', !!q('#tfDistrict'), '| datalist:', !!q('#tfDistrictOpts'),
    '| 候选数:', qa('#tfDistrictOpts option').length);
  const allCards=qa('.tf-split .pcard').length;
  const dist=w.eval("db.projects[0].district");
  const di=q('#tfDistrict'); di.value=String(dist).slice(1,3); ev(di,'input');
  const afterCards=qa('.tf-split .pcard').length;
  console.log('输入「' + String(dist).slice(1,3) + '」→', afterCards, '/', allCards, '(模糊命中:', afterCards>0 && afterCards<=allCards, ')');
  console.log('清空按钮:', !!q('[data-act="tfDistrictClear"]'));
  click('[data-act="tfDistrictClear"]');
  console.log('清除后恢复:', qa('.tf-split .pcard').length===allCards);

  console.log('\n--- 5. 整单全字段编辑 ---');
  click('.nav-item[data-page="inboundLedger"]');
  const targetDoc=txt('.dc-no');
  click('.dc-no');
  console.log('弹窗字段:', {
    日期: !!q('[data-change="deHead"][data-key="date"]'),
    仓库: !!q('[data-change="deHead"][data-key="warehouseId"]'),
    项目: !!q('[data-change="deHead"][data-key="projectId"]'),
    经办人: !!q('[data-change="deHead"][data-key="operator"]'),
    入库类型: !!q('[data-change="deHead"][data-key="inType"]'),
    单据备注: !!q('[data-change="deHead"][data-key="remark"]')
  });
  const dIn=q('[data-change="deHead"][data-key="date"]');
  dIn.value='2026-10-01'; ev(dIn,'change');
  const opIn=q('[data-change="deHead"][data-key="operator"]');
  opIn.value='测试经办'; ev(opIn,'change');
  const rmIn=q('[data-change="deHead"][data-key="remark"]');
  rmIn.value='整单改备注'; ev(rmIn,'change');
  click('[data-act="saveDocEdit"]');
  await sleep(80);
  const saved=JSON.parse(w.eval(`JSON.stringify(db.records.filter(r=>r.docNo==='${targetDoc}').map(r=>({d:r.date,o:r.operator,r:r.remark})))`));
  console.log('保存后:', JSON.stringify(saved));
  console.log('日期/经办人/备注 全部写入:', saved.every(r=>r.d==='2026-10-01' && r.o==='测试经办' && r.r.indexOf('整单改备注')>=0));
  console.log('日志:', w.eval('db.logs[0].detail').slice(0,60));

  console.log('\n--- 5b. 出库单改所属项目 ---');
  click('.nav-item[data-page="outboundLedger"]');
  const outDoc=txt('.dc-no');
  const outPid0=w.eval(`db.records.find(r=>r.docNo==='${outDoc}').projectId`);
  click('.dc-no');
  const pj2=q('[data-change="deHead"][data-key="projectId"]');
  const pjNew=Array.from(pj2.options).map(o=>o.value).filter(v=>v && v!==outPid0)[0];
  pj2.value=pjNew; ev(pj2,'change');
  click('[data-act="saveDocEdit"]');
  await sleep(80);
  const outPid1=w.eval(`db.records.find(r=>r.docNo==='${outDoc}').projectId`);
  console.log('项目', outPid0, '→', outPid1, '| 已改:', outPid1===pjNew);

  console.log('\n--- 6. 改成「项目返回入库」必须选项目 ---');
  click('.nav-item[data-page="inboundLedger"]');
  click('.dc-no');
  const itSel=q('[data-change="deHead"][data-key="inType"]');
  itSel.value='return'; ev(itSel,'change');
  const pj3=q('[data-change="deHead"][data-key="projectId"]');
  pj3.value=''; ev(pj3,'change');
  const n0=w.eval('db.records.length');
  click('[data-act="saveDocEdit"]');
  await sleep(60);
  console.log('被拒:', w.eval('db.records.length')===n0, '| 弹窗仍在:', !!q('#modalRoot .modal'), '| toast:', txt('#toast').slice(-24));
  click('[data-act="closeModal"]');

  console.log('\n--- 7. 权限实时生效（去掉 transfer 后调拨只读） ---');
  w.eval("(function(){var u=db.users.find(x=>x.account==='admin');var r=db.roles.find(x=>x.id===u.roleId);r.perms.projects=r.perms.projects.filter(a=>a!=='transfer');invalidatePerms();})()");
  w.eval("state.page='projectTransfer'; state.tfTab='new'; render();");
  console.log('只读 banner:', !!q('.ro-banner'), '| 提交按钮:', qa('[data-act="tfSubmit"]').length,
    '| 加目标按钮:', qa('[data-act="tfAdd"]').length);
  w.eval("(function(){var u=db.users.find(x=>x.account==='admin');var r=db.roles.find(x=>x.id===u.roleId);r.perms.projects.push('transfer');invalidatePerms();})()");

  console.log('\nERRORS', errors.length, errors.slice(0,5).join(' | '));
  try{ w.close(); }catch(e){}
}, 400);
