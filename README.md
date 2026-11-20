# 出入库存工作台 · 项目说明

单文件前端原型 + 设计方案 + 回归测试。无构建、无依赖、无联网，数据存浏览器 localStorage。

---

## 一、文件清单

| 路径 | 说明 |
|---|---|
| `index.html` | **可运行原型**。单文件（内联样式 + 单个脚本），双击即用，当前 8867 行 / 约 497KB |
| `出入库存工作台-设计方案.md` | **设计方案 v4.16**。功能范围、数据模型、页面规格、权限矩阵、备份策略、跳转矩阵、使用说明 |
| `tests/_env.js` | 测试公共环境：定位 `index.html` 与 jsdom，脚本内不再写死绝对路径 |
| `tests/t1.js` | 登录 / 游客 / 项目删除 / 负责人筛选 / 账号角色 / 备份 / 设置 / 日志 |
| `tests/t2.js` | 只读账号梯度、权限实时生效、绕过 UI 直调接口被拦 |
| `tests/t3.js` | 自动备份触发、重置保留账号、空权限回落、权限矩阵批量操作 |
| `tests/t4.js` | 既有业务回归（入库两行同单、出库超量、返回核销、台账编辑、物料、排序、汇总、记录、指标） |
| `tests/t5.js` | 超管账号、自助改密、备份参数与路径、登录背景图、旧账号迁移 |
| `tests/t6.js` | 行政区筛选残留修复、模块右键重命名 |
| `tests/t7.js` | 出库项目模糊搜索、项目页搜索、双栏滚动、单项目 / 汇总导出、冻结列 |
| `tests/t8.js` | 项目清单模块、项目视图互通、铺满布局、只读权限 |
| `tests/t9.js` | 顶栏手动备份、单位默认 PCS、分类自维护、物料批量导入、清空业务数据 |
| `tests/t10.js` | 备份 JSON 导入（带 BOM）、非法文件拦截、导入后恢复 |
| `tests/t11.js` | 免登录游客浏览、登录浮层开关、受限页回落、登录后权限 |
| `tests/t12.js` | 备份真实落盘（目录句柄）、未连接时自动下载、自动备份静默写盘、恢复 |
| `tests/t13.js` | 时间校准（时间源 +1h）、手动校准、日期合法性、备份/日志/单据日期跟随、断网回退 |
| `tests/t14.js` | 出库物资调拨：按单据调拨、多接收项目、库存总量不变、超额/同项目拦截、只读 |
| `tests/t15.js` | 入库/出库台账卡片化、整单编辑与校验、整单删除、列宽拖拽与持久化 |
| `tests/t16.js` | 权限矩阵核对、调拨独立台账、整单全字段编辑、调拨页行政区筛选 |
| `tests/t17.js` | 项目左栏/汇总列排序、权限模块与导航一一对应、已领用指标与出入库日历 |
| `tests/t18.js` | 只读启动无登录入口、调拨按单量排序、项目→调拨、仪表盘栅格拖动缩放 |
| `tests/t19.js` | 台账导出、施工单位管理（多联系人）、项目施工单位与筛选、设备使用看板 |
| `tests/t20.js` | 删除出库单连带清理关联调拨、失效调拨清理入口、库存与项目持有回滚 |
| `tests/t21.js` | 项目清单右侧详情抽屉、项目视图左栏行政区两级目录 |
| `tests/t22.js` | 出库单位联系人联动、记录页删除流水、角色权限 19 模块齐全、字体缩放与字体设置 |
| `tests/t23.js` | 云端乐观锁（rev 条件更新 / 冲突检测 / 冲突阻塞推送 / 强制覆盖）与历史快照 UI |
| `tests/t24.js` | 项目视图平铺左栏与拖拽调宽、已出库领用划拨、看板双子页、顶栏缩放 |
| `tests/run-all.js` | 一键跑全部，输出 PASS/FAIL 与 ERRORS 计数，退出码 0/1 |
| `记录/` | 项目记录：`AGENT.md`（需求）、`state.md`（进度）、`问题记录.md`、`时间线.md` |
| `desktop/` | **桌面客户端源码**（Electron）：`main.js` 主进程、`preload.js` 桥接、`build.js` 打包脚本、`make-icon.py` 图标生成、`assets/` 图标 |
| `dist/出入库存工作台_v4.19.0_桌面客户端.zip` | **桌面客户端成品**：解压后双击 `出入库存工作台_v4.19.0.exe`（exe 名带版本号），无需安装 |
| `tools/preview.py` | **截图工具**：注入指定状态后用 Edge headless 截图/取值，视觉校对用 |
| `.workbuddy/memory/2026-10-25.md` | 开发过程记录：需求演进、踩坑、测试结论（续作时先读这个） |

