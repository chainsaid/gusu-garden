# 姑苏园林（Gusu Garden）渐进式重构计划

## 概述与指导原则

本计划旨在将现有的程序化 3D 引擎从“日式禅宗佛寺”平滑演进为具有纯正美学风骨的**姑苏古典园林（江南私家园林）**。

### 核心原则
1. **纯代码程序化保全**：严守零外部模型、零图片贴图的底线，一切形态与纹理由 JavaScript 几何算法与 GLSL 程序化生成。
2. **渐进式演进（Progressive Refactoring）**：
   - **前中期先保稳定性**：不破坏既有 `layout.js` 坐标基准、运镜流水线与渲染通道，确保每一步修改都“随时能跑、立即可见”。
   - **后期深挖意境**：循序推进假山、竹蕉、室内雅集、借景与专属分镜。

> **2026-10-23 全仓审计说明**
>
> 阶段一 ~ 阶段七的**材质颜色层、植被补充层、室内陈设层、分镜层**改造已实质落地（竹/芭蕉/垂柳、太湖石假山与叠石驳岸、文人书房、吴王靠、漏窗、苏式长窗、嫩戗发戗均已生效）。
>
> 但复查发现：**几何形制层几乎原封未动，文案层完全未同步**。当前的观感是“远看粉墙黛瓦、近看全是日本寺社剪影”。
>
> 因此本文已按复查结果**修正各阶段勾选状态**，并在末尾新增 **阶段八：去日化收尾（审计清单）**——它是当前唯一的权威待办清单，按 P0 / P1 / P2 逐条推进。

---

## 重构路线全景图

```mermaid
flowchart TD
    P1["阶段一：视觉基调与材质去日化\n(保留layout / 原位换材质 / 拔除特征日式构件)"] --> P2["阶段二：建筑构件形制深化\n(嫩戗发戗起翘 / 落地长窗 / 回廊白墙镂空漏窗)"]
    P2 --> P3["阶段三：园林专属植物生态\n(修竹丛 / 雨打芭蕉 / 垂柳依依)"]
    P3 --> P4["阶段四：太湖石与叠石假山\n(Worker SDF 3D分形腐蚀 / 皱漏瘦透 / 湖石驳岸)"]
    P4 --> P5["阶段五：文人雅集室内陈设\n(撤佛堂 / 条案太师椅 / 隔扇中堂 / 博古架)"]
    P5 --> P6["阶段六：空间总规与造园深化\n(曲水环廊 / 移塔为'借景' / 曲桥)"]
    P6 --> P7["阶段七：分镜重铸与成片输出\n(10组江南意境镜头 / 丝竹配乐 / 1080p60离线渲染)"]
    P7 --> P8["阶段八：去日化收尾\n(P0 几何形制 / P1 命名术语 / P2 文档产物)"]
```

---

## 阶段详解与工作拆解

### 阶段一：视觉基调与材质去日化（原位材质换血）
> **目标**：不改动任何坐标网格与摄像机，通过材质翻转和特征构件剔除，瞬间洗掉“日本寺庙味”，确立粉墙黛瓦基调。

- [x] **1.1 扩展核心材质库 (`src/core/materials.js`)**
  - 新增 `M.plasterWhite`（江南白粉墙）：微弱漫射水痕、极细龟裂纹理与轻度泛碱法线。
  - 新增 `M.tileCyan`（小青瓦）：青灰哑光、边缘细腻的阴阳瓦层叠感。
  - 新增 `M.woodChestnut`（栗壳色/黑褐色桐油木）：替换高饱和度朱红漆。
  - 新增 `M.stoneCyan`（青石/条石）：青灰水磨质感，用于台基与驳岸。
- [x] **1.2 建筑皮肤全局替换 (`hall-mats.js`, `buildings-mat.js`)**
  - 将柱、枋、桁等朱红漆构件全面改用栗壳木色。
  - 将所有錾金铜饰（金物）隐去或转为暗哑熟铁/木雕本色（`buildings-mat.js` 的 `H.gold` / `H.cap` 均走 `giltHooks({ base: 'vec3(0.08,0.078,0.075)' })` 熟铁底，见 **P0-18**）。
  - 大殿与回廊墙体换为白粉墙。
- [x] **1.3 拔除典型日式构件**
  - 从主殿装配逻辑中剥离 **唐破风抱厦**（`src/world/hall-kara.js`）。 ✅（已删除，见 **P0-6 / P2-8**）
  - 剔除桥梁金铜拟宝珠，将太鼓木桥置换为素雅青石平拱桥（`src/world/bridge.js`）。 ✅（矢高收敛 1.55 m、柱头改青石莲瓣，见 **P0-10 / P0-15**）
  - 弱化五重塔九环金顶相轮反光。 ✅（相轮整体重写为北宋铸铁塔刹，见 **P0-1**）
- [x] **1.4 采光氛围微调 (`src/core/env.js`, `sky.js`)**
  - 太阳角度微调，减弱过于强烈的日落金光，增加水汽漫射湿润感。

---

### 阶段二：建筑构件形制深化（江南古建风骨）
> **目标**：在现有占地面积内，重构建筑几何外形，呈现轻灵飘逸的江南建筑语汇。

- [x] **2.1 飞檐发戗算法 (`hall-roof.js`, `pagoda-parts.js`, `buildings-kit.js`)**
  - 重构翼角曲率计算函数，实现江南特有的“嫩戗发戗”高起翘（戗角反翘），取代日式屋檐的平直沉重。
  - `hall-roof.js` 的 `makeWarp()` 已落地并在 `hall.js` 两处屋面（重檐上下檐）生效；塔与侧厅檐口起翘及屋脊螭吻已随 **P0-8** 落地。
- [x] **2.2 落地长窗与格扇门 (`hall-body.js`)**
  - 废弃日式格子障子门。
  - 算法生成标准的江南格扇长窗（含上部绦环板、格心步步锦/冰裂纹，下部抹头与裙板）。
- [x] **2.3 漫步游廊与镂空漏窗 (`buildings-corridor.js`)**
  - 回廊靠外侧立起白粉墙。
  - 墙面程序化镂空挖孔：海棠形、八角形、扇面形、六角形漏窗，窗心加入冰裂纹木质棂条。
- [x] **2.4 临水水榭与小品改造 (`buildings.js`, `props.js`)**
  - 观景亭重塑为临水水榭，三面设落地长窗，面水一侧增设弧形美人靠（吴王靠）。 ✅
  - 去除日式石灯笼，精简为江南石笋、素面石鼓墩与庭院古井。 ✅（见 **P0-3 / P0-17 / P0-17b**）

---

### 阶段三：园林专属植物生态（竹蕉柳成荫）
> **目标**：植入江南私家园林不可或缺的文人植物体系。

