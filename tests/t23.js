/* t23：云端乐观锁（rev 条件更新 / 冲突检测 / 冲突阻塞推送 / 强制覆盖）与历史快照 UI */
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
  w.eval('showLogin()');
  q('#lg-account').value='admin'; q('#lg-pwd').value=('sl'+'123456');
  click('[data-act="doLogin"]');
  await sleep(60);

  /* mock 云端 rdb：rev 命中才推进，用来验证条件更新 */
  w.eval(`
window.__mockCloud = function(opts){
  var m = window.__m = { remoteRev: opts.rev, updateCalls: 0, insertCalls: 0, upsertCalls: 0, hist: opts.hist || [] };
  cloud.on = true; cloud.pulled = true; cloud.pushing = false;
  cloud.rev = opts.localRev; cloud.conflict = false; cloud.err = '';
  cloud.rdb = {
    from: function(){
      return {
        update: function(row){
          return { eq: function(){ return { eq: function(k, v){
            m.updateCalls++;
            if(Number(v) === m.remoteRev) m.remoteRev = Number(row.rev);
            return Promise.resolve({ error: null });
          } }; } };
        },
        insert: function(rows){
          m.insertCalls++;
          if(m.remoteRev > 0) return Promise.resolve({ error: { message: 'duplicate key value violates unique constraint' } });
          m.remoteRev = Number(rows[0].rev);
          return Promise.resolve({ error: null });
        },
        upsert: function(row){
          m.upsertCalls++;
          m.remoteRev = Number(row.rev);
          return Promise.resolve({ error: null });
        },
        select: function(){
          var chain = {
            single: function(){
              return Promise.resolve({ data: { rev: m.remoteRev, updated_at: '2026-11-19T05:00:00Z', updated_by: 'tester' }, error: null });
            },
            order: function(){ return { limit: function(){
              return Promise.resolve({ data: m.hist, error: null });
            } }; }
          };
          return { eq: function(){ return chain; } };
        }
      };
    }
  };
};
`);

  /* ---------- 1. rev 命中：正常写入 ---------- */
  console.log('--- 1. 乐观锁命中：本地 rev 5 / 云端 rev 5 ---');
  w.eval('__mockCloud({rev:5, localRev:5})');
  await w.eval('cloudPush()');
  await sleep(30);
  const r1 = w.eval('({rev:cloud.rev, conflict:cloud.conflict, calls:__m.updateCalls})');
  console.log('  → cloud.rev:', r1.rev, '| conflict:', r1.conflict, '| 条件更新次数:', r1.calls);
  if(r1.rev !== 6) errors.push('命中后 rev 应为 6');
  if(r1.conflict) errors.push('命中不应产生冲突');
  if(r1.calls !== 1) errors.push('应走条件更新一次');

  /* ---------- 2. rev 不匹配：判定冲突且不覆盖 ---------- */
  console.log('\n--- 2. 冲突：本地 rev 5 / 云端 rev 9 ---');
  w.eval('__mockCloud({rev:9, localRev:5})');
  await w.eval('cloudPush()');
  await sleep(30);
  const r2 = w.eval('({rev:cloud.rev, conflict:cloud.conflict, cre:cloud.conflictRev, remote:__m.remoteRev})');
  console.log('  → conflict:', r2.conflict, '| conflictRev:', r2.cre, '| 云端实际 rev:', r2.remote);
  if(!r2.conflict) errors.push('rev 不匹配应判定冲突');
  if(r2.remote !== 9) errors.push('冲突时不应写入云端');
  if(r2.cre !== 9) errors.push('冲突信息应记录云端 rev');

  /* ---------- 3. 冲突期间禁止自动推送 ---------- */
  console.log('\n--- 3. 冲突未处理时，saveDB 不再触发推送 ---');
  const before = w.eval('__m.updateCalls');
  w.eval('cloudSchedulePush()');
  await sleep(100);
  const r3 = w.eval('({timer: cloud.timer, calls: __m.updateCalls})');
  console.log('  → timer:', r3.timer, '| 新增写入:', r3.calls - before);
  if(r3.calls !== before) errors.push('冲突期间不应写入');

  /* ---------- 4. 强制覆盖 ---------- */
  console.log('\n--- 4. 以本地为准覆盖云端 ---');
  await w.eval('cloudForcePush()');
  await sleep(40);
  const r4 = w.eval('({rev:cloud.rev, conflict:cloud.conflict, remote:__m.remoteRev, ups:__m.upsertCalls})');
  console.log('  → upsert 次数:', r4.ups, '| 云端 rev:', r4.remote, '| 本地 rev:', r4.rev, '| conflict:', r4.conflict);
  if(r4.ups !== 1) errors.push('强制覆盖应走 upsert');
  if(r4.remote !== 10) errors.push('覆盖后云端 rev 应为 10');
  if(r4.conflict) errors.push('覆盖后应清除冲突标记');

  /* ---------- 5. 云端为空：首次插入 ---------- */
  console.log('\n--- 5. 云端为空时首次插入 ---');
  w.eval('__mockCloud({rev:0, localRev:0})');
  await w.eval('cloudPush()');
  await sleep(30);
  const r5 = w.eval('({ins:__m.insertCalls, rev:cloud.rev, remote:__m.remoteRev})');
  console.log('  → insert 次数:', r5.ins, '| 云端 rev:', r5.remote, '| 本地 rev:', r5.rev);
  if(r5.ins !== 1) errors.push('空云端应走 insert');
  if(r5.remote !== 1) errors.push('首次插入 rev 应为 1');

  /* ---------- 6. 快照列表渲染 ---------- */
  console.log('\n--- 6. 历史快照弹窗 ---');
  w.eval(`__mockCloud({rev:10, localRev:10, hist:[
    {id:33, rev:9, updated_at:'2026-11-19T04:00:00Z', updated_by:'张三', archived_at:'2026-11-19T04:00:01Z'},
    {id:32, rev:8, updated_at:'2026-11-19T03:00:00Z', updated_by:'李四', archived_at:'2026-11-19T03:00:01Z'}
  ]})`);
  w.eval('modalCloudHistory()');
  await sleep(150);
  const rows = qa('#cloudHistBody tbody tr').length;
  const bodyText = (q('#cloudHistBody') || {textContent:''}).textContent.replace(/\s+/g,' ');
  console.log('  快照行数:', rows, '| 含 rev 9:', /rev|9/.test(bodyText), '| 恢复按钮:', qa('[data-act="cloudRestore"]').length);
  if(rows !== 2) errors.push('快照列表应有 2 行');
  if(qa('[data-act="cloudRestore"]').length !== 2) errors.push('每行应有恢复按钮');

  /* ---------- 7. 徽标冲突态可点击 ---------- */
  console.log('\n--- 7. 徽标冲突提示 ---');
  w.eval("cloud.conflict = true; cloud.conflictRev = 12; updateCloudBadge('conflict')");
  await sleep(30);
  const badge = q('#cloudBadge');
  const bTxt = badge ? badge.textContent.replace(/\s+/g,' ').trim() : '';
  console.log('  徽标文字:', bTxt, '| 可点击:', !!(badge && badge.onclick));
  if(!/冲突/.test(bTxt)) errors.push('徽标应显示冲突');
  if(!badge || !badge.onclick) errors.push('冲突徽标应可点击');

  console.log('\nERRORS', errors.length, errors.slice(0,6).join(' | '));
  try{ w.close(); }catch(e){}
}, 260);