---

## 二、快速开始

- **打开原型**：直接双击 `index.html`；或 `python -m http.server` 后访问，避免个别浏览器对 `file://` 的存储限制。
- **登录账号**：

| 账号 | 密码 | 角色 | 说明 |
|---|---|---|---|
| `admin` | `sl` + `123456`（连续输入） | 超级管理员 | 内置超管，63 项权限，可进系统管理四个模块 |
| `zhouming` | `123456` | 仓库管理员 | 34 项，看不到系统管理 |
| `zhangwei` | `123456` | 项目只读 | 9 项，只读 |
| `lisi` | `123456` | 项目只读 | **已停用**，用于验证停用拦截 |

- **打开即只读**：不需要登录，直接以「项目只读」权限进入（总览 / 库存数据 / 基础档案 / 项目含调拨 / 查询，共 9 个页面全只读）。
- **右上角登录**：点「项目只读 · 点击登录」打开登录浮层，登录后按角色权限进入；内网/桌面端也可用 `#/login` 或 `Ctrl+Alt+L`。
- **内置超管**：`admin` / `sl123456`（旧数据里的 `useradmin` 自动改名并重置为该密码）。
- **重置演示数据**：顶栏「重置」（需 `settings.edit`），保留账号、角色、日志、模块名称、工作台名称、备份。

---

## 三、运行测试

前置：Node 18+，jsdom。本机已有托管运行时，可直接用绝对路径调用。

```bash
# 项目根目录
"C:/Users/HGG/.workbuddy/binaries/node/versions/22.22.2-6/node.exe" tests/run-all.js

# 单个脚本
"C:/Users/HGG/.workbuddy/binaries/node/versions/22.22.2-6/node.exe" tests/t6.js
```

若换机器没有托管运行时：

```bash
cd tests && npm i jsdom      # _env.js 会优先用 tests/node_modules
node run-all.js
```

说明：测试在 jsdom 内存中运行，会先 `localStorage.clear()`，**不影响真实浏览器里的数据**。每个脚本约 4–28 秒，超时上限 120 秒。

> `tests/` 是**唯一测试源**。`C:/Users/HGG/.workbuddy/binaries/node/workspace/` 下的同名 `t*.js` 是历史副本，已停止维护，不要在那里改。

### 截图 / 取值

```bash
PY="C:/Users/HGG/.workbuddy/binaries/python/versions/3.13.12/python.exe"

# 登录页
"$PY" tools/preview.py login
# 指定页面 + 造数据
"$PY" tools/preview.py roles --page accounts --js "state.acctTab='roles';"
# 只取页面里的 data-probe（不截图）
"$PY" tools/preview.py probe --dump --js "document.body.setAttribute('data-probe','hello')"
# 清理 _preview_*
"$PY" tools/preview.py --clean
```

---

## 四、代码地图（`index.html`）

