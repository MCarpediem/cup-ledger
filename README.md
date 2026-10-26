# 杯记 · cup-ledger

移动端优先的饮品日记。按仓库中的产品需求和技术方案实现，使用 React、TypeScript、Vite、React Router、Dexie / IndexedDB、date-fns、Recharts 和 CSS Modules。

## 本地运行

需要 Node.js 22.12+（本项目在 Node.js 24 上验证）。首次运行：

```sh
npm ci
npm run dev
```

打开终端显示的本地地址，通常为 `http://127.0.0.1:5173`。首次进入确认水目标、咖啡因参考值和饮品总糖参考线。应用不会自动插入示例记录。

## 已实现

- 今日：六项摄入指标、参考线状态、最近记录、跨午夜刷新。
- 全屏记录流程：11 类、32 款内置饮品；搜索；类型、甜度、容量、份数、时间；单份或每 100 ml 输入；未知值、估算和手动状态；单份及本次合计；酒精估算与手动覆盖。
- 历史：日期和类别筛选、按日分组、编辑、重选饮品和删除，所有视图同步更新。
- 记录快捷：可从饮品配置页固定常喝规格；记录页默认显示 4 个、最多 8 个，点击直接记入 1 份并提供 5 秒撤销。相同商品规格不会重复固定，取消固定不影响历史记录。
- 商品搜索：搜索结果优先展示带品牌和包装规格的常见商品，同时保留通用饮品和自定义入口。当前收录可口可乐和百事可乐；商品成分以商品参考值预填并提示核对包装，历史记录保存快照。
- 统计：周一开始的周历、月历最多两个图标与 `+N`、全年摘要；六项总量和自然日日均；每日趋势、饮品偏好与按 ml 计算的类别占比。
- 我的：自定义饮品、内置默认值覆盖、目标设置、本地存储说明、两步确认清空。模板修改和删除不会改变历史快照。
- 页面加载完成后可断网读写和切换页面；刷新或关闭后的离线重开不在本版范围内。

## 已采用的产品默认值

- “接近参考线”从 80% 开始，超过 100% 显示明确的超出值；这些是个人记录提示。
- 趋势使用面积折线图并提供每日文字数值；分类占比使用环形图、图例、容量和百分比。
- 内置成分是可编辑的产品初始估算，**不是经过核验的品牌或实验室营养数据库**。正式发布前应逐项确认来源。鸡尾酒等配方差异大的成分留空，不以零代替。
- 奶茶甜度估算保留每 100 ml 的 2 g 天然糖，其余糖按甜度缩减，热量按移除糖量同步调整；实际配方不同，应手动修改。
- 无糖气泡水不计入水。只有明确标为普通饮用水、矿泉水或纯净水的模板计入。
- 每次切换统计视图进入当前周期；可回看过去周期，不能前往未来周期。

## 验证

```sh
npx playwright install chromium webkit
npm run test        # 计算和数据库单元测试
npm run build       # 严格 TypeScript 检查与生产构建
npm run test:e2e    # Chromium + WebKit，手机视口
npm run test:docs   # 原有文档检查（需要 PowerShell 7 / pwsh）
npm run check      # 依次运行以上全部检查
```

浏览器测试使用独立浏览器上下文，不接触日常浏览器数据。截图和失败追踪保存在忽略提交的 `test-results/` 目录。测试包括离线记录、重新载入后的持久化、空值与零、跨日移动、模板快照、规格换算、酒精覆盖、日均边界、月历溢出、320px 窄屏、类别色一致及二次确认清空。

## 目录

- `src/model.ts`：类型与默认设置。
- `src/catalog.ts`：内置饮品及类别色映射。
- `src/domain.ts`：换算、水/成分汇总、日期范围、日均分母、饮品偏好与验证。
- `src/db.ts`：数据库版本、索引、事务、设置和快照服务。
- `src/DrinkForm.tsx`：记录与模板共用编辑器。
- `src/Stats.tsx`：日历和统计。
- `src/pages.tsx`、`src/components.tsx`、`src/App.tsx`：页面、共用组件和路由。

## 账号与云端同步