- [x] **3.1 修竹林生成器 (`src/world/vegetation-bamboo.js`)**
  - 细长圆柱竹竿（参数化节瘤凹凸）+ 顶端簇生竹叶卡片。
  - Instancing 批量排布在粉墙角隅、廊道漏窗外，营造“斑竹半帘”意向。
- [x] **3.2 雨打芭蕉生成器 (`src/world/vegetation-banana.js`)**
  - 大曲率叶柄放样 + 宽阔微垂叶片几何。
  - GLSL 次表面散射（Translucency）与羽状主副叶脉凹凸，布置于庭院阴湿处或书房窗前。
- [x] **3.3 岸边垂柳生成器 (`src/world/vegetation-willow.js`)**
  - 扭曲倾斜树干 + 垂挂柔性柳丝串联叶片，顶点着色器加入微风拂动动画。
- [x] **3.4 现有树木重整 (`vegetation.js`)**
  - 原有黑松修剪为具有盆景意味的临水罗汉松、卧石老松；精选红枫与紫藤点缀。 ✅（`genPine` 已改自然形古松，见 **P0-13 / P0-TREE-1**）
  - 刈込球（杜鹃球/黄杨球）已全域置换为江南灌木自然丛生 → 见 **P0-SHRUB-1/2/3**

---

### 阶段四：太湖石与叠石假山（全案技术制高点）
> **目标**：用纯数学算法还原“皱、漏、瘦、透”的太湖石艺术。

- [x] **4.1 多线程 SDF 假山生成引擎 (`src/world/rockery-sdf.js`)**
  - 基于隐式三维场 + 快速 Surface Nets 提取封闭网格，分析法线梯度与顶点烘焙 AO。
  - GLSL 太湖石着色器（溶蚀水痕水流沟槽 + 凹穴氧化黄斑 + 向上积土生苔 + 水面水痕浸润）。
- [x] **4.2 独立立峰特写（如冠云峰、玉玲珑）**
  - 构筑庭院冠云峰（带雕花须弥座）及回廊漏窗对景小石峰、水面立峰。
- [x] **4.3 湖石驳岸与水矶 (`src/world/pond-stone.js`)**
  - 替换池塘原有的日式规整块石条墙，生成参差交错的叠石驳岸、探头石/挑石与伸入水面的水矶群。
  - `rockeryEmbankment()` 已生效（`pond-stone.js:310`，`buildPondStone` 内逐段调用）；广场侧与桥头驳岸已随 **P1-6** 统一为叠石驳岸。

---

### 阶段五：文人雅集室内陈设（室雅楠香）
> **目标**：将大殿内殿彻底改为明清文人待客、抚琴、品茗、读书的诗意空间。

- [x] **5.1 移除佛殿造像与法器**
  - 下线阿弥陀佛金铜大像、背光、须弥坛供桌与榻榻米草席。 ✅（死代码已随 **P2-8** 全部删除）
  - 室内障子门与格天井已改江南隔扇（明瓦/绢背）与前后卷棚轩 → 见 **P0-11 / P0-12**
- [x] **5.2 文人中堂与家具生成 (`interior-scholar.js`, `interior.js`)**
  - 算法生成水墨中堂大轴山水画（纯 Canvas 墨分五色题跋朱印）与黑漆金字对联（“清风明月本无价，近水远山皆有情”）。
  - 构筑明式红木翘头条案、宣德三足香炉（带袅袅青烟）、青花梅瓶、八仙方桌与四出头太师椅/官帽椅。
  - 东厢设琴台与七弦古琴，西厢设罗汉床（带炕几）与万卷博古宝格架。
- [x] **5.3 室内穿堂光束（丁达尔天光）**
  - 阳光穿透落地长窗冰裂纹与步步锦花格，投射在水磨金砖地面上的流动光影与尘埃浮动。

---

### 阶段六：空间总规与造园深化（步移景异，可选深入）
> **目标**：脱离原位替换，彻底重铸苏州园林非对称造园规制。

- [x] **6.1 空间布局重划 (`src/layout.js`)**
  - 水院环池造景，去除日式樱花树（替换为古松与红枫），消除落花漂移与色斑，芭蕉与翠竹环廊相映。 ✅（樱花纹理已重构为碧桃/红梅，内部 species 名亦已改名 `peach`，见 **P0-14**）
  - 广场枯山水白砂已改青石板铺地与花街地坪，三尊石组改太湖石立峰组 → 见 **P0-4 / P0-5**
- [x] **6.2 五重塔“借景”与对景体系 (`src/layout.js`, `src/world/props.js`)**
  - 构建“借景北寺塔”远眺水镜倒影、“漏窗对景立峰”、“太湖石透望对岸水榭”多层立体景深空间。 ✅（塔已移出园外 WNW，改九层八角北寺塔，见 **P0-1 / P0-2 / P0-2b**）
- [x] **6.3 自然水岸与石桥融合 (`src/world/pond-stone.js`)**
  - 挑石驳岸、水矶自然嵌合池缘，形成贴近水面的亲水园林水体景观。 ✅；桥已改江南青石平拱桥（见 **P0-15**）

---

### 阶段七：分镜重铸、配乐与成片输出
> **目标**：完成 70 秒 1080p60 影视级古风画卷渲染。

- [x] **7.1 10 组江南意境分镜设计 (`src/shots.js`, `src/shotkeys/`)**
  - **Shot 0 (0:00)**：漏窗窥荷（从竹影海棠漏窗穿过，远焦拉出水池全景）
  - **Shot 1 (0:07)**：晨露荷花（微距荷花花蕊特写，低空滑行至石桥与叠石驳岸）
  - **Shot 2 (0:14)**：芭蕉听雨（逆光芭蕉叶水滴滑落，摇镜至书斋长窗）
  - **Shot 3 (0:21)**：太湖石透（穿过冠云峰石峰空洞，聚焦对岸水榭）
  - **Shot 4 (0:28)**：漫步曲廊（沿粉墙竹影与漏窗低速推移）
  - **Shot 5 (0:35)**：飞檐发戗（斜插仰拍歇山顶高翘角梁与风铎）
  - **Shot 6 (0:42)**：文人书斋（推门入室，扫过红木条案、古琴、中堂水墨山水与对联）
  - **Shot 7 (0:49)**：柳影拂水（水榭美人靠凭栏处，垂柳如丝轻拂绿水微波）
  - **Shot 8 (0:56)**：倒影借景（水面倒映的远塔与石桥涟漪）
  - **Shot 9 (1:03)**：暮色江南（大摇臂高空升起，俯瞰整座水院的粉墙黛瓦与烟水雾霭）
  - 经过 `node tools/camcheck.mjs` 检测，全 10 镜头平滑度与角加速度 100% 达标通过。
  - 镜头文案（风铎/借景北寺塔/翘头条案）已随 **P1-4** 全部校正。
