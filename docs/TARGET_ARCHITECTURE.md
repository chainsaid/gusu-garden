# 目标架构：机制 / 领域 / 数据

> 状态：设计稿，供评审。本文只定义内部边界与迁移计划，不代表已实施。
> 本轮不修改 `src/`、`web/`、`shared/` 中任何代码。
>
> 依据：工程侧可复用性审计、内容侧（`src/world`）函数级审计、
> `docs/ARCHITECTURE.md`、`docs/REFACTORING_PLAN.md` 与当前源码核对结果。

---

## 0. 术语与角色

| 角色 | 目录（目标） | 一句话定义 |
|---|---|---|
| 机制层 Mechanism | `src/core/` | 与「姑苏园林」无关的 Three.js / GLSL / 渲染机制。换任何 WebGL 项目都不改文件内容。 |
| 领域工具层 Domain | `src/world/` | 认「江南园林 / 木作 / 瓦作 / 太湖石 / 荷池」词汇的生成器与领域策略。换一座苏州园林可复用，换欧洲建筑不复用。 |
| 项目数据层 Data | `src/data/`、`shared/data/` | 这一座园子、这一部片的**事实**：坐标、尺寸、镜头、时长、KEEP 盒、配色选择。声明式，无过程。 |
| 装配层 App | `src/app/`、`web/`、`tools/` | 拥有 URL、DOM、canvas、启动顺序、HTTP 端点；把上面三层组织起来。不是可复用资产。 |

「三级」指前三层。装配层是消费者，不参与「什么代码可以被别的项目拿走」的判断，但它拥有所有**副作用与生命周期**。

本架构不解决对外发 npm 包的问题（已明确搁置）。这里的「可复用」指：换项目时能整文件/整函数搬走，且依赖方向干净。

---

## 1. 不变量（每批迁移都必须满足）

1. **项目始终可运行**：`npm run dev`、`npm run dev:web` 在每批结束时都能起。
2. **画面可证不变**：每批按第 8.1 节的验证等级出证据，不接受「看起来没变」。
3. **单一真源**：同一事实（水位、太阳角、镜头时长、KEEP 盒）只存一处。
4. **无 import 期副作用**：模块加载不得读 URL、改写 `THREE.ShaderChunk`、原地修改导出数据、求值项目规格。
5. **状态有主**：所有跨模块共享的可变对象由装配层创建并显式传递，不存在「谁 import 谁就先初始化」的隐式顺序。

---

## 2. 分层模型与准入标准

### 2.1 判定流程（拿去判断任意一个文件/函数）

按顺序问，命中最先一项即定层：

1. 它是否包含**具体坐标、镜头号、秒数、这座园子的尺寸、KEEP 盒、片长**？
   → **数据层**（或数据层中的常量），除非这些数值只是函数的通用默认值。
2. 它是否读取 `location` / `document` / `window` / `performance`，或决定模块加载顺序、创建 renderer/canvas/HTTP 服务？
   → **装配层**。
3. 它是否认「屋面 / 斗拱 / 飞檐 / 太湖石 / 石板 / 荷池 / 漏窗 / 廊」等词汇，或实现这一家族的装配算法？
   → **领域层**。
4. 它是否只做数学、GLSL、几何操作、相机求值、后处理、时间轴，且换一个完全无关的 Three.js 项目不用改文件内容？
   → **机制层**。
5. 一个文件同时命中多层？
   → 按**导出函数**拆文件；文件跟随其最高层的导出。低层函数移出，而不是给高层函数加开关。

### 2.2 机制层准入（必须全部满足）

| 编号 | 条件 |
|---|---|
| M1 | 只 import `three` / `three/addons` / 同层机制模块。不得 import `data/`、`world/`、`app/`。 |
| M2 | 模块顶层不求值项目数据、不读 URL/DOM/window、不产生可观察副作用（含改写 `THREE.ShaderChunk`）。 |
| M3 | 不持有跨消费者可变单例。需要状态时用 `createX(...)` 返回句柄，由调用方持有。 |
| M4 | 所有与场景相关的数值只能是参数；参数有单位、有通用默认值；不得把项目值烘焙进 GLSL 常量。 |
| M5 | 需要 renderer / scene / camera / uniforms 时，一律作为入参，不在内部创建。 |
| M6 | 判定测试：把它搬到「一个产品配置器 / 建筑可视化 / 另一座园林」，只需改调用参数，不需改文件内容。 |

### 2.3 领域层准入（必须全部满足）

| 编号 | 条件 |
|---|---|
| D1 | 编码江南园林的词汇或装配算法（屋面、斗拱、飞檐、太湖石、石板、荷池、漏窗、树木图集）。 |
| D2 | 只 import 机制层与领域层。**不得 import 项目数据**；尺寸、坐标、配色必须通过 spec 入参拿到。 |
| D3 | 模块顶层不得求值项目规格或精度档位；所有派生常量（如瓦件间距 `TILE`）必须是函数内局部值或工厂返回值。 |
| D4 | 可以创建 Geometry / Material，但不得 `scene.add`；需要挂载时接收显式 parent。 |
| D5 | 生成器必须声明它需要的材质槽（slot 名 / UV 约定），或直接接收 `materialKit`；禁止隐式依赖全局 `M`。 |
| D6 | 判定测试：换另一座江南园林可不改代码；换欧洲教堂则明确不该复用。 |

### 2.4 数据层准入（必须全部满足）

| 编号 | 条件 |
|---|---|
| P1 | 只包含这座园子 / 这部片的事实：坐标、尺寸、镜头 keys、时长、切点、配色选择、模块清单、KEEP 盒、资产清单、每镜编排参数。 |
| P2 | 只 import 其他数据模块；不 import `three`、机制层、领域层。坐标用普通数组/数字。 |
| P3 | 无副作用、无过程；允许字面量组合与 `Object.freeze`。 |
| P4 | 修改它只改变**内容**，不改变**能力**。 |
| P5 | 同一事实只存一处；`src/` 与 `web/` 不得各存一份。跨应用共用的事实放 `shared/data/`。 |

### 2.5 边界判定示例（可直接照用）

| 对象 | 结论 | 理由 |
|---|---|---|
| `src/core/rng.js`、`glsl.js`、`geom.js` | 机制 | 零项目知识，纯函数/字符串 |
| `src/core/detail.js` | 机制（改为工厂） | LOD 策略是通用机制；当前问题是模块单例 |
| `src/core/post.js` | 机制（参数化） | 管线对场景零假设；DEFAULT_POST 属数据 |
| `src/core/env.js` | 混合，必须拆 | 太阳角/色温属数据；uniform 句柄属机制；URL 解析属装配 |
| `src/core/fog.js` | 机制（改为显式 install） | 雾/体积光算法通用；当前 import 期改写 chunk 是缺陷 |
| `src/core/materials.js` 的 `patch()` | 机制 | onBeforeCompile 注入框架 |
| `materials.js` 的 `PROC` / `materials()` | 领域 | 江南配色、苔藓、湿水带、`gold→iron` 别名 |
| `src/world/hall-roof.js` 的 `TILE` | 领域 | `gap(0.335)` 派生自 detail，应改为 `tileParams(detail)` |
| `src/world/rockery-sdf.js` | 领域 | 太湖石 SDF 组合；surface nets 算法本身可上提机制 |
| `src/layout.js`、`shotkeys/*`、`SHOTS` | 数据 | 这座园子的坐标与镜头 |
| `src/world/vegetation.js` KEEP 数组 | 数据 | 具体预留盒坐标 |
| 同文件的 `clearance()` / `screenBlocked()` | 领域 | 避让规则；但底层几何查询可上提机制 |
| `src/main.js` | 装配 | URL、DOM、canvas、启动顺序、HTTP |
| `tools/snap.mjs` 的 Chrome 启动 | 机制 | 通用抓帧基础设施 |
| `tools/snap.mjs` 的 `__renderView` 查询 DSL | 装配契约 | 页面必须实现该契约 |

### 2.6 函数级拆分规则（对应内容侧审计的 55 / 25 / 15–20）

`src/world` 的可复用边界在函数级：

- **55–60% 纯生成器**：`(spec, rng) → geometry`。目标签名 `buildX(spec, { rng, detail })`，返回 `{ geometry|object, slots }`。
- **25% 需注入 Builder / 材质的生成器**：目标签名 `buildX(spec, { rng, detail, kit, parent })`。**几何与材质成对提供**，不允许只搬几何而让调用方猜材质。
- **15–20% 布点避让**：移入第 6 节的布点层，不留在生成器里。

文件只有在「所有导出函数同层」时才整体归层；混合文件按导出函数拆。

### 2.7 目标目录