项目支持可选的 Supabase 邮箱账号和跨设备同步。复制 `.env.example` 为 `.env.local`，填写 Supabase Project URL 与 Publishable/anon key；然后在 Supabase SQL Editor 依次执行 `supabase/schema.sql` 和 `supabase/sync-migration.sql`。已经建表的项目只需执行后一个脚本。不要把 service role key 放进前端环境变量。

未配置环境变量时，应用继续使用原来的本地 IndexedDB 模式。配置后，邮箱登录支持独立账号缓存，每 15 秒及恢复网络、窗口聚焦时同步，也可点击“立即同步”。原本地日记不会自动上传，可点击“导入原本地记录”并确认，原数据保留。导入沿用账号目标设置。

同步基于上次成功快照合并独立修改和删除；数据库函数使用更新时间检查，防止同时上传互相覆盖。同一项数据被同时修改会停止同步并显示错误，保留本地修改，目前没有自动解决冲突界面。网络请求期间的新改动会留待下轮同步。尚未支持关闭网页后的后台上传、密码找回或完整离线启动。

端到端本地功能测试会清空服务进程的 Supabase 环境变量，不连接真实项目；云同步测试使用模拟传输，真实邮箱验证、数据库函数及多设备联调仍需项目环境验证。

## 静态部署

`npm run build` 生成 `dist/`。将其部署到支持 HTTPS 的静态站点，并把不存在的应用路径回退到 `/index.html`；资源请求应照常返回对应文件或 404。例如 Nginx 的页面 location 可配置 `try_files $uri $uri/ /index.html;`。Vite 的 `npm run preview` 可用于本机检查构建结果。

IndexedDB 与站点来源（协议、域名、端口）绑定。配置云同步后，清理浏览器数据仍可从账号恢复；未登录或未配置 Supabase 时，数据仍只保存在当前设备。

### GitHub Pages 部署

项目已包含 `.github/workflows/deploy-pages.yml`。把最新代码推送到 `main` 后，GitHub Actions 会自动执行 `npm ci`、`npm run build` 并发布到 GitHub Pages。工作流会额外生成 `404.html` 作为单页应用回退，因此刷新 `/records`、`/stats` 等页面不会出现 404，也不会影响 Supabase 邮箱确认链接。

1. 在 GitHub 仓库打开 **Settings → Pages**，将 **Source** 设为 **GitHub Actions**。
2. 如果要启用账号和跨设备同步，打开 **Settings → Secrets and variables → Actions**，新增两个 Repository secrets：

   - `VITE_SUPABASE_URL`：Supabase 项目 URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY`：Supabase publishable/anon key

   不配置这两个 secret 也可以部署，但网站只使用当前设备的 IndexedDB，不提供登录和云同步。不要把 service role key 放入 secret 或提交到 GitHub。
3. 在本地项目目录执行：

   ```sh
   git add .
   git commit -m "chore: deploy with GitHub Pages"
   git push origin main
   ```

4. 打开仓库的 **Actions** 页面，等待 `Deploy to GitHub Pages` 完成。网站地址通常是：

   `https://mcarpediem.github.io/cup-ledger/`

5. 在 Supabase SQL Editor 依次执行 `supabase/schema.sql` 和 `supabase/sync-migration.sql`。在 Supabase **Authentication → URL Configuration** 把 Site URL 设为 `https://mcarpediem.github.io/cup-ledger/`，并将该站点加入 Redirect URLs；否则邮箱确认可能跳回旧地址。然后测试部署后的注册、登录和同步。

## 2026-10 界面更新

今日和记录页各保留一个页面内添加入口；记录页展示真实记录数与记录天数。分类依次为水、茶、咖啡、奶茶、果汁、牛奶、碳酸饮料、能量饮料、运动饮料、酒精饮品、其他种类。水合并为一款；气泡水和豆奶归入其他种类，历史快照保持不变。新增摩卡、澳白和低脂牛奶，汽水使用可乐、无糖可乐、雪碧和芬达橙味。自定义饮品从选择页创建时，取消和保存均返回选择页，再返回原来的今日或记录页。

### 字体与阅读尺寸

界面统一使用随应用提供的 Noto Sans SC 可变字体，使用 Unicode 子集按需加载，无需请求外部字体服务。正文 16px / 500 字重，辅助文字 15px，标题与关键数字 650–750 字重；首页也统一使用黑体。字体遵循 SIL Open Font License，许可随构建保存在 `font-license.txt`。