- [x] **7.2 配乐定制与对齐 (`tools/score.mjs`)** — **正式成片已交付**（2026-10-29）
  - 用 `npm run fetch-music` 取回 "Finding Movement"（Kevin MacLeod, CC BY 4.0，4.4 MB，SHA256 校验通过），`score.mjs` 按 70 s 剪辑点拼接：弦乐渐强落 28 s 切点、最强击落 42 s 入书斋，交叉淡入 38–41 s / 39–40.5 s，整体淡出 67.5–70 s，−16 LUFS 归一后 AAC 混流。
  - 2026-10-29 草稿复测：`I = −15.7 LUFS`、`LRA 7.0 LU`、`True peak −1.4 dBFS`，音频流 48 kHz 立体声，时长 70.000 s ✅
- [x] **7.3 质量检测与成片交付** — **正式 1080p60 成片已交付**（2026-10-29）
  - `camcheck.mjs` 全 10 镜头复核通过（速度/转向/角加速度无尖峰，最高 19.60 m/s 在 shot 9 摇臂升起段）。
  - `render.mjs --spp 2 --w 960 --h 540` 渲染 70 s 草稿：4,200 帧 / 19.4 min / 0.28 s 帧，`out/gusu-garden-draft.mp4`，ffprobe 校验 70.000 s、60 fps、960×540。
  - `lumaflicker.mjs` 复检草稿：分区均值 0.2045/255，最差 16.01 @ 52.53 s（水面高光，2 spp 草稿噪声偏大）✅
  - **正式成片**：`render.mjs --w 1920 --h 1080 --fps 60 --spp 8`（4200 帧 / 66.0 min / 0.94 s 帧，M4 GPU）→ `out/gusu-garden.mp4`（268 MB，ffprobe 校验 70.000 s、60 fps、1920×1080）→ `score.mjs` 混流 `out/gusu-garden_final.mp4`（270 MB，AAC 48 kHz 立体声，70.000 s）；`lumaflicker.mjs` 复检正片：均值 0.1855/255，最差 14.629 @ 33.90 s（shot 5 桥面水光）✅

---

### 阶段八：去日化收尾（审计清单 · 2026-10-23）
> **目标**：清掉“材质已江南、形制仍东洋”的落差，并让文档、命名、产物与代码对齐。
>
> 图例：**状态 = 渲染中**（画面里能看到）/ **死代码**（不渲染但残留）。
> 推进顺序：先 P0（改几何，逐批 `npm run dev` 目视确认），再 P1（改名，零风险），最后 P2（文档与清理）。

#### P0 — 建筑与器物的日式几何（视觉冲击最大）

- [x] **P0-1** 五重塔**相轮 sorin** — 已改为中式 **塔刹**：`pagoda.js` 的 `spire()` 重写为 露盘 + 覆钵 + 仰莲 + **7 道相轮**（更薄的铁箍带，无挂铃）+ **宝盖** + **火焰珠**（球体 + 8 片火焰舌）。删掉 水烟 suien、龙车、九轮挂铃、四角锁链 kusari 与其风铃
- [x] **P0-2** 五重塔 → **借景·北寺塔** — `layout.js` 移到园外 WNW `[-105, 0, -48]`（离厅堂 ~118 m，地面 0.68 m），改为 **9 层**、baseWidth 8.2、shrink 0.90、层高加高 → 总高 **54.9 m**（瘦高比 6.7）；`makeStoreys` 的 `kk` 补到 9 项；`pagoda.js` 根部 y 改从 `ctx.modules.terrain.heightAt()` 取样（园外无网格）；`shots.js:122` 与 `shotkeys/pond.js:27` 的 look 改 `[-105, 28, -48]`、focus 150（实测方位偏差仅 0.05°）
- [x] **P0-2b** 北寺塔**八角化** — 已改为正八边形平面，`pagoda.js` 不再有 4 边假设：
  - 新增边数参数 `L.pagoda.sides = 8`，导出 `TAN = tan(pi/NS)` / `SEC = 1/cos(pi/NS)` / `SN` / `CS`；`R[]` 改为 NS 个 `TAU/NS` 旋转
  - 严格区分**内切半径（apothem）`s.a`** 与**单面横向半宽 `s.h = s.a * TAN`**：原来方形下两者相等，所有横向坐标（柱位、开间、梁长、栏杆、平坐）改用 `h`，所有出挑方向坐标（墙平面、出跳 p1/p2/p3、檐口）仍用 `a`
  - `s.Xc`（檐角横向坐标）改为 `(a + O + flare) * TAN`
  - 角科斜向：`sq2 = Math.SQRT2` → `SEC`；`dpos/老角梁/戗脊` 的 `(±d, d)` → `(±d*TAN, d)`；对角臂方向 `1/sq2` → `SN`/`CS`；螭吻与风铎的 `-π/4` → `-π/NS`
  - 每面开间由 3 间改为 **1 间**（角柱 + 槏柱），台基与平坐楼板由方盒改为 NS 棱柱；楼梯只保留在 4 个正向面
  - 校验：相邻两面檐角间距 **0.0000 m**、墙角半径 = `a*SEC`、檐角半径 = `(a+O+flare)*SEC`、`h/a = 0.4142` — 平面严格闭合
