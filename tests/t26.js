/* t26：移动端适配（抽屉菜单、响应式规则、触摸尺寸） */
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
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

setTimeout(async ()=>{
  console.log('--- 1. 抽屉菜单结构 ---');
  console.log('  汉堡按钮:', !!q('.nav-toggle'), '| 遮罩:', !!q('.nav-mask'));
  if(!q('.nav-toggle')) errors.push('缺少汉堡按钮');
  if(!q('.nav-mask')) errors.push('缺少侧栏遮罩');

  console.log('\n--- 2. 打开 / 关闭 ---');
  click('[data-act="navToggle"]');
  await sleep(30);
  console.log('  打开后 body.nav-open:', d.body.classList.contains('nav-open'));
  if(!d.body.classList.contains('nav-open')) errors.push('抽屉未打开');
  click('[data-act="navToggle"]');
  await sleep(30);
  console.log('  再次点击关闭:', !d.body.classList.contains('nav-open'));
  if(d.body.classList.contains('nav-open')) errors.push('抽屉未关闭');

  console.log('\n--- 3. 点导航自动收起 ---');
  click('[data-act="navToggle"]');
  await sleep(20);
  click('.nav-item[data-page="stock"]');
  await sleep(60);
  console.log('  跳转页面:', w.eval('state.page'), '| 抽屉已收起:', !d.body.classList.contains('nav-open'));
  if(d.body.classList.contains('nav-open')) errors.push('导航后抽屉未收起');

  console.log('\n--- 4. 响应式规则存在 ---');
  const css = d.querySelector('style') ? d.querySelector('style').textContent : '';
  const checks = {
    '断点 768': /@media \(max-width:768px\)/.test(css),
    '侧栏抽屉': /transform:translateX\(-102%\)/.test(css),
    '仪表盘单列': /\.dash-grid\{grid-template-columns:minmax\(0,1fr\) !important/.test(css),
    '隐藏拖拽手柄': /\.pl-resizer\{display:none\}/.test(css),
    '输入框16px': /input:not\(\[type=range\]\):not\(\[type=checkbox\]\),select,textarea\{font-size:16px\}/.test(css),
    '弹窗全宽': /\.modal\{width:100%;max-width:none/.test(css),
    '触摸按钮高度': /\.btn\{min-height:34px/.test(css)
  };
  Object.keys(checks).forEach(k => console.log('  ' + k + ':', checks[k]));
  Object.keys(checks).forEach(k => { if(!checks[k]) errors.push('缺少规则: ' + k); });

  console.log('\n--- 5. 移动端顶栏精简 ---');
  console.log('  缩放控件（手机上隐藏）:', /\.zoom-ctrl\{display:none\}/.test(css));
  console.log('  全局搜索（手机上隐藏）:', /\.topbar \.gsearch\{display:none\}/.test(css));
  console.log('  备份/重置按钮隐藏:', /#topBackup,#resetBtn\{display:none\}/.test(css));

  console.log('\n--- 6. 抽屉内恢复文字菜单 ---');
  console.log('  覆盖图标条:', /\.brand-name,\.brand-sub,\.nav-group,\.nav-item span,\.side-foot\{display:block\}/.test(css));
  if(!/\.brand-name,\.brand-sub,\.nav-group,\.nav-item span,\.side-foot\{display:block\}/.test(css)) errors.push('抽屉未恢复文字菜单');

  console.log('\nERRORS', errors.length, errors.slice(0,6).join(' | '));
  try{ w.close(); }catch(e){}
}, 260);
