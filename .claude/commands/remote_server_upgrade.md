# New API remote server upgrade

请帮我在「/Users/wanghejie/workspace/new-api」路径下，将已经推送到 GitHub 的 new-api 项目安全升级到远程服务器「root@45.58.165.180」上由 `docker compose` 运行的实例。必须按顺序完成本地预检、远程状态记录、数据与配置备份、拉取前审查、快进代码、Compose 配置校验、构建、重启、健康验证和必要回滚，确保升级成功或安全中止。ultrathink and do it

## 固定信息
- 本地仓库路径：「/Users/wanghejie/workspace/new-api」
- 目标服务器：「root@45.58.165.180」
- 服务器部署分支：「main」
- 远程项目目录：如果用户没有提供，先通过只读 SSH 命令查找包含 `.git` 与 `docker-compose.yml` 的 new-api 目录；如果找到多个或找不到，停止并说明需要用户提供准确路径
- 真实线上配置：服务器上的 `docker-compose.yml` 是 ignored 本地配置文件，不会随 `git pull` 更新，不要依赖 `git stash` 管理它

## 执行步骤
1. 跳转至「/Users/wanghejie/workspace/new-api」，读取当前分支、工作树状态和远端引用：
   - 执行「git branch --show-current」
   - 执行「git status --short --branch」
   - 执行「git fetch origin」
   - 如果工作树不干净，停止并说明需要先处理本地改动，不要擅自提交、丢弃或覆盖用户改动

2. 确认本地当前分支与 `origin/main` 的关系，并确保本次目标版本已经进入 `origin/main`：
   - 计算「git rev-list --count origin/main..$CURRENT_BRANCH」和「git rev-list --count $CURRENT_BRANCH..origin/main」
   - 如果当前分支是 `main` 且本地领先 `origin/main`，执行「git push origin main」
   - 如果当前分支不是 `main` 且仅领先 `origin/main`，切到 `main`，执行「git pull --ff-only origin main」，再执行「git merge --ff-only $CURRENT_BRANCH」和「git push origin main」
   - 如果当前分支与 `origin/main` 双向分歧，或 `main` 无法 fast-forward，停止并说明分歧原因
   - 最终执行「git fetch origin」并记录目标 commit：「git rev-parse origin/main」

3. 连接远程服务器并确定远程项目目录：
   - 执行「ssh root@45.58.165.180」
   - 如果远程项目目录未知，使用只读方式查找候选目录，不要修改远程文件
   - 进入远程项目目录后，确认「git branch --show-current」必须输出 `main`
   - 记录当前线上 commit：「git rev-parse HEAD | tee /tmp/new-api-rollback-commit.txt」
   - 查看当前服务状态：「docker compose ps」和「docker images new-api:local」

4. 在远程服务器上创建备份目录并完成不可跳过的备份：
   - 创建「BACKUP_DIR=/root/backups/new-api/$(date +%Y%m%d_%H%M%S)」
   - 执行 PostgreSQL dump：「docker compose exec -T postgres pg_dump -U root -Fc new-api > "$BACKUP_DIR/new-api.dump"」
   - 校验 dump 可读：「cat "$BACKUP_DIR/new-api.dump" | docker compose exec -T postgres pg_restore -l >/dev/null」
   - 确认并备份真实线上配置：「test -f docker-compose.yml」和「cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml"」
   - 如存在 `.env`，执行「cp .env "$BACKUP_DIR/.env"」
   - 备份 bind mount 数据：「tar --exclude='*.log' -czf "$BACKUP_DIR/data.tar.gz" data/」；如需保留日志，再备份 `logs/`
   - 保存当前旧镜像：「docker save new-api:local | gzip > "$BACKUP_DIR/new-api-image.tar.gz"」
   - 执行「ls -lh "$BACKUP_DIR"」确认备份文件存在且大小合理
   - 任一备份或校验失败，立即停止，不要继续升级

5. 在远程服务器上拉取前审查即将部署的变更：
   - 执行「git status --short --branch」
   - 如果存在非 ignored 本地改动，先执行「git diff > "$BACKUP_DIR/server-local-changes.patch"」并人工判断；必要时执行「git stash push -u -m "pre-upgrade-$(date +%Y%m%d_%H%M%S)"」
   - 执行「git fetch origin」
   - 确认「git rev-parse origin/main」等于本地阶段记录的目标 commit；不一致则停止
   - 预览提交：「git log HEAD..origin/main --oneline」和「git log HEAD..origin/main --stat | head -100」
   - 拉取前审查关键文件：「git diff --stat HEAD origin/main -- Dockerfile docker-compose.example.yml go.mod web/package.json VERSION model/ .env.example setting/ common/env.go」
   - 审查配置模板：「git diff HEAD origin/main -- .env.example docker-compose.example.yml」
   - 如果发现破坏性数据库变更、必需配置无法确认、或明显不兼容变更，停止并说明风险，不要继续

