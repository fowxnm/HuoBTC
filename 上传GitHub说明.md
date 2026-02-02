# 上传到 GitHub 并部署

你的仓库地址：**https://github.com/fowxnm/BTC.git**

## 一、安装 Git（若未安装）

- Windows: 下载 https://git-scm.com/download/win 安装后重启终端。
- 安装后打开 **PowerShell** 或 **命令提示符**，执行 `git --version` 确认可用。

## 二、在项目目录执行（一次性）

在 **PowerShell** 或 **命令提示符** 中依次执行（请把路径改成你的实际项目路径）：

```bash
cd c:\Users\AM\Desktop\BTC
```

### 1. 若本地还没有 Git 仓库，先初始化

```bash
git init
```

### 2. 添加远程仓库

```bash
git remote add origin https://github.com/fowxnm/BTC.git
```

如果已经添加过但地址不对，可先删除再添加：

```bash
git remote remove origin
git remote add origin https://github.com/fowxnm/BTC.git
```

### 3. 添加所有文件并提交

```bash
git add .
git commit -m "Initial commit: BTC Exchange full project"
```

### 4. 推送到 GitHub（主分支）

若仓库是新建、且还没有任何提交：

```bash
git branch -M main
git push -u origin main
```

若 GitHub 上已有内容（例如有 README），先拉再推：

```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

---

## 三、重要说明

- **`.gitignore`** 已配置：不会上传 `node_modules/`、`backend/.env`、`frontend/.env`、`dist/` 等，避免泄露密钥和无关文件。
- **部署服务器时**：在服务器上 `git clone https://github.com/fowxnm/BTC.git` 后，在 `backend` 和 `frontend` 下分别复制 `.env.example` 为 `.env` 并填写数据库、Redis 等配置，再执行 `bun install` 与构建/启动命令。

## 四、后续更新代码

修改代码后再次上传：

```bash
cd c:\Users\AM\Desktop\BTC
git add .
git commit -m "描述你的修改"
git push origin main
```
