# 横屏 20:9 适配说明

本轮基于 feat/nameless-war-god / bee9b6c，用户的“横屏 9:20”按宽高比 20:9 落地。

## 变更
- 新增 viewport-math.js：在安全区内等比适配 20:9，返回 CSS 像素矩形，不把 DPR 混进逻辑尺寸。
- 新增 viewport.js：canvas、HUD、触屏控制、营地、行囊、结算共享矩形；监听窗口/VisualViewport/全屏变化；提供可失败回退的用户触发全屏与横屏请求。
- 更新 war.html/boot.js/app.js：新入口单独启用适配；renderer 与 camera 使用容器尺寸；竖屏阻止出征及模拟推进，旋转时清输入并暂停，回横屏不自动续战。
- 新增 landscape.css：优先中央战场，四主要动作+两辅助动作；移除重复暂停按钮；小屏与超矮窗口下简化次要 HUD；左右双栏行囊独立滚动，保留底部装备操作。
- 原存档键、装备数值、掉落规则、敌人数、旧 index.html/ink.html/main 分支均不改变。没有创建公网部署。

## 验证
- 15 项 Node 检查通过（比例/边界/安全区/异常数值/静态接入检查）。
- 54 项 Chromium 布局与输入检查通过。包含 2000×900、1000×450、844×390、667×375、568×320、1280×720、1024×768、960×360；HUD 不重叠、操作目标可点且至少44 CSS px、行囊操作可见、真实 CDP 多指输入、旋转暂停回调、模拟安全边距。
- 以测试结果修正最小横屏中玩家/首领血条重叠、任务挡摇杆、装备说明高度不足的问题。
- 页面加载的是实际 HTML/CSS/viewport/touch 代码，在内存页面展开 imports；使用简化事件总线、填充测试文字与装备列表，不执行完整游戏启动及成长系统。界面截图带有“非战斗实机”标记，不是三维战斗截图。
- 本轮浏览器探测 WebGL2 上下文创建返回 false。没有验证 GLSL/三维战场、HTTP 模块加载、真实手机全屏锁定、连续热机帧率、完整局内存档流程；未据本轮检查下调兵力。

```sh
node --test checks/war-landscape.test.mjs
python checks/war-landscape-browser.py --chromium /usr/bin/chromium --out landscape-results
```

在完整仓库静态服务中打开 war.html。20:9 屏幕填满安全区域；16:9/平板/超宽屏等比留边，不裁切或拉伸主角。方向锁定支持因浏览器/容器而异，失败仍可手动旋转。
下一轮先用真实 WebGL2 浏览器完成一局战斗，并验证旋转前后暂停状态、触摸坐标和存档。后续里程碑见 DEVELOPMENT_ROADMAP.md。
