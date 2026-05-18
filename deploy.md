# Docker Compose 部署说明

## 适用场景

适合这种部署方式：

- 项目运行在单台服务器
- 使用 `docker compose` 管理容器
- 应用自身携带 SQLite，不依赖外部数据库
- 希望把数据库文件持久化到 Docker volume 或宿主机目录

## 一、准备生产环境变量

先复制模板：

```bash
cp .env.production.example .env.production
```

填写最少配置：

```env
DATA_MOUNT=attendance-data
DATABASE_PATH=/data/attendance.sqlite
ADMIN_PASSWORD=你的后台密码
```

说明：

- `DATABASE_PATH` 在当前 compose 里默认已经固定为 `/data/attendance.sqlite`
- `.env.production` 里保留同样的值，便于本地和服务器排查
- `DATA_MOUNT` 默认是 `attendance-data`，表示数据保存在 Docker 命名卷

如果你希望数据库明确落在服务器目录，比如 `/srv/classroom-attendance/data`，改成：

```env
DATA_MOUNT=/srv/classroom-attendance/data
DATABASE_PATH=/data/attendance.sqlite
ADMIN_PASSWORD=你的后台密码
```

此时：

- 容器内仍然使用 `/data/attendance.sqlite`
- 宿主机实际目录是 `/srv/classroom-attendance/data`
- 更新或重建容器不会影响这个目录里的数据

## 二、构建并启动

如果直接在服务器构建：

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose --env-file .env.production logs -f
```

如果你在本地构建镜像再传到服务器，镜像里不再需要 Supabase build args，普通 `docker build --platform linux/amd64` 即可。

## 三、首次启动会发生什么

应用启动时会自动：

- 创建 SQLite 文件所在目录
- 打开数据库 `/data/attendance.sqlite`
- 创建业务表和索引
- 开启外键约束和 WAL 模式

不需要手动执行建表 SQL。

## 四、数据持久化

当前 `docker-compose.yml` 已包含：

```yaml
volumes:
  - ${DATA_MOUNT:-attendance-data}:/data
```

这意味着：

- 当 `DATA_MOUNT=attendance-data` 时，使用 Docker 命名卷
- 当 `DATA_MOUNT=/srv/classroom-attendance/data` 这类路径时，使用宿主机目录挂载
- `docker compose down` 不会删除数据库数据
- 重新 `up` 后会继续使用原来的签到数据

查看 volume：

```bash
docker volume ls | grep attendance-data
docker volume inspect classroom-attendance_attendance-data
```

如果已经切到宿主机目录挂载，直接在服务器查看目录即可：

```bash
ls -la /srv/classroom-attendance/data
```

## 五、常用命令

启动：

```bash
docker compose --env-file .env.production up -d
```

停止：

```bash
docker compose --env-file .env.production down
```

查看日志：

```bash
docker compose --env-file .env.production logs -f
```

进入容器：

```bash
docker compose --env-file .env.production exec attendance-web sh
```

查看当前数据库路径：

```bash
docker compose --env-file .env.production exec attendance-web node -p "process.env.DATABASE_PATH"
```

## 六、排查 SQLite 相关问题

确认环境变量：

```bash
grep -nE 'DATA_MOUNT|DATABASE_PATH|ADMIN_PASSWORD' .env.production
docker compose --env-file .env.production exec attendance-web node -p "process.env.DATABASE_PATH"
```

确认数据库文件已经创建：

```bash
docker compose --env-file .env.production exec attendance-web ls -la /data
```

如果要重置全部签到数据：

```bash
docker compose --env-file .env.production down
docker volume rm classroom-attendance_attendance-data
docker compose --env-file .env.production up -d
```

注意：上面的命令会永久删除 SQLite 数据文件。

## 七、从旧 volume 迁移到服务器目录

如果你当前已经在使用默认 volume，并且想迁移到服务器目录，可以按这个顺序：

```bash
mkdir -p /srv/classroom-attendance/data
docker run --rm \
  -v classroom-attendance_attendance-data:/from \
  -v /srv/classroom-attendance/data:/to \
  alpine sh -c 'cp -av /from/. /to/'
```

然后把 `.env.production` 改成：

```env
DATA_MOUNT=/srv/classroom-attendance/data
DATABASE_PATH=/data/attendance.sqlite
ADMIN_PASSWORD=你的后台密码
```

最后重建容器：

```bash
docker compose --env-file .env.production up -d --force-recreate
```

迁移完成后，新容器就会直接使用宿主机目录里的数据库文件。

## 八、反向代理示例（Nginx）

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
