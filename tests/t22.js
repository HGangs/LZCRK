/* t22：出库联系人、记录删除、权限矩阵补全、字体缩放与字体设置 */
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

  /* ---------- 1. 建单位 + 两个联系人 ---------- */
  console.log('--- 1. 出库登记：单位联系人联动 ---');
  click('.nav-item[data-page="orgUnits"]');
  await sleep(40);
  click('[data-act="newOrgUnit"]');
  await sleep(30);
  q('#ou-name').value='测试施工单位';
  q('#ouContacts .ou-contact .ou-c-name').value='张工';
  q('#ouContacts .ou-contact .ou-c-phone').value='13800001111';
  click('[data-act="ouAddContact"]');
  await sleep(20);
  const rows2 = qa('#ouContacts .ou-contact');
  rows2[1].querySelector('.ou-c-name').value='李工';
  rows2[1].querySelector('.ou-c-phone').value='13900002222';
  click('[data-act="saveOrgUnit"]');
  await sleep(50);
  const ouId = w.eval('db.orgUnits[0].id');

  click('.nav-item[data-page="outbound"]');
  await sleep(50);
  const unitSel = q('select[data-type="out"][data-key="unitId"]');
  const recSel = q('select[data-type="out"][data-key="contactIdx"]');
  console.log('施工单位下拉:', !!unitSel, '| 联系人下拉:', !!recSel,
    '| 未选单位时提示:', recSel ? recSel.options[0].textContent : '-');
  if(!recSel) errors.push('缺少单位联系人下拉');
  unitSel.value = ouId;
  w.eval(`draft.out.unitId='${ouId}';draft.out.contactIdx='';render();`);
  await sleep(50);
  const opts = [...q('select[data-type="out"][data-key="contactIdx"]').options].map(o => o.textContent);
  console.log('选单位后联系人候选:', opts.join(' | '));
  if(opts.length < 3) errors.push('联系人候选未刷新');
  console.log('含两个联系人:', opts.some(t => t.indexOf('张工') >= 0) && opts.some(t => t.indexOf('李工') >= 0));

  // 选第二个联系人并提交
  w.eval("draft.out.warehouseId=db.warehouses[0].id;draft.out.contactIdx='1';" +
    "draft.out.lines=[{materialId:db.materials[0].id,qty:'3',remark:''}];submitMovement('out');");
  await sleep(50);
  const rec = JSON.parse(w.eval("JSON.stringify(db.records[db.records.length-1])"));
  console.log('流水 contactName:', rec.contactName, '| contactPhone:', rec.contactPhone);
  if(rec.contactName !== '李工' || rec.contactPhone !== '13900002222') errors.push('联系人未写入流水');

  // 换单位应重置联系人
  w.eval("draft.out.contactIdx='1';draft.out.unitId='';");
  click('.nav-item[data-page="outbound"]');
  await sleep(40);
  const selU = q('select[data-type="out"][data-key="unitId"]');
  selU.value = ouId; ev(selU, 'change');
  await sleep(50);
  console.log('重新选单位后 contactIdx 已重置:', w.eval('draft.out.contactIdx') === '');

  /* ---------- 2. 出入库记录：删除按钮 ---------- */
  console.log('\n--- 2. 出入库记录删除 ---');
  click('.nav-item[data-page="records"]');
  await sleep(60);
  const delBtns = qa('[data-act="delRecRow"]');
  console.log('删除按钮数:', delBtns.length, '| 表格行数:', qa('#recordTable tbody tr').length);
  if(!delBtns.length) errors.push('记录页缺少删除按钮');
  const before = w.eval('db.records.length');
  // 删一条出库（删除入库会校验库存，这里选最简单的第一条）
  const targetId = delBtns[0].dataset.id;
  const targetRec = JSON.parse(w.eval(`JSON.stringify(db.records.find(r=>r.id===${JSON.stringify(targetId)}))`));
  delBtns[0].click();
  await sleep(40);
  console.log('确认弹窗:', !!q('[data-act="confirmOk"]'), '| 提示:', txt('.modal').slice(0, 60));
  click('[data-act="confirmOk"]');
  await sleep(60);
  const after = w.eval('db.records.length');
  console.log('流水 ', before, '→', after, '| 删掉的单号:', targetRec.docNo,
    '| 日志已记:', w.eval("db.logs[0].module==='出入库记录'"));
  if(after !== before - 1) errors.push('记录删除未生效');
  console.log('表格已刷新:', qa('#recordTable tbody tr').length === Math.min(12, after));

  /* ---------- 3. 权限矩阵：19 模块齐全 ---------- */
  console.log('\n--- 3. 角色权限补全 ---');
  const modIds = w.eval('MODULES.map(m=>m.id)');
  const roles = JSON.parse(w.eval("JSON.stringify(db.roles.map(r=>({id:r.id,name:r.name,keys:Object.keys(r.perms||{})})))"));
  console.log('模块数:', modIds.length);
  roles.forEach(r => {
    const missing = modIds.filter(id => !r.keys.includes(id));
    console.log('  ' + r.id + ' 键数:', r.keys.length, '| 缺失:', missing.length ? missing.join(',') : '无');
    if(missing.length) errors.push(r.id + ' 权限键不全');
  });
  const admin = JSON.parse(w.eval("JSON.stringify(db.roles.find(r=>r.id==='r_admin').perms)"));
  console.log('超管 records.delete:', (admin.records||[]).includes('delete'),
    '| 仓管 records:', JSON.stringify(w.eval("db.roles.find(r=>r.id==='r_keeper').perms.records")));
  console.log('只读 accounts:', JSON.stringify(w.eval("db.roles.find(r=>r.id==='r_viewer').perms.accounts")));

  /* ---------- 4. 字体缩放与字体 ---------- */
  console.log('\n--- 4. 显示与字体 ---');
  click('.nav-item[data-page="settings"]');
  await sleep(60);
  const slider = q('#dp-scale'), fontSel = q('[data-change="dpFont"]');
  console.log('缩放下拉:', !!slider, '| 字体下拉:', !!fontSel, '| 选项数:', fontSel ? fontSel.options.length : 0);
  if(!slider || !fontSel) errors.push('设置页缺少显示与字体');
  slider.value = '150'; ev(slider, 'input');
  await sleep(20);
  console.log('滑块 150% 实时 zoom:', w.eval('document.documentElement.style.zoom'),
    '| 数值显示:', txt('#dp-scale-v'));
  ev(slider, 'change');
  await sleep(30);
  console.log('落库 scale:', w.eval('db.settings.display.scale'));
  if(w.eval('db.settings.display.scale') !== 150) errors.push('缩放未保存');

  fontSel.value = '微软雅黑'; ev(fontSel, 'change');
  await sleep(40);
  console.log('字体已保存:', w.eval('db.settings.display.font'),
    '| body 字体:', w.eval('document.body.style.fontFamily').slice(0, 30));
  if(w.eval('db.settings.display.font') !== '微软雅黑') errors.push('字体未保存');

  click('[data-act="dpReset"]');
  await sleep(50);
  console.log('恢复默认:', JSON.stringify(w.eval('JSON.stringify(db.settings.display)')),
    '| zoom 清空:', !w.eval('document.documentElement.style.zoom'));
  console.log('字体检测按钮:', !!q('[data-act="dpFontDetect"]'));

  // 夹紧越界值
  w.eval("db.settings.display.scale=999;normalizeDB();saveDB();");
  console.log('越界 999 夹紧为:', w.eval('db.settings.display.scale'));
  if(w.eval('db.settings.display.scale') !== 200) errors.push('缩放未夹紧');

  console.log('\nERRORS', errors.length, errors.slice(0,6).join(' | '));
  try{ w.close(); }catch(e){}
}, 260);