- [x] **P0-3** **16 座春日灯笼 kasuga-dōrō**（带发光纸窗 + 火点光）— 已删除并替换为江南石景小品：`props-stone.js` 重写为 石笋 / 石鼓墩 / 散置湖石 三种生成器；`layout.js` 字段 `stoneLanterns → stoneStands`；`props.js` `placeStoneLanterns → placeStoneStands`（不再生成纸窗与火点光）；`terrain-field.js` `lanterns/sdLanterns → stands/sdStands`、`shoreLanterns → shoreStands`；`terrain-ground.js` `uLant → uStands`；`terrain-cover.js`、`vegetation.js`（`lanternR → standR`）同步
- [x] **P0-4** **枯山水耙纹白砂** — 已完成（2026-10-29 补齐两处漏网）：`terrain-ground.js` 废弃 `tg_rake*` 积分与白砂条纹、改为**青石板铺地**（石板错缝、潮湿水痕与泛碱青苔），`terrain-field.js` 移除 `gRake` 与 `rakeDist` 全链路；**甬道两侧的耙砂肩带**（`tg_yongdao()` 的 `cos(6.2831853 * sx / 0.12)` 耙沟 + 白砂色 `vec3(0.56,0.54,0.50)`）已重写为**仄砖镶边 + 青灰碎石散铺**（**P0-GROUND-1**）；「花街地坪」已实现为 `tg_huajie()` 卵石万字/鱼鳞/冰裂/海棠拼花（**P0-GROUND-5**）
- [x] **P0-5** **枯山水三尊石组** — 已改为**庭院太湖石立峰与石笋组**：`terrain-cover.js` 重构 `ISLES` 石组分布，由日式三尊石组改为中式高耸立峰、伴石与散置湖石
- [x] **P0-6** 主厅正面**千鸟破风 chidori-hafu** — 已停用（`hall.js` 移除 `buildChidori` 调用与 `hall-kara.js` 导入）；`hall-kara.js` 已随 **P2-8** 删除
- [x] **P0-7** **唐破风残洞（缺陷）** — 已修复：`hall.js` 删除 `karahafuParams()`、`mok.frontExcl`、`mok.hide` 与檐下 AO 暗区，下檐屋面不再被挖空；楼梯栏杆改用具名常量 `PORCH_Z = 12.4`
- [x] **P0-8** **鬼瓦 onigawara + 鯱 shibi + 鳥衮 toribusuma** → **螭吻（chiwen）** — `hall-orn.js` 的 `onigawara()` 重写为 `chiwen()`：外轮廓改为「张口的下颌 + 唇线 + 高颧骨 + 眉骨 + 双角上卷 + 中间下凹的冠」，正面开**张口孔洞**并后置暗喉，加**凸眼 + 眉脊 + 鼻须卷草 + 联珠边**，冠上立 **剑把**；`shibi` / `horn`（鳥衮）/ `flame`（火炎宝珠）分支全部删除。`buildings-arch.js` 的 `oniGeo/placeOni` → `chiwenGeo/placeChiwen`（配置项 `R.oni.s` → `R.chiwen.s`），并删掉 tori-busuma 挑出瓦；`pagoda-parts.js` 的 `onigawaraGeo()` → `chiwenGeo()`（去鬼面环/宝珠/火焰角/獠牙/侧鳍，加双眼与眉脊），`pagoda.js` 同步删掉 toribusuma 段
- [x] **P0-9** 檐口**镀金三つ巴瓦当** → **莲花瓦当** — `hall-detail.js` 的 `tomoeDisc`（含 `tomoeOutline` 三巴纹）重写为 `lotusDisc`：外缘 + **弦纹环** + **8 瓣莲瓣** + **莲蓬与莲子**；`hall-orn.js` 的 `tileDisc` 不再接受镀金；`hall-roof.js:231` 的 `goldDiscs` 默认值由 `!== false` 改为 `=== true`（默认关闭）
- [x] **P0-10** **拟宝珠 giboshi** — 已改中式**莲瓣望柱头**：`hall-stair.js` 与 `hall-body.js` 剔除镀金金属套筒改为栗壳木本色莲瓣望柱头；`pagoda.js` 栏杆改为木质望柱头；`bridge.js` 拟宝珠铜套头改为青石雕刻莲瓣望柱头
- [x] **P0-11** 室内**障子门 shoji（自发光纸） + 栏间 ranma** — 已改为江南**隔扇/长窗**：`interior-arch.js` 的 `buildSideScreen` 以 **明瓦/绢背**（`interior-mats.js` 新增 `M.mingwa`：半透明 opacity 0.62、**不自发光**）取代 `M.shoji` 发光纸；方格 `koshi` 改为**步步锦**棂格（横档定行 + 竖棂隔行错半步）；`ranma` 改称**上夹堂板**
- [x] **P0-12** **格天井 gobuchi** 满铺方格 + 金十字 — 已改为**前后卷棚轩 + 中部彻上明造**：`interior-arch.js` 的 `buildCeiling` 删掉均布方格与鎏金十字，改为两端各一段圆弧**轩**（拱面 + 轩椽），中部敞开露出**望板 + 露明椽**，两轩之间加檐枋；`M.ceilingPaint` 不再使用
- [x] **P0-13** **日式黑松仕立松（niwaki 云片）** — 已改**自然形古松 / 罗汉松**：`vegetation-tree.js:797` 放宽 `squash` 由 0.2 至 0.45~0.55，拔除扁平云片修剪，枝冠恢复自然饱满舒展
- [x] **P0-14** **樱花去日化** — 已改**江南碧桃 / 红梅**：`vegetation-tex.js` 将 `drawSakura` 重构为 `drawPeachBlossom`，去除花瓣 V 型樱花缺口，呈现圆润饱满的五瓣桃花/梅花与花蕊
- [x] **P0-15** **太鼓桥** — 已改为**江南青石平拱桥**：`layout.js` 与 `bridge.js` 将矢高由 2.6 m 陡拱收敛为 1.55 m（矢跨比约 1/14），桥身金属构件全部降为暗哑熟铁，柱头改制为青石素雕莲瓣柱头
- [x] **P0-16** 两座侧厅的**唐破风向拜 karaKohai** — 已改为中式**抱厦**：`buildings-halls.js` 的 `karaKohai` → `baosha`，檐口线由唐破风的钟形曲线（中凸、两侧内凹）改为中式檐口线 `y = yE + H*(0.10*(1-u)^2 + 0.90*u^3)`——中间平直、两端起翘；博风板去鎏金边，注释改称博风板/山墙/额枋/荷叶墩
- [x] **P0-17** **手水钵 tsukubai**（筧 + 柄杓 + 前石/手烛石/汤桶石）+ **常香炉 jōkōro** 冒烟 — 已删除：`props.js` 的 `PLAZA` 只保留 `stepping`（汀步），`placePlaza` 不再产生香炉/石钵/烟/火点光，`STATE.plaza` 与 showcase 同步；`props-plaza.js` 的 `buildJokoro / buildTsukubai / smokeGeo` 已随 **P2-8** 删除
- [x] **P0-17b** **补景：庭院古井 / 石桌石凳** — 已落地：`props-plaza.js` 新增 `buildStoneTableSet`（青石圆桌 + 4座石鼓墩）与 `buildStoneWell`（八角青石井栏与幽深水面），布置于东广场与西侧角隅
- [x] **P0-18** **真金色仍在渲染** — 已清除：`buildings.js:100` 的 `K.capPaint` 由 `PROC.gold('vec3(0.80,0.56,0.24)')` 改为 `PROC.chestnutWood('vec3(0.105,0.062,0.038)')`（metalness 0.55→0.08）；`hall-mats.js` 的 `agedGiltHooks` 里强制暖金的 `fragLight` 由 `vec3(1.45,0.92,0.38)` 改为微冷 `vec3(0.92,0.98,1.10)`（强度 0.55→0.28）；`buildings-kanagu.js` 的 `gilt` 由 `vec3(1.0,0.69,0.29)` 改为熟铁 `vec3(0.135,0.125,0.115)`，磨损色由 `vec3(0.50,0.26,0.10)` 改为 `vec3(0.20,0.11,0.055)`
- [x] **P0-19** **斗拱斜下昂** — 已落地：`hall-bracket.js` 将尾垂木上斜改制为**由内向外斜下探出之下昂**，端头做**批竹昂嘴**斜切，材质采用栗壳木本色，去除日式鎏金套帽与六叶菊饰
- [x] **P0-20** **蛙股 kaerumata / 蟇股 gegyo / 金物板 kanagu / 钉隐 kugikakushi** → 中式构件：`hall-orn.js` 的 `kaerumataShape/kaerumata`（蛙股：两腿 + 拱 + 鎏金牡丹卷草）重写为 **`lotusBlockShape/lotusBlock`（荷叶墩·柁墩）**——外张的脚、收腰的侧面、顶部两瓣荷叶中凹；`gegyo`（蟇股：心形云纹 + 中央牡丹 + 垂珠）重写为 **`xuanyu`（悬鱼）**——宽肩收成开叉鱼尾 + 惹草卷 + 联珠；两者都改为**清水木雕**（栗壳木本色，不鎏金）。`hall-roof.js` 山花装配同步：博风板上的金物板 `kanagu` 删除、只留 `rosette` 作**门簪**；博风板注释改称**博风板**。`hall-bracket.js`（斗拱间的垫块）、`hall-kara.js`（死代码）同步改名
- [x] **P0-20b** **悬鱼配置项统一** — `buildings-arch.js`、`buildings-halls.js`、`buildings.js` 统一支持中式 `xuanyu` 配置字段并兼容 `gegyo`
- [x] **P0-21** 楼门柱身金物 + **梵钟 bonsho** → **钟亭**：`buildings-halls.js` 的 `bonsho` → `zhong`，轮廓改为中式青铜钟（平口盘、宽肩、缓收），去掉**龍頭双拱**改为**钟钮**（两柱一横梁），**撞座**从莲华座改为凸弦圈；`L.bellTower` → `L.bellPavilion`、`buildBellTower` → `buildBellPavilion`、模块键 `belltower` → `bellpavilion`，`vegetation.js` / `terrain-field.js` 同步