| 行号 | 区块 | 内容 |
|---|---|---|
| 7–523 | `<style>` | 全局样式；302 起为账号/权限/登录/备份/右键菜单/组合框/冻结列/项目清单等模块样式 |
| 525–570 | `<body>` 骨架 | 侧边导航、顶栏（含 `#topBackup`）、`#view`、`#modalRoot`、`#ctxMenu`、`#loginRoot`、`#toast`、隐藏 file inputs |
| 572–627 | utils | `$` / `$$` / `esc` / `uid` / 时钟（`clockOffset`、`nowMs`、`nowDate`、`nowTs`、`today`）/ `download` / `toast` |
| 628–666 | constants | `KEY`、`IN_TYPES`、`DISTRICTS`、`DEF_METRICS`、`STATUSES`、`UNITS`（PCS 首位）、`CATS`（空） |
| 667–714 | 权限模型 | `PERM_ACTS`、`MODULES`、`PAGE_MOD`、`pageCan()`、`GUEST_PERMS` |
| 715–943 | 数据层 | `SKEY`/`BKEY`、`SUPER_*`、`defaultRoles/Users`、`can()`、`logAct()`、`normalizeDB()`（分类/单位/时间兜底） |
| 944–1484 | 备份引擎 + 时钟校准 | `bkCfg()`、`createBackup()`、`noteChange()`、调度与裁剪；**时间校准**（`timeCfg`/`probeClock`/`syncClock`/`manualClock`，975–1205）；备份落盘（`writeBackupFile`/`deliverBackup`，1206 起） |
| 1485–1582 | 聚合 | `loadAgg()`：仓库库存 / 项目持有 / 物料汇总的唯一计算入口 |
| 1583–1638 | 路由与状态 | `PAGES`（14 页）、`NAV_ORDER`、`state`（`projKw`、`pl`、`plHighlight`） |
| 1639–1749 | 外壳 | `renderNav()`（按 pageCan 过滤）、`renderChrome()`（顶栏备份按钮）、`render()` |
| 1750–2269 | 页面渲染（前半） | dashboard / movement（项目组合框） |
| 2270–2504 | 库存与档案 | stock ledger / materials（含批量导入入口） |
| 2505–2540 | 仓库 | warehouses |
| 2541–2908 | 项目两页 | 项目视图（`viewProjects`/`projectBodyHtml`/`summaryMatrix`）+ 项目清单（9 列） |
| 2909–3093 | 明细与查询 | materialDetail / records |
| 3094–3576 | 系统管理 | accounts / logs / backups（本机目录 + 危险操作）/ settings（时间校准卡片） |
| 3577–3808 | 登录 / 浮层 | `showLogin()`、`doLogin()`、`askConfirm()`、`openModal()`、右键菜单与模块重命名 |
| 3809–4148 | 弹窗与保存 | 各类 `modal*`、`save*`（含 `saveClockManual`）、xlsx/csv 解析 |
| 4149–4358 | 导出 / 物料导入 | 三个项目导出、`modalMatImport()`、`importMaterials()` |
| 4359–5295 | 事件层 | click / change / input / drag / keydown；含 `bkNowTop`、`pickBkDir`、`wipeData`、`importBackupFile`、`manualClock` |
| 5296–5324 | boot | 会话 → 数据 → 目录句柄 → 时钟偏移 → 自动校准 → `render()` |

---

## 五、关键约定与不变量（改代码前必读）

1. **库存一律由流水聚合**，不存冗余字段：
   - 仓库库存 = `initialStock + Σ入库 − Σ出库`
   - 项目持有 = `Σ出库(该项目) − Σ入库(该项目且 inType='return')`
