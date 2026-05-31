# Hook: 每次 Write/Edit 后自动生成变更摘要
# 退出码: 0 = 允许继续, 2 = 阻止并要求修正

$changedFiles = @(Get-ChildItem -Path "d:\project\kaoshi" -Recurse -Include "*.js","*.css","*.html","*.json" -File -ErrorAction SilentlyContinue)

# 仅做记录，不阻断 — 退出码 0 表示允许
Write-Output "[Hook] 文件变更检测完成，涉及 $($changedFiles.Count) 个潜在文件。"
exit 0
