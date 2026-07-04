# 极简智考 开发经验库

> 自动积累·每次debug后更新

## 2026-07-04 五层质量门禁建立

### 问题1: AI出题5次修不好
- **症状**: 点击按钮→"AI出题暂不可用"
- **根因**: 服务端index.js多余`}`→SyntaxError→Node.js崩溃→PM2假在线→502
- **发现**: Debug面板显示POST 502,不是前端问题
- **修复**: 删除多余`}`, 原子化部署
- **预防**: L3部署前语法检查 + L5 Debug面板

### 问题2: 部分文件部署
- **症状**: 修复语法后仍502
- **根因**: index.js import了captureError但zhice-pipeline.js未传→缺少export
- **修复**: rsync --delete 整个server目录
- **预防**: L3原子化部署

### 问题3: 浏览器缓存旧JS
- **症状**: 改了代码用户看不到
- **根因**: 浏览器缓存旧JS文件
- **修复**: nginx `Cache-Control: no-cache`
- **预防**: L5版本化缓存

### 问题4: 模板内script不执行
- **症状**: 按钮onclick无响应
- **根因**: innerHTML注入的`<script>`标签不执行
- **修复**: window.xxx = function(){} 在模块顶层定义
- **预防**: L1 pre-commit语法检查

### 问题5: Vite动态import生产构建失败
- **症状**: 模块加载404
- **根因**: 动态import的chunk文件名在生产构建中变化
- **修复**: 改用静态import
- **预防**: L2构建时验证关键API在产物中

### 问题6: 502 = 服务器死了
- **经验**: API返回502→先检查PM2是否真的在监听端口,不是查API逻辑
- **诊断**: `ssh pm2 logs` → 看SyntaxError → 定位根因
- **预防**: L4部署后冒烟测试

## 预防体系（按优先级）

1. **每次部署前**: `npm run deploy` (自动9步验证)
2. **每次提交前**: `.husky/pre-commit` (自动语法+构建检查)
3. **用户端出错**: 点🐛打开Debug面板 (实时看请求和错误)
4. **API异常**: 先检查PM2日志再查API逻辑
