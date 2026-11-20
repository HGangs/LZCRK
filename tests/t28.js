/* t28：每日双端备份（云端 wms_backup + 本机文件）与成功率判定 */
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
  /* mock 云端 wms_backup 表 + 可切换的本机写盘结果 */
  w.eval(`
window.__bkMock = function(opts){
  var m = window.__bm = { rows: (opts.rows || []).slice(), writes: 0, fail: opts.fail || '' };
  function chain(){
    var o = {
      limit: function(){ return Promise.resolve({ data: m.rows.slice(), error: null }); },
      single: function(){ return Promise.resolve({ data: m.rows[0] || null, error: null }); },
      eq: function(){ return o; }
    };
    return o;
  }
  cloud.on = true; cloud.pulled = true;
  cloud.rdb = {
    from: function(t){
      return {
        select: function(){ return chain(); },
        update: function(base){
          return { eq: function(){ m.writes++; if(m.fail) return Promise.resolve({ error: { message: m.fail } });
            if(m.rows[0]) Object.assign(m.rows[0], base); return Promise.resolve({ error: null }); } };
        },
        insert: function(arr){
          m.writes++;
          if(m.fail) return Promise.resolve({ error: { message: m.fail } });
          m.rows = arr.map(function(x){ return Object.assign({ id: 1 }, x); });
          return Promise.resolve({ error: null });
        }
      };
    }
  };
};
window.__localFail = true;
writeBackupFile = async function(item){
  if(window.__localFail) return { ok:false, reason:'no-dir' };
  return { ok:true, path: 'D:/WMS/backup/auto/' + backupFileName(item) };
};
`);

  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  await sleep(60);

  const day = w.eval('bkDayKey()');
  console.log('--- 1. 云端为空时的检测 ---');
  w.eval('__bkMock({rows:[]})');
  let st = JSON.parse(await w.eval('dailyBackupStatus().then(r=>JSON.stringify(r))'));
  console.log('  cloud:', JSON.stringify(st.cloud), '| local:', JSON.stringify(st.local));
  if(st.cloud.ok) errors.push('空表不应判定云端已备份');
  if(st.cloud.reason !== 'missing') errors.push('云端缺省原因应为 missing');

  console.log('\n--- 2. 缺两端 → 补执行，各自回报真实结果 ---');
  w.eval('window.__localFail = true');
  let r = JSON.parse(await w.eval('ensureDailyBackup({silent:true}).then(x=>JSON.stringify(x))'));
  console.log('  skipped:', r.skipped, '| cloud.ok:', r.cloud && r.cloud.ok, '| local.ok:', r.local && r.local.ok);
  console.log('  云端写入次数:', w.eval('__bm.writes'), '| 本机失败原因:', (r.local && r.local.err) || '');
  if(r.skipped) errors.push('缺备份时不应跳过');
  if(!r.cloud || !r.cloud.ok) errors.push('云端备份应成功');
  if(r.local && r.local.ok) errors.push('无目录时本机不应报成功');
  if(w.eval('__bm.writes') !== 1) errors.push('云端应写入 1 次');

  console.log('\n--- 3. 云端已有 + 本机缺失 → 只补本机 ---');
  w.eval('__bkMock({rows:[{id:1, day:"' + day + '", kind:"auto", size_bytes:1024, created_at:"2026-11-20T02:00:00Z"}]})');
  w.eval('window.__localFail = false');
  const writesBefore = w.eval('__bm.writes');
  r = JSON.parse(await w.eval('ensureDailyBackup({silent:true}).then(x=>JSON.stringify(x))'));
  console.log('  云端再次写入:', w.eval('__bm.writes') - writesBefore, '（应 0）| 本机成功:', r.local && r.local.ok);
  if(w.eval('__bm.writes') !== writesBefore) errors.push('云端已存在时不应重复写入');
  if(!r.local || !r.local.ok) errors.push('本机应补写成功');

  console.log('\n--- 4. 两端齐全 → 跳过 ---');
  w.eval('__bkMock({rows:[{id:1, day:"' + day + '", kind:"auto", size_bytes:1024, created_at:"2026-11-20T02:00:00Z"}]})');
  r = JSON.parse(await w.eval('ensureDailyBackup({silent:true}).then(x=>JSON.stringify(x))'));
  console.log('  skipped:', r.skipped, '| both:', r.both, '| cloud.ok:', r.status && r.status.cloud.ok, '| local.ok:', r.status && r.status.local.ok);
  if(!r.skipped) errors.push('两端齐全时应跳过');

  console.log('\n--- 5. 云端写入失败不谎报成功 ---');
  w.eval('__bkMock({rows:[], fail:"permission denied"})');
  w.eval('window.__localFail = true');
  r = JSON.parse(await w.eval('ensureDailyBackup({silent:true}).then(x=>JSON.stringify(x))'));
  console.log('  cloud.ok:', r.cloud && r.cloud.ok, '| 错误:', (r.cloud && r.cloud.err) || '', '| local.ok:', r.local && r.local.ok);
  if(r.cloud && r.cloud.ok) errors.push('写入失败不应报成功');

  console.log('\n--- 6. 备份页状态区渲染 ---');
  w.eval('__bkMock({rows:[{id:1, day:"' + day + '", kind:"auto", size_bytes:2048, created_at:"2026-11-20T02:00:00Z"}]})');
  w.eval('window.__localFail = true');
  w.eval("state.page='backups'; render();");
  await sleep(80);
  await w.eval('renderDailyBackupBox()');
  await sleep(60);
  const boxTxt = (q('#bkDailyBox') || {textContent:''}).textContent.replace(/\s+/g,' ');
  const cloudChip = (q('#bkCloudState') || {textContent:''}).textContent;
  const localChip = (q('#bkLocalState') || {textContent:''}).textContent;
  console.log('  今日状态区:', boxTxt.slice(0, 80));
  console.log('  云端 chip:', cloudChip, '| 本机 chip:', localChip);
  if(!/云端备份/.test(boxTxt) || !/本机备份/.test(boxTxt)) errors.push('状态区未渲染两端信息');
  if(!cloudChip || cloudChip === '检测中…') errors.push('云端状态 chip 未更新');
  if(!localChip || localChip === '检测中…') errors.push('本机状态 chip 未更新');

  console.log('\nERRORS', errors.length, errors.slice(0,6).join(' | '));
  try{ w.close(); }catch(e){}
}, 260);
