/* t17：项目排序（左栏 / 汇总列）+ 权限模块与导航同步 + 仪表盘已领用与日历 */
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
const txt=s=>{const el=q(s); return el ? el.textContent.replace(/\s+/g,' ').trim() : '';};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

setTimeout(async ()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');

  /* ---------- 1. 项目视图左栏：两级目录（行政区 → 编号） ---------- */
  console.log('--- 1. 按项目查看：左栏按行政区分组，组内按项目编号排序 ---');
  click('.nav-item[data-page="projects"]');
  const readOrder = () => qa('.plist .pcard').map(el => el.dataset.id);
  const codeOf = el => w.eval(`(db.projects.find(p=>p.id===${JSON.stringify(el.dataset.id)})||{}).code||''`);
  const groupsInfo = () => qa('.pl-group').map(g => ({
    g: g.dataset.g,
    n: g.querySelectorAll('.pcard').length,
    collapsed: g.classList.contains('collapsed'),
    codes: [...g.querySelectorAll('.pcard')].map(codeOf)
  }));
  const ascOk = arr => arr.every((c,i)=> i===0 || String(arr[i-1]).localeCompare(String(c),'zh-Hans-CN') <= 0);
  const descOk = arr => arr.every((v,i)=> i===0 || arr[i-1] >= v);
  const zeroLast = arr => arr.every((v,i)=> v>0 || arr.slice(i).every(x=>x<=0));

  let gs = groupsInfo();
  console.log('行政区数:', gs.length, '|', gs.map(x => x.g + '(' + x.n + ')').join(' '));
  console.log('每组内按编号升序:', gs.every(x => ascOk(x.codes)), '| 示例:', (gs[0] || {codes:[]}).codes.join(','));
  console.log('项目总数一致:', gs.reduce((n,x)=>n+x.n,0) === w.eval('filteredProjects().length'),
    '| 左栏卡片数:', readOrder().length);

  // 折叠 / 展开
  const firstGroup = q('.pl-group');
  const beforeCollapsed = firstGroup.classList.contains('collapsed');
  q('.pl-group-head').click();
  await sleep(30);
  const afterCollapsed = q('.pl-group').classList.contains('collapsed');
  console.log('点击组头切换折叠:', beforeCollapsed, '→', afterCollapsed, '| 生效:', beforeCollapsed !== afterCollapsed);
  q('.pl-group-head').click();
  await sleep(30);
  console.log('再次点击恢复:', q('.pl-group').classList.contains('collapsed') === beforeCollapsed);

  // 行政区筛选后分组仍然正确
  const pickSet = (sel, val) => { const el = q(sel); if(!el) return null; el.value = val; ev(el,'change'); return el; };
  const aDistrict = (q('[data-change="district"]') || {options:[]}).options[1];
  if(aDistrict){
    pickSet('[data-change="district"]', aDistrict.value);
    await sleep(40);
    gs = groupsInfo();
    console.log('筛选「' + aDistrict.value + '」→ 分组数:', gs.length, '| 组内升序:', gs.every(x => ascOk(x.codes)));
    pickSet('[data-change="district"]', 'all');
    await sleep(40);
  }

  // 搜索后仍按编号升序
  const ps = q('#projSearch');
  ps.value = '区'; ev(ps,'input');
  await sleep(40);
  gs = groupsInfo();
  console.log('搜索「区」→ 卡片数:', readOrder().length, '| 组内升序:', gs.every(x => ascOk(x.codes)));
  q('#projSearch').value = ''; ev(q('#projSearch'),'input');
  await sleep(40);

  /* ---------- 2. 汇总矩阵的列顺序 ---------- */
  console.log('\n--- 2. 跨项目物料汇总：项目列按数量从大到小 ---------');
  click('[data-act="pview"][data-m="summary"]');
  await sleep(40);
  const heads = qa('.matrix thead th:not(.stk)').map(th => th.getAttribute('title'));
  const headTotals = heads.map(name => {
    const pid = w.eval(`(db.projects.find(p=>p.name===${JSON.stringify(name)})||{}).id`);
    return pid ? w.eval(`projectTotal(loadAgg(),'${pid}')`) : null;
  });
  console.log('列顺序:', heads.join(' | '));
  console.log('对应持有量:', headTotals.join(' , '));
  console.log('从左到右递减:', descOk(headTotals.filter(v => v !== null)));
  console.log('零值列在最右:', (() => {
    const vals = headTotals.filter(v => v !== null);
    const firstZero = vals.findIndex(v => v <= 0);
    return firstZero < 0 || vals.slice(firstZero).every(v => v <= 0);
  })());
  click('[data-act="pview"][data-m="byProject"]');

  /* ---------- 3. 权限模块与导航同步 ---------- */
  console.log('\n--- 3. 角色授权与导航模块一致 ---------');
  const modIds = w.eval("MODULES.map(m=>m.id).join(',')").split(',');
  console.log('模块数:', modIds.length, '| 含台账/清单/调拨:',
    ['inboundLedger','outboundLedger','projectList','projectTransfer'].every(id => modIds.indexOf(id) >= 0));
  const pageIds = w.eval("Object.keys(PAGES).join(',')").split(',');
  const noMod = pageIds.filter(p => modIds.indexOf(p) < 0);
  console.log('页面数:', pageIds.length, '| 没有同名权限模块的页面:', noMod.length ? noMod.join(',') : '无（一一对应）');

  const keeper = JSON.parse(w.eval("JSON.stringify(db.roles.find(r=>r.id==='r_keeper').perms)"));
  console.log('仓库管理员 入库台账:', (keeper.inboundLedger||[]).join(',') || '（空）');
  console.log('仓库管理员 出库台账:', (keeper.outboundLedger||[]).join(',') || '（空）');
  console.log('仓库管理员 项目清单:', (keeper.projectList||[]).join(',') || '（空）');
  console.log('仓库管理员 出库物资调拨:', (keeper.projectTransfer||[]).join(',') || '（空）');

  click('.nav-item[data-page="accounts"]');
  await sleep(30);
  click('[data-act="acctTab"][data-t="roles"]');
  await sleep(30);
  const roleBtn = qa('[data-act="editRole"]').find(b => b.dataset.id === 'r_keeper');
  if(roleBtn) roleBtn.click(); else errors.push('missing editRole for r_keeper');
  await sleep(40);
  const permRows = qa('#permWrap tbody tr').length;
  const permText = txt('#permWrap');
  console.log('角色弹窗矩阵行数:', permRows, '| 含入库台账:', permText.indexOf('入库台账')>=0,
    '| 含出库台账:', permText.indexOf('出库台账')>=0,
    '| 含项目清单:', permText.indexOf('项目清单')>=0,
    '| 含出库物资调拨:', permText.indexOf('出库物资调拨')>=0);
  console.log('动作列:', qa('#permWrap thead th').map(th=>th.textContent.trim()).join('/'));

  // 取消勾选「入库台账」后保存，应只失去台账权限、不影响入库登记
  w.eval("permDraft.inboundLedger=[]");
  click('[data-act="saveRole"]');
  await sleep(60);
  w.eval("session={userId:db.users.find(u=>u.account==='zhouming').id,guest:false}; saveSession(); invalidatePerms();");
  console.log('仓库管理员 台账权限已关:', w.eval("can('inboundLedger','edit')"),
    '| 入库登记仍可编辑:', w.eval("can('inbound','edit')"),
    '| 台账页面仍可见:', w.eval("pageCan('inboundLedger')"));
  w.eval("session={userId:db.users.find(u=>u.account==='admin').id,guest:false}; saveSession(); invalidatePerms();");
  console.log('保存后角色里的入库台账:', JSON.stringify(w.eval("db.roles.find(r=>r.id==='r_keeper').perms.inboundLedger")));

  /* ---------- 4. 仪表盘：已领用 + 日历 ---------- */
  console.log('\n--- 4. 仪表盘已领用指标与出入库日历 ---');
  click('.nav-item[data-page="dashboard"]');
  await sleep(60);
  console.log('指标定义含 issued:', w.eval("METRIC_DEF.some(m=>m.id==='issued')"),
    '| 可见指标:', w.eval("db.settings.metrics.join(',')"));

  const holdSum = w.eval("db.projects.reduce((s,p)=>{const t=projectTotal(loadAgg(),p.id);return s+(t>0?t:0);},0)");
  const cardLabels = qa('.kpi').map(k => (k.querySelector('.kpi-label')||{}).textContent || '');
  const issuedIdx = cardLabels.findIndex(t => t.indexOf('项目已领用') >= 0);
  const issuedVal = issuedIdx >= 0 ? Number((qa('.kpi-value')[issuedIdx].textContent||'').replace(/[^\d.-]/g,'')) : null;
  console.log('已领用 KPI 存在:', issuedIdx >= 0, '| 数值:', issuedVal, '| 期望:', holdSum, '| 一致:', issuedVal === holdSum);

  const dashText = txt('#view');
  console.log('已领用物料卡片:', dashText.indexOf('项目已领用物料') >= 0,
    '| 按数量排序说明:', dashText.indexOf('按已领用数量排序') >= 0);
  const issuedTable = qa('.card table').map(t => t.textContent).find(t => t.indexOf('项目已领用') >= 0);
  console.log('已领用表格存在:', !!issuedTable);

  /* 日历默认显示当前自然月；种子流水固定在 10 月，先切到有数据的月份再断言（避免测试依赖运行日期） */
  w.eval("(function(){var d=(db.records.filter(function(r){return !r.transfer;}).map(function(r){return r.date;}).sort().pop()||'').slice(0,7); if(d) state.cal.ym=d; state.cal.day='';})()");
  w.eval('render()');
  await sleep(30);
  console.log('日历卡片:', dashText.indexOf('出入库日历') >= 0, '| 有记录日格:', qa('.cal-cell.has').length,
    '| 空白占位:', qa('.cal-cell.blank').length, '| 显示月份:', txt('.cal-title'));
  const dayCell = q('.cal-cell.has');
  if(dayCell){
    const dstr = dayCell.dataset.d;
    dayCell.click();
    await sleep(50);
    const detail = txt('.cal-detail');
    const exp = w.eval(`(function(){var A={},B={};db.records.forEach(function(r){if(r.date==='${dstr}'&&!r.transfer){if(r.type==='in')A[r.docNo]=1;else B[r.docNo]=1;}});return Object.keys(A).length+'|'+Object.keys(B).length;})()`).split('|');
    console.log('点选', dstr, '→ 明细:', detail.slice(0, 70));
    console.log('当天笔数正确:', detail.indexOf('入库 ' + exp[0] + ' 笔')>=0 && detail.indexOf('出库 ' + exp[1] + ' 笔')>=0);
  }else errors.push('没有带记录的日期格');

  const titleBefore = txt('.cal-title');
  click('[data-act="calMonth"][data-dir="1"]');
  await sleep(40);
  console.log('切到下月:', titleBefore, '→', txt('.cal-title'), '| 已切换:', titleBefore !== txt('.cal-title'));
  click('[data-act="calToday"]');
  await sleep(40);
  console.log('回到今天:', txt('.cal-title'), '| 选中今天:', !!q('.cal-cell.sel'));

  console.log('\nERRORS', errors.length);
  errors.forEach(e => console.log('  ' + e));
  w.close();
}, 260);
