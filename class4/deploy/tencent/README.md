# 四班工作台 · 腾讯云独立运行部署包（尚未现场验收）

**适用对象：** 已获得授权的腾讯云轻量应用服务器或等价的 Linux Docker 主机。部署必须符合学校关于学生个人信息的管理要求。本仓库公开：绝不上传学生名单、任何账号口令、个人反馈或云端密钥。

## 证据范围

此目录构建的是已完成 GitHub CI 编译的 ClassFire 候选版本；不是 AppDeploy 迁移，也没有迁移旧站数据库。最终生产许可须等待完整班务、离线重开及现场网络验收通过。本包不能证明“任何网络必然可用”。

## 必须具备

- 能运行 Docker Compose 的服务器（需要先核查已有资源；本项目不会自动采购或购买）。
- 已正确解析的合法域名及 HTTPS。中国内地服务器绑定域名，须先完成 ICP 备案。无备案域名时，勿将测试站公开用于真实学生信息。
- 符合学校数据处理授权要求；独立账号及访问策略；个人设备启用离线暂存前需明确授权。
- 备份空间，并安排离机备份。现有备份脚本仅做停机一致性本地快照，不是自动云端灾备。

## 从 GitHub 构建成果部署（运维人员执行）

1. 在 GitHub Actions 成功作业的 `class4-build-evidence` 工件内，取得 `classfire-candidate-with-source.tar.gz`。它包含应用源码、GPLv3许可、测试及 `.output` 运行产物。
2. 将 tar.gz 安全传到服务器，在一个独立的新目录解压。确认 `LICENSE`、`.output/server/index.mjs`、`deploy/tencent/compose.yaml` 存在。**不要覆盖原 WorkBuddy 或 AppDeploy 数据库。**
3. 在 `deploy/tencent` 目录执行 `cp .env.example .env`，仅在服务器本地填写真实备案域名及联系邮箱。使用 `openssl rand -hex 32` 单独生成 64 位十六进制随机密钥，填写到 `NUXT_SESSION_PASSWORD`。不要将 `.env` 提交到 GitHub；建议 `chmod 600 .env`。
4. 运行 `docker compose --env-file .env -f compose.yaml config -q`，检查服务定义及端口。随后执行 `docker compose --env-file .env -f compose.yaml up -d --build`，检查 `docker compose --env-file .env -f compose.yaml ps`。
5. 仅公网开放必需的 80、443 端口，**不要开放 Node 3000 端口**。检查 Caddy 获取有效 HTTPS 证书并在真实浏览器打开 `https://已备案域名`，再做双账号写入/读取与权限验收。
6. 停机备份：`bash backup.sh /secure/class4-backups`。复原过程必须在隔离环境先通过校验和与数据库完整性测试，再经数据管理员授权人工实施，严禁直接覆盖仍在运行的数据库。

## 退出和回滚

保留上一个已通过验收的镜像和完整数据快照。若验证失败，停止新站，不切换生产 DNS 和真实用户流量。**从未上线的新站不需要触碰旧站数据。**

## 待完成项

真实大陆校园网/家庭 Wi-Fi/手机流量、实体手机、断网关闭浏览器后新登记、班务全流程和只读大屏尚未验收。没有服务器权限时，此文件不会自行部署，不能视为正式交付。