2. **删除项目不删流水**：只把 `projectId` 置空，仓库库存不变，历史记录仍可查。
3. **权限三层收敛**：导航不渲染 → 按钮不渲染 → 事件层 `can(mod,act)` 再拦一次。新增写入口必须在事件函数第一行校验。
4. **只读回落**：未登录（只读）/ 账号停用 / 未分配角色 / 角色权限为空，统一回落到 `GUEST_PERMS`（9 个页面的 view：dashboard / stock / materialDetail / materials / warehouses / projectList / projects / projectTransfer / records），与内置角色「项目只读」逐项一致；登录入口在右上角胶囊。
5. **权限即改即生效**：保存角色后必须调用 `invalidatePerms()` 并重渲染。
6. **审计留痕**：所有写操作在 `saveDB()` 后调用 `logAct(module, action, detail)`；日志不记录密码内容。
7. **模块重命名只改显示名**：写 `settings.moduleNames[id]`，经 `modLabel(id)` 读取；URL、权限键、日志里的历史模块名都不改。
8. **备份是只读快照**：存 `wms_backups_v1`，不进业务表、不参与聚合；恢复前自动生成「恢复前快照」。
9. **行政区/负责人筛选候选实时从项目表提取**，不再用固定行政区列表；筛选值失效时自动回落 `all`。
10. **密码是演示级 djb2 哈希**，非 bcrypt；上生产必须换服务端校验。
11. **`SUPER_PASSWORD` 用字符串拼接书写**（`'sl' + '123456'`），避免外部规则把字面量改写。
12. **项目三条件筛选统一走 `filteredProjects()`**：搜索（编号/名称/行政区/负责人）+ 行政区 + 负责人 AND 组合；列表、详情兜底、汇总列都读同一结果。
13. **汇总口径**：`各项目使用汇总 = Σ(当前显示项目持有量)`，`总数量 = 仓库现有 + 各项目使用汇总`；仓库现有不随项目筛选变化。
14. **搜索只做局部刷新**：`#projBody` / `.combo-list` 由 `refreshProjectBody()` / `openProjectCombo()` 更新，不整页 `render()`，避免丢焦点与列表滚动位置。
15. **汇总表冻结列靠固定宽度**：`colgroup` 宽度（92/140/64/84 … 100/88/76）与 CSS `stk-l*/stk-r*` 的 `left/right` 偏移、`totalW = 644 + 项目数 × 100` 必须同步修改，否则冻结列会错位；右侧冻结只在 `.is-scroll`（横向溢出）时生效。
16. **项目 `export` 动作** 只追加在内置超管角色上（`normalizeDB()` 迁移）；其他角色需管理员在权限矩阵里手动勾选。
17. **页面→权限模块映射**：「项目清单」不是独立权限模块，经 `PAGE_MOD.projectList='projects'` 复用项目管理权限；新增同域页面也走这个映射，导航/兜底跳转/URL 权限校验统一用 `pageCan()`。
18. **项目数据单一来源**：项目清单与项目视图都读写 `db.projects`；任一页编辑/删除后，另一页在下一次渲染自动同步。
19. **视觉令牌**：卡片/弹窗圆角 8px、按钮与输入 6px、登录卡 12px；页面留白 24px；KPI 数字 24px；内容区无最大宽度限制（`.view` 铺满）。改圆角/间距时保持同一类组件一致。
20. **分类不内置**：`CATS` 为空数组，候选只来自已填写的 `materials.category`；保存时留空即空串，禁止回填「其他」。
21. **物料导入只新增**：名称必填、编码留空自动生成、编码重复跳过、单位留空按 `PCS`；不修改已有物料与流水。
22. **清空业务数据 ≠ 重置**：清空会保留账号/角色/设置/备份，并在清空前自动快照；重置则恢复演示数据。
23. **时间统一走校准时钟**：所有时间戳用 `nowMs()/nowDate()`（`nowTs`、`today`、备份 `at/createdAt`、日志、单据默认日期、仪表盘区间）；偏移存 `settings.time.offset`。`syncClock()` **5 个源全并发**、先成功者胜出（单源 3.5s 超时）：腾讯/淘宝走 JSONP（`<script>`，不受 CORS 限制）、苏宁/timeapi/worldtimeapi 走 fetch；秒级源 `+500ms` 取中点并加 `RTT/2`；全部失败时用「手动校准」填当前时间兜底，`settings.time.diag` 记录逐源诊断。
24. **调拨不改仓库**：调拨流水带 `transfer:true`，`loadAgg()` 里 `agg.mt`/`agg.wh` 跳过它，只累加 `pm`（调出记 `in`/`tIn`，接收记 `out`/`tOut`）。可调拨量 = `agg.pdm[项目|单据|物料]` 的 `out − moved`，再与 `stockInProject()` 取小；「累计领用/退回」必须减掉 `tOut/tIn`，否则调拨会污染统计。
25. **台账按单成卡**：`groupDocs()` 以 docNo 聚合，卡片明细来自同一单的全部流水；整单编辑先「移除旧行 + 写入新行」再整体重算库存与项目持有，任一物料为负即拒绝。列宽存 `localStorage['wms_colw_v1']`，按表头 `data-colkey` 取用，列数与表头不一致时忽略。
26. **权限模块与导航一一对应**：`MODULES` 19 条 = 19 个导航页，`PERM_ACTS` 8 个动作。权限判断分三档：
    - 同页同模块（如入库登记）直接 `can(mod, act)`；
    - 台账 / 项目清单 / 调拨用 `canMod(mod, act)` 或 `pageCan(page)`：角色显式配置过该模块就用它，否则回退 `PAGE_MOD` 里的旧主模块（台账←入库/出库登记，清单与调拨←项目视图）；
    - 游客**不回退**，严格走 `GUEST_PERMS`（9 个页面 view，含调拨查看，不含台账与系统管理）。
    新增页面必须同时改 `PAGES`、`MODULES`、`PAGE_MOD`、`NAV_ORDER`、`render` 分发与只读兜底；`saveRole` 会写入空数组表示「显式关闭」，不要改回「空数组不存」。