6. 审查通过后，在远程服务器上快进到最新 `main`：
   - 执行「git pull --ff-only origin main」
   - 执行「git rev-parse HEAD」，确认等于目标 commit
   - 如果 fast-forward 失败，执行「git log origin/main..HEAD --oneline」说明原因后停止，不要直接 `git reset --hard`

7. 同步并校验 ignored 线上配置：
   - 设置「OLD=$(cat /tmp/new-api-rollback-commit.txt)」和「NEW=$(git rev-parse HEAD)」
   - 审查模板变化：「git diff "$OLD" "$NEW" -- docker-compose.example.yml .env.example」
   - 如果 `docker-compose.example.yml` 或 `.env.example` 新增必需环境变量、服务、端口、卷或健康检查，先把必要变化手动同步到服务器真实 `docker-compose.yml` / `.env`，同时保留线上真实密码和端口
   - 执行「test -f docker-compose.yml」
   - 执行「docker compose config >/dev/null」
   - 如果 Compose 配置校验失败，停止并修复真实配置后重试，不要构建或重启

8. 在远程服务器上构建新镜像，构建期间不停止旧容器：
   - 执行「docker compose build new-api」
   - 构建失败时旧容器仍在运行；停止并说明错误，不要执行 `docker compose up`
   - 构建成功后执行「docker images new-api:local」确认新镜像生成

9. 仅重建 `new-api` 服务容器：
   - 执行「docker compose up -d new-api」
   - 立即查看日志：「docker compose logs -f --tail=200 new-api」
   - 不要让日志跟随无限挂起；看到服务启动完成、健康检查通过，或等待约 120 秒后停止跟随并进入验证

10. 执行健康验证：
    - 执行「docker compose ps」，确认 `new-api` 为 Up/healthy
    - 执行「curl -fsS http://127.0.0.1:9991/api/status | jq .」
    - 扫描错误日志：「docker compose logs --tail=500 new-api | grep -iE "error|panic|failed" | head -30」
    - 如需检查表结构，执行「docker compose exec -T postgres psql -U root -d new-api -c "\dt"」
    - 如果 `docker-compose.yml` 绑定的是 `127.0.0.1:9991:3000`，不要用 `http://45.58.165.180:9991/` 作为公网验证地址；浏览器验证应使用实际公网入口、反向代理域名或用户提供的访问地址

11. 如果启动失败或健康验证不通过，按顺序回滚：
    - 先等待 60 秒并重试「curl -fsS http://127.0.0.1:9991/api/status」
    - 仍失败则优先加载升级前旧镜像：「docker load < "$BACKUP_DIR/new-api-image.tar.gz"」和「docker compose up -d new-api」
    - 如果旧镜像也无法启动，停止 `new-api`，用阶段 4 的 PostgreSQL dump 恢复数据库，再启动服务
    - 服务恢复后，再整理仓库 HEAD：「git reset --hard $(cat /tmp/new-api-rollback-commit.txt)」
    - 回滚过程必须保留备份文件，不要删除备份目录

12. 升级成功后收尾：
    - 执行「docker image prune -f」
    - 执行「df -h /var/lib/docker」
    - 写入部署记录到「/root/new-api-deploy.log」，包含时间、旧 commit、新 commit、分支、备份位置和执行人
    - 最终汇报目标 commit、旧 commit、备份目录、健康检查结果、是否执行回滚、仍需人工验证的公网入口

## 完成前自检
- 已确认 `origin/main` 的目标 commit 与远程服务器 `git rev-parse HEAD` 一致
- 已完成 PostgreSQL dump，并用 `pg_restore -l` 校验可读
- 已备份真实 `docker-compose.yml`、`.env`、`data/` 和旧镜像
- 已在 `git pull` 前审查 Dockerfile、`docker-compose.example.yml`、`.env.example`、依赖、版本和 `model/` 相关 diff
- 已确认 `docker-compose.example.yml` / `.env.example` 的必需变化已同步到真实线上配置
- 已执行 `docker compose config >/dev/null`
- 已执行 `docker compose build new-api` 且成功
- 已执行 `docker compose up -d new-api`，且没有重启 postgres / redis
- `/api/status` 返回成功，`docker compose ps` 显示服务健康
- 已写入部署记录，最终回复包含旧 commit、新 commit、备份目录、健康检查结果和是否回滚

## 注意事项
- 严格按步骤顺序执行；任何关键步骤失败都必须停止或进入回滚，不要跳步
- 不要执行「docker compose up -d --build」；必须先「docker compose build new-api」，再「docker compose up -d new-api」
- 禁止执行「docker compose down」和「docker compose down -v」
- 禁止删除 Docker volume、PostgreSQL volume、`data/`、`logs/` 或备份目录
- `docker-compose.yml` 是 ignored 线上真实配置，不会被 `git pull` 覆盖，也不会被普通 `git stash push -u` 暂存
- 只在确认安全时处理非 ignored 本地改动；不要擅自覆盖用户或服务器上的本地修改
- 不要把真实密码、token、密钥或完整 `.env` 内容输出到最终回复
- 如果 SSH、Docker、PostgreSQL、GitHub 访问或权限缺失导致无法继续，明确说明阻塞点和已经完成的步骤
