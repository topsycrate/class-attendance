# 课堂签到系统

单教师课堂签到系统，当前后端已切换为 Supabase。

- 固定课程：`英语听力`
- 固定班级：`一班`、`二班`
- 学生先绑定，再扫码输入 4 位签到码
- 学生入口与教师后台登录入口分离
- 管理后台只信任服务端签发的管理员会话

## 技术栈

- Next.js 15 App Router
- React 19
- TailwindCSS 3.4
- Supabase
- `qrcode.react`

## 启动

```bash
cd "/Volumes/HIKSEMI/Python/签到系统"
npm install
npm run dev
```

建议 Node 版本：

- Node.js `18.20+`

## Docker 部署

推荐部署方式：

- 服务器上安装 Docker Engine 和 Docker Compose Plugin
- 项目使用 `docker compose` 运行一个 Next.js 容器
- 域名、HTTPS 和公网入口继续交给你现有的 Nginx / Caddy / 宝塔反向代理
- Supabase 继续使用外部服务，不放进容器

### 1. 准备生产环境变量

先复制模板：

```bash
cp .env.production.example .env.production
```

然后填写：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-service-role-or-secret-key
ADMIN_PASSWORD=你的后台密码
```

如果你更习惯使用 `SUPABASE_SERVICE_ROLE_KEY`，也可以填这个变量，服务端会读取两者之一。

### 2. 构建并启动容器

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose --env-file .env.production logs -f
```

默认情况下，应用只监听服务器本机：

- `127.0.0.1:3000`

这样公网流量只能通过你的反向代理进入。

### 3. 更新部署

代码更新后重新执行：

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

如果改了环境变量，也要重新构建并重启。

停止服务：

```bash
docker compose --env-file .env.production down
```

### 4. 反向代理示例

Nginx 示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

如果你已经有 HTTPS 配置，只需要把上面的转发目标保持为 `http://127.0.0.1:3000`。

## 环境变量

复制模板：

```bash
cp .env.example .env.local
```

最少需要：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-service-role-or-secret-key
ADMIN_PASSWORD=你的后台密码
```

可选：

```env
SUPABASE_SERVICE_ROLE_KEY=
```

说明：

- 服务端访问 Supabase 必须配置 `SUPABASE_SECRET_KEY` 或 `SUPABASE_SERVICE_ROLE_KEY`
- 不再支持 `ADMIN_DEVICE_UUIDS`、`ADMIN_ENTRY_USERNAME`、`ADMIN_ENTRY_PASSWORD`
- 后台统一从 `/admin/login` 登录

## 建表

我已经生成了建表 SQL：

- [schema.sql](/Volumes/HIKSEMI/Python/签到系统/supabase/schema.sql)

在 Supabase Dashboard 里打开 `SQL Editor`，粘贴并执行这份 SQL 即可。

这份 SQL 会创建或补齐：

- `students`
- `device_bindings`
- `attendance_sessions`
- `attendance_records`

如果当前数据库为空，只需要先准备 `students` 数据：

- 必填：`student_id`、`name`
- 可选：`class_name`、`email`

导入方式：

- 登录后台后打开 `/admin/login`，登录成功后进入 `/admin/session`
- 学生列表导入页位于 `/admin/students`
- 直接粘贴学生名单
- 支持格式：`学号,姓名,班级,邮箱`
- 也支持制表符分隔

## 路由

公共页面：

- `/`
- `/bind`
- `/device-id`
- `/sign`

后台页面：

- `/admin`
- `/admin/login`
- `/admin/session`
- `/admin/session/[id]`
- `/admin/students`
- `/admin/stats`

## 当前数据逻辑

- 学生绑定：按 `student_id + name` 查询 `students`
- 学生设备标识优先通过同源 cookie 传给服务端
- 首次绑定会更新 `students.class_name`
- 每个学生只允许一个设备绑定
- 每个学生每场签到只允许一条记录
- 管理后台实时页每 5 秒刷新

## 安全说明

- 首页不会再依据设备信息自动进入后台
- `device_id` 只用于学生绑定和签到，不代表管理员身份
- 浏览器不应直接写入 Supabase 业务表，业务写入统一走 Next.js API
- `supabase/schema.sql` 已切换为启用 RLS，并移除 `anon/authenticated` 的直接写权限

## 说明

- 页面文案已压缩为简短指引
- 学生页是移动端优先
- 为兼容当前本地 Node 18，Tailwind 使用 `3.4.x`