#### P1 — 命名与术语（不改画面，但误导后续开发）

- [x] **P1-1** `layout.js` 头部 ASCII 平面图 + 注释 — 已改为中文构件名（北廊 / 主厅·重檐歇山 / 钟亭 / 石板庭院 / 荷池 / 水榭 / 砖雕门楼）
- [x] **P1-2** `layout.js` 日式构件注释与字段名 — `hondō`→主厅、`kidan`→青石台基、`mokoshiEaveY`→`lowerEaveY`、`taiko-bashi`→青石平拱桥、`gold giboshi`→莲瓣望柱头、`kairō/chūmon`→环池游廊/门楼、`bellTower`→钟亭、`Gravel plaza`→石板庭院、`stone lanterns`→石景小品。另外用一次性脚本把全仓注释里的日式罗马字批量替换为中式术语（45 个文件、281 行注释）：本瓦葺→青瓦、入母屋/歇山、裳階→副阶、唐破风、蛙股→荷叶墩、蟇股→悬鱼、破风板→博风板、钉隐、肘木、巻斗、大斗、尾垂木、地垂木→檐椽、飛檐垂木→飞椽、隅木→老角梁、丸桁→挑檐檩、茅負→连檐、雨落、袖石、基壇→台基、縁→檐廊、腰組、擬宝珠→望柱头、三つ巴→巴纹、鬼瓦、鯱、鳥衮、相輪、水煙、宝珠、春日灯笼、手水钵、常香炉、仕立松、紅葉、桜、錦鯉品系名…
- [~] **P1-3** 字段改名 — `L.pagoda` / 模块名 `pagoda` **有意保留**：它是 URL 参数（`?modules=`）与 RNG 种子名的一部分，改名会改变确定性世界并破坏既有调用；注释已全部改为「借景·北寺塔」。其余字段（`stoneLanterns→stoneStands`、`bellTower→bellPavilion`）已改
- [x] **P1-4** 镜头文案残留 — `shots.js:77` 与 `shotkeys/hall.js:4` 的 `bronze wind chime` → 风铎；`shotkeys/interior.js` 的 Amida 注释 → 实际内容；`shotkeys/vegetation.js` 的 `momiji` → 红枫；`shots.js:116` 与 `shotkeys/pond.js:21` 改为「borrowed Beisi Pagoda」；`shots.js:90` 的 `altar table` → 红木翘头条案
- [x] **P1-5** 参道 → 甬道 — `terrain-paving.js` 的 `sando` → `yongdao`，`terrain-glsl.js` 的 `tg_sando` → `tg_yongdao`，`terrain-ground.js` 调用同步
- [x] **P1-6** 苔地上的飞石 → 只保留临水少量汀步 — `terrain-paving.js:128-160` 的 stepping stones 收窄为池岸与路径处的汀步；`pond-stone.js` 的广场侧/桥头驳岸已随叠石驳岸统一
- [x] **P1-7** 锦鲤品系名 — `pond-koi.js` 由日系锦鲤（红白/大正三色/昭和三色/丹顶/浅黄/黄金）收窄为中式配色（全红/红白花/红黑花/金黄/青黑/橙红/银白），types 表同步调整
- [x] **P1-8** 建筑构件术语统一 — `hall-roof.js` 的 `irimoya` → 歇山（`buildXieshanRidges/Gables`、`kind: 'xieshan'`）、`mokoshi` → 副阶/下檐（`kind: 'skirt'`）；其余见 P1-2 的批量替换

#### P2 — 文档、产物与死代码清理

