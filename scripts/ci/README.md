# CI/CD 配置指南

## 架构

```
Git Push / PR
    │
    ▼
GitHub Actions
    │
    ├── P2: Code Quality (lint + typecheck + Claude review)
    │   └── FAIL → ❌ 阻断，禁止进入 P3
    │
    ├── P3: Test Verification (test + coverage + Claude verify)
    │   └── FAIL → ❌ 阻断，禁止进入 P4
    │
    ├── P4: Comprehensive Review (PRD trace + security + integration)
    │   └── FAIL → ❌ 阻断，禁止部署
    │
    ├── P5: Deploy Checklist (gate summary + changelog)
    │
    └── Gate Summary (P2+P3+P4+P5 状态总览)
```

## 首次配置

### 1. 设置 GitHub Secrets

运行设置脚本：

```bash
bash scripts/ci/setup-github-secrets.sh
```

或手动设置（GitHub → Settings → Secrets and variables → Actions）：

| Secret | 说明 |
|--------|------|
| `ANTHROPIC_AUTH_TOKEN` | API 密钥（DeepSeek 或 Anthropic） |
| `ANTHROPIC_BASE_URL` | API 端点（默认 `https://api.deepseek.com/anthropic`） |
| `ANTHROPIC_MODEL` | 模型名称（默认 `deepseek-v4-pro`） |

### 2. 触发 CI

CI 在以下情况下自动运行：

- Push 到 `feature/**` / `fix/**` 分支
- 创建 PR 到 `main`
- 手动触发（Actions → SDLC Pipeline → Run workflow）

### 3. 安全扫描

每日 UTC 9:00 自动运行。发现高危漏洞自动创建 GitHub Issue。

## 分支策略

```
main          ← PR merge only (通过 P4 后才能合并)
  ├── feature/xxx   ← 自动触发 P2 → P3
  ├── fix/xxx       ← 自动触发 P2 → P3
  └── refactor/xxx  ← 自动触发 P2 → P3
```

## CI 报告

每次运行后，CI 报告保存在：
- `ci-reports/` 目录（GitHub Actions Artifact）
- GitHub Step Summary（Action 运行页面底部）
