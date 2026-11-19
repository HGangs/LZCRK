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
const ctx=(el,x,y)=>el.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:x||120,clientY:y||240}));
const opts=s=>qa(s+' option').map(o=>o.textContent);
setTimeout(()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  console.log('login:', !q('.login-wrap'), '| user:', q('.user-chip .un').textContent);

  console.log('--- 行政区：只列真实存在的值 ---');
  click('.nav-item[data-page="projects"]');
  console.log('seeded districts:', opts('#districtFilter').join(' / '));

  // 1) 删掉一个区（该区只有一个项目时，选项应随之消失）
  const cards=qa('.pcard');
  const distOf = c => (c.closest('.pl-group') || {dataset:{}}).dataset.g || '';
  const dist=distOf(cards[0]);
  const shared=cards.filter(c=>distOf(c)===dist).length;
  cards[0].click();
  click('[data-act="delProject"]');
  if(q('#cf-chk')) q('#cf-chk').checked=true;
  click('[data-act="confirmOk"]');
  console.log('deleted district', dist, '| shared before:', shared, '| option now:',
    opts('#districtFilter').includes(dist) ? 'still there' : 'gone', '|', opts('#districtFilter').join(' / '));

  // 2) 删空全部项目
  let guard=0;
  while(db().projects.length && guard++<20){
    if(!q('.pcard') && q('[data-act="resetProjFilter"]')) click('[data-act="resetProjFilter"]');
    if(!q('.pcard')) break;
    q('.pcard').click();
    click('[data-act="delProject"]');
    if(q('#cf-chk')) q('#cf-chk').checked=true;
    click('[data-act="confirmOk"]');
  }
  console.log('projects left:', db().projects.length, '| district select gone:', !q('#districtFilter'), '| owner select gone:', !q('#ownerFilter'));
  console.log('state reset:', w.eval('state.district'), '/', w.eval('state.owner'), '| empty:', q('#view').textContent.includes('还没有项目'));

  // 3) 重新建项目，行政区按实际值重建
  w.eval("db.projects.push({id:'p_a',code:'P-A',name:'甲项目',district:'市南区',owner:'张伟',status:'进行中',startDate:'2026-01-01'},"+
         "{id:'p_b',code:'P-B',name:'乙项目',district:'',owner:'',status:'进行中',startDate:'2026-02-01'}); saveDB(); render();");
  console.log('rebuilt districts:', opts('#districtFilter').join(' / '));
  console.log('rebuilt owners:', opts('#ownerFilter').join(' / '));

  // 项目删到只剩一个区时，其他行政区不会再冒出来
  q('.pcard').click();
  click('[data-act="delProject"]');
  if(q('#cf-chk')) q('#cf-chk').checked=true;
  click('[data-act="confirmOk"]');
  console.log('after deleting 甲项目:', db().projects.length, '| districts:', opts('#districtFilter').join(' / '));
  w.eval("db.projects.push({id:'p_a',code:'P-A',name:'甲项目',district:'市南区',owner:'张伟',status:'进行中',startDate:'2026-01-01'}); saveDB(); render();");

  const df=q('#districtFilter'); df.value='__none__'; ev(df,'change');
  console.log('unassigned filter:', qa('.pcard').length, '| card:', q('.pcard') ? q('.pcard').textContent.replace(/\s+/g,'') : '-');
  const of=q('#ownerFilter'); of.value='__none__'; ev(of,'change');
  console.log('both blank filters:', qa('.pcard').length, '|', q('#view').textContent.includes('当前筛选条件下没有项目'));
  w.eval("state.district='all';state.owner='all';render();");

  console.log('--- 右键重命名模块 ---');
  const navEl=q('.nav-item[data-page="inbound"]');
  ctx(navEl, 130, 240);
  console.log('menu open:', q('#ctxMenu').classList.contains('open'), '| head:', q('#ctxMenu .ctx-head').textContent);
  console.log('items:', qa('#ctxMenu button').map(b=>b.textContent.trim()+(b.disabled?'(disabled)':'')).join(' / '));
  click('#ctxMenu [data-act="renameModule"]');
  console.log('modal:', !!q('#rn-name'), '| value:', q('#rn-name').value, '| reset btn:', !!q('.modal [data-act="resetModuleName"]'));
  q('#rn-name').value='采购入库';
  click('.modal [data-act="saveModuleName"]');
  console.log('nav text:', q('.nav-item[data-page="inbound"] span').textContent, '| stored:', db().settings.moduleNames.inbound);
  console.log('log:', db().logs[0].module, '/', db().logs[0].detail);
  click('.nav-item[data-page="inbound"]');
  console.log('page title:', q('#pageTitle').textContent, '| desc:', q('#pageDesc').textContent.slice(0,8));

  // 权限矩阵同步
  w.eval("openModal('权限矩阵', permMatrixHtml(allPerms()))");
  const cells=qa('#permWrap tbody tr td:first-child').map(td=>td.textContent.split('整行切换')[0].trim());
  console.log('matrix has custom name:', cells.includes('采购入库'), '| first 3:', cells.slice(0,3).join(','));
  w.eval("closeModal()");

  // 重名拦截
  const outEl=q('.nav-item[data-page="outbound"]');
  ctx(outEl, 130, 280);
  click('#ctxMenu [data-act="renameModule"]');
  q('#rn-name').value='采购入库';
  click('.modal [data-act="saveModuleName"]');
  console.log('duplicate blocked:', !db().settings.moduleNames.outbound, '|', qa('.toast').pop().textContent);

  // 空值 / 超长
  q('#rn-name').value='   '; click('.modal [data-act="saveModuleName"]');
  console.log('empty blocked:', !db().settings.moduleNames.outbound, '|', qa('.toast').pop().textContent);
  q('#rn-name').value='一二三四五六七八九十十一十二'; click('.modal [data-act="saveModuleName"]');
  console.log('len blocked:', !db().settings.moduleNames.outbound, '|', qa('.toast').pop().textContent);

  // 恢复默认
  click('.modal [data-act="closeModal"]');
  ctx(q('.nav-item[data-page="inbound"]'), 130, 240);
  console.log('reset item enabled:', !qa('#ctxMenu button')[1].disabled);
  click('#ctxMenu [data-act="resetModuleName"]');
  console.log('nav restored:', q('.nav-item[data-page="inbound"] span').textContent, '| stored:', db().settings.moduleNames.inbound);

  // 页头右键
  ctx(q('#pageTitle'), 500, 60);
  console.log('title ctx open:', q('#ctxMenu').classList.contains('open'), '| head:', q('#ctxMenu .ctx-head').textContent);
  d.body.click();
  console.log('menu closed on outside click:', !q('#ctxMenu').classList.contains('open'));

  // 持久化：新窗口读取 localStorage
  console.log('persist raw:', (JSON.parse(w.localStorage.getItem('wms_workbench_v2')).settings.moduleNames || {}).inbound === undefined);

  console.log('--- 无权限账号 ---');
  click('[data-act="myAccount"]'); click('.modal [data-act="logout"]');
  w.eval('showLogin()');
  q('#lg-account').value='zhangwei'; q('#lg-pwd').value='123456'; click('[data-act="doLogin"]');
  ctx(q('.nav-item[data-page="projects"]'), 120, 240);
  console.log('viewer menu:', q('#ctxMenu').classList.contains('open'), '|', q('#ctxMenu').textContent.trim(), '| disabled:', q('#ctxMenu button').disabled);

  console.log('ERRORS', errors.length, errors.slice(0,5).join(' | '));
  try{ w.close(); }catch(e){}
}, 900);