- [x] **P2-1** **`README.md` 整体重写** — 已重写为「姑苏园林 Gusu Garden」：标题/简介/hero alt、仓库地址 `chainsaid/gusu-garden`、产物名 `gusu-garden-1080p60.mp4`、10 镜头表改为江南意境名、`out/gusu-garden*.mp4`、模块表、项目结构树、材质表改为栗壳桐油木/小青瓦/白粉墙/青石/熟铁；新增 **The Jiangnan design** 一节说明粉墙黛瓦、歇山嫩戗、螭吻、借景北寺塔、太湖石、竹芭柳、文人书斋；「How it was made」同步
- [x] **P2-2** **`docs/ARCHITECTURE.md` 同步** — 全面同步：标题与正文改为 Gusu Garden；`interior` 条目更新为文人书斋；`hall` 条目更新为歇山嫩戗与批竹昂嘴；`materials()` 材质清单与各个模块表全部更新为江南园林语汇；镜头归属表与示例代码全面同步
- [x] **P2-3** **`package.json`** — `name: gusu-garden`、description 改为姑苏园林、仓库 URL 改为 `chainsaid/gusu-garden`、keywords 改为 `chinese-garden / suzhou-garden / jiangnan`
- [x] **P2-4** **`index.html`** — `<title>` 改为「姑苏园林 Gusu Garden」、`lang="zh-CN"`
- [x] **P2-5** **`CREDITS.txt`** — 标题改为「姑苏园林 Gusu Garden - credits」
- [x] **P2-6** **`tools/`** 默认输出名改为 `out/gusu-garden.mp4` / `gusu-garden_final.mp4` / `gusu-garden_spliced.mp4` — `render.mjs`、`score.mjs`、`splice.mjs`
- [x] **P2-7** **`docs/images/` 重命名 + 重渲染** — 11 张分镜图已按新分镜全部重出（1920×1080 spp=8 final，缩至 1200 宽归档，共 2.3 MB），旧的 `buddha / giboshi / lantern / pagoda / sanctum / wind-bell / finale / gate-fitting / hall-eave / lotus / mirror-pond` 已删除。现存：`hero`（终幕航拍）、`leak-window`、`lotus-dew`、`banana-dew`、`guanyun-peak`、`winding-corridor`、`flying-eave`、`scholar-hall`、`water-pavilion`、`borrowed-reflection`、`dusk-aerial`。README 的 alt 文案已按实际画面校正
- [~] **P2-7b** contact sheet 版式 — 现为 `sheet.mjs` 产出的 2 列 × 10 行竖版（1400×3938），README 已按 46% 宽度居中、当「镜头清单」用；若要 4×5 宽版，重跑 `node tools/sheet.mjs --t 0.5,6.5 --tag film` 后用 ffmpeg `tile=4x5` 重拼即可（约 1 分钟 GPU）
- [x] **P2-8** **死代码清理** — 已全部完成，构建与 lint 通过：
  - **删除 4 个文件**：`hall-kara.js`（唐破风/千鸟破风，零引用）、`interior-sdf.js` + `interior-sdfworker.js` + `interior-shapes.js`（SDF 佛像 meshing 链与 worker 池，仅被死链引用）。删掉后连 `disposePool()` 调用也一并移除，worker 池不再创建
  - **`interior.js`**：删除 324 行死函数链（`buildFigures` 阿弥陀三尊 → `makeCurls` → `snailGeo`、`buildBodhiOrnaments`、`buildThrone`、`buildMandorla`、`kebutsuGeo`），清掉 8 个死导入（须弥坛/礼盘/浄花/琴/木鱼/经桌/天盖/幢幡），文件头注释改为实际的文人中堂内容
  - **`interior-mats.js`**：删除 `M.tatami`（榻榻米材质仍在编译 shader）及其 envList / envK 引用，共 49 行
  - **`props-plaza.js`**：删除 `buildJokoro` / `buildTsukubai` / `smokeGeo`（常香炉 + 手水钵 + 烟），共 180 行，只保留 `rockGeo` 与 `buildSteppingStones`
  - **`hall-mats.js`**：删除 `paintHooks`（緑青/群青組物彩画）与 `ORN_GLSL` + `ornHooks`（kirikane 唐草金饰），共 102 行；`hall.js` 导入同步
  - **`hall-orn.js`**：删除 `monCrest`（樱纹家纹）；`hall-body.js` 导入同步
  - **`buildings.js`**：删除 `K.goldRelief`（七宝纹）材质块与 `LOCAL_KEYS` 条目


---

## 阶段九：江南生态与纯木作造园深化（2026-10 审计落地，2026-10-29 复核更新）

详见专项权威审计指南：[docs/JIANGNAN_LANDSCAPE_AUDIT.md](./JIANGNAN_LANDSCAPE_AUDIT.md)。

针对用户专项指出的"树木植被偏日式"及全仓隐蔽和风残余，展开五大专项整改。
（2026-10-29 复核：以下 13 条全部落地，并经 `npm run snap` 单帧与双端构建验证。）

### 1. 植被生态系统重构（P0-TREE）
- [x] **P0-TREE-1** **松树去云片化**：`vegetation-tree.js` 的 `genPine()`（约 :849 起）已废除 `squash = 0.45` 压扁馒头云片，改为 `addCrown(..., fullness = rng.range(0.84, 1.0))` 立体椭球 + 子球簇，注释同步改为「江南古松／罗汉松，去日式仕立松扁平云片剪枝」。
- [x] **P0-TREE-2** **主殿台阶去对称迎客松**：`x:1.6 / 18.4, z:-7.0` 两株对称仕立松已删除；`vegetation.js`（约 :1380）改为单株偏轴 `crabapple, x:19.2, z:-6.4` 依粉墙而立。
- [x] **P0-TREE-3** **背景远山去京都化**：`terrain-forest.js`（约 :313）`coniferP` 已由 `0.42 + 0.45*…`（60%~87%）压至 `clamp(…, 0.01, 0.14)`，新增 `bambooP`（8%~28%）竹丛，优势种为香樟/槲栎/朴树阔叶圆冠。
- [x] **P0-TREE-4** **扩充江南树种池**：`vegetation.js` `fillTypes` 已为 `camphor×3 / maple×2 / pine / mapleRed / crabapple / magnolia`，`cherry` 已彻底剔除（内部 species 名亦已统一改名为 `peach`）。

### 2. 大木作与金属构件清退（P0-WOOD）
- [x] **P0-WOOD-1** **清退立柱金具套筒**：全仓 `kanaguBand` / `colBand(..., K.gold)` 调用点已归零，柱身回归栗壳桐油木本色直落青石柱础。
- [x] **P0-WOOD-2** **清退全仓六叶/八叶钉隐**：全仓 `rosette(` 调用点已归零；受力表达改用中式平齐木销或隐入漆面。

### 3. 桥梁与水系五金清退（P0-BRIDGE）
- [x] **P0-BRIDGE-1** **清退桥身饰金具与猪目镂空**：`bridge.js` 中 kazari 金物几何、猪目心形镂空与鎏金花盘已全部删除，仅存历史镜头注释也已改写；桥身回归水磨青石与素面莲瓣望柱。

