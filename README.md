# 课堂签到系统

单教师课堂签到系统，当前后端使用本地 SQLite。

- 固定课程：`英语听力`
- 固定班级：`一班`、`二班`
- 学生先登录账号，再扫码直接签到
- 学生入口与教师后台登录入口分离
- 管理后台只信任服务端签发的管理员会话

## 技术栈

- Next.js 15 App Router
- React 19
- TailwindCSS 3.4
- SQLite + `better-sqlite3`
- `qrcode.react`

## 本地启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` 最少需要：

```env
DATABASE_PATH=./data/attendance.sqlite
ADMIN_PASSWORD=change-this-password
```

说明：

- `DATABASE_PATH` 不填时默认也是 `./data/attendance.sqlite`
- 应用首次启动会自动创建数据库目录、表结构和索引
- 本地数据库文件默认保存在 `data/attendance.sqlite`

## Docker 部署

详细部署步骤见 [deploy.md](deploy.md)。

当前部署方式：

- 单个 Next.js 容器
- SQLite 文件默认保存在 Docker 命名卷 `attendance-data`
- 也支持改成服务器宿主机目录挂载，路径由 `DATA_MOUNT` 控制
- 容器内数据库路径固定为 `/data/attendance.sqlite`
- 应用仅监听 `127.0.0.1:3000`，便于交给 Nginx / Caddy / 宝塔反向代理

启动命令：

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose --env-file .env.production logs -f
```

`.env.production` 最少需要：

```env
DATA_MOUNT=attendance-data
DATABASE_PATH=/data/attendance.sqlite
ADMIN_PASSWORD=change-this-password
```

如果你想把数据库放到服务器其他目录，例如 `/srv/classroom-attendance/data`，改成：

```env
DATA_MOUNT=/srv/classroom-attendance/data
DATABASE_PATH=/data/attendance.sqlite
ADMIN_PASSWORD=change-this-password
```

停止服务：

```bash
docker compose --env-file .env.production down
```

删除容器但保留数据卷时，签到数据不会丢失。只有显式删除 `attendance-data` volume 时，数据库才会被清空。

如果使用宿主机目录挂载，更新或重建容器也不会影响该目录里的数据库文件。

## 数据初始化

项目不再依赖外部数据库服务，也不需要手动执行建表 SQL。

如果当前数据库为空，只需要先导入学生数据：

- 登录后台后打开 `/admin/login`
- 登录成功后进入 `/admin/students`
- 直接粘贴学生名单
- 支持格式：`学号,姓名,班级,邮箱`
- 也支持制表符分隔

字段要求：

- 必填：`student_id`、`name`
- 可选：`class_name`、`email`

## 路由

公共页面：

- `/`
- `/bind`
- `/sign`

后台页面：

- `/admin`
- `/admin/login`
- `/admin/session`
- `/admin/session/[id]`
- `/admin/students`
- `/admin/stats`

## 当前数据逻辑

- 首次设置 PIN：按 `student_id + name` 查询 `students`
- 学生设备标识优先通过同源 cookie 传给服务端，仅用于签到记录排查
- 首次设置 PIN 会更新 `students.class_name`
- 学生账号不绑定设备，换手机或换浏览器后可重新登录
- 每个学生每场签到只允许一条记录
- 同一设备 ID 每场签到只允许提交一次，避免一台手机代多人签到
- 场次过期后会自动从 `active` 切为 `closed`
- 管理后台实时页每 5 秒刷新

## 安全说明

- 首页不会再依据设备信息自动进入后台
- `device_id` 只用于同场次重复设备拦截和签到记录排查，不代表管理员或学生身份
- 浏览器不直接写数据库，业务写入统一走 Next.js API
- 后台统一从 `/admin/login` 登录

## 说明

- 页面文案已压缩为简短指引
- 学生页是移动端优先
- 本项目使用 SQLite，适合单机、低并发课堂签到场景
