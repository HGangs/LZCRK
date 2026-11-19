/* t9：顶栏手动备份 / 物料单位默认 PCS / 分类自维护 / 物料批量导入 / 清空业务数据 */
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
const ev=(el,t)=>{el.dispatchEvent(new w.Event(t,{bubbles:true,cancelable:true}));};
const txt=s=>{const el=q(s); return el ? el.textContent.replace(/\s+/g,' ').trim() : ''};

setTimeout(()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  console.log('login:', !q('.login-wrap'));

  /* ---------- 1. 顶栏手动备份 ---------- */
  console.log('\n--- 顶栏手动备份 ---');
  const before=bks().length;
  console.log('top btn:', !!q('#topBackup [data-act="bkNowTop"]'), '| backups before:', before);
  click('[data-act="bkNowTop"]');
  console.log('after click → backups:', bks().length, '| +', bks().length-before,
    '| note:', (bks()[0]||{}).note||'-', '| toast:', txt('#toast'));

  /* ---------- 2. 单位默认 PCS / 分类无内置项 ---------- */
  console.log('\n--- 物料默认值与分类 ---');
  click('.nav-item[data-page="materials"]');
  console.log('unit select value:', q('#nm-unit') ? q('#nm-unit').value : '(no form)', '| first option:', q('#nm-unit') ? q('#nm-unit').options[0].textContent : '-');
  console.log('cat datalist options:', qa('#catList option').map(o=>o.value).join(' / ') || '(空)');

  // 新增一个带新分类的物料
  q('#nm-code').value='T-001'; q('#nm-name').value='测试物料A';
  q('#nm-cat').value='自定义类';
  const n0=db().materials.length;
  click('[data-act="saveMaterial"]');
  const m1=db().materials[db().materials.length-1];
  console.log('saved:', db().materials.length-n0, '| unit:', m1 && m1.unit, '| category:', m1 && m1.category);
  console.log('cat datalist now:', qa('#catList option').map(o=>o.value).join(' / '));

  // 留空分类 → 保存为空
  q('#nm-code').value='T-002'; q('#nm-name').value='测试物料B'; q('#nm-cat').value='';
  click('[data-act="saveMaterial"]');
  const m2=db().materials[db().materials.length-1];
  console.log('blank category saved as:', JSON.stringify(m2.category), '| unit:', m2.unit);

  /* ---------- 3. 物料批量导入 ---------- */
  console.log('\n--- 物料批量导入 ---');
  click('[data-act="matImport"]');
  console.log('modal:', !!q('.modal'), '| template btn:', !!q('[data-act="downloadMatTemplate"]'),
    '| pick btn:', !!q('[data-act="pickMatFile"]'));
  w.eval("window.__dl=null; download=function(n,t){ window.__dl={name:n,text:t}; return true; };");
  click('[data-act="downloadMatTemplate"]');
  const tpl=w.__dl||{name:'',text:''};
  console.log('template:', tpl.name, '| head:', (tpl.text.split('\n')[0]||'').slice(0,60));
  w.eval("importMaterials([['物料编码','物料名称','规格型号','单位','分类','品牌/厂商','初始库存','预警阈值','备注'],['T-100','批量物料1','10x10','','导入类','品牌X','5','2',''],['T-101','批量物料2','','箱','','','0','0',''],['T-100','重复编码','','','','','0','0',''],['','自动编码物料','','PCS','','','1','0','']])");
  const mats=db().materials.slice(-3);
  console.log('imported last3:', mats.map(m=>m.code+'/'+m.name+'/'+m.unit+'/'+(m.category||'空')).join(' | '));
  console.log('row count +:', db().materials.length-n0, '| default unit PCS:', mats.some(m=>m.code!=='T-100'&&m.code!=='T-101'&&m.unit==='PCS'));

  /* ---------- 4. 清空业务数据 ---------- */
  console.log('\n--- 清空业务数据 ---');
  click('.nav-item[data-page="backups"]');
  console.log('wipe btn:', !!q('[data-act="wipeData"]'));
  const users0=db().users.length, roles0=db().roles.length, bk0=bks().length;
  click('[data-act="wipeData"]');
  console.log('confirm modal:', !!q('.modal'), '| checkbox:', !!q('#cf-chk'));
  click('[data-act="confirmOk"]');   // 未勾选，应被拦
  console.log('without check → records:', db().records.length, '(unchanged)');
  q('#cf-chk').checked=true;
  click('[data-act="confirmOk"]');
  const after=db();
  console.log('after wipe → 仓库', after.warehouses.length, '项目', after.projects.length,
    '物料', after.materials.length, '流水', after.records.length, '日志', after.logs.length);
  console.log('kept → users', after.users.length, '(=', users0, ') roles', after.roles.length, '(=', roles0, ')',
    '| backups', bks().length, '(+', bks().length-bk0, ')');
  console.log('pre-wipe snapshot note:', (bks().find(b=>b.note.indexOf('清空')>=0)||{}).note||'-');
  click('.nav-item[data-page="inbound"]');
  console.log('inbound after wipe → empty tip:', txt('#view').indexOf('还没有仓库')>=0);

  // 只读账号不应看到顶栏备份与清空入口
  click('[data-act="myAccount"]'); click('.modal [data-act="logout"]');
  w.eval('showLogin()');
  q('#lg-account').value='zhangwei'; q('#lg-pwd').value='123456'; click('[data-act="doLogin"]');
  console.log('viewer top backup:', !!q('#topBackup [data-act="bkNowTop"]'), '| viewer wipe:', !!q('[data-act="wipeData"]'));

  console.log('\nERRORS', errors.length, errors.slice(0,5).join(' | '));
  try{ w.close(); }catch(e){}
}, 900);