### 4. 灌木层去刈込化（P0-SHRUB，2026-10-29 新增并完成）
- [x] **P0-SHRUB-1** **灌木图集换中式品种**：`vegetation-tex.js` `makeShrubAtlas()` 由 2×2（杜鹃/黄杨）扩为 **1536×1024、3列×2行、每格 512²** 的六格图集——cell 0 保留通用阔叶（樟树冠层共用），cell 1 南天竹（夏绿羽叶）、cell 2 栀子（革质叶+白花）、cell 3 八角金盘（掌状大叶）、cell 4 迎春（三出复叶+黄花）、cell 5 南天竹（秋红叶+红果）；新增 `pinnateSpray / berryCluster / ellipticLeaf / gardeniaFlower / fatsiaPalmate / jasmineFlower` 绘制函数。着色器图集寻址（`vegetation.js` 约 :351）与卡片 UV 同步改为 1/3 × 1/2。
- [x] **P0-SHRUB-2** **丛生形态置换刈込球**：`vegetation.js` 的"主半球+子半球堆叠+球面均匀撒卡"（原 karikomi 算法）已重写为**枝条驱动**——每丛 3~6 根斜向枝条（`shoots/spread/lean/hRatio/ragged` 参数化），每枝条一枚偏心小不透明核心，叶卡沿枝条分布（基部稀疏、枝端加密、边缘参差），彻底消除几何球感；`addMound` 品种池全量换为 nandina / nandinaAutumn / gardenia / fatsia / jasmine。
- [x] **P0-SHRUB-3** **撒点去轴对称**：主殿台阶前原 `[-6.5,2.2]` 与 `[17.8,26.5]` 双对称带改为"轴线让空——西侧一组松散丛、东侧零星两三丛"；塔台四角对称各 3 丛改为沿台缘圆周不规则散布 11 丛；Web 端 `shrubSpots`（`web/src/scene/vegetation.js`）同步去镜像化。`npm run snap` 主厅前视角单帧确认：台阶轴线通透直达主厅，两侧丛生灌木无修剪球痕迹。

### 5. Web 端同步（P0-WEB，2026-10-29 完成）
- [x] **P0-WEB-1** **Web 端灌木丛生化**：`web/src/scene/vegetation.js` 的 `SphereGeometry(0.75,10,8,…,0.52π)` 半球修剪球改为 `mergeGeometries` 合成的丛生单体（中央低矮叶团 + 4 根斜向外伸枝端叶团，无公共竖直轴），仍走 `InstancedMesh` 合批（实例数不变），配色改江南灌木深绿；`build:web` 与 `dev:web` 目视验证通过。
- [x] **P0-WEB-2** **材质匹配去和风关键字**：`web/src/scene/loader.js` 熟铁套筒匹配正则由 `/iron|dark|gold|kazari/i` 移除 `kazari` 分支。

---

## 阶段十一　江南化加强·画面验证版（2026-10-29 完成）

> 背景：成片检出后确认，此前部分条目按"代码已改"勾账，但画面未成立——成片里书斋仍是金唐纸墙 + 一对落地灯篭 + 朱漆家具，桥仍是木拱 + 白宝珠头，长窗透出白粉墙读作障子，塔身爆橙红，草坪如公园，湖石读作白蛋。本阶段逐项修复，**每一项以 `npm run snap` 单帧目视核对后才记账**。

- [x] **P0-JN-1 内景去金**：`interior-mats.js` 的 `M.panel` 由"黑漆底金雕（鱼子地）"重写为**栗壳木底木雕**（roughness 0.62/0.44、metalness 0、去金公式与鱼子地），背屏框 `M.goldAntique`、隔扇立柱饰件 `M.goldBright` 改 `M.woodNanmu`；`interior-altar.js` 新增 `buildFloorPalaceLantern()`（红木灯杆 + 六角绢罩宫灯 + 红穗），`interior.js` 的两只日式落地灯篭（火袋/warabi 翘角/宝珠）替换为落地宫灯。书斋由"金堂"回"书斋"。验证帧：`shot=6&t=42`。
- [x] **P0-JN-2 桥木改石**：`bridge.js` 两个专属 shader 重写——`lac`（栏杆/拱梁/底子）去年轮/纹理/漆磨损机，改**水磨青石**（基色 0.245/0.185 冷灰、顺构件券石分缝 + 宽构件横缝、磨损/崩角露新鲜石色、clearcoat 0）；`wood`（桥面）改**青石板**：`PLANK_PITCH 0.245→0.62` 大板、去钉头/木节/年轮、石缝暗灰、走道磨光冷灰。望柱头 `capMat` 去掉 `col * bright` 提亮（莲瓣头不再发白）。注：临水木平台与吴王靠仍为木作，属中式正当做法。验证帧：`cam=10,2.4,20`、`cam=14,2,16`。
- [x] **P0-JN-3 长窗去障子感**：`hall-body.js` 落地长窗格心底衬由白粉墙改**暗色内壁**（`inW`，格心透出幽暗室内/明瓦灰光），大殿立面成为深木格 + 裙板 + 栗壳柱，障子感消除；上层竖棂窗明瓦保留淡色（clerestory 属实）。验证帧：`cam=10,2.4,20`、`cam=6.5,2.4,10`。
- [x] **P0-JN-4 塔身做旧**：`pagoda.js` 木构 `vec3(0.34,0.13,0.06)→vec3(0.25,0.105,0.055)`，赭黄墙身 `0xd8c090→0xc2a87e`（做旧土赭，不再是鲜橙朱红）；九层八角/平座/腰檐/塔刹形制不变。验证帧：`cam=0,3,30&look=-105,35,-48`。
- [x] **P0-JN-5 庭院地物**：碧桃花瓣三档由樱粉 `[252,232,238]…` 改**碧桃深粉** `[243,172,194]…`（`vegetation-tex.js`）；`tg_meadow` 草地基色压暗 `(0.050,0.075,0.020)→(0.042,0.062,0.017)`、苔地权重 0.6→0.78、整体 1.3→1.12，大草坪读作园林地被。
- [x] **P0-JN-6 石作与铺装**：`pond-stone.js` 湖石 `vec3(0.96,0.97,0.93)→vec3(0.60,0.62,0.61)`（太湖石灰岩，不再白蛋）、整石挡墙 `vec3(1.12,1.1,1.06)→vec3(0.78,0.81,0.83)`（青石，不再米黄现代块石）；花街铺地（`terrain-glsl.js`）卵石场提亮加**白卵石档**、灰浆压暗 0.105→0.085、万字锦线 0.014→0.019 且线色 0.082→0.055——图案在远景可读。验证帧：`cam=13,4.2,14`、`shot=3`。

---

## 阶段十：地面铺装与室内地坪（2026-10-29 勘查，2026-10-29 完成）

> 用户指出"地砖和室内木地板不像江南特色"。2026-10-29 全仓勘查确认：地面层是**前几轮的系统性漏网区**——
> 灌木、树木、建筑构件都改完了，唯独脚下和室内地坪没动。以下 6 项已全部施工完毕。
>
> **均未新增任何纹理或几何**：庭院地面仍是 `CELL = 0.2 m` 的 height-field（`terrain-ground.js:14-16`），
> 拼花全部靠 shader + `n_bumpView` 高度起伏表现；室内地坪只是替换了一块 box 的材质。

