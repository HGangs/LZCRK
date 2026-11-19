/* t12：备份真实落盘（目录句柄）/ 无目录时自动下载 / 恢复验证 */
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
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

setTimeout(async ()=>{
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  click('.nav-item[data-page="backups"]');

  console.log('--- 1. 备份设置：目录面板 ---');
  console.log('dir panel:', !!q('[data-act="pickBkDir"]'), '| status:', txt('.chip'),
    '| auto-download toggle:', !!q('#bk-dl'), '| checked:', !!(q('#bk-dl')||{}).checked);

  console.log('\n--- 2. 未连接目录：改走下载 ---');
  w.eval("window.__dl=null; download=function(n,t){ window.__dl={name:n,text:t}; return true; };");
  const n0=bks().length;
  click('[data-act="newBackup"]');
  q('#bk-note').value='落盘测试-下载';
  click('[data-act="doBackup"]');
  await sleep(120);
  const dl=w.__dl||{name:'',text:''};
  console.log('backup +', bks().length-n0, '| download name:', dl.name,
    '| json ok:', (()=>{ try{ const o=JSON.parse(dl.text); return Array.isArray(o.projects); }catch(e){ return false; } })());

  console.log('\n--- 3. 连接目录后：真实写入文件 ---');
  w.eval(`
    window.__writes=[];
    bkDirHandle = {
      name: 'WMS备份',
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getDirectoryHandle: async (dir) => ({
        getFileHandle: async (file) => ({
          createWritable: async () => ({
            write: async (t) => { window.__writes.push({path: dir + '/' + file, size: t.length, data: t}); },
            close: async () => {}
          })
        })
      })
    };
  `);
  const n1=bks().length;
  click('[data-act="newBackup"]');
  q('#bk-note').value='落盘测试-目录';
  click('[data-act="doBackup"]');
  await sleep(200);
  const writes=w.__writes||[];
  console.log('backup +', bks().length-n1, '| writes:', writes.length, '| path:', writes[0] ? writes[0].path : '-');
  const wj = writes[0] ? (()=>{ try{ const o=JSON.parse(writes[0].data); return {ok:true, projects:o.projects.length, records:o.records.length, users:o.users.length}; }catch(e){ return {ok:false}; } })() : {};
  console.log('file json:', JSON.stringify(wj), '| starts with manual/:', writes[0] && writes[0].path.indexOf('manual/wms_manual_')===0);
  console.log('toast:', txt('#toast'));

  console.log('\n--- 4. 自动备份静默落盘 ---');
  const beforeAuto=(w.__writes||[]).length;
  w.eval("createBackup('auto','测试自动备份')");
  await sleep(150);
  const aw=(w.__writes||[]).slice(beforeAuto);
  console.log('auto writes:', aw.length, '| path:', aw[0] ? aw[0].path : '-');

  console.log('\n--- 5. 从备份恢复 ---');
  const bw=bks().find(b=>b.note==='落盘测试-目录') || bks()[0];
  w.eval("db.projects.pop(); saveDB(); render();");
  click('.nav-item[data-page="backups"]');
  const target=q('[data-act="restoreBackup"][data-id="'+bw.id+'"]');
  console.log('restore btn:', !!target);
  target.click();
  q('#cf-chk') && (q('#cf-chk').checked=true);
  click('[data-act="confirmOk"]');
  console.log('restored projects:', db().projects.length, '| snapshot projects:', (bw.payload||{}).projects.length,
    '| match:', db().projects.length === (bw.payload||{}).projects.length);
  console.log('pre-restore snapshot:', bks().some(b=>b.note.indexOf('恢复前快照')>=0));
  console.log('cards show file name:', txt('.bk-grid').indexOf('wms_manual_')>=0);

  console.log('\nERRORS', errors.length, errors.slice(0,5).join(' | '));
  try{ w.close(); }catch(e){}
}, 900);