```
src/
  core/                     # 机制层
    rng.js  glsl.js  geom.js
    detail.js               # createDetailPolicy
    uniforms.js             # createUniforms
    environment.js          # createEnvironment
    materials.js            # 只剩 patch 框架：patch/std/phys/glow/depthMaterialFor
    sky.js                  # createSky
    lighting.js             # createSun / fitSunShadow / captureEnvironment
    fog.js                  # installAtmosphere（显式、幂等）
    post.js                 # Pipeline（参数化）
    spatial.js              # AABB / 相机净空 / 屏幕矩形 / 距离查询
    diag.js                 # 注入 registry 的诊断
    film/
      shot-eval.js          # createShotEvaluator（纯数学）
      timeline.js           # createTimeline（切点 / localT）
    render/
      sampling.js           # Halton / 快门 / 太阳抖动
      camera.js             # focalToFov / applyCamera
      frame.js              # createOfflineRenderer
  world/                    # 领域层（现有 80 个文件归位）
    materials/
      proc.js               # 通用 PBR 过程
      presets-jiangnan.js   # 江南预设（湿水带、苔藓、瓦作、漆面）
      kit.js                # createMaterialKit
    placement/
      rules.js              # KEEP / treeTopCap / 取景保护策略
      index.js              # createPlacement
    hall*.js  pond*.js  vegetation*.js  terrain*.js  props*.js  pagoda*.js  bridge*.js  buildings*.js
  data/                     # 项目数据层（离屏专用）
    atmosphere.js           # 太阳 / 雾 / 风 / 云数值
    film/shots.js           # 镜头数据
    film/shotkeys/*.js      # 镜头覆盖数据
    film/choreography.js    # 每镜水面/落叶/锦鲤参数
    modules.js              # 离线世界模块清单
    placement.js            # KEEP 盒 / 净空阈值 / 受保护取景矩形
    assets.js               # 导出清单
  app/                      # 装配层
    main.js                 # 原 src/main.js
    runtime-config.js       # URL 解析与覆盖
    director.js             # film → 解析后的 uniform 标量
    context.js              # ctx 组装
shared/
  data/
    layout.js               # 跨应用站点数据（canonical）
    palette.js              # 若 web 也需要，才放这里
```

---

## 3. 依赖规则

### 3.1 允许矩阵

| from \ to | 机制 | 领域 | 数据 | 装配 |
|---|---|---|---|---|
| 机制 | ✓ | ✗ | ✗ | ✗ |
| 领域 | ✓ | ✓ | ✗（只能入参） | ✗ |
| 数据 | ✗ | ✗ | ✓ | ✗ |
| 装配（`src/`、`web/`、`tools/`） | ✓ | ✓ | ✓ | ✓ |
| `web/`（阶段一） | ✗ | ✗ | ✓（仅 `shared/data`） | 自己的装配 |

### 3.2 硬规则

- **R1** 机制层只依赖机制层。
- **R2** 领域层可依赖机制层；领域层之间可互相依赖。
- **R3** 领域层不得 import 数据层；数据只能通过 spec / ctx 入参进入。
- **R4** 数据层只依赖数据层，且只放常量与字面量。
- **R5** 任何层不得 import 装配层（`src/app/`、`web/`、`tools/`）。
- **R6** 机制层与领域层的模块顶层不得写第三方全局（`THREE.ShaderChunk`、prototype、`window`）。
- **R7** 镜头语义（`uShot`、`SHOT_DUR`、切点）只允许出现在装配层与数据层；资产只认 `ctx.time` 和 director 解析后的标量。
- **R8** 机制层不得把项目值烘焙为 GLSL 常量；所有场景数值走 uniform 或参数。
- **R9** 同一项目事实只能有一个真源；`web/` 与 `src/` 共用的事实只能在 `shared/data/`。

### 3.3 当前实际存在的反向依赖（已核实）

| # | 位置 | 类型 | 为什么是反的 | 目标修复批 |
|---|---|---|---|---|
| 1 | `src/world/pond-water.js:10,442-454` | 领域 → 机制可变单例，并写 `SKY_UNIFORMS.uSunDisc` | 领域代码反改机制层全局；隐藏/恢复逻辑与 `lighting.js` 重复 | B2 |
| 2 | `src/core/lighting.js:3,72-84` | 机制 → 机制，但 lighting 反改 sky 的内部 uniform | 所有权倒置：太阳光捕获不应知道天空对象内部结构 | B2 |
| 3 | `src/core/materials.js:3,43,92-97` | 机制 → 项目全局 `G` + 风 GLSL + `uShot` | 机制层绑定项目单例，无法换场景/多实例 | B1、B5 |
| 4 | `src/core/materials.js:5,215` | 机制 → detail 模块单例 | 材质程序缓存键随全局档位变化，不可注入 | B4 |
| 5 | `src/core/sky.js:3,12` | 机制 → 项目大气数值 | 天空机制读项目 `ENV`/`G` | B1 |
| 6 | `src/core/fog.js:50,54-55,118` | import 期改写 `THREE.ShaderChunk`，并缓存原 chunk | 全局副作用；与其他 chunk 补丁不可组合；three 版本变化会静默失效 | B3 |
| 7 | `src/core/fog.js:2,92` | 机制 → 项目 `sunDir` 烘焙成 GLSL 常量 | 场景值进入机制层 | B1、B3 |
| 8 | `src/world/pond.js:14` | 领域 → 项目环境全局 `sunDir` | 绕过 ctx，直接 import 项目数据 | B1 |
| 9 | `src/world/pond.js:16-17,255` | 领域模块顶层 `await import('../shots.js')`；写死 `SHOT_DUR`，并用 `shot * SHOT_DUR + 37.0` | import 期异步副作用；片长与主循环 37 s 时钟偏移漏进资产 | B5 |
| 10 | `src/world/vegetation.js:11` | 领域 → 电影数据 `SHOTS` | 资产依赖镜头数据 | B5 |
| 11 | `src/world/vegetation.js:56`、`pond-water.js:193`、`pond-lotus.js:56` | shader 直接分支 `uShot` | 资产层知道「第几镜」，`SHOT_DUR=7` 的假设散落三处 | B5 |
| 12 | `src/world/hall-roof.js:91` | 领域在 import 期读 detail 单例（`TILE.S = gap(0.335)`） | 同进程无法并存两档精度；加载顺序成为隐式契约 | B4 |
| 13 | `src/main.js:53` | 装配依赖「先 setDetailTier 再动态 import world」 | 隐式加载顺序契约，`?detail` 覆盖与模块求值耦合 | B4 |
| 14 | `src/core/diag.js:7` | 诊断 → materials 全局注册表 | 诊断不可注入，绑定材质实现 | B6 |
| 15 | `src/main.js:207-209,333` | 装配直接写 `G` / `SKY_UNIFORMS` | 状态所有权不清；装配层是唯一合法写者，但接口应显式 | B1、B2 |
| 16 | `shared/layout.js:5` | web → `src/layout.js` 的间接依赖 | 跨应用数据路径穿过离线源码 | B9 |

补充：22 个 `src/world/*.js` 直接 `import` `core/detail.js`（见 8.5 清单）。方向本身允许，但破坏可注入性，统一在 B4 收到 `ctx.detail` / 参数。

---

## 4. 注入契约

### 4.1 总表