- [x] **P0-GROUND-1** **甬道耙纹白砂 → 仄砖镶边 + 青灰碎石散铺**：`terrain-glsl.js` `tg_yongdao()` 函数体重写——删除周期 0.12 m 的平行耙沟与白砂色 `vec3(0.56,0.54,0.50)`，改为肩带内 1.70~2.06 m 一圈 **仄砖（青砖，0.245 m 一块，缝 0.014）**，其余 2.06~2.85 m 为 **青灰碎石散铺**（Worley 细胞 1/16 m ⇒ 卵石 3~4 cm，青灰/米黄/赭/墨四色 + 灰色石屑底，起伏 3.5 mm）。两个调用点（`terrain-glsl.js` `tg_meadow` 内与 `terrain-ground.js` 西侧外圈）同时生效，`npm run snap "cam=10,3,70&look=10,1,46&focal=40"` 确认耙纹已绝迹。
- [x] **P0-GROUND-2** **室内木地板 → 苏州御窑金砖**：`interior-mats.js` 的 `M.woodFloor` 重写并改名 **`M.floorBrick`**（`interior.js` 三处引用同步；`core/materials.js:532-533` 的 `M.woodFloorX/Z` 建筑木楼板**保留不动**）——0.30 m 窄板 + `rings` 木纹年轮 + clearcoat 0.9 镜面蜡全部删除，改为 **0.58 m 见方、对缝（不骑缝）** 的金砖：冷青灰 `vec3(0.30,0.325,0.335)`、缝 0.0018 m（按 `fwidth` 自动展宽抗锯齿）、**金星**云母颗粒（`smoothstep(0.74,0.93,n_snoise*210)` + 亚像素过滤）、中心**踩踏包浆**、四边磨圆倒角 + 缝内积灰；参数 `roughness 0.22→0.38`、`clearcoat 0.9→0.40`、`clearcoatRoughness 0.07→0.25`、`envK 0.75→0.45`。`npm run snap "shot=6&t=42"` 确认格缝整齐、无木纹、无镜面蜡感。
- [x] **P0-GROUND-3** **去 uchimizu 打水**：`terrain-paving.js` 的 `wetBase` 由 `0.66/0.55/…` 降到 `0.17/0.14/0.02`，删掉 `film` 水膜整段（含把 `p_rough` 拉到 0.035 的近镜面项），只保留"雨后潮气"——湿斑粗糙度改为 `mix(0.50,0.62,moss)`、变暗幅度 0.68→0.80，注释改为中文「雨后潮气」。
- [x] **P0-GROUND-4** **花岗岩条石改冷青灰**：`terrain-paving.js` 石材调色板 `vec3(0.345,0.352,0.352)→(0.44,0.425,0.39)` 改为冷青灰 `(0.315,0.335,0.345)→(0.400,0.412,0.418)`；删除 `pink feldspar granite` 与 `iron-stained` 两个偏暖分支，只留"致密深色"与"细粒偏蓝"两支；汀步石、河卵石、檐沟压顶同步去暖。
- [x] **P0-GROUND-5** **新增花街铺地**：`terrain-glsl.js` 新增 `tg_huajie()`（`hj_seg / hj_wanzi / hj_yulin / hj_binglie / hj_haitang` 五个小函数，约 60 行 GLSL）——**卵石场**用 Worley 细胞（1/16 m ⇒ 3~5 cm 卵石，青灰/米黄/赭红/墨四色随机，灰浆细缝，卵石凸起 3.8 mm，远景自动平均为卵石色而非灰浆色）+ **砖瓦图案线**：沿每条甬道边缘由内向外依次「**万字锦**（0.50 m 格）→ **鱼鳞**（0.34 m 格）→ **冰裂纹**（1.5/m Worley F2−F1）+ **海棠**团花（1.35 m 间距）」，并以两道**砖框**分隔。`terrain-ground.js` 石板分支内接 `uPlaza` 矩形遮罩（`layout.js` 的 `plaza`）+ `mk.a` 路径遮罩（不复用 `uRect`：`uRect` 是整个回廊范围，会把花街铺到苔地上），拼花半径以「距最近甬道边缘米数」而非「距广场边界」定位，故每条路都自然镶边。俯视 `cam=10,24,-1&look=10,0,-2&focal=26` 与近景 `cam=6.4,3.4,0.6&look=6.4,0,0.5&focal=45` 均确认纹样成立。
- [x] **P0-GROUND-6** **地面层术语清理**：`terrain.js:2`（raked gravel→铺地）、`terrain-field.js`（枯山水 islands→石景岛、raked gravel walk→band of paving、参道→甬道、`檐口滴水-mizo`→`檐口滴水`、gravel zones→paved zones）、`terrain-cover.js`（`ishigumi`→叠石、gravel→paving、JS 变量 `cherries`→`peaches`）、`terrain-gutter.js:2`（去 mizo、granite→blue-grey）、`terrain-paving.js:128`（苔径汀步）、`terrain-ground.js:2/94/262`，全链路 `g_wG`（G = gravel）→ **`g_wP`**（P = paving）。复查 `grep -rn "gravel|raked|参道|枯山水|mizo|ishigumi|uchimizu|tobiishi" src/` 仅剩 `pond-shore.js` 的浅滩天然砾石 ✅
- **验证**：`npm run build` 0 报错；`npm run snap` 甬道机位、`shot=6` 室内、庭院俯视三组单帧核对通过。


---

## 阶段验收与迭代节奏推荐

| 阶段 | 交付物 | 验证方式 | 耗时评估 |
|:---:|---|---|:---:|
| **阶段一** | 白墙灰瓦、栗壳木漆初版场景 | `npm run dev` 交互漫游，色调完全中式化 | 1 ~ 2 天 |
| **阶段二** | 发戗翘角、落地长窗、漏窗游廊 | 单帧渲染 (`npm run snap`) 检查立面形制 | 2 ~ 3 天 |
| **阶段三** | 翠竹林、芭蕉叶、水岸垂柳 | 查看近景植被逆光与质感 | 2 天 |
| **阶段四** | 穿孔太湖石立峰与自然叠石驳岸 | SDF 网格渲染检查“皱漏瘦透” | 3 ~ 4 天 |
| **阶段五** | 文人书房内景与中堂光影 | 查看 Shot 7 内景特写 | 2 天 |
| **阶段六** | 借景北寺塔与曲水环廊总规 | 整体平面鸟瞰与透视关系 | 2 ~ 3 天 |
| **阶段七** | 1080p60 姑苏园林 70s 成片 mp4 | FFmpeg 离线渲染导出成片 | 1 ~ 2 天 |
| **阶段八 P0** | 塔刹/石灯笼/耙纹/鬼瓦/拟宝珠/障子/黑松/桥形制全部江南化 | `npm run dev` 逐批目视 + `npm run snap` 单帧核对剪影 | 4 ~ 6 天 |
| **阶段八 P1** | 命名、注释、字段名去日化 | 全仓 grep 日式术语归零，`npm run build` 通过 | 1 天 |
| **阶段八 P2** | README / ARCHITECTURE / package.json / 图片 / 死代码 | 文档与代码一致，`mcflicker` + `lumaflicker` 复检 | 1 ~ 2 天 |