27. **仪表盘日历口径**：`calDayStats()` 按「天 × 类型 × 单据号」去重统计笔数（一张单多行算 1 笔），数量按行累加；`transfer` 流水既不算笔数也不算数量，与台账口径一致。项目排序统一走 `sortProjectsByHold()`（持有量降序、零值沉底）。
28. **仪表盘布局存本机**：`DASH_KEY='wms_dash_v1'` 存 `[{id,w,h}]`（顺序即卡片顺序），**不进 db**、不跨设备；`dashLayout()` 负责合并默认、去重、夹紧（宽 3–12、高 3–18）；`initDashGrid()` 在每次 render 后插握把与缩放手柄。拖动/缩放结束才 `saveDashLayout()`，中途只改 style 让其他卡片实时让位。
29. **施工单位与看板口径**：`db.orgUnits = [{id,name,remark,contacts:[{name,phone}],createdAt}]`，`projects[].unitId` / `records[].unitId` 均可选；删除单位只置空引用、不删流水。看板：单位领用次数按 `docNo` 去重（仅非调拨 `out`），单位剩余 = 该单位领用量 − 该单位负责项目的持有量；总览差异 = 出库总数 − 项目使用数量。所有 `db.orgUnits` 读取走 `ouList()` 兜底，避免旧数据未归一化时报错。
30. **权限必须写全 19 个模块**：`saveRole` 与 `permMig=4` 都给每个角色写满 19 个键（无权限写 `[]`）。补键前必须先按旧回退语义（`PAGE_MOD`）折算真实权限再写入，否则老角色会因「有键但为空」被判为显式关闭而丢权限。新增模块时 `MODULES`、`PAGES`、`NAV_ORDER`、`defaultRoles`、`permMig` 五处同步。
31. **显示设置**：`db.settings.display = {scale:50~200, font:''}`，`applyDisplay()` 在每次 render 末尾执行（`documentElement.style.zoom` + `body.fontFamily`）；缩放用 `zoom` 而非 `transform`，保证 fixed 浮层与表格拖拽坐标一致。

---

## 六、已知边界

- 权限为**功能级**（模块 × 动作），不含数据行级隔离（如「只看自己负责的项目」），列在 P2。
- 备份默认只存浏览器 localStorage；**在备份设置里「选择目录」后才会真实写盘**（File System Access API，目录下 `manual/`、`auto/`）。未选择目录时手动备份自动下载 JSON、自动备份仅存浏览器，清理浏览器数据仍会丢失 localStorage 中的备份。
- 备份存 localStorage，清浏览器数据会一并丢失；长期留存请用备份卡片「下载」导出 JSON。
- 单仓核算模型：库存按物料全局核算，仓库作为单据属性记录。
- 触屏设备无法可靠长按弹出右键菜单，设置页提供「模块名称」集中改名入口作为兜底。