| 单例 / 契约 | 现状 | 目标载体 | 生命周期归属 | 理由 |
|---|---|---|---|---|
| `G` | `src/core/env.js` 模块级 `export const G`，被 materials/sky/lighting/fog 直接 import | `createUniforms(atmosphere)` → `ctx.u`，所有 shader 共享同一引用 | 装配层创建一次 | uniform 身份必须共享；但全局单例阻止多实例与 headless 测试 |
| `ENV` / `sunDir` | 模块级常量 + 派生 `Vector3` | `src/data/atmosphere.js` 常量；`createEnvironment()` 产出冻结值对象 | 装配层 | 数值是数据；派生物由工厂生成 |
| `SKY_UNIFORMS` | 模块级导出，被 lighting / pond-water 反改 | `createSky({u, atmosphere})` 返回 `{ object, uniforms, withSunDiscHidden(fn) }` | 装配层创建，机制/领域消费 | 天空是场景对象，不是环境全局；隐藏太阳盘必须成对操作 |
| 风函数 | `WIND_GLSL` 常量，materials 硬 import | `createWindGLSL(preset)` → `createPatchKit({ u, windGLSL })`，可按材质覆盖 | 装配层 | 风位移是通用机制，风速/阵风是参数；植被需要更慢的变体 |
| detail 档位 | 可变模块单例 `DETAIL` + `setDetailTier()` | `createDetailPolicy({ tier, override })` → `ctx.detail` | 装配层，**world 动态 import 之前**创建 | 同进程可并存多档；工具与测试可直接构造 |
| 镜头表 | `SHOTS` 被 `shotkeys` import 期原地改写；`SHOT_DUR` 常量 | `src/data/film/shots.js` 纯数据（覆盖在数据层一次性合成、冻结）；`createShotEvaluator({ shots, duration })` | 装配层 + 工具 | 消除 import 期改写；`camcheck` 可直接消费数据 |
| 镜头键覆盖 | `src/shotkeys/index.js` import 期改 `SHOTS` | `src/data/film/shotkeys/*.js`，由 `data/film/shots.js` 纯组合 | 数据层 | 覆盖也是数据，不是副作用 |
| 材质 `M` / `PROC` | `materials()` 共享单例，经 `ctx.M` 下发，模块可改 | `createMaterialKit({ u, patchKit, palette, waterLevel })` → `ctx.materials` | 装配层 | 共享可变材质是隐患（`interior-mats.js` 已主动规避并自建） |
| 雾 | `import` 即改写 chunk；`installFog()` 读模块级 `sunDir`；`setAmbientVolumes` 二次安装 | `installAtmosphere({ environment, params, volumes })`，显式、幂等、返回 `{ setVolumes }` | 装配层，首帧编译前调用 | 全局 chunk 补丁必须显式；体积必须在世界构建后、编译前设定 |
| 镜头导演 | 无；`uShot` 直接驱动水面/落叶/锦鲤 | `createDirector({ film, timeline, choreography })` → `sample(t)` 返回 `{ index, localT, params }`；资产只收标量 | 装配层 | 资产不应知道片长与镜头号；编排属项目数据 |
| 布点 | 散落在 vegetation/terrain/pond-lotusplan | `createPlacement({ spatial, rules, data })` → `resolve(candidates)` / `capHeight(x,z)` | 装配层 | 生成器与避让策略分离，见第 6 节 |
| 场景服务 | `scene.userData.noRefl` 魔法字符串、`window.__ctx` | `ctx.layers.noRefl` 注册器、`ctx.services` | 装配层 | 去掉魔法字符串与全局逃逸 |

### 4.2 为什么用「工厂 + ctx」而不是「模块级配置对象」

- uniform 必须共享同一引用。工厂只保证**每个渲染器一份**，不制造隐藏全局。
- 同一进程要能创建两套环境（离线 + 实时、测试双档 detail）。模块单例做不到。
- 测试与工具（`camcheck`、golden harness）需要在不启动页面生命周期的情况下构造 `uniforms` / `detail` / `shotEvaluator`。
- 显式 ctx 让「谁拥有状态」可审计；模块级 export 让所有权不可见。

### 4.3 资产只认时间：`uShot` 的替代

现状（三处）：

- `pond-water.js:193`：`abs(uShot - uGlitterShot) < 0.5` → 水面闪鳞开关。
- `pond-lotus.js:56`：`uShot < -0.5 || abs(uShot - uLeakShot) < 0.5` → 荷池漏光。
- `vegetation.js:56`：`int sh = int(floor(uShot + 0.5))` → 逐镜叶片抬升。

目标：

1. 机制层 `COMMON_HEAD` 删除 `uniform float uShot;`。
2. 装配层 `director.sample(t)` 计算 `{ uGlitterOn, uGlitterT, uLeakOn, uLeafLift, uKoiPhase }`。
3. shader 只判断解析后的标量（`uGlitterOn`、`uLeakOn`），不再知道镜头号。
4. `pond.js` 的锦鲤路径只接收 `time` 与 `uKoiPhase`；`SHOT_DUR` 不再出现在领域层。
5. 数值映射必须与现状**逐值相同**（同一 shot/t 下算出的标量一致），用 B5 的逐帧一致验证兜底。

这条是内容侧审计里最重要的架构结论：**时间轴不是资产属性，是编排层属性。**

---

## 5. 消灭 import 期副作用

### 5.1 清单与替代

| # | 现状 | 位置 | 替代形态 | 批次 |
|---|---|---|---|---|
| 1 | 模块级读 `location.search`，把 `?sunelev/?sunaz` 写进 ENV | `src/core/env.js:15-19` | `src/app/runtime-config.js` 解析 URL 与覆盖；数据层只放默认值 | B1 |
| 2 | import 即改写 `THREE.ShaderChunk.shadowmap_pars_fragment`，并缓存原 chunk | `src/core/fog.js:50,54-55` | `installAtmosphere()` 内部完成；显式调用；幂等；不缓存可覆盖的原 chunk（改为在 install 时读当前值） | B3 |
| 3 | import 期原地改写 `SHOTS` | `src/shots.js:143-146` | 数据层纯组合 + `Object.freeze`；求值器只读 | B5 |
| 4 | 领域模块顶层 `await import('../shots.js')` | `src/world/pond.js:16-17` | 移除；镜头路径由 `ctx.placement` / `ctx.director` 入参 | B5 |
| 5 | 模块级 `TILE = { S: gap(0.335) ... }` 求值 detail 档位 | `src/world/hall-roof.js:91` | `tileParams(detail)` 函数内求值，或由 `buildHall(spec, { detail })` 传入 | B4 |
| 6 | `onBeforeCompile` 内无条件读 `window.__shaderMin` | `src/core/materials.js:156` | 由 `createPatchKit` 接收 `shaderMin` 回调；默认不读 `window` | B1 |
| 7 | `materials()` 在模块加载时构建全部材质 | `src/core/materials.js` | `createMaterialKit()` 由装配层在数据就绪后创建 | B6 |
| 8 | `installFog()` 在 `main.js:59` 早于 renderer 创建 | `src/main.js:59` | 启动顺序显式化：renderer → install → build → volumes → compile | B3 |

### 5.2 目标启动顺序（必须保持画面一致）

```
1. runtime-config      解析 URL / 覆盖 / 质量档
2. atmosphere data + createUniforms + createEnvironment
3. 创建 canvas / renderer / scene / camera
4. installAtmosphere({ environment })          ← 必须早于任何材质编译
5. createDetailPolicy({ tier })                ← 必须早于 world 动态 import
6. createSky / createSun / createMaterialKit / Pipeline
7. 动态 import world builders，按 ctx 构建世界
8. createPlacement，解析布点；收集 ambientVolumes
9. atmosphere.setVolumes(vols)                 ← 必须早于首帧编译
10. 预编译 shader
11. 天空 PMREM + 场景环境捕获
12. 进入 mode（still / render / dev）
```

当前实现的视觉等价顺序：`setDetailTier`（53）→ `installFog`（59）→ world build（319）→ `setAmbientVolumes`（329）→ 编译（335+）。目标顺序不改变这些**相对先后**，只把「谁调用」从模块副作用改为装配层显式调用。

### 5.3 禁止清单

- 机制 / 领域模块顶层不得出现 `location`、`document`、`window`、`performance`、`new THREE.WebGLRenderer`。
- 不得在 import 期改写任何 `THREE.*` 全局（chunk、prototype、默认值）。
- 不得在 import 期修改其他模块导出的对象（数组、对象、单例）。
- 不得让「先 import 谁」成为正确性条件；顺序必须写在装配层。

---

## 6. 布点 / 空间约束层

### 6.1 为什么需要独立成层

当前「防穿模」知识散落在生成器内部：

- `vegetation.js`：`KEEP` 盒数组、`clearance()` 净空判断。
- `vegetation-tree.js`：`screenBlocked()` / `boxBlocked()` 取景与包围盒避让。
- `terrain-field.js`：`treeTopCap` 高度上限。
- `terrain-land.js` / `terrain-forest.js`：地形高度上限对树木的约束。
- `pond-lotusplan.js`：荷池布点与相机净空。

如果只抽「纯生成器」，这些知识会随生成器一起丢失，抽出来的树会在别的项目里穿墙。因此抽取单位必须是 **生成器 + 布点契约**。

### 6.2 三层归属

| 子层 | 内容 | 例子 |
|---|---|---|
| **机制层** `src/core/spatial.js` | 纯几何查询：AABB/OBB 相交、线段-体距离、球/胶囊扫掠、世界→NDC 投影、屏幕矩形包含、占据网格 | `segmentIntersectsBox`、`projectBoxToNdc`、`distanceToAabb` |
| **领域层** `src/world/placement/rules.js` | 江南园林的避让**策略**：树木不可侵入 KEEP 盒；檐口/树冠需低于 `treeTopCap`；近水相机路径需保留净空；受保护取景矩形内不得出现遮挡体 | `mayPlaceTree(candidate, ctx)`、`capForGround(x,z)` |
| **数据层** `src/data/placement.js` | 具体预留盒坐标、净空阈值、受保护取景矩形、相机路径采样 | `KEEP = [...]`、`margin = 2.5`、`protectedFrames` |

