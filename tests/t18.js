/* t18：只读启动（无登录界面）+ 调拨项目排序 + 项目视图跳转 + 仪表盘栅格布局 */
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
const navs=()=>qa('.nav-item').map(n=>n.dataset.page);

setTimeout(async ()=>{
  console.log('--- 1. 打开即项目只读，右上角可登录 ---');
  console.log('无登录浮层:', !q('.login-wrap'), '| 右上角登录按钮:', !!q('[data-act="showLogin"]'));
  console.log('身份胶囊:', txt('.user-chip .un'), '/', txt('.user-chip .ur'), '| 标签:', q('.user-chip').tagName);
  console.log('超管账号:', w.eval('SUPER_ACCOUNT'), '| 内置用户:', w.eval('db.users[0].account'));
  const viewerPerms = JSON.parse(w.eval("JSON.stringify(db.roles.find(r=>r.id==='r_viewer').perms)"));
  const guest = JSON.parse(w.eval('JSON.stringify(GUEST_PERMS)'));
  const gk = Object.keys(guest).sort(), vk = Object.keys(viewerPerms).sort();
  console.log('游客模块:', gk.join(','));
  console.log('与「项目只读」角色一致:', JSON.stringify(gk) === JSON.stringify(vk),
    '| 动作全为 view:', Object.values(guest).every(a => a.length === 1 && a[0] === 'view'));
  console.log('导航:', navs().join(','));
  console.log('调拨可见但只读:', navs().includes('projectTransfer'), w.eval("can('projectTransfer','view')"),
    '| 无调拨权限:', !w.eval("can('projectTransfer','transfer')"));
  console.log('台账不可见:', !navs().includes('inboundLedger') && !navs().includes('outboundLedger'));

  console.log('\n--- 2. 隐藏的管理员入口 ---');
  w.eval('showLogin()');
  console.log('浮层可打开:', !!q('.login-wrap'), '| 关闭按钮:', !!q('[data-act="closeLogin"]'));
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  console.log('管理员登录:', txt('.user-chip .un'), '| 导航数:', navs().length);
  click('[data-act="myAccount"]');
  click('.modal [data-act="logout"]');
  console.log('退出后无浮层:', !q('.login-wrap'), '| 回到:', txt('.user-chip .un'), '| 导航数:', navs().length);

  console.log('\n--- 3. 调拨页：项目按领用单数量倒序 ---');
  click('.nav-item[data-page="projectTransfer"]');
  await sleep(40);
  const tfOrder = qa('.tf-split .plist .pcard').map(el => el.dataset.id);
  const tfDocs = tfOrder.map(id => w.eval(`tfDocs('${id}').length`));
  const tfHold = tfOrder.map(id => w.eval(`projectTotal(loadAgg(),'${id}')`));
  console.log('项目顺序:', tfOrder.map(id => w.eval(`db.projects.find(p=>p.id==='${id}').name`)).join(' | '));
  console.log('领用单数:', tfDocs.join(' , '), '| 持有量:', tfHold.join(' , '));
  const descOk = tfDocs.every((n,i)=> i===0 || tfDocs[i-1] >= n);
  const zeroLast = tfDocs.every((n,i)=> n>0 || tfDocs.slice(i).every(x=>x===0));
  console.log('按领用单倒序:', descOk, '| 无单的沉底:', zeroLast);

  console.log('\n--- 4. 项目视图 → 出库物资调拨 ---');
  click('.nav-item[data-page="projects"]');
  await sleep(40);
  const firstCard = q('.pcard');
  const pid = firstCard.dataset.id;
  console.log('左栏卡片调拨按钮:', qa('.plist .pcard [data-act="gotoTransfer"]').length, '/', qa('.plist .pcard').length);
  console.log('详情头部调拨按钮:', qa('.proj-detail-body').length, !!q('.card-head [data-act="gotoTransfer"]'));
  const goBtn = q('.plist .pcard [data-act="gotoTransfer"]');
  if(goBtn) goBtn.click(); else errors.push('missing gotoTransfer in card');
  await sleep(40);
  console.log('跳转后页面:', w.eval('state.page'), '| 预选项目一致:', w.eval('state.tfProjectId') === pid,
    '| Tab:', w.eval('state.tfTab'));

  console.log('\n--- 5. 仪表盘栅格：结构 / 排序 / 缩放持久化 ---');
  click('.nav-item[data-page="dashboard"]');
  await sleep(60);
  console.log('栅格容器:', !!q('#dashGrid'), '| 卡片数:', qa('.dash-card').length);
  console.log('默认顺序:', qa('.dash-card').map(el => el.dataset.card).join(','));
  console.log('每卡都有握把与缩放手柄:', qa('.dash-card .dash-grip').length, '/', qa('.dash-card .dash-rs').length);
  const defW = qa('.dash-card').map(el => el.style.gridColumn.replace('span','').trim()).join(',');
  const defH = qa('.dash-card').map(el => el.style.gridRow.replace('span','').trim()).join(',');
  console.log('默认宽:', defW, '| 默认高:', defH);

  // 保存一个自定义布局（含超范围值，应被夹紧）
  w.eval("saveDashLayout([{id:'alerts',w:99,h:99},{id:'kpi',w:12,h:4},{id:'cal',w:6,h:10}])");
  w.eval('render()');
  await sleep(60);
  console.log('自定义后顺序:', qa('.dash-card').map(el => el.dataset.card).join(','));
  const lay = JSON.parse(w.eval("JSON.stringify(dashLayout())"));
  console.log('夹紧后的宽高:', lay.map(x => x.id + ':' + x.w + 'x' + x.h).join(' '));
  console.log('越界值被限制:', lay[0].w === 12 && lay[0].h === 18);
  console.log('缺失卡片自动补齐:', lay.length, '| 顺序以保存为准:', lay.slice(0,2).map(x=>x.id).join(','));

  click('[data-act="dashReset"]');
  await sleep(60);
  console.log('恢复默认顺序:', qa('.dash-card').map(el => el.dataset.card).join(','),
    '| 已清空存储:', !w.localStorage.getItem('wms_dash_v1'));

  console.log('卡片内容仍在:', ['关键指标','近 6 个月出入库趋势','项目领用排行','出入库日历','项目已领用物料','库存预警']
    .every(t => txt('#view').indexOf(t) >= 0));
  console.log('日历日格:', qa('.cal-cell').length, '| 有记录:', qa('.cal-cell.has').length);

  console.log('\nERRORS', errors.length, errors.slice(0,5).join(' | '));
  try{ w.close(); }catch(e){}
}, 260);
