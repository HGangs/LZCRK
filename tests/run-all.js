/* 一键跑完全部回归测试：node tests/run-all.js
   每个脚本独立进程运行（各自清空 localStorage），汇总 ERRORS 数量。
   退出码：0 = 全部通过；1 = 有脚本报错或超时。 */
const path = require('path');
const { spawnSync } = require('child_process');

const FILES = ['t1.js', 't2.js', 't3.js', 't4.js', 't5.js', 't6.js', 't7.js', 't8.js', 't9.js', 't10.js', 't11.js', 't12.js', 't13.js', 't14.js', 't15.js', 't16.js', 't17.js', 't18.js', 't19.js', 't20.js', 't21.js', 't22.js', 't23.js', 't24.js', 't25.js', 't26.js', 't27.js', 't28.js'];

/* 每个脚本覆盖的范围，便于失败时快速定位 */
const SCOPE = {
  't1.js': '登录 / 游客 / 项目删除 / 负责人筛选 / 账号角色 / 备份 / 设置 / 日志',
  't2.js': '只读账号梯度、权限实时生效、直调接口被拦',
  't3.js': '自动备份触发、重置保留账号、空权限回落、权限矩阵批量',
  't4.js': '既有业务回归（入库/出库/台账/物料/排序/汇总/记录/指标）',
  't5.js': '超管账号、自助改密、备份参数与路径、背景图、账号迁移',
  't6.js': '行政区筛选残留、模块右键重命名',
  't7.js': '出库项目模糊搜索、项目页搜索、双栏滚动、单项目/汇总导出、冻结列',
  't8.js': '项目清单模块、项目视图互通、铺满布局、只读权限',
  't9.js': '顶栏手动备份、物料单位 PCS、分类自维护、物料批量导入、清空业务数据',
  't10.js': '备份 JSON 导入（迁移）、非法文件拦截、导入后恢复',
  't11.js': '免登录游客浏览、登录浮层开关、受限页回落、登录后权限',
  't12.js': '备份真实落盘、未连接自动下载、自动备份写盘、恢复',
  't13.js': '时间校准、备份/日志/单据时间跟随、断网回退',
  't14.js': '出库物资调拨：按单据调拨、多接收项目、库存不变、超额拦截、只读',
  't15.js': '入库/出库台账卡片化、整单编辑、库存校验、删除整单、列宽拖拽',
  't16.js': '权限矩阵核对、调拨独立台账、整单全字段编辑、调拨页行政区筛选',
  't17.js': '项目左栏与汇总列排序、权限模块与导航一一对应、已领用指标与出入库日历',
  't18.js': '只读启动右上角可登录、调拨单量排序、项目跳调拨、仪表盘栅格拖动缩放',
  't19.js': '台账导出、施工单位管理（多联系人）、项目施工单位与筛选、设备使用看板',
  't20.js': '删除出库单连带清理关联调拨、失效调拨清理入口、库存与项目持有回滚',
  't21.js': '项目清单右侧详情抽屉（点击行编辑/Esc/遮罩）、项目视图左栏行政区两级目录',
  't22.js': '出库单位联系人联动、记录页删除流水、角色权限 19 模块齐全、字体缩放与字体设置',
  't23.js': '云端乐观锁（rev 条件更新 / 冲突检测 / 冲突阻塞推送 / 强制覆盖）与历史快照 UI',
  't24.js': '项目视图平铺左栏与拖拽调宽、已出库领用划拨、看板双子页、顶栏缩放',
  't25.js': '游客权限跟随「项目只读」角色（含看板）、物料明细只显示名称、批量选择物料',
  't26.js': '移动端适配（抽屉菜单、单列布局、触摸尺寸、顶栏精简）',
  't27.js': '项目领用记录（列表 / 全字段编辑 / 撤销归还与库存联动）',
  't28.js': '每日双端备份（云端 + 本机分别校验、只补缺端、状态展示）'
};

let failed = 0;
const rows = [];

for (const f of FILES) {
  const file = path.join(__dirname, f);
  const started = Date.now();
  const r = spawnSync(process.execPath, [file], {
    encoding: 'utf8',
    timeout: 120000,
    cwd: __dirname
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split('\n').filter(l => /ERRORS/.test(l)).pop() || '';
  const m = line.match(/ERRORS\D*(\d+)/);
  const count = m ? Number(m[1]) : NaN;
  const ok = r.status === 0 && count === 0;
  if (!ok) failed++;

  rows.push({
    file: f,
    ok,
    count: Number.isNaN(count) ? '无结果' : count,
    ms: Date.now() - started,
    timedOut: r.error && r.error.code === 'ETIMEDOUT',
    tail: out.trim().split('\n').slice(-1)[0] || ''
  });

  console.log((ok ? 'PASS  ' : 'FAIL  ') + f.padEnd(7) + ' ' +
    (Number.isNaN(count) ? 'ERRORS ?' : 'ERRORS ' + count) +
    '  (' + (Date.now() - started) + 'ms)  ' + SCOPE[f]);
  if (!ok) {
    console.log('      ' + (out.trim().split('\n').join('\n      ')).slice(0, 2000));
  }
}

console.log('\n' + '-'.repeat(72));
const passed = FILES.length - failed;
console.log('结果：' + passed + '/' + FILES.length + ' 通过' + (failed ? '，' + failed + ' 个失败' : ''));
process.exit(failed ? 1 : 0);