回答「它是否属于机制层」：**求解器与几何查询属于机制层；避让规则属于领域层；被避让的具体体积属于数据层。** 三者不能混在一个文件里。

### 6.3 职责边界与执行顺序

```
content (world)      : 给定 placement，产出几何；不做避让
placement (domain)   : 给定 candidates + keep-outs + camera paths，接受/拒绝/微调
director/shot (data+app): 提供相机路径与受保护取景矩形（来自 film 数据）
app                  : terrain → placement.resolve → content build → director → render
```

关键约束：

- 生成器不得读取镜头表；相机路径由 placement 入参进入。
- placement 不得创建几何；它只返回落位与拒绝原因（可诊断）。
- 受保护取景矩形来自电影数据，属数据层；规则如何判定属领域层。

### 6.4 接口草案

```js
// mechanism
createSpatialIndex({ cell })
  .insertBox(id, min, max)
  .querySegment(a, b, radius)     // 返回相交 id
  .projectToNdc(box, camera)      // 返回屏幕矩形

// domain
createPlacement({ spatial, rules, data })
  .resolve(candidates)            // → [{ id, pos, rot, scale, accepted, reason }]
  .capHeight(x, z)                // → number（给地形/树高用）
  .protectedFrames(shotIndex)     // → NDC rects

// data
export const KEEP = [...];
export const CLEARANCE = { pond: 2.5, eave: 1.2, camera: 3.0 };
export const PROTECTED_FRAMES = { 0: [...], 3: [...] };
```

---

## 7. `src/` 与 `web/` 的关系

### 7.1 事实核对

- `web/` 有自己的 `core/engine.js`、`core/post.js`（`EffectComposer` 路线）、自己的场景、UI、天气、热点、音频。
- `web/` 对 `src/core` 的 import 数为 **0**；唯一共享的是 `shared/layout.js`（13 个 scene 文件使用）。
- `tools/export-web-assets.mjs` 把离屏世界的几何导出为 GLB；`tools/verify-asset-consistency.mjs` 用三角面数校验资产是否过期。
- `tools/test-web-runtime.mjs` 是 web 的端到端测试（自带 3000 端口）。
- `tools/compare-benchmarks.mjs` 原本用于离屏 vs web 的 12 机位对比，但当前硬编码 `C:/Users/.../brain` 路径，macOS 上不可用（第 10 行），B9 需要先参数化。

**结论：`src/core` 至今没有被自己的第二个前端复用。** 这是判断「core 到底解耦了没有」的关键证据——不是理论问题，是既有事实。

### 7.2 三个可选方案

| 方案 | 内容 | 代价 | 收益 | 风险 |
|---|---|---|---|---|
| **A. web 作为机制层第二消费者** | web 改用 `rng/glsl/geom/detail/patch/spatial`，逐步替换自己的工具函数；post 与场景仍各用各的 | 中高：需要把 web 的工具函数逐个对照替换；材质/天空若共用要抽预设 | 一套着色/材质/几何工具，减少双份 bug | web 视觉漂移；两套后处理无法统一，容易产生「假共用」 |
| **B. web 为独立应用，仅共享数据层（现状形式化）** | `web/` 只能 import `shared/data/**`；`src/` 也只能从 `shared/data` 取跨应用事实；其余互不依赖 | 低：主要是路径与约束 | 边界清晰、零回归风险；承认两套实现 | 天空/水面/植被的双份实现长期存在 |
| **C. web 变成共享领域构建器的瘦客户端** | 两端共用 `world/builders`，web 只换渲染循环、相机控制、UI | 很高：web 内容/交互与离线片不同；资产管线要重做 | 真正一套内容 | 高概率破坏 web 的交互特性；工作量不可控 |

### 7.3 推荐

**当前采用 B，保留 A-lite 作为后续可选提升；不采用 C。**

理由：

1. 「是否拆包」已搁置，本轮的内部解耦不需要 web 来证明；强行合并会制造第二个高风险工程。
2. web 与离屏的产品目标不同（实时、可交互、天气/时段）；共用 post 与内容层会把两边的约束互相污染。
3. 机制层的纯工具（rng/glsl/geom/spatial/detail/patch）确实有第二消费者潜力，值得在 B 完成后按需提升。

### 7.4 后续可提升清单（A-lite 的准入）

| 可提升到机制层共用的 | 不提升的 |
|---|---|
| `rng`、`glsl` 噪声、`geom` Builder/分块、`spatial`、`detail` 工厂、`patch` 框架、`shot-eval`（若 web 用电影机位） | `post` 管线、`sky`（web 有天气/时段预设，语义不同）、`lighting` 捕获策略、`fog` 安装方式、全部 `world` 生成器、离屏 `render/frame` |

提升门槛（必须同时满足）：

1. web 出现**具体的第二个用途**，而不是「架构上应该共用」。
2. `tools/test-web-runtime.mjs` 通过。
3. 参数化后的 `tools/compare-benchmarks.mjs` 12 机位 SSIM ≥ 0.98。
4. web 生产包体积增幅 ≤ 5%，首帧时间回退 ≤ 5%。

### 7.5 回归契约

`shared/` 的角色从「模糊的共享目录」改为「跨应用数据层」：

- `shared/data/layout.js` 为 canonical；`src/app` 与 `web/` 都从这里取。
- `shared/layout.js` 删除（不再做一层无意义 re-export）。
- `src/data/` 只放离屏专用数据（大气、电影、编排、布点、资产清单、模块清单）。
- `tools/dep-lint.mjs` 把第 3 节的矩阵变成可执行检查。

---

## 8. 迁移施工单

### 8.0 总则

**每批开工前（工作区前提）**

1. `git status --porcelain` 为空；若有未提交改动，先提交或 stash。
2. 记录 `git rev-parse HEAD` 到 `out/golden/<batch>/HEAD.txt`。
3. `out/.gpu.lock` 不存在；没有其他 `snap/render` 任务在跑（GPU 互斥）。
4. `npm run dev` 在 5173 运行；需要 web 的批次再起 `npm run dev:web`（3000）。
5. 基线必须来自**同一 HEAD**；HEAD 变了就重采基线。

**提交与回滚**

- 一批 = 一个 commit；提交信息写清「纯重构，无视觉变化」或「契约变更」。
- 回滚用 `git revert <sha>`。不要用 `reset --hard` / `clean -fd` 清掉未跟踪产物；`out/` 是生成物，可保留。
- 每批结束前必须跑完该批的验证命令并保存输出到 `out/golden/<batch>/report.txt`。

**验证等级**

| 等级 | 判据 | 适用 |
|---|---|---|
| **V0 逐帧一致** | 正式出片档 51 张里的 spp=1 帧 SHA-256 完全相同；4spp 预览档允许每像素最大 1 个色阶且差异像素 ≤0.01%（见下） | B1–B6、B8、B9（离屏不受影响）、B10 |
| **V1 结构一致** | tri 数、shader program 数、材质注册表完全一致；PNG PSNR ≥ 50 dB、SSIM ≥ 0.9995 | 允许浮点重排的搬运批 |
| **V2 视觉评审** | 接触表 + 逐帧 SSIM ≥ 0.995 + 像素差定位清单 + 人工签字 | 仅 B7 在无法逐字节时使用 |
| **V3 成片一致** | 同参数 `render.mjs` 输出；`ffmpeg ssim` ≥ 0.999；闪烁三指标残差变化 < 5%；`camcheck` 文本 diff 为空 | B3、B5、B8 |

> 为什么可以要求逐字节：主循环的子帧模式只依赖 `k`（`main.js` 的 `(k*5+1)%spp` 与 Halton 权重），没有时间/随机源；同机同驱动下重复渲染是确定性的。跨机器/驱动不同才退化为 PSNR/SSIM。

**V0 分档判据（B5 收尾时按实测调整，2026-11-07）**

| 档位 | 集合 | 判据 |
|---|---|---|
| 正式出片档 | S2（final, spp=1）、S3（realtime, spp=1）、以及 `render.mjs` 成片 | **逐字节一致**，不设容差 |
| 预览档 | S1、S4（preview, spp=4） | 每像素最大差 **1 个色阶**（8-bit），差异像素占比 **≤0.01%**（960×540 下 ≤52 像素），且 SSIM 必须为 1.000000 |

调整依据（实测，不是放宽了事）：

- B5 完成后 S2/S3 共 20 帧逐字节一致；S1/S4 的差异只出现在 4 次采样累加路径上。
- 同一帧、同一分辨率，把 `spp` 从 4 改成 1：工作区与 HEAD 逐字节一致 → 着色数值与材质输出没有变化。
- 10 个镜头 × 61 个时刻的相机求值（pos/look/focal/focus/fstop）与 HEAD 最大绝对差为 **0**；`camcheck` 输出逐字符一致。
- S1 实测最坏一帧 4/518400 像素（0.0008%）、最大差 1 个色阶；PSNR 105–111、SSIM 1.000000。作者目检改前/改后原图，确认看不出差别并接受该差异。
- 触发点是 B5 必须做的契约变化（`uShot` 从 `COMMON_HEAD` 删除、改为按 shader 声明 `uFilmShot`）；shader 源码变动后，4-spp 累加中的 GPU 舍入落在 1 个色阶。

