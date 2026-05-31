#!/bin/bash
# Claude Code CI Runner — Headless execution for GitHub Actions
# Usage: bash scripts/ci/claude-ci-runner.sh <phase>
# Phases: p2-code-review | p3-test-verify | p4-comprehensive-review | p5-deploy-checklist

set -euo pipefail

PHASE="${1:-p2-code-review}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
REPORT_DIR="ci-reports"
mkdir -p "$REPORT_DIR"

# Colour helpers
red()   { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
cyan()  { echo -e "\033[36m$*\033[0m"; }

log_header() {
    echo ""
    echo "============================================"
    echo "  Claude Code CI — $1"
    echo "  Time: $TIMESTAMP"
    echo "============================================"
    echo ""
}

# ------------------------------------------------------------------
# Check prerequisites
# ------------------------------------------------------------------
check_prereqs() {
    if ! command -v node &>/dev/null; then
        red "[FAIL] Node.js not found. Install it: https://nodejs.org"
        exit 1
    fi

    if [ -z "${ANTHROPIC_AUTH_TOKEN:-}" ]; then
        red "[FAIL] ANTHROPIC_AUTH_TOKEN not set. Add it to GitHub Secrets."
        exit 1
    fi

    if [ -n "${ANTHROPIC_BASE_URL:-}" ]; then
        cyan "[INFO] Using custom API base: $ANTHROPIC_BASE_URL"
    fi

    green "[OK] Prerequisites satisfied."
}

# ------------------------------------------------------------------
# Install Claude Code CLI if not present
# ------------------------------------------------------------------
install_claude_cli() {
    if command -v claude &>/dev/null; then
        green "[OK] Claude Code CLI found: $(claude --version 2>&1 || echo 'version unknown')"
        return
    fi

    cyan "[INFO] Installing Claude Code CLI..."
    npm install -g @anthropic-ai/claude-code 2>&1 || {
        red "[FAIL] Could not install Claude Code CLI."
        exit 1
    }
    green "[OK] Claude Code CLI installed."
}

# ------------------------------------------------------------------
# Run Claude Code in headless mode with timeout
# ------------------------------------------------------------------
run_claude() {
    local phase="$1"
    local prompt_file="scripts/ci/prompts/${phase}.txt"
    local output_file="$REPORT_DIR/${phase}-${TIMESTAMP}.md"
    local prompt=""

    if [ -f "$prompt_file" ]; then
        prompt=$(cat "$prompt_file")
        cyan "[INFO] Using prompt from: $prompt_file"
    else
        cyan "[INFO] No prompt file found, using inline prompt for: $phase"
        prompt=$(get_inline_prompt "$phase")
    fi

    if [ -z "$prompt" ]; then
        red "[FAIL] Empty prompt for phase: $phase"
        exit 1
    fi

    cyan "[INFO] Running Claude Code headless ($phase)..."
    cyan "[INFO] Report will be saved to: $output_file"

    # Run with 10-minute timeout
    set +e
    timeout 600 claude --headless --print "$prompt" > "$output_file" 2>&1
    local exit_code=$?
    set -e

    echo "Exit code: $exit_code" >> "$output_file"

    if [ $exit_code -eq 0 ]; then
        green "[PASS] Phase $phase completed successfully."
        cat "$output_file"
    elif [ $exit_code -eq 124 ]; then
        red "[FAIL] Phase $phase timed out (10 minutes)."
        cat "$output_file"
        exit 1
    else
        red "[FAIL] Phase $phase exited with code $exit_code."
        cat "$output_file"
        exit 1
    fi
}

# ------------------------------------------------------------------
# Inline prompts (fallback if no prompt file exists)
# ------------------------------------------------------------------
get_inline_prompt() {
    case "$1" in
        p2-code-review)
            cat <<'PROMPT'
执行 P2 编码审查。严格按以下步骤：

1. 读取 .claude/project-state.json 了解当前阶段
2. 检查本次 PR/commit 变更的所有文件
3. 运行项目配置的 linter（如果有）
4. 检查代码是否符合 CLAUDE.md 中的编码规范：
   - PRD 约束（无 PRD 外功能）
   - 函数≤50行、嵌套≤3层
   - OWASP 安全规范（SQL注入、XSS、硬编码密钥）
   - UI 规范（如果涉及前端代码）
5. 输出审查报告，第一行必须是 PASS 或 FAIL
   如果 FAIL，列出具体问题和修复建议。
PROMPT
            ;;
        p3-test-verify)
            cat <<'PROMPT'
执行 P3 测试验证。严格按以下步骤：

1. 运行项目的测试套件
2. 检查测试覆盖率（目标：行≥80%，关键业务≥90%，分支≥70%）
3. 检查是否有 PRD 需求缺少测试覆盖
4. 如果涉及 UI，检查是否有响应式测试和可访问性测试
5. 输出测试报告，第一行必须是 PASS 或 FAIL
   列出：通过/失败/跳过的测试数量、覆盖率、未覆盖的 PRD 需求。
PROMPT
            ;;
        p4-comprehensive-review)
            cat <<'PROMPT'
执行 P4 综合审查。严格按以下步骤：

1. PRD 追溯：每条 PRD 需求 → 对应代码 → 对应测试。输出追溯表。
2. 安全检查：SQL注入、XSS、目录遍历、硬编码密钥、日志泄露。
3. 集成一致性：检查模块间接口是否匹配，有无重复代码。
4. 如果有 UI 变更：Lighthouse ≥90、axe-core 0 违规、响应式 3 断点。
5. 输出审查报告，第一行必须是 PASS 或 FAIL。
PROMPT
            ;;
        p5-deploy-checklist)
            cat <<'PROMPT'
执行 P5 部署检查。严格按以下步骤：

1. 验证所有前置门禁：P2(编码) → P3(测试) → P4(审查) 全部通过
2. 检查 Git 状态：无未提交变更
3. 构建检查：项目能否成功构建
4. 生成 CHANGELOG 摘要
5. 输出部署就绪报告，第一行必须是 READY 或 NOT_READY
PROMPT
            ;;
        *)
            echo ""
            ;;
    esac
}

# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
main() {
    log_header "$PHASE"
    check_prereqs
    install_claude_cli
    run_claude "$PHASE"
    echo ""
    green "=== Phase $PHASE: DONE ==="
}

main
