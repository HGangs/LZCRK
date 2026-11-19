/* t8：项目清单模块 + 铺满布局 + 项目视图/清单互通 */
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

setTimeout(()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  console.log('login:', !q('.login-wrap'), '| projects:', db().projects.length);

  console.log('\n--- 项目清单页 ---');
  console.log('nav item:', !!q('.nav-item[data-page="projectList"]'), '| label:', (q('.nav-item[data-page="projectList"] span')||{}).textContent);
  click('.nav-item[data-page="projectList"]');
  console.log('page title:', txt('#pageTitle'), '| desc ok:', txt('#pageDesc').indexOf('项目档案')>=0);
  console.log('rows:', qa('#plBody tbody tr').length, '| footer 合计:', txt('#plBody tfoot').indexOf('合计')>=0,
    '| head cnt:', txt('.card-title .cnt').slice(0,26));
  console.log('toolbar:', !!q('#plSearch'), !!q('[data-change="plDistrict"]'), !!q('[data-change="plOwner"]'),
    '| export btn:', !!q('[data-act="exportPl"]'));

  console.log('\n--- 搜索与筛选 ---');
  console.log('headers:', qa('#plBody thead th').map(t => t.textContent.trim()).join(' | '));
  console.log('no status/startDate:', txt('#plBody thead').indexOf('状态') < 0 && txt('#plBody thead').indexOf('开工') < 0);
  const ps=q('#plSearch'); ps.value='云创'; ev(ps,'input');
  console.log('search 云创 → rows:', qa('#plBody tbody tr').length, '| first code:', txt('#plBody tbody tr td'));
  ps.value=''; ev(ps,'input');
  const df=q('[data-change="plDistrict"]'); df.value='市南区'; ev(df,'change');
  console.log('district 市南区 → rows:', qa('#plBody tbody tr').length);
  df.value='all'; ev(df,'change');
  console.log('reset selects → rows:', qa('#plBody tbody tr').length);

  console.log('\n--- 导出清单 ---');
  w.eval("window.__dl=null; download=function(n,t){ window.__dl={name:n,text:t}; return true; };");
  click('[data-act="exportPl"]');
  const dl=w.__dl||{name:'',text:''};
  const dlHead=(dl.text.split('\n').find(l=>l.indexOf('项目编号')===0)||'');
  console.log('file:', dl.name, '| meta:', (dl.text.split('\n')[1]||'').slice(0,66),
    '| has 种数列:', dl.text.indexOf('领用物料种数')>=0, '| 合计:', dl.text.indexOf('合计')>=0,
    '| 无状态/开工:', dlHead.indexOf('状态')<0 && dlHead.indexOf('开工')<0);

  console.log('\n--- 与项目视图互通 ---');
  const firstId=db().projects[0].id;
  click('#plBody tbody tr:first-child [data-act="openProjectInView"]');
  console.log('查看 → page:', w.eval('state.page'), '| detail title:', txt('.proj-split .card:nth-child(2) .card-title').slice(0,20));
  click('[data-act="openProjectList"]');
  console.log('清单 → page:', w.eval('state.page'), '| highlighted row:', !!q('#plBody tr.hl-row'),
    '| hl id matches:', q('#plBody tr.hl-row') ? q('#plBody tr.hl-row').getAttribute('data-x')||w.eval('state.plHighlight')===db().projects[0].id : false);

  console.log('\n--- 编辑入口 / 权限 ---');
  click('.nav-item[data-page="projectList"]');
  click('#plBody tbody tr:first-child [data-act="editProject"]');
  console.log('edit modal:', !!q('.modal'), '| close:', (click('[data-act="closeModal"]'), !q('.modal')));
  click('[data-act="myAccount"]'); click('.modal [data-act="logout"]');
  w.eval('showLogin()');
  q('#lg-account').value='zhangwei'; q('#lg-pwd').value='123456'; click('[data-act="doLogin"]');
  console.log('viewer login:', !q('.login-wrap'));
  console.log('viewer 清单 nav:', !!q('.nav-item[data-page="projectList"]'));
  click('.nav-item[data-page="projectList"]');
  console.log('viewer rows:', qa('#plBody tbody tr').length, '| banner:', !!q('.ro-banner'),
    '| export:', !!q('[data-act="exportPl"]'), '| new:', !!q('[data-act="newProject"]'),
    '| row edit:', !!q('#plBody [data-act="editProject"]'), '| row del:', !!q('#plBody [data-act="delProject"]'),
    '| 查看 btn:', !!q('#plBody [data-act="openProjectInView"]'));

  console.log('\n--- 铺满布局 ---');
  const v=q('.view');
  console.log('view max-width:', (w.getComputedStyle ? w.getComputedStyle(v).maxWidth : 'n/a'),
    '| padding:', w.getComputedStyle ? w.getComputedStyle(v).paddingLeft : 'n/a');

  console.log('\nERRORS', errors.length, errors.slice(0,5).join(' | '));
  try{ w.close(); }catch(e){}
}, 800);
