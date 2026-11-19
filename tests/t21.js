/* t21：项目清单右侧详情抽屉 + 项目视图左栏两级目录 */
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
const ev=(el,type)=>el.dispatchEvent(new w.Event(type,{bubbles:true}));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

setTimeout(async ()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  await sleep(60);

  /* ---------- 1. 左栏两级目录 ---------- */
  console.log('--- 1. 项目视图左栏：行政区 → 项目编号 ---');
  click('.nav-item[data-page="projects"]');
  await sleep(60);
  const groups = qa('.pl-group');
  console.log('行政区组数:', groups.length, '|', groups.map(g => g.dataset.g).join(','));
  const codeOf = el => w.eval(`(db.projects.find(p=>p.id===${JSON.stringify(el.dataset.id)})||{}).code||''`);
  const ascOk = arr => arr.every((c,i)=> i===0 || String(arr[i-1]).localeCompare(String(c),'zh-Hans-CN') <= 0);
  console.log('每组组内按编号升序:', groups.every(g => ascOk([...g.querySelectorAll('.pcard')].map(codeOf))));
  console.log('卡片总数 = 项目数:', qa('.plist .pcard').length === w.eval('db.projects.length'),
    '(', qa('.plist .pcard').length, '/', w.eval('db.projects.length'), ')');

  // 折叠后切到其它页面再回来，状态保持
  const g0 = q('.pl-group'), g0name = g0.dataset.g;
  const wasCollapsed = g0.classList.contains('collapsed');
  q('.pl-group-head').click();
  await sleep(30);
  const nowCollapsed = q('.pl-group').classList.contains('collapsed');
  console.log('折叠切换:', wasCollapsed, '→', nowCollapsed, '| 已记忆:',
    w.eval(`state.plGroups[${JSON.stringify(g0name)}]`) === !wasCollapsed);
  // 切页再回来
  click('.nav-item[data-page="dashboard"]');
  await sleep(40);
  click('.nav-item[data-page="projects"]');
  await sleep(60);
  console.log('切页返回后折叠状态保留:', q('.pl-group').classList.contains('collapsed') === nowCollapsed);
  if(q('.pl-group').classList.contains('collapsed') !== nowCollapsed) errors.push('折叠状态未保留');

  /* ---------- 2. 项目清单：点行弹出详情抽屉 ---------- */
  console.log('\n--- 2. 项目清单右侧详情抽屉 ---');
  click('.nav-item[data-page="projectList"]');
  await sleep(60);
  const firstRow = q('#plBody tbody tr');
  console.log('表格行可点击:', !!firstRow && firstRow.dataset.act === 'plDrawer');
  if(!firstRow){ errors.push('项目清单无数据行'); }
  else{
    const pid = firstRow.dataset.id;
    firstRow.click();
    await sleep(50);
    const drawer = q('#plDrawerRoot .pl-drawer');
    console.log('抽屉出现:', !!drawer, '| 标题:', txt('#plDrawerRoot .pl-drawer-head'));
    if(!drawer) errors.push('点击行未打开抽屉');
    console.log('行高亮:', firstRow.classList.contains('pl-row-active'));
    console.log('字段齐全:', ['pd-code','pd-name','pd-district','pd-unit','pd-owner','pd-status','pd-start','pd-remark']
      .every(id => !!q('#'+id)));
    console.log('施工单位在负责人之前:', (() => {
      const a = q('#pd-unit'), b = q('#pd-owner');
      return !!(a && b && (a.compareDocumentPosition(b) & w.Node.DOCUMENT_POSITION_FOLLOWING));
    })());

    // 直接编辑并保存
    const oldName = q('#pd-name').value;
    q('#pd-name').value = oldName + '-改';
    q('#pd-owner').value = '抽屉负责人';
    click('[data-act="savePlDrawer"]');
    await sleep(80);
    const saved = JSON.parse(w.eval(`JSON.stringify(db.projects.find(p=>p.id===${JSON.stringify(pid)})||null)`));
    console.log('保存后名称:', saved && saved.name, '| 负责人:', saved && saved.owner,
      '| 抽屉已关闭:', !q('#plDrawerRoot .pl-drawer'));
    if(!saved || saved.name !== oldName + '-改') errors.push('抽屉保存未生效');
    if(saved && saved.owner !== '抽屉负责人') errors.push('负责人未保存');
    console.log('表格已刷新:', txt('#plBody').indexOf(oldName + '-改') >= 0);

    // 行内按钮不应打开抽屉
    const viewBtn = q('#plBody tbody tr [data-act="openProjectInView"]');
    if(viewBtn){
      viewBtn.click();
      await sleep(60);
      console.log('点行内按钮未误开抽屉:', !q('#plDrawerRoot .pl-drawer'));
      click('.nav-item[data-page="projectList"]');
      await sleep(60);
    }

    // 再打开一次，用 Esc 关闭
    q('#plBody tbody tr').click();
    await sleep(50);
    console.log('再次打开:', !!q('#plDrawerRoot .pl-drawer'));
    d.dispatchEvent(new w.KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
    await sleep(40);
    console.log('Esc 关闭:', !q('#plDrawerRoot .pl-drawer'), '| state 已清空:', !w.eval('state.plDrawer'));
    if(q('#plDrawerRoot .pl-drawer')) errors.push('Esc 未关闭抽屉');

    // 点遮罩关闭
    q('#plBody tbody tr').click();
    await sleep(40);
    click('.pl-drawer-mask');
    await sleep(40);
    console.log('点遮罩关闭:', !q('#plDrawerRoot .pl-drawer'));
  }

  console.log('\n--- 3. 汇总视图不受影响 ---');
  click('.nav-item[data-page="projects"]');
  await sleep(50);
  click('[data-act="pview"][data-m="summary"]');
  await sleep(60);
  console.log('汇总表存在:', !!q('.matrix'), '| 左栏隐藏:', !q('.plist'));
  click('[data-act="pview"][data-m="byProject"]');
  await sleep(50);
  console.log('切回按项目查看:', !!q('.plist'), '| 分组数:', qa('.pl-group').length);

  console.log('\nERRORS', errors.length, errors.slice(0,6).join(' | '));
  try{ w.close(); }catch(e){}
}, 260);