---

## 七、迁移与打包

**目录要求**：`index.html` 是唯一的运行文件，其余均为文档 / 测试 / 开发工具，删掉也能跑。

| 打包用途 | 需要包含 | 说明 |
|---|---|---|
| 运行包（给别人用） | `index.html` + `README.md` | 拷到任意目录双击即用 |
| 开发包（继续改） | 全部（含 `tests/`、`tools/`） | 测试需 Node + jsdom；截图需 Edge |
| 不建议打包 | `.workbuddy/` | 项目记忆（开发日志），与运行无关 |

**数据迁移**（数据存在浏览器 localStorage，不随文件走）：
1. 旧机器：`数据备份` →「导出当前数据」得到 `wms_data_日期.json`；或对某份备份点「下载」。
2. 把 `index.html` 与该 JSON 一起拷到新机器。
3. 新机器打开 `index.html` → `数据备份` →「导入备份」选中 JSON → 列表里点「恢复」（会先自动留一份「恢复前快照」）。
4. 旧机器若能打开，建议再点顶栏「备份」，留一份手动快照兜底。

> 同一台机器、同一个浏览器里换目录，数据通常仍可见（file:// 同源）；换浏览器或换机器必须走上面的 JSON 导入。

## 八、桌面客户端（exe）

把工作台打包成 Windows 本地客户端：**离线运行、无浏览器、数据存本机**，双击即用。

### 8.1 产物与使用

| 项 | 说明 |
|---|---|
| 成品 | `dist/出入库存工作台_v4.19.0_桌面客户端.zip`（约 151MB）；exe 名为 `出入库存工作台_v4.19.0.exe` |
| 运行 | 解压到任意目录 → 双击 `出入库存工作台.exe` |
| 系统要求 | Windows 10/11 64 位（Electron 45 自带运行时，无需装 .NET / VC++ / 浏览器） |
| 体积 | 解压后约 470MB（Electron 运行时占绝大部分，`app.asar` 仅 360KB） |
| 菜单 | 文件（导入数据备份 / 打开备份目录 / 打开数据目录）、编辑、视图（缩放 / 重新加载 / F12 开发者工具）、帮助 |

> exe 未做代码签名，首次运行 Windows SmartScreen 可能提示「已保护你的电脑」→ 点「更多信息 → 仍要运行」。杀毒软件若误报，把 exe 所在目录加白名单即可。

### 8.2 数据存在哪

