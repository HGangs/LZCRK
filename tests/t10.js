/* t10：备份 JSON 导出/导入（迁移） + 导入后恢复 */
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
const bks=()=>JSON.parse(w.localStorage.getItem('wms_backups_v1')||'[]');
const txt=s=>{const el=q(s); return el ? el.textContent.replace(/\s+/g,' ').trim() : ''};

setTimeout(async ()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');

  const snap=w.eval('JSON.stringify(db)');
  const snapObj=JSON.parse(snap);
  console.log('snapshot:', '项目', snapObj.projects.length, '物料', snapObj.materials.length, '流水', snapObj.records.length);

  // 改动数据：删掉一个项目
  w.eval("db.projects.pop(); saveDB(); render();");
  console.log('after change → 项目', db().projects.length);

  click('.nav-item[data-page="backups"]');
  console.log('\n--- 导入备份 ---');
  console.log('pick btn:', !!q('[data-act="pickBkFile"]'), '| hidden input:', !!q('#bkFileInput'));
  const n0=bks().length;

  // 带 BOM 的 JSON（模拟从「导出当前数据」拿到的文件）
  await w.importBackupFile(new w.File(['\ufeff'+snap], 'migrate.json', {type:'application/json'}));
  console.log('backups:', n0, '→', bks().length, '| note:', (bks()[0]||{}).note,
    '| toast:', txt('#toast'));
  console.log('imported counts:', JSON.stringify((bks()[0]||{}).counts));

  // 非法文件
  await w.importBackupFile(new w.File(['{"foo":1}'], 'bad.json'));
  console.log('invalid → backups unchanged:', bks().length, '| toast:', txt('#toast').slice(0,30));

  console.log('\n--- 从导入的备份恢复 ---');
  click('[data-act="restoreBackup"]');
  console.log('confirm modal:', !!q('.modal'), '| checkbox:', !!q('#cf-chk'));
  if(q('#cf-chk')) q('#cf-chk').checked=true;
  click('[data-act="confirmOk"]');
  const after=db();
  console.log('restored → 项目', after.projects.length, '物料', after.materials.length, '流水', after.records.length,
    '| matches snapshot:', after.projects.length===snapObj.projects.length && after.records.length===snapObj.records.length);
  console.log('pre-restore snapshot added:', bks().some(b=>b.note.indexOf('恢复前快照')>=0));

  console.log('\nERRORS', errors.length, errors.slice(0,5).join(' | '));
  try{ w.close(); }catch(e){}
}, 900);