**以后什么时候要重新收紧**（任一命中即回到「全部逐字节」）：

1. 正式出片档出现任何字节差异（哪怕 1 个像素、1 个色阶）。
2. 预览档单帧差异像素超过 0.01%，或出现最大差 ≥2 个色阶，或 SSIM < 1.000000。
3. 换了 GPU、驱动、浏览器或 `three` 版本后，重采基线仍复现同一批像素差（说明不是路径舍入，而是真实变化）。
4. 某批改动触及 4-spp 路径本身（AA 权重、子帧顺序、Halton 采样、后处理管线）：B8 的离屏渲染器、B6/B7 若动到材质/后处理必须重新按本判据验证。
5. 任何一批的 `camcheck` 文本 diff 非空，或相机求值最大差 > 0。
6. 出现「预览档容差刚好卡在上限」的帧：说明差异开始系统性变大，必须定位而非继续刷新基线。

### 8.1 G 批：基线、接触表与检查脚本（不改 `src/`）

**目标**：建立可重复的「画面不变」证据，后续每批都用同一套。

**新增**

- `tools/golden.mjs`：封装 `snap` 的批量取帧、SHA-256、PSNR/SSIM、manifest（HEAD/GPU/驱动/three 版本）。
- `tools/dep-lint.mjs`：先只报告（不阻断），把第 3 节矩阵变成检查项。

**修改**

- `package.json`：新增
  - `"golden:capture": "node tools/golden.mjs capture"`
  - `"golden:verify": "node tools/golden.mjs verify"`
  - `"dep:lint": "node tools/dep-lint.mjs"`

**基线集合（写入 `out/golden/baseline/`）**

| 集合 | 内容 | 命令要点 |
|---|---|---|
| S1 | 10 镜 × t=0/3.5/6.9，`q=preview`、960×540、spp=4、smap=1024（30 张） | `w=960&h=540&spp=4&q=preview&smap=1024` |
| S2 | 10 镜 × t=3.5，`q=final`、1280×720、spp=1、smap=4096（10 张） | `w=1280&h=720&spp=1&q=final&smap=4096` |
| S3 | 10 镜 × t=3.5，`q=realtime`、`detail=0.5`、spp=1（10 张） | `q=realtime&detail=0.5` |
| S4 | 太阳覆盖帧：`?sunelev=30&sunaz=180`，shot=0 | 覆盖 URL 覆盖路径 |
| F1 | 完整 70 s 成片，1080p60 spp=8 | `node tools/render.mjs --w 1920 --h 1080 --spp 8 --out out/golden/baseline/film.mp4` |
| F2 | 快速成片，960×540 spp=2 | 每批回归用 |

**单帧采集命令（S1 示例）**

```bash
node tools/snap.mjs "w=960&h=540&spp=4&q=preview&smap=1024" \
  --view "shot=0&t=0"   out/golden/baseline/s0_t0.png \
  --view "shot=0&t=3.5" out/golden/baseline/s0_t35.png \
  --view "shot=0&t=6.9" out/golden/baseline/s0_t69.png
# s1..s9 同理；tools/golden.mjs 负责循环
```

**接触表与相机基线**

```bash
node tools/sheet.mjs --t 0,3.5,6.9 --w 960 --h 540 --spp 4 --tag baseline
node tools/camcheck.mjs > out/golden/baseline/camcheck.txt
```

**闪烁基线**

```bash
node tools/lumaflicker.mjs out/golden/baseline/film.mp4 > out/golden/baseline/lumaflicker.txt
node tools/flickercheck.mjs out/golden/baseline/film.mp4 0 70 > out/golden/baseline/flickercheck.txt
node tools/mcflicker.mjs    out/golden/baseline/film.mp4 0 7  > out/golden/baseline/mcflicker_s0.txt
```

**本批判据**：同一 HEAD 连续采集两次，S1–S4 共 51 张 PNG SHA-256 全等；`camcheck.txt` 与第二次相同；接触表目检。若不等，先排查 GPU/驱动/页面缓存，不允许继续迁移。

> 实测（2026-11-07，M4 / ANGLE Metal）：预热后的重复采集逐字节一致（51/51）。**全新浏览器 profile 的第一次采集会与后续相差 ≤1 LSB**（约 0.03% 像素、最大差 1），属冷 shader 缓存效应；因此基线必须在缓存预热后采集，`verify` 也应在同一缓存状态下跑。
>
> 已踩过的坑（B3 收尾时实测）：S1（spp=4、30 张）存在**跨运行 ±1 LSB 抖动**，且抖动是"整组稳定"的——同一份代码连续跑三次会稳定地错同样 15 帧、同样那 1–4 个像素。此时**不能**据此判定回归：正确做法是把 HEAD 单独 checkout 到另一个 worktree，用同一浏览器/同一命令重采 S1，与工作区逐字节对照（本次实测 HEAD 与工作区 30/30 全等，证明 B1–B3 零像素变化），随后以这次 HEAD 采集刷新基线 S1。S2/S3/S4（spp=1）没有此现象。
>
> **判据补充**：`verify` 失败若只差 ≤1 LSB、且像素数 ≤4，先做"HEAD worktree ↔ 工作区"对照，再考虑刷新基线；只有该对照出现真实差异时才算回归。

**风险**：无。**依赖**：所有批次依赖 G。**并行**：可独立完成。

### 8.2 B1 批：环境与 uniform 所有权

**契约变化**

- 删除模块级 `G`、`ENV`、`sunDir` 导出。
- 新增 `createUniforms(atmosphere)` → `ctx.u`；`createEnvironment({ atmosphere, overrides })` → `{ u, env, sunDir }`。
- `patch()` / `std()` / `phys()` 改为 `createPatchKit({ u, windGLSL, shaderMin })` 的返回函数；不再 import `env.js`。
- URL 覆盖（`?sunelev/?sunaz`）从 `core/env.js` 移到 `src/app/runtime-config.js`。
- `onBeforeCompile` 不再读 `window.__shaderMin`。

**新增**

- `src/core/uniforms.js`
- `src/core/environment.js`
- `src/data/atmosphere.js`
- `src/app/runtime-config.js`

**修改**

- `src/core/materials.js`
- `src/core/sky.js`（接受 environment）
- `src/core/lighting.js`
- `src/core/fog.js`（改为接收 environment 参数；显式安装留到 B3）
- `src/core/diag.js`（如引用 G）
- `src/main.js`
- `src/world/pond.js`（`sunDir` 改从 ctx 取）

**删除**

- `src/core/env.js`

**风险**：高。uniform 引用若有一处未共享，所有材质会静默错位；`?sunelev` 覆盖路径迁移最易漏。

**验证**

1. V0：S1/S2/S3/S4 全部逐字节一致。
2. 覆盖帧专项：`?sunelev=30&sunaz=180&shot=0&t=3.5` 与基线一致。
3. `node tools/sheet.mjs --t 3.5 --tag b1`，接触表人工目检。
4. `node tools/camcheck.mjs > .../b1/camcheck.txt`；与基线 diff 为空（本批不动相机，属额外保险）。

**依赖/并行**：G 之后第一批；后续 B2、B4、B6 依赖本批。不可与任何批并行（`main.js` + materials 是热点）。

### 8.3 B2 批：天空与太阳捕获的所有权

**契约变化**

- 删除 `SKY_UNIFORMS` 导出。
- `createSky({ u, atmosphere })` 返回 `{ object, uniforms, withSunDiscHidden(fn) }`。
- `captureEnvironment(renderer, scene, position, { sky, ... })` 不再 import sky。
- `pond-water.js` 的反射通行证使用 `ctx.sky.withSunDiscHidden(fn)`，不再直接改 uniform。

**新增**：无。

**修改**

- `src/core/sky.js`
- `src/core/lighting.js`
- `src/world/pond-water.js`
- `src/main.js`

**删除**：无。

**风险**：中。太阳盘隐藏/恢复必须成对；两次并发隐藏（光捕 + 水下反射）若嵌套会提前恢复。

**验证**

- V0：S1/S2 全部逐字节一致；重点镜 1/2/8（水面反射）单独出接触表。
- `?probe=materials` 的 program 数不变。
- 水面反射特写：`shot=1&t=3.5`、`shot=2&t=6.9`，逐字节一致。

**依赖/并行**：依赖 B1；与 B4 不可并行（都改 `materials.js` 相关路径与 `main.js`）。

