/* t14：出库物资调拨（按领用单据逐单调拨，项目持有量互转，仓库库存不变） */
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
const txt=s=>{const el=q(s); return el ? el.textContent.replace(/\s+/g,' ').trim() : ''};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const agg=()=>w.eval('loadAgg()');
const inProj=(pid,mid)=>w.eval(`stockInProject(loadAgg(),'${pid}','${mid}')`);
const stock=(mid)=>w.eval(`stockOf(loadAgg(),'${mid}')`);
const recCount=()=>w.eval('db.records.length');
const trs=()=>w.eval("db.records.filter(r=>r.transfer)");
const P=name=>w.eval(`((db.projects.find(p=>p.name.indexOf('${name}')>=0))||{}).id`);
const M=code=>w.eval(`(db.materials.find(m=>m.code==='${code}')||{}).id`);

setTimeout(async ()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');

  console.log('--- 1. 导航与页面 ---');
  console.log('nav item:', !!q('.nav-item[data-page="projectTransfer"]'), '| text:', q('.nav-item[data-page="projectTransfer"]') ? txt('.nav-item[data-page="projectTransfer"]') : '');
  click('.nav-item[data-page="projectTransfer"]');
  console.log('page title:', txt('#pageTitle'), '| split:', !!q('.tf-split'), '| project cards:', qa('.tf-split .pcard').length);
  console.log('doc cards:', qa('.tf-card').length, '| targets:', qa('.tf-target').length, '| add buttons:', qa('[data-act="tfAdd"]').length);
  console.log('tip shown:', txt('.tf-tip').slice(0, 26));

  console.log('\n--- 2. 选一张有领用单的项目 ---');
  const XH=P('星河湾'), YC=P('云创'), GJ=P('光济');
  console.log('projects:', [XH,YC,GJ].join(' | '));
  w.eval(`state.tfProjectId='${XH}'; state.tfCart={}; render();`);
  const docs=w.eval(`JSON.stringify(tfDocs('${XH}').map(d=>d.docNo))`);
  console.log('XH docs:', docs, '| rendered cards:', qa('.tf-card').length);
  console.log('first card head:', txt('.tf-card .tf-card-head').slice(0, 60));

  console.log('\n--- 3. 单设备单接收项目：调拨 100 ---');
  const mid=M('M-1001');
  const before={xh:inProj(XH,mid), yc:inProj(YC,mid), wh:stock(mid), n:recCount()};
  console.log('before → XH:', before.xh, '| YC:', before.yc, '| 仓库:', before.wh);
  const docNo=w.eval(`tfDocs('${XH}')[0].docNo`);
  const left=w.eval(`transferableQty(loadAgg(),'${XH}','${docNo}','${mid}')`);
  console.log('单据', docNo, '可调拨:', left);
  const key=docNo+'|'+mid;
  w.eval(`state.tfCart['${key}']=[{to:'${YC}',qty:'100'}]; render();`);
  click(`[data-act="tfSubmit"][data-doc="${docNo}"]`);
  await sleep(80);
  const after={xh:inProj(XH,mid), yc:inProj(YC,mid), wh:stock(mid), n:recCount()};
  console.log('after  → XH:', after.xh, '| YC:', after.yc, '| 仓库:', after.wh);
  console.log('XH -100:', after.xh===before.xh-100, '| YC +100:', after.yc===before.yc+100,
    '| 仓库不变:', after.wh===before.wh, '| 新增 2 条流水:', after.n===before.n+2);
  console.log('toast:', txt('#toast').slice(-30));
  const tr=w.eval("JSON.stringify(db.records.filter(r=>r.transfer).map(r=>({no:r.docNo,type:r.type,q:r.qty,pid:r.projectId,src:r.srcDocNo})))");
  console.log('transfer rows:', tr);

  console.log('\n--- 4. 已调拨量与可调拨量联动 ---');
  const moved=w.eval(`(loadAgg().pdm['${XH}|${docNo}|${mid}']||{}).moved`);
  const left2=w.eval(`transferableQty(loadAgg(),'${XH}','${docNo}','${mid}')`);
  console.log('已调拨:', moved, '| 新可调拨:', left2, '| 减少 100:', left2===left-100);
  click('.nav-item[data-page="projectTransfer"]');
  const cardTxt=txt('.tf-card');
  console.log('card 显示已调拨:', cardTxt.indexOf('100')>=0, '| 表格行:', qa('.tf-card .tf-table tbody tr').length);

  console.log('\n--- 5. 一个设备同时调拨给两个项目 ---');
  const mid2=M('M-1002');
  const b2={xh:inProj(XH,mid2), yc:inProj(YC,mid2), gj:inProj(GJ,mid2)};
  const doc1=w.eval(`tfDocs('${XH}').find(d=>d.docNo.indexOf('20260906')>=0).docNo`);
  const key2=doc1+'|'+mid2;
  console.log('第二张单据:', doc1, '| key2:', key2);
  w.eval(`state.tfCart['${key2}']=[{to:'${YC}',qty:'50'},{to:'${GJ}',qty:'30'}]; render();`);
  click(`[data-act="tfSubmit"][data-doc="${doc1}"]`);
  await sleep(80);
  const a2={xh:inProj(XH,mid2), yc:inProj(YC,mid2), gj:inProj(GJ,mid2)};
  console.log('XH:', b2.xh, '→', a2.xh, '(-80)', a2.xh===b2.xh-80);
  console.log('YC:', b2.yc, '→', a2.yc, '(+50)', a2.yc===b2.yc+50);
  console.log('GJ:', b2.gj, '→', a2.gj, '(+30)', a2.gj===b2.gj+30);
  console.log('transfer 组数:', w.eval("new Set(db.records.filter(r=>r.transfer).map(r=>r.transferId)).size"));

  console.log('\n--- 6. 超额调拨被拦截 ---');
  const nBefore=recCount();
  w.eval(`state.tfCart['${key2}']=[{to:'${YC}',qty:'99999'}]; render();`);
  click(`[data-act="tfSubmit"][data-doc="${doc1}"]`);
  await sleep(60);
  console.log('被拒:', recCount()===nBefore, '| toast:', txt('#toast').slice(-40));

  console.log('\n--- 7. 接收项目不能等于调出项目 ---');
  w.eval(`state.tfCart['${key2}']=[{to:'${XH}',qty:'10'}]; render();`);
  click(`[data-act="tfSubmit"][data-doc="${doc1}"]`);
  await sleep(60);
  console.log('被拒:', recCount()===nBefore, '| toast:', txt('#toast').slice(-30));

  console.log('\n--- 8. 累计领用/退回不受调拨污染 ---');
  const pr=w.eval(`JSON.stringify(loadAgg().pr['${XH}'])`);
  const o=JSON.parse(pr);
  console.log('pr:', pr);
  console.log('transferIn=', o.transferIn, ' transferOut=', o.transferOut, '| 累计领用净额=', o.out-(o.transferOut||0));

  console.log('\n--- 9. 记录页显示调拨 ---');
  click('.nav-item[data-page="records"]');
  const body=txt('#view');
  console.log('含「调拨调出」:', body.indexOf('调拨调出')>=0, '| 含「调拨调入」:', body.indexOf('调拨调入')>=0);

  console.log('\n--- 10. 只读账号无提交按钮 ---');
  w.eval("session={userId:'', guest:true}; saveSession(); state.page='projectTransfer'; render();");
  console.log('readonly banner:', !!q('.ro-banner'), '| submit btn:', !!q('[data-act="tfSubmit"]'), '| add btn:', !!q('[data-act="tfAdd"]'));

  console.log('\nERRORS', errors.length, errors.slice(0,5).join(' | '));
  try{ w.close(); }catch(e){}
}, 400);