- 数据目录：`%APPDATA%\出入库存工作台\`（菜单「文件 → 打开数据目录」可直接跳转）。
- 页面仍是 `index.html` 单文件，业务数据在其中的 localStorage（leveldb 存在数据目录下）；**关闭、重启、升级客户端都不丢**。
- 与浏览器版**互不相通**：浏览器和 exe 各自一份 localStorage，靠 JSON 备份文件迁移（见 8.3）。
- 删掉数据目录 = 清空客户端全部数据，删除前请先导出备份。

### 8.3 从浏览器迁移到客户端

1. **旧环境导出**：浏览器打开 `index.html` → `系统管理 → 数据备份` →「导出当前数据」，得到 `wms_data_日期.json`（或对任意备份点「下载」）。
2. **客户端导入**：打开 exe → 菜单「文件 → 导入数据备份…」选中该 JSON（等价于 `数据备份` 页右上角「导入备份」）。
3. **恢复**：备份列表里出现「导入备份 · xxx」，点「恢复」→ 勾选确认。恢复前会自动留一份「恢复前快照」。
4. 反向迁移同理：客户端「导出当前数据」→ 浏览器「导入备份」→「恢复」。

### 8.4 备份落盘（与浏览器版的区别）

- 浏览器用 File System Access API 选目录；**Electron 不支持该 API**，客户端改为**系统目录对话框**：`数据备份 → 备份设置 → 选择目录` → 选一个文件夹。
- 选完后备份**直接写盘**：`<目录>\manual\wms_manual_<时间>.json`、`<目录>\auto\wms_auto_<时间>.json`，无需授权、刷新不丢（目录记在 `%APPDATA%\出入库存工作台\desktop-config.json`）。
- 目录被删除或移动后，客户端会提示未连接，重新选一次即可。
- 未连接目录时行为与浏览器一致：手动备份自动下载 JSON、自动备份只存客户端数据目录。

### 8.5 重新打包

```bash
cd desktop
npm install                    # 首次：装 electron 45 + @electron/packager
node build.js                  # 输出 dist/desktop/... 与 dist/出入库存工作台_v<版本>_桌面客户端.zip
```

- `build.js` 会先把根目录最新的 `index.html` 复制到 `desktop/app/`，**不会修改源文件**。
- 若 `node_modules/electron/dist` 为空（npm 跳过 postinstall），先手动下载：`node node_modules/electron/install.js`（内网加 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`）。
- 证书受限/内网：`@electron/packager` 默认联网下载 Electron，会报 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`。`build.js` 已内置兜底——检测到 `node_modules/electron/dist` 就自动压成 `.cache/electron-v<版本>-win32-x64.zip` 并走 `electronZipDir` 本地打包，首次多花约 10 秒。
- 自检：`出入库存工作台.exe --selftest` 会跑一轮登录、写盘、导入，输出 `%APPDATA%\出入库存工作台\selftest.json`（含 `localStorage/loggedIn/writeOk/imported` 四项布尔值）。若从注入了 `ELECTRON_RUN_AS_NODE=1` 的终端启动，需先 `env -u ELECTRON_RUN_AS_NODE`，否则 Electron 会退化成纯 Node。

### 8.6 与浏览器版的差异

| 能力 | 浏览器版 | 桌面客户端 |
|---|---|---|
| 启动方式 | 双击 html / 任意静态服务 | 双击 exe |
| 数据位置 | 浏览器 localStorage（按浏览器隔离） | `%APPDATA%\出入库存工作台`（独占一份） |
| 选备份目录 | File System Access API（弹授权） | 系统目录对话框，直接写盘 |
| 导出 CSV/JSON | 走浏览器下载目录 | 走系统下载目录（Electron 默认） |
| 免登录游客浏览 | 有 | 有（同一套 `GUEST_PERMS`） |
| 数据备份导入/恢复 | 有 | 有，且多了菜单入口 |

## 九、版本记录

| 版本 | 主要内容 |
|---|---|
| v1 | 多项目 / 多物料出入库、项目汇总矩阵、物料明细、记录查询导出、可配置仪表盘 |
| v2 | 单仓模型（入库归属仓库）、出库项目选填、项目行政区 + Excel 导入、库存明细台账、台账可编辑、项目返回入库 |
| v3 | 入库类型三选一、台账全列排序 + 拖动排序、物料删除/品牌厂商/分类手填/编码自定义/拖动排序 |
| v4 | 账号登录与权限体系、操作日志、数据备份、项目删除、负责人筛选、工作台名称 |
| v4.1 | 登录页精简、登录背景图、自助改密、超管改 `useradmin`、备份时间与路径可配置 |
| v4.2 | 模块右键重命名（含设置页集中入口）、行政区筛选残留修复 |
| v4.3 | 出库项目模糊搜索、项目页搜索、双栏独立滚动、单项目 / 汇总导出、汇总冻结列与「各项目使用汇总」 |
| v4.4 | 内容区铺满视口（去 1560px 上限）、新增「项目清单」模块并与项目视图互通、按企业级设计令牌统一圆角/间距/表格/滚动条/焦点环 |
| v4.5 | 顶栏一键备份、物料批量导入、单位默认 PCS、分类改为随录入自维护、项目清单精简为 9 列、清空业务数据（保留账号/设置/备份） |
| v4.6 | 备份 JSON 导入（跨机器迁移）、导出 JSON 去 BOM 并修正 MIME |
| v4.7 | 免登录游客浏览（5 个板块只读）、右上角登录浮层可关闭、游客不再可见入库/出库与系统管理、登录后停留原页 |
| v4.8 | 备份真实落盘（选择本机目录，manual/auto 子目录）、未连接时自动下载、备份卡片显示文件名 |
| v4.9 | 统一时钟（nowMs/nowDate）、HTTPS 时间校准（三源回退）、设置页时间校准卡片、偏移持久化 |
| v4.10 | 修复「立即校准」必失败：国内源优先 + 全源并发 + JSONP 主通道；新增手动校准与逐源诊断 |
| v4.11 | 新增 Windows 桌面客户端（Electron）：离线 exe、系统对话框选备份目录直接写盘、菜单导入备份文件 |
| v4.12 | 项目组新增「出库物资调拨」：按领用单据逐单调拨、多接收项目、可调拨上限校验、库存总量不变 |
| v4.13 | 入库/出库台账独立成页并卡片化（点单号整单编辑、增删行、整单删除、库存校验）；全台账表格支持拖动调列宽 + 双击恢复；调拨表列宽重排 |
| v4.14 | 台账整单全字段编辑（日期/仓库/项目/经办人/入库类型/备注）；调拨记录独立成台账（双 Tab）；调拨页行政区模糊筛选；新增 transfer 权限动作并修正内置角色 |
| v4.15 | 项目左栏与汇总列按持有量降序；权限模块补齐到 17 个（台账/清单/调拨独立，老角色回退兼容）；仪表盘新增「项目已领用」指标与物料卡、出入库日历 |
| v4.16 | 去掉登录界面（打开即项目只读，管理员用 #/login 或 Ctrl+Alt+L）；仪表盘 12 列栅格可拖动排序与缩放；调拨项目按领用单倒序；项目视图每个项目加「调拨」入口 |
| v4.17 | 只读页面右上角恢复「登录」按钮；内置超管改为 `admin` / `sl123456`（旧的 useradmin 自动改名） |
| v4.18 | 入库/出库台账支持导出；新增施工单位管理（多联系人）与出库「领用施工单位」；项目档案新增施工单位（负责人之前）与清单筛选；新增设备使用看板（总览 + 单位卡片） |
| v4.18 | 修复：删除出库单未清理其发起的调拨（`srcDocNo` 关联），新增「清理失效调拨」入口 |
| v4.19 | 出库新增单位联系人；记录页支持删除流水；角色权限写全 19 模块；exe 名带版本号；项目清单右侧详情抽屉；项目视图左栏行政区两级目录；字体缩放 50%~200% 与字体选择；按 shadcn/ui 统一视觉 token |
| v5.0 | CloudBase PG 云同步（单文档 + 匿名登录 + 防覆盖闸门）；发布为在线应用 |
| v4.20 | 云端历史快照（触发器归档 30 份 + 一键恢复）；推送改乐观锁，冲突不再静默覆盖 |
| v4.21 | 项目视图左栏改平铺单行 + 拖拽调宽；详情新增「仓库领用 / 已出库领用」；看板拆两个子页；顶栏字体缩放控件；字体候选回显修复 |
| v4.22 | 游客权限跟随「项目只读」角色（只继承 view）；物料明细只显示名称 + 批量选择；移动端适配（抽屉菜单 / 单列 / 触摸尺寸） |
| v4.23 | 修复云端空库无法首次推送（`.single()` → `.limit(1)`）；安全域名与 anon 写权限；真实数据入库；看板移到库存数据分组 |
| v4.24 | 项目详情新增领用记录：全字段编辑、数量联动库存与项目持有、撤销时归还仓库/单位额度 |
| v4.25 | 修复自动备份假成功；新增云端 `wms_backup` 表，每日云端+本机各一份，启动检测缺则补，备份页展示两端真实状态 |

---

_最后更新：2026-11-18 · 对应 `index.html` v4.19 · 桌面客户端见第八节 · UI 规范参考技能 ui-design-languages（shadcn/ui）_