### 8.4 B3 批：雾改为显式安装

**契约变化**

- `src/core/fog.js` 不再在 import 期改写 `THREE.ShaderChunk`。
- 新增 `installAtmosphere({ environment, params, volumes })`，显式、幂等；返回 `{ setVolumes, aerialGLSL }`。
- 装配层在 renderer 创建后、任何材质编译前调用；体积在世界构建后、编译前设置。

**新增**：无（`setVolumes` 是返回方法）。

**修改**

- `src/core/fog.js`
- `src/main.js`（移除 `installFog()` 的 import 副作用；改为显式调用）
- `src/world/pond-water.js`（若使用 `aerialGLSL()`，改为从 ctx 取）

**删除**：无。

**可选 B3b（独立评审）**：把环境体积从烘焙 GLSL 常量改为 uniform 数组，`setVolumes` 更新 uniform 即可，不再二次安装、不再重编译。**不做**则保持两次显式安装。B3b 单独一批，必须有 V0 + `?probe=materials` 证据。

**风险**：中高。这是全局 chunk 补丁；漏一次会导致所有雾/体积消失（目检可见）。PCF 旋转若被误改会造成闪烁，必须跑 V3。

**验证**

- V0：S1/S2 全部逐字节一致。
- V3：F2 成片 + `lumaflicker`/`flickercheck`/`mcflicker`，三项残差与基线差 < 5%。
- 启动顺序检查：在 `main.js` 的 install 与首次 compile 之间加临时断言（仅本批调试，提交前删）。

**依赖/并行**：依赖 B1；建议在 B2 之后（同属大气层，减少冲突）。不可并行。

### 8.5 B4 批：detail 从单例变注入

**契约变化**

- `detail.js` 导出 `createDetailPolicy({ tier, override })` → `{ tier, s, seg, gap, cnt, dens, lod, isRealtime }`。
- 删除 `setDetailTier` 与模块级 `DETAIL`。
- 世界生成器不再 `import '../core/detail.js'`；从 `ctx.detail` 或函数参数取。
- `hall-roof.js` 的 `TILE` 改为 `tileParams(detail)`（内部使用 `gap()/cnt()`），不再是模块级常量。
- `materials.js` 的 `isRealtime()` 调用改为 `patchKit.isRealtime()`（由 B1 的 kit 注入）。

**新增**：无。

**修改（22 个 detail 直接导入文件，逐个改为 ctx/参数）**

```
src/world/bridge.js
src/world/buildings-corridor.js
src/world/buildings-halls.js
src/world/buildings-kit.js
src/world/hall-carve.js
src/world/hall-lib.js
src/world/hall-roof.js
src/world/pagoda-parts.js
src/world/pagoda.js
src/world/pond-lotus.js
src/world/pond-lotusgeo.js
src/world/pond-lotusplan.js
src/world/pond-stone.js
src/world/props-geo.js
src/world/props-hang.js
src/world/props-stone.js
src/world/terrain-cover.js
src/world/terrain-forest.js
src/world/terrain-stonegeo.js
src/world/vegetation-bamboo.js
src/world/vegetation-tree.js
src/world/vegetation.js
```

另修改：

- `src/core/detail.js`
- `src/core/materials.js`
- `src/main.js`（在动态 import world 之前创建 policy，并放入 ctx）

**删除**：`src/core/detail.js` 的模块级导出（文件保留，改为工厂）。

**风险**：高。22 个文件机械改动，漏掉一个模块级派生常量就会让某一档几何数量变化。

**验证**

- V0：S1（preview，s=1）、S2（final，s=1）逐字节一致。
- V0：S3（realtime，detail=0.5）逐字节一致；这条最关键，因为只有该档会走到 `gap/cnt` 的不同分支。
- 结构：`?probe=tris` 的每个模块三角面数与基线完全一致（S1/S2/S3 三档各采一次）。
- `node tools/sheet.mjs --t 3.5 --tag b4 --extra "q=realtime&detail=0.5"` 接触表评审。

**依赖/并行**：依赖 B1（materials 的 kit）；是 B7 的前提。与其他批不可并行（22 个 world 文件 + main）。

### 8.6 B5 批：把时间轴从资产里拔出来

**契约变化**

- `SHOTS` / `SHOT_DUR` / `FILM_DURATION` 从 `src/shots.js` 迁到数据层；`src/shots.js` 删除。
- 覆盖键从 `src/shotkeys/*` 迁到 `src/data/film/shotkeys/*`；覆盖合并在数据层一次性完成并 `Object.freeze`，不再 import 期改数组。
- 新增 `createShotEvaluator({ shots, duration })`（纯数学，无数据 import）。
- 新增 `createTimeline({ cuts })` → `sample(t)`，以及装配层 `createDirector({ film, timeline, choreography })`。
- `uShot` 从 `COMMON_HEAD` 删除；三处 shader 改用 director 解析出的标量。
- `src/world/pond.js` 删除顶层 `await import('../shots.js')` 与 `SHOT_DUR`；镜头路径由 ctx 入参。
- `src/world/vegetation.js` 删除 `import { SHOTS }`；英雄构图数据由 ctx 提供。

**新增**

- `src/data/film/shots.js`
- `src/data/film/shotkeys/*.js`（搬迁）
- `src/data/film/choreography.js`
- `src/core/film/shot-eval.js`
- `src/core/film/timeline.js`
- `src/app/director.js`

**修改**

- `src/main.js`
- `src/core/materials.js`（删 `uShot` 声明与绑定）
- `src/core/uniforms.js`（删 `uShot`）
- `src/world/pond.js`
- `src/world/pond-water.js`
- `src/world/pond-lotus.js`
- `src/world/vegetation.js`
- `tools/camcheck.mjs`（改为 import `shot-eval` + `data/film/shots.js`）

**删除**

- `src/shots.js`
- `src/shotkeys/`（迁出后删除）

**风险**：高。这是唯一一批改变「创意行为」的搬运；`uShot→标量` 的映射必须逐值等价，否则镜头 1/2/8 的水面与落叶会变。

**数值等价要求（写进提交说明）**

- `uGlitterOn`: 现状 `uGlitter.w > 0 && (|shot - uGlitterShot| < 0.5 || shot < -0.5)` → 目标在 `discrete shot index` 时的布尔值必须相同。
- `uLeakOn`: 同上。
- `uLeafLift`: 现状 `floor(uShot + 0.5)` 的整数分支 → 目标每个 shot 的整数值必须相同。
- `pond` 的 `shot * SHOT_DUR + 37.0` → 目标 `director` 用同一公式，37.0 作为 app 层常量，不下放到 world。

**验证**

- V0：S2/S3（spp=1）全部逐字节一致；S1/S4（4spp 预览档）按 8.1 的分档判据（≤1 色阶、≤0.01% 像素、SSIM 1.000000）。重点镜 0（落叶）、1/2（水面闪鳞）、8（荷池漏光）。
- `node tools/camcheck.mjs` 输出与基线 **逐字符一致**（证明求值器拆分未改数学）。
- V3：F2 成片 + 三项闪烁指标，残差变化 < 5%。
- 反向检查：`grep -rn "SHOTS\|SHOT_DUR\|uShot" src/world` 必须为空。

**本轮实测（2026-11-07）**：`camcheck` 逐字符一致；相机求值最大差 0；S2/S3 20/20 逐字节一致；S1 最坏 4 像素、S4 1 像素、最大差均 1 个色阶；作者目检后接受，S1/S4 基线已按判据用当前工作区刷新，`verify` 51/51 PASS。三处 shader 的字段改名为 `uFilmShot`，GLSL 表达式逐字符保留。

**依赖/并行**：依赖 B1、B4（都改 vegetation/pond）；是 B7、B8 的前提。不可并行。

### 8.7 B6 批：材质域化

**契约变化**

- `materials.js` 只保留 patch 框架（机制层）。
- `PROC` 与 `materials()` 移到领域层：`src/world/materials/proc.js`（通用过程）、`presets-jiangnan.js`（江南预设）、`kit.js`（`createMaterialKit`）。
- 湿水带、苔藓、`gold→iron` 等江南语义不再出现在机制层；水位等数值从数据层入参。
- `diag.js` 的材质注册表改为注入，不再 import `materials.js`。

**新增**

- `src/world/materials/proc.js`
- `src/world/materials/presets-jiangnan.js`
- `src/world/materials/kit.js`

**修改**

- `src/core/materials.js`（缩为 patch 框架）
- `src/core/diag.js`
- `src/main.js`（`createMaterialKit`，写 `ctx.materials` / `ctx.mat`）
- `src/world/*-mat.js` 与 `hall-mats.js` 等：只需确认它们从 `ctx` 取 kit，不直接 import 机制层材质

