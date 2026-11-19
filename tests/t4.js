const fs=require('fs');
const env=require('./_env');
const {JSDOM}=env.resolveJsdom();
const html=fs.readFileSync(env.HTML,'utf8');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,
  beforeParse(w){ try{ w.localStorage.clear(); w.localStorage.setItem('wms_session_v1', JSON.stringify({userId:'u_admin',guest:false})); }catch(e){} }});
const w=dom.window,d=w.document;
w.addEventListener('error',e=>errors.push('ERR: '+e.message));
const q=s=>d.querySelector(s), qa=s=>[...d.querySelectorAll(s)];
const click=s=>{const el=q(s); if(!el){errors.push('missing '+s);return false;} el.click(); return true;};
const db=()=>JSON.parse(w.localStorage.getItem('wms_workbench_v2'));
const ev=(el,t)=>{el.dispatchEvent(new w.Event(t,{bubbles:true,cancelable:true}));};
setTimeout(()=>{
  console.log('logged in as:', q('.user-chip .un').textContent, '| nav', qa('.nav-item').length);
  // 入库两行
  click('.nav-item[data-page="inbound"]');
  click('[data-act="addLine"]');
  const s1=q('#lines-in .line:nth-child(1) select'); s1.value=s1.options[2].value; ev(s1,'change');
  const q1=q('#lines-in .line:nth-child(1) input[data-change="lineQty"]'); q1.value='12'; ev(q1,'input');
  const s2=q('#lines-in .line:nth-child(2) select'); s2.value=s2.options[3].value; ev(s2,'change');
  const q2=q('#lines-in .line:nth-child(2) input[data-change="lineQty"]'); q2.value='8'; ev(q2,'input');
  const b=db().records.length;
  click('[data-act="submitMovement"][data-type="in"]');
  const newRows=db().records.slice(-2);
  console.log('inbound rows:', db().records.length-b, '| qty in db:', newRows.reduce((a,r)=>a+r.qty,0), '| docNo same:', newRows[0].docNo===newRows[1].docNo, '| toast:', qa('.toast').pop().textContent);
  // 出库超量
  click('.nav-item[data-page="outbound"]');
  const os=q('#lines-out .line select'); os.value=os.options[2].value; ev(os,'change');
  const oq=q('#lines-out .line input[data-change="lineQty"]'); oq.value='999999'; ev(oq,'input');
  const b2=db().records.length;
  click('[data-act="submitMovement"][data-type="out"]');
  console.log('over blocked:', db().records.length===b2, '|', qa('.toast').pop().textContent.slice(0,20));
  oq.value='3'; ev(oq,'input');
  click('[data-act="submitMovement"][data-type="out"]');
  console.log('out ok:', db().records.length>b2, '| no project allowed:', db().records[db().records.length-1].projectId==='');
  // 返回入库
  click('.nav-item[data-page="inbound"]');
  click('[data-act="inType"][data-v="return"]');
  const rs=q('#lines-in .line select'); rs.value=rs.options[2].value; ev(rs,'change');
  const rq=q('#lines-in .line input[data-change="lineQty"]'); rq.value='2'; ev(rq,'input');
  const b3=db().records.length;
  click('[data-act="submitMovement"][data-type="in"]');
  console.log('return w/o project blocked:', db().records.length===b3, '|', qa('.toast').pop().textContent);
  const ps=q('select[data-type="in"][data-key="projectId"]'); ps.value=ps.options[1].value; ev(ps,'change');
  const rs2=q('#lines-in .line select'); rs2.value=rs2.options[2].value; ev(rs2,'change');
  const rq2=q('#lines-in .line input[data-change="lineQty"]'); rq2.value='2'; ev(rq2,'input');
  click('[data-act="submitMovement"][data-type="in"]');
  console.log('return ok:', db().records.length>b3);
  // 台账整单编辑（v4.13：独立台账页 + 单据卡片）
  click('.nav-item[data-page="inboundLedger"]');
  console.log('ledger page cards:', qa('.dc-card').length>0, '| first no:', (q('.dc-no')||{}).textContent);
  click('.dc-card [data-act="editDoc"]');
  const dq=q('.de-table input[data-change="deQty"]'); dq.value='7'; ev(dq,'change');
  click('[data-act="saveDocEdit"]');
  console.log('ledger edit:', db().records.some(r=>r.qty===7), '| log:', db().logs[0].module);
  // 物料新增/编辑/删除
  click('.nav-item[data-page="materials"]');
  q('#nm-code').value='T-001'; q('#nm-name').value='测试物料'; q('#nm-brand').value='测试品牌';
  click('[data-act="saveMaterial"]');
  const nm=db().materials.find(m=>m.code==='T-001');
  console.log('material add:', !!nm, '| brand:', nm && nm.brand);
  click('[data-act="editMaterial"][data-id="'+nm.id+'"]');
  q('#em-safety').value='5'; click('[data-act="saveEditMaterial"]');
  console.log('material edit:', db().materials.find(m=>m.id===nm.id).safetyStock);
  click('[data-act="delMaterial"][data-id="'+nm.id+'"]'); click('[data-act="confirmOk"]');
  console.log('material del:', !db().materials.some(m=>m.code==='T-001'));
  // 库存台账排序
  click('.nav-item[data-page="stock"]');
  click('#stockTable thead th[data-k="qty"]');
  console.log('stock sort arrow:', q('#stockTable thead th[data-k="qty"] .sind').textContent);
  click('[data-act="stockResetSort"]');
  // 项目视图 + 汇总
  click('.nav-item[data-page="projects"]');
  click('[data-act="pview"][data-m="summary"]');
  console.log('summary cols:', qa('#view thead th').length, '| rows:', qa('#view tbody tr').length);
  click('[data-act="pview"][data-m="byProject"]');
  // 记录
  click('.nav-item[data-page="records"]');
  console.log('records rows:', qa('#view tbody tr').length, '| pager:', q('#recPager').textContent.replace(/\s+/g,' ').slice(0,20));
  const f=q('select[data-change="f"][data-key="type"]'); f.value='in'; ev(f,'change');
  console.log('filter in:', qa('#view tbody tr').length);
  click('[data-act="clearFilters"]');
  click('[data-act="viewDoc"]');
  console.log('doc modal:', !!q('.modal'), q('.modal-head h3').textContent);
  click('.modal [data-act="closeModal"]');
  // 仪表盘配置
  click('.nav-item[data-page="dashboard"]');
  const k0=qa('.kpi').length;
  click('[data-act="cfgMetrics"]');
  const cb=q('input[data-change="metricToggle"][data-id="ratio"]'); cb.checked=true; ev(cb,'change');
  console.log('kpi', k0, '->', qa('.kpi').length);
  click('.modal [data-act="closeModal"]');
  // 导出
  click('.nav-item[data-page="records"]');
  click('[data-act="exportRecords"]');
  console.log('export toast:', qa('.toast').pop().textContent);
  console.log('=== ERRORS(',errors.length,'):',errors.slice(0,8).join(' ; '));
  try{ w.close(); }catch(e){}
},700);
