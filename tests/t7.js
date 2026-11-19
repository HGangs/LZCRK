/* t7：出库项目模糊搜索 / 项目页搜索 / 双栏滚动 / 单项目导出 / 汇总冻结列与导出 */
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
const ev=(el,t)=>{el.dispatchEvent(new w.Event(t,{bubbles:true,cancelable:true}));};
const txt=s=>{const el=q(s); return el ? el.textContent.replace(/\s+/g,' ').trim() : ''};
const login=(a,p)=>{ if(!q('#lg-account')) w.eval('showLogin()'); const acc=q('#lg-account'), pw=q('#lg-pwd'); if(acc){acc.value=a;pw.value=p;click('[data-act="doLogin"]');} };

setTimeout(()=>{
  login('admin', ('sl'+'123456'));
  console.log('login:', !q('.login-wrap'), '| projects:', db().projects.length);

  /* ---------- 1. 出库：项目模糊搜索 ---------- */
  console.log('\n--- 出库项目搜索 ---');
  click('.nav-item[data-page="outbound"]');
  const inp=q('#projInput-out');
  console.log('combo exists:', !!q('#projCombo-out'), '| input:', !!inp, '| native select left:',
    !!q('select[data-type="out"][data-key="projectId"]'));
  inp.focus();
  if(!q('.combo-list.open')) inp.dispatchEvent(new w.FocusEvent('focusin',{bubbles:true}));
  console.log('open on focus:', !!q('.combo-list.open'), '| items:', qa('#projList-out .combo-item').length);

  inp.value='星河'; ev(inp,'input');
  let its=qa('#projList-out .combo-item');
  console.log('search 星河 → items:', its.length, '| name:', its[0] ? its[0].textContent.replace(/\s+/g,' ').trim() : '-',
    '| highlighted kw:', qa('#projList-out .kw').map(x=>x.textContent).join(','));

  inp.value='市南 张'; ev(inp,'input');
  its=qa('#projList-out .combo-item');
  console.log('multi keyword 市南+张 → items:', its.length, '|', its[0] ? its[0].textContent.replace(/\s+/g,' ').trim() : '-');

  inp.value='不存在的项目xyz'; ev(inp,'input');
  console.log('no match → empty tip:', !!q('#projList-out .combo-empty'), '| items:', qa('#projList-out .combo-item').length);

  inp.value='星河'; ev(inp,'input');
  qa('#projList-out .combo-item')[0].click();
  const pickedId=w.eval('draft.out.projectId');
  const picked=db().projects.find(p=>p.id===pickedId);
  console.log('picked:', picked ? picked.name : '(none)', '| input shows:', q('#projInput-out').value,
    '| list closed:', !q('.combo-list.open'), '| clear btn:', !!q('[data-act="clearProject"]'));

  // 键盘：搜索后 ArrowDown + Enter
  const inp2=q('#projInput-out'); inp2.focus();
  if(!q('.combo-list.open')) inp2.dispatchEvent(new w.FocusEvent('focusin',{bubbles:true}));
  inp2.value='云创'; ev(inp2,'input');
  inp2.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
  inp2.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  console.log('keyboard pick →', w.eval('(db.projects.find(p=>p.id===draft.out.projectId)||{}).name'));

  // 提交一单，验证流水带上项目
  const curPid=w.eval('draft.out.projectId');
  const sel=q('#lines-out .line select'); sel.value=sel.options[2].value; ev(sel,'change');
  const qi=q('#lines-out input[data-change="lineQty"]'); qi.value='1'; ev(qi,'input');
  const before=db().records.length;
  click('[data-act="submitMovement"][data-type="out"]');
  const rec=db().records.filter(r=>r.type==='out').slice(-1)[0];
  console.log('submit → rows +', db().records.length-before, '| projectId matches draft:', rec && rec.projectId===curPid);

  // 清除选择
  click('[data-act="clearProject"]');
  console.log('clear → projectId:', JSON.stringify(w.eval('draft.out.projectId')));

  /* ---------- 2. 项目页搜索 ---------- */
  console.log('\n--- 项目页模糊搜索 ---');
  click('.nav-item[data-page="projects"]');
  console.log('search box:', !!q('#projSearch'), '| cards:', qa('.pcard').length, '| split:', !!q('.proj-split'));
  const ps=q('#projSearch'); ps.value='云创'; ev(ps,'input');
  const cards=qa('.pcard');
  console.log('search 云创 → cards:', cards.length, '| detail title:', txt('.proj-split .card:nth-child(2) .card-title'),
    '| active:', cards[0] ? cards[0].classList.contains('active') : false);
  const cols=qa('.matrix-wrap thead th').length;

  // 切换汇总，列数应跟随筛选
  click('[data-act="pview"][data-m="summary"]');
  const sumCols=qa('.matrix-wrap thead th');
  console.log('summary cols:', sumCols.length, '| project col:', sumCols[4] ? sumCols[4].textContent.trim() : '-',
    '| note has kw:', txt('#projBody').indexOf('云创')>=0);
  click('[data-act="pview"][data-m="byProject"]');

  // 搜索 + 行政区组合 → 空态
  const df=q('#districtFilter'); df.value='市北区'; ev(df,'change');
  console.log('search+district → cards:', qa('.pcard').length, '| empty tip:', txt('#projBody').indexOf('没有项目')>=0,
    '| reset btn:', !!q('[data-act="resetProjFilter"]'));
  click('[data-act="resetProjFilter"]');
  console.log('reset → cards:', qa('.pcard').length, '| kw:', JSON.stringify(w.eval('state.projKw')),
    '| search value:', q('#projSearch').value);

  /* ---------- 3. 双栏结构与单项目导出 ---------- */
  console.log('\n--- 双栏 / 单项目导出 ---');
  console.log('left list:', !!q('.proj-split>.card .plist'), '| right body:', !!q('.proj-detail-body'),
    '| left cards:', qa('.proj-split>.card:first-child .pcard').length);
  w.eval("window.__dl=null; download=function(n,t){ window.__dl={name:n,text:t}; return true; };");
  const target=db().projects.find(p=>p.name.indexOf('星河')>=0) || db().projects[0];
  click('.proj-split .pcard');
  const btn=q('[data-act="exportProject"]');
  console.log('export btn:', !!btn);
  btn.click();
  const dl=w.__dl||{name:'',text:''};
  console.log('file:', dl.name, '| lines:', dl.text.split('\n').length,
    '| has project:', dl.text.indexOf(target.code)>=0,
    '| has header:', dl.text.indexOf('物料编码,物料名称,单位')>=0,
    '| has total:', dl.text.indexOf('合计')>=0,
    '| has 导出时间:', dl.text.indexOf('导出时间')>=0);

  /* ---------- 4. 汇总表：冻结列 + 使用汇总 + 导出 ---------- */
  console.log('\n--- 汇总表 ---');
  click('[data-act="pview"][data-m="summary"]');
  const ths=qa('.matrix-wrap thead th');
  console.log('headers:', ths.map(t=>t.textContent.trim()).join(' | '));
  console.log('sticky left:', qa('.matrix-wrap thead .stk-l1').length, '.stk-l4:', qa('.matrix-wrap thead .stk-l4').length,
    '| right:', qa('.matrix-wrap thead .stk-r1').length, qa('.matrix-wrap thead .stk-r3').length,
    '| table fixed:', q('.matrix-wrap table.matrix') ? 'yes' : 'no',
    '| colgroup cols:', qa('.matrix-wrap col').length);
  // 行内校验：汇总 = 各项目列之和；总数量 = 仓库现有 + 汇总
  const row=qa('.matrix-wrap tbody tr')[0];
  if(row){
    const tds=[...row.children].map(td=>td.textContent.trim());
    const qty=tds.slice(4, tds.length-3).map(v=>Number(v.replace(/,/g,''))||0);
    const hold=Number(tds[tds.length-3].replace(/,/g,''))||0;
    const total=Number(tds[tds.length-2].replace(/,/g,''))||0;
    const stock=Number(tds[3].replace(/,/g,''))||0;
    console.log('row check → projects sum:', qty.reduce((a,b)=>a+b,0), '| hold:', hold,
      '| total:', total, '| stock+hold:', stock+hold, '| ok:', hold===qty.reduce((a,b)=>a+b,0) && total===stock+hold);
  }
  // 汇总导出
  w.eval("window.__dl=null;");
  click('[data-act="exportSummary"]');
  const dl2=w.__dl||{name:'',text:''};
  const head2=dl2.text.split('\n').find(l=>l.indexOf('物料编码')===0)||'';
  console.log('summary file:', dl2.name, '| head:', head2.slice(0,90),
    '| has 各项目使用汇总:', head2.indexOf('各项目使用汇总')>=0,
    '| has 合计:', dl2.text.indexOf('合计')>=0,
    '| meta:', (dl2.text.split('\n')[1]||'').slice(0,60));

  /* ---------- 5. 权限：只读账号无导出 ---------- */
  console.log('\n--- 权限 ---');
  click('[data-act="myAccount"]'); click('.modal [data-act="logout"]');
  login('zhangwei','123456');
  click('.nav-item[data-page="projects"]');
  console.log('viewer login:', !q('.login-wrap'), '| exportProject btn:', !!q('[data-act="exportProject"]'));
  click('[data-act="pview"][data-m="summary"]');
  console.log('viewer summary export:', !!q('[data-act="exportSummary"]'), '| matrix rows:', qa('.matrix-wrap tbody tr').length);

  console.log('\nERRORS', errors.length, errors.slice(0,5).join(' | '));
  try{ w.close(); }catch(e){}
}, 800);