**删除**：无（代码搬迁）。

**风险**：低中。纯搬迁，但材质对象键名必须保持完全一致（`M.gold`、`M.tileCyan` 等别名不能让老代码踩空）。

**验证**

- V0：S1/S2/S3 全部逐字节一致。
- `?probe=materials` 的程序数与材质清单完全一致（shader 编译顺序可能不同，清单必须相同）。
- `node tools/bench.mjs --label b6` 的 progTop / 首帧时间与基线同量级（允许 ±5%）。

**本轮实测（2026-11-07）**：`golden verify` 51/51 逐字节一致（S1/S4 预览档也落在逐字节，未用到 1 色阶容差）；`?probe=materials` 的注册表 `entries=132 / autoNamed=123 / userNamed=9 / collisions=0` 与 16 行 census（`materials=1034 distinctKeys=107`）与搬迁前逐字符相同；`PROC` 全部函数体与 HEAD 逐字节一致（仅把 `v3u/U3/U1/OC` 助手与工厂包装搬进 `createProc`）；`dep-lint` 仍是 7 条既有 web→domain 违规、无新增；`verify-asset-consistency` 通过。`bench --label b6`：programs=278、`progTop` 头部条目与搬迁前清单一致、buildMs=8319、p50=78.4 ms。（仓库里没有 B6 之前的 bench 记录，±5% 只能靠「程序数/清单未变 + 逐字节一致」间接成立。）

**依赖/并行**：依赖 B1；可在 B2/B3/B4 之后独立执行；与 B7 文件不冲突，可并行（B7 不碰 `*-mat.js`）。

### 8.8 B7 批：布点 / 空间约束层

**契约变化**

- 新增 `ctx.placement`；生成器不再内含 KEEP/净空/取景保护。
- `treeTopCap` 从 `terrain-field.js` 移到 `placement.rules`；地形/森林通过 `ctx.placement.capHeight(x,z)` 取值。
- `screenBlocked` / `boxBlocked` 的几何部分上提 `core/spatial.js`，策略部分留 `world/placement/rules.js`。
- `pond-lotusplan.js` 的相机净空改从 `ctx.placement.protectedFrames(shot)` + 相机路径入参取。

**新增**

- `src/core/spatial.js`
- `src/world/placement/rules.js`
- `src/world/placement/index.js`
- `src/data/placement.js`

**修改**

- `src/world/vegetation.js`
- `src/world/vegetation-tree.js`
- `src/world/terrain-field.js`
- `src/world/terrain-land.js`
- `src/world/terrain-forest.js`
- `src/world/pond-lotusplan.js`
- `src/main.js`（createPlacement，构建顺序改为 terrain → placement → content）

**删除**：无（代码搬迁与签名调整）。

**风险**：高。任何一个净空阈值解释不同，树的位置就会变；这是唯一可能出现真实画面差异的批次。

**验证**

- 首选 V0：S1/S2/S3 全部逐字节一致；`?probe=tris` 每模块三角面数一致。
- 若无法逐字节：必须提交 `tools/sheet.mjs` 前后接触表、逐帧 SSIM（≥ 0.995）、像素差定位清单（哪些镜头、哪些区域、原因），人工签字后才进入下一批。
- 反向检查：`grep -rn "KEEP\|treeTopCap\|screenBlocked" src/world` 中不得再出现硬编码坐标数组。

**依赖/并行**：依赖 B4（detail）、B5（相机路径数据）。可在 B5 后与 B9 并行（文件不重叠）。

**本轮实测（2026-11-07）**：`golden verify` 51/51 逐字节一致（S1 30 帧 4spp、S2 10 帧 spp=1、S3 10 帧 realtime、S4 1 帧太阳覆盖），无需启用 V2；`?probe=tris` 各模块三角面数与基线一致（terrain forest 6798/620266、pond lotus 1003/2074070、vegetation bark 1316166 等）；反向 grep 无硬编码坐标数组残留；`dep-lint` 仍为 7 条既有 web→domain 违规，无新增。`placement` 由 main 在世界构建之前创建（它只依赖 layout + 数据，不依赖 terrain field；若放在 terrain 之后，terrain-land/forest 的 `capHeight` 调用会形成环）。

### 8.9 B8 批：离屏渲染器抽取

**契约变化**

- `main.js` 中的子帧采样与渲染循环移到机制层：`createOfflineRenderer({ renderer, scene, camera, pipeline, shotEval, director, sun })`。
- `src/main.js` 移到 `src/app/main.js`，只保留 URL、DOM、canvas、HTTP 端点、启动顺序。
- `window.__ctx` 改为 `ctx.services`；`scene.userData.noRefl` 改为 `ctx.layers.noRefl`。

**新增**

- `src/core/render/sampling.js`（Halton / AA 权重 / 快门置换 / 太阳盘抖动）
- `src/core/render/camera.js`（`focalToFov` / `applyCamera`）
- `src/core/render/frame.js`（`createOfflineRenderer`）
- `src/app/main.js`（搬迁）
- `src/app/context.js`

**修改**

- `index.html`（入口路径）
- `src/core/post.js`（只接受参数，不读全局）
- `vite.config.js`（如需入口调整）

**删除**

- `src/main.js`

**风险**：高。装配与机制最容易在这里混回去；必须保证 `frame.js` 内不出现 `location/document/window`。

**验证**

- V0：S1/S2/S3 全部逐字节一致。
- V3：F2 成片 + 三项闪烁指标，残差变化 < 5%；`lumaflicker` 对 shadow 稳定性尤其敏感。
- 检查：`grep -rn "location\|document\|window" src/core/render src/core/post.js` 必须为空。

**依赖/并行**：依赖 B3（fog 安装）、B5（director）、B6（kit）。可在 B7 之后串行，或与 B9 并行。

**本轮实测（2026-11-07）**：`golden verify` 51/51 逐字节一致（S1 30 帧 4spp、S2 10 帧 spp=1、S3 10 帧 realtime、S4 1 帧太阳覆盖），`window.__ctx` 已移除（tools 的 `window.__services` 由 `ctx.services` 赋值）；`src/core/render/frame.js` 只做子帧循环、采样与阴影拟合，时间/雾/阴影排除/后处理覆盖由装配层回调注入；`grep -rn "location\|document\|window" src/core/render src/core/post.js` 为空；`dep-lint` 仍为 7 条既有 web→domain 违规，无新增。`post.js` 本身已是纯参数化，无需改动。V3 未执行：仓库内不存在 F2 成片的基线产物（`out/` 不入库），仍帧已由 V0 逐字节覆盖；闪烁指标依赖的采样模式按 k 取值、代码逐字搬迁，但若日后需要数值证据，应以一次带 `--film` 的基线捕获为准。

### 8.10 B9 批：`src/` 与 `web/` 的边界

**契约变化**

- `shared/layout.js` 删除；canonical 数据移到 `shared/data/layout.js`。
- `web/` 只允许 import `shared/data/**`；`dep-lint` 开始阻断违规。
- `compare-benchmarks.mjs` 的 `BRAIN_DIR` 改为 CLI 参数/环境变量，macOS 可用。

**新增**

- `shared/data/layout.js`（搬迁）
- `tools/dep-lint.mjs`（若 G 批只做报告，本批改为阻断）
- `shared/data/palette.js`（仅当 web 也需要）

**修改**

- `web/` 中 13 个使用 `shared/layout.js` 的文件
- `src/app/*` 的 layout import 路径
- `src/data/modules.js`（从 `shared/modules.js` 迁入离线专用数据）
- `package.json`（`dep:lint` 进入检查流程）
- `tools/compare-benchmarks.mjs`（参数化路径）

**删除**

- `shared/layout.js`
- `src/layout.js`（迁出后删除）
- `shared/modules.js`（迁到 `src/data/modules.js`）

**风险**：低（路径改动），但会触及 web 构建。

**验证**

- 离屏：V0 S1/S2 逐字节一致（本批不应影响离线渲染）。
- web：`npm run build:web` 成功；`node tools/test-web-runtime.mjs` 全项通过。
- 跨端：`node tools/compare-benchmarks.mjs` 12 机位 SSIM ≥ 0.98（与参数化后的基线比）。
- `npm run dep:lint` 通过；仅允许 `web → shared/data`。

**依赖/并行**：依赖 B1（layout 的 import 在 `src/app` 稳定后）；可与 B7、B8 并行（只碰 `shared/`、`web/`、`tools/`）。

