# Overheat Test

Overheat Test 是一个基于 React + Vite + Express + Socket.IO 的卡牌对战项目。前端负责卡组构筑、收藏、商店、匹配和战场交互；后端负责账号、卡组、收藏、对局状态、实时同步和规则结算。

## 技术栈

- React 19
- Vite 6
- TypeScript
- Tailwind CSS
- Express
- Socket.IO
- MariaDB
- tsx

## 本地环境

需要先安装：

- Node.js
- npm
- MariaDB

安装依赖：

```bash
npm install
```

创建或调整 `.env`：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=overheat
PORT=3001
VITE_BACKEND_URL=
GEMINI_API_KEY=
JWT_SECRET=replace-with-local-secret
```

说明：

- 后端默认监听 `3001`。
- 前端默认监听 `3000`。
- `VITE_BACKEND_URL` 为空时，前端会通过 Vite 代理访问 `/api` 和 `/socket.io`。
- Vite 配置会把 `/api` 和 `/socket.io` 代理到 `http://localhost:3001`。

## 数据库初始化

首次运行前，确保 MariaDB 中已创建数据库：

```sql
CREATE DATABASE overheat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

初始化表、商店数据、测试账号和基础收藏：

```bash
npm run init
```

初始化脚本会创建或更新主要表：

- `users`
- `games`
- `decks`
- `user_cards`
- `pack_history`
- `email_verification_codes`

默认测试账号由 `server/init_db.ts` 写入，包括 `admin`、`guest1` 到 `guest5`。

## 启动开发环境

同时启动前端和后端：

```bash
npm run dev
```

也可以分别启动：

```bash
npm run frontend
npm run backend
```

访问：

```text
http://localhost:3000
```

## 常用命令

```bash
npm run init
```

初始化数据库、商店和测试账号收藏。

```bash
npm run frontend
```

启动 Vite 前端服务，端口为 `3000`。

```bash
npm run backend
```

启动后端服务，默认端口为 `3001`。

```bash
npm run dev
```

同时启动前端和后端。

```bash
npm run build
```

构建前端产物到 `dist`。

```bash
npm run lint
```

执行 `tsc --noEmit` 类型检查。

```bash
npm run generate:card-scripts
```

根据卡牌表生成或更新 `src/scripts` 中的卡牌脚本。

```bash
npm run resetcards
```

重置所有用户收藏。

```bash
npm run deletecards
```

删除用户收藏数据。

## 目录结构

```text
.
├── src
│   ├── components      # React 页面与 UI 组件
│   ├── data            # 前端卡牌数据加载
│   ├── hooks           # React hooks
│   ├── lib             # 前端工具函数
│   ├── scripts         # 单卡效果脚本
│   ├── services        # 前端服务与规则辅助逻辑
│   └── types           # TypeScript 类型定义
├── server
│   ├── index.ts        # Express / Socket.IO 入口
│   ├── ServerGameService.ts
│   ├── db.ts
│   ├── card_loader.ts
│   └── init_*.ts       # 初始化脚本
├── script              # 卡牌脚本生成、迁移、同步工具
├── assets              # 静态资源
├── pics                # 卡图资源
└── dist                # 构建输出
```

## 卡牌效果开发

卡牌效果主要写在 `src/scripts/<cardId>.ts`。

每张卡导出一个 `Card` 对象，常见效果类型包括：

- `CONTINUOUS`：永续效果，通过 `applyContinuous` 在持续效果重算时应用。
- `TRIGGER`：诱发效果，通过 `triggerEvent` 和 `condition` 入队处理。
- `ACTIVATE`：启动效果，通常包含 `condition`、`cost`、`execute`。

常用工具集中在：

- `src/scripts/BaseUtil.ts`
- `src/services/EventEngine.ts`
- `src/services/AtomicEffectExecutor.ts`
- `server/ServerGameService.ts`

开发建议：

- 优先复用 `BaseUtil.ts` 中已有工具，例如 `createSelectCardQuery`、`moveCard`、`moveCardAsCost`、`addTempPower`、`addContinuousPower`。
- 需要选择卡牌或玩家时，优先创建 `pendingQuery`，让前端交互完成后通过 `onQueryResolve` 继续处理。
- 费用移动使用 `moveCardAsCost`，效果移动使用 `moveCard` 或 `AtomicEffectExecutor.execute`。
- 永续效果应只写可被 `EventEngine.recalculateContinuousEffects` 重算覆盖的状态，避免卸装备或离场后残留。
- 可选诱发不要设置 `isMandatory: true`。

## 卡牌数据与收藏

前端通过 `src/data/cards.ts` 动态加载 `src/scripts/*.ts`。

后端通过 `server/card_loader.ts` 加载同一批脚本，用于卡组校验、收藏、商店和对局结算。

更新卡牌扩展包、卡牌脚本或基础收藏后，通常需要重新运行相关脚本：

```bash
npm run generate:card-scripts
npm run resetcards
```

如果只需要同步已有用户的基础收藏，可以查看 `server/reset_all_user_cards.ts` 和 `server/card_inventory.ts` 的当前逻辑。

## 对局同步

实时对局通过 Socket.IO 完成。

前端入口：

- `src/socket.ts`
- `src/components/BattleField.tsx`

后端入口：

- `server/index.ts`
- `server/ServerGameService.ts`

主要事件：

- `authenticate`
- `joinGame`
- `gameAction`
- `gameStateUpdate`
- `matchFound`

## 构建

```bash
npm run build
```

构建结果输出到：

```text
dist
```

本地预览：

```bash
npm run preview
```

## 已知注意事项

当前 `npm run lint` 使用 `tsc --noEmit`，项目中可能仍存在历史类型错误。修复卡牌脚本或规则逻辑时，建议同时运行针对具体脚本的轻量行为验证，避免被无关类型问题阻塞。

本项目的规则逻辑仍在快速迭代中，修改 `ServerGameService.ts`、`EventEngine.ts`、`AtomicEffectExecutor.ts` 时要特别注意对已有卡牌脚本的影响。

## License

MIT License. See [LICENSE](./LICENSE) for details.
