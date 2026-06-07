# 题库数据处理流水线 (Question Bank Pipeline)

## 触发条件
- "处理题库" "清洗题库" "导入题库" "题库标准化"
- "提取题目" "PDF转JSON" "批量上传题目"
- 新增考试品类时

## 流水线总览

```
PDF源文件 → [阶段1] 提取为JSON → [阶段2] 去重清洗 → [阶段3] 增强标注 → [阶段4] 上传API
```

## 阶段说明

### 阶段1：PDF提取（scratch/extract_pdf.py）
- **输入**: D:\kaoshi-wangpan\ 下的 PDF 文件（文本型用 pdfplumber，扫描件用 LLM Vision）
- **输出**: 同目录下 `*_题库.json`（初步结构化）
- **格式**: `[{type, stem, options, answer, analysis, difficulty, tags, source_file}]`

### 阶段2：去重清洗（scratch/clean_duplicates.py）
- 过滤：无选项/无答案/题干<10字/OCR乱码/广告/PDF页眉页脚
- 去重：题干前80字相似度匹配
- 答案验证：检查answer字母是否匹配选项
- **命令**: `python scratch/clean_duplicates.py`

### 阶段3：增强标注（scratch/enrich_questions.py）
- 真题标记：从文件名自动判断 source_type（真题/习题/笔记/讲义）
- 题型检测：从answer格式自动判断 single/multiple
- 章节标注：关键词匹配（19章 × 每章10-20个关键词）
- 模块标注：章节→模块映射
- 难度推断：真题+1、否定词+1、多选+1
- UUID：自动生成唯一ID
- **命令**: `python scratch/enrich_questions.py`

### 阶段4：API上传（server/index.js）
- POST /api/questions/batch：批量上传，自动去重（ID+题干双检）
- 返回 {inserted, duplicated, errors, beforeCount, afterCount}
- **服务器需先启动**: `node server/index.js`

## 新增科目 Checklist
1. 将科目PDF放入 D:\kaoshi-wangpan\{科目名}\
2. 在 enrich_questions.py 中新增科目的章节关键词映射
3. 在 subjects.json 中新增科目条目
4. 在 subjects-meta.js 中新增科目章节树
5. 运行流水线

## 质量指标
- 有效率 > 85%（过滤掉<15%）
- 去重后≥800题/科
- 章节覆盖率 ≥ 70%
- 真题标记准确率 100%（基于文件名）