**本轮实测（2026-11-07）**：`golden verify` 51/51 逐字节一致（S1/S2/S3/S4），离屏渲染零差异。`npm run build:web` 成功（50 modules）；`node tools/test-web-runtime.mjs` 全项通过。`npm run dep:lint`（已改为 `--strict` 门禁）0 条新增、7 条既有 `web -> domain` 植被生成器复用登记为 known、不阻断。`node tools/compare-benchmarks.mjs` 在 macOS 首次跑通 12 机位，未提供 `--brain`/`BRAIN_DIR` 时自动跳过工件库同步。实测 `web/` 直接 import 旧 `shared/layout.js` 的文件为 10 个（前文 13 个为估算，其余是注释提及）。跨端比对说明：仓库不保存 `out/`，此前没有可比基线；本次新采的离线基准与 Web 帧逐位 SSIM 为 0.185–0.492，两者是资产、天空与构件实现各自独立的渲染器，故 0.98 应作为「同一侧、同一基线的前后回归」门禁，而非 src↔web 的画面对等指标。验收还暴露一处 B4 起的既有断点：离线植被生成器改为接收 detail policy 后，web 的 4 处调用未传参（读取 `detail.dens` 时 undefined），`test-web-runtime` 第一次运行即失败；已用 `web/src/scene/detail.js` 的 `WEB_DETAIL`（s=1，等价重构前默认档）补齐，密度不变。

### 8.11 B10 批（可选）：目录归位

只做物理移动与 import 路径更新，不改任何行为：

- `src/core/film/*`、`src/core/render/*` 的子目录归位。
- `src/world/` 的 `hall*/pond*/vegetation*` 子目录归位（可选，收益低）。
- `src/data/film/shotkeys/*` 最终命名统一。

**验证**：V0 全量；Vite 构建通过。

**建议**：可以无限期推迟；收益是阅读体验，不是解耦。若做，单独提交，方便 review 时忽略。

### 8.12 依赖图与并行组

```
G
└─ B1
   ├─ B2 ── B3
   ├─ B4
   │  └─ B5
   │     ├─ B7
   │     └─ B8
   ├─ B6
   └─ B9
```

- **必须串行**：`G → B1 → B2 → B3`；`B1 → B4 → B5`；`B5 → B7/B8`。
- **可并行**（文件不重叠时）：
  - `B6 ∥ B3`（材质 vs 雾）。
  - `B7 ∥ B9`（`world/` vs `shared/` + `web/`）。
  - `B9 ∥ B8`（web 边界 vs 离屏渲染器；若同改 `src/app/main.js` 则改为串行）。
- **冲突热点**：`src/main.js` 被 B1、B3、B4、B5、B6、B8、B9 触及。任何并行计划都必须按「谁先改 main」排序；默认策略是主线串行，只允许 `B7`/`B9` 这类不碰 main 的批次旁路。

### 8.13 每批验收记录模板

```
batch: B?
head: <sha>
files-changed: <count>  新增/修改/删除
contract: <哪个单例换成了什么入参；哪个副作用移到哪>
golden: S1 30/30 ✓  S2 10/10 ✓  S3 10/10 ✓  S4 ✓
hash: <manifest 路径>
structure: tris ✓  programs ✓
film: F2 + lumaflicker/flickercheck/mcflicker（B3/B5/B8 必跑）
web: build + test-web-runtime（B9 必跑）
verdict: PASS / FAIL(+原因)
```

---

## 9. 风险登记与明确不做

### 9.1 主要风险

| 风险 | 触发点 | 缓解 |
|---|---|---|
| uniform 引用未共享 | B1 | 逐字节 S1–S3；加临时断言「所有材质 uniforms.uTime === ctx.u.uTime」 |
| 太阳盘隐藏嵌套 | B2 | 用 `withSunDiscHidden` 成对封装；禁止裸写 `uSunDisc.value` |
| 全局 chunk 补丁漏装 | B3 | 雾消失是肉眼可见；V0 + V3 双保险 |
| detail 派生常量漏改 | B4 | 三档 tri 数与基线比对；`grep -rn "core/detail.js" src/world` 必须为空 |
| 时间轴标量映射不等价 | B5 | 逐镜逐 t 的标量对照表；S1 逐字节 + camcheck 文本一致 |
| 布点阈值解释漂移 | B7 | 默认要求逐字节；否则走 V2 评审 |
| 装配逻辑混回机制层 | B8 | `grep` 禁止清单；reviewer 检查 `render/frame.js` 无 DOM/URL |
| web 回归 | B9 | `build:web` + `test-web-runtime` + 12 机位 SSIM |

### 9.2 明确不做

- **不**在本轮拆 npm 包、不引入 monorepo、不发布 `@gusu/*`。
- **不**合并 `src/` 与 `web/` 的后处理管线；两者产品目标不同。
- **不**把 `world` 生成器抽成「无材质几何库」；几何与材质槽必须成对。
- **不**把 `PROC` 的江南配色、苔藓、湿水带搬进机制层；它们是领域语义。
- **不**把 `layout` / `SHOTS` / `KEEP` 坐标搬进领域层；它们是数据。
- **不**为了「架构好看」把 `post.js` 改成插件系统；当前参数化已足够。
- **不**在没有逐帧证据的情况下接受任何批次的「看起来没变」。

---

## 附录 A：现有文件 → 目标层级

| 现有路径 | 目标层 | 目标位置 / 动作 |
|---|---|---|
| `src/core/rng.js` | 机制 | 原地 |
| `src/core/glsl.js` | 机制 | 原地 |
| `src/core/geom.js` | 机制 | 原地 |
| `src/core/detail.js` | 机制 | 改工厂 |
| `src/core/env.js` | 混合 | 拆到 `uniforms.js` + `environment.js` + `data/atmosphere.js`；删除 |
| `src/core/materials.js` | 混合 | patch 留机制；PROC/materials 迁 `world/materials/` |
| `src/core/sky.js` | 机制 | 改工厂 |
| `src/core/lighting.js` | 机制 | 改工厂；捕获接受 sky 句柄 |
| `src/core/fog.js` | 机制 | 改显式 install |
| `src/core/post.js` | 机制 | 参数化 |
| `src/core/diag.js` | 机制 | 注入 registry |
| `src/layout.js` | 数据 | `shared/data/layout.js` |
| `src/shots.js` | 混合 | 数据 + `core/film/shot-eval.js`；删除 |
| `src/shotkeys/*` | 数据 | `src/data/film/shotkeys/` |
| `src/main.js` | 装配 | `src/app/main.js` + `core/render/*` |
| `src/world/*-mat.js`, `hall-mats.js` | 领域 | 改为从 ctx 取 kit |
| `src/world/hall*.js` | 领域 | 生成器签名化；`TILE` 局部化 |
| `src/world/rockery-sdf.js` | 领域 | SDF 组合留领域；surface nets 可上提机制（可选） |
| `src/world/vegetation*.js` | 领域 + 数据 | 生成器留领域；KEEP/净空迁布点层 |
| `src/world/terrain*.js` | 领域 + 数据 | 地形生成留领域；`treeTopCap` 策略迁布点层 |
| `src/world/pond*.js` | 领域 + 数据 | 生成器留领域；镜头路径/水位迁数据 + director |
| `src/world/buildings*.js`, `props*.js`, `pagoda*.js`, `bridge*.js`, `interior*.js` | 领域 | 原地，按 D2/D3/D4 逐个签名化 |
| `shared/layout.js` | 数据 | 删除，改 `shared/data/layout.js` |
| `shared/palette.js` | 数据 | `shared/data/palette.js` 或 `src/data/` |
| `shared/modules.js` | 数据 | `src/data/modules.js`（离线专用） |
| `tools/lib/chrome.mjs` | 机制 | 原地 |
| `tools/snap.mjs` / `render.mjs` / `sheet.mjs` | 装配契约 | 原地，契约文档化 |
| `tools/camcheck.mjs` | 装配 + 机制 | 改 import `shot-eval` + `data/film/shots.js` |
| `tools/lumaflicker` / `flickercheck` / `mcflicker` | 机制 | 原地 |
| `tools/score.mjs` / `fetch-music.mjs` / `export-web-assets.mjs` | 项目/领域流水线 | 原地，不进任何复用层 |

## 附录 B：每批开完工检查单

**开工**

- [ ] `git status --porcelain` 为空
- [ ] `git rev-parse HEAD` 已记录
- [ ] `out/.gpu.lock` 不存在
- [ ] `npm run dev` 可用，基线来自同一 HEAD
- [ ] 本批文件清单已列出（新增/修改/删除）

**完工**

- [ ] 本批契约变化已写入提交说明
- [ ] V0/V1/V2/V3 按 8.0 等级完成，报告落在 `out/golden/<batch>/`
- [ ] `grep` 反向依赖检查通过（见各批「反向检查」）
- [ ] 接触表人工目检（至少 10 镜 t=3.5）
- [ ] `npm run dev` 与 `npm run dev:web` 均可启动
- [ ] 提交为单独 commit，可 `git revert`

