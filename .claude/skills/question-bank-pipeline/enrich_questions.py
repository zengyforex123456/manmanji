"""题库增强：真题标记 + 题型检测 + 章节关键词 + UUID"""
import json, os, glob, re, requests, uuid

SOURCE_DIR = r'D:\kaoshi-wangpan'
OUTPUT_DIR = r'D:\project\kaoshi\public\data'
API = 'http://localhost:3001'

# ─── 科目映射 ───
SUBJ_MAP = {'人力':'hr', '工商':'biz', '基础':'econ'}

# ─── 题型检测（从答案格式推测） ───
def detect_type(q):
    ans = q.get('answer','').strip().upper()
    stem = q.get('stem','')
    # 答案含多个字母 → 多选
    if re.match(r'^[A-E]{2,}$', ans):
        return 'multiple'
    # 题干含判断关键词
    if re.search(r'正确|错误|正确.*错误|属于|不属于|是|不是|包括|不包括', stem):
        pass  # 保持原type
    if q.get('type') in ('single','multiple','case'):
        return q['type']
    return 'single' if len(ans) == 1 else 'multiple'

# ─── 真题标记（从文件名） ───
def detect_source_type(filepath):
    name = os.path.basename(filepath)
    if '真题' in name:
        return '真题'
    if '习题' in name or '母题' in name:
        return '习题'
    if '笔记' in name or '四色' in name or '三色' in name:
        return '笔记'
    if '讲义' in name:
        return '讲义'
    return '其他'

# ─── 科目推断 ───
def detect_subject(filepath):
    for kw, sid in SUBJ_MAP.items():
        if kw in filepath:
            return sid
    return None

# ─── 人力19章关键词 ───
HR_CHAPTERS = {
    1: ['激励','动机','内源性','外源性','需要层次','双因素','ERG','三重需要','参与管理',
        '目标管理','期望理论','公平理论','强化','工作特征','工作设计'],
    2: ['领导','魅力型','生命周期','路径目标','权变','管理方格','特质','领导风格','决策'],
    3: ['组织设计','组织文化','组织变革','矩阵','职能制','事业部','虚拟组织','无边界','学习型组织'],
    4: ['战略性人力资源','战略匹配','人力资本','平衡计分卡','高绩效工作系统','人力资源指数'],
    5: ['人力资源规划','需求预测','供给预测','马尔可夫','德尔菲','回归分析','趋势外推','比率分析'],
    6: ['甄选','面试','结构化面试','非结构化','情景模拟','心理测试','评价中心','信度','效度','录用','MBTI'],
    7: ['绩效管理','绩效考核','KPI','360度','关键绩效','目标管理','行为锚定','配对比较','强制分布'],
    8: ['薪酬','工资','奖金','福利','岗位评价','因素比较','薪酬调查','宽带薪酬','股权激励'],
    9: ['培训','开发','职业生涯','培训评估','在职培训','脱产培训','柯氏','学习型组织'],
    10: ['劳动关系','集体合同','工会','集体谈判','员工参与','产业关系','劳资'],
    11: ['劳动力市场','劳动力供给','劳动力需求','工资率','收入效应','替代效应','劳动参与率'],
    12: ['就业','失业','工资差别','补偿性工资','效率工资','最低工资','菲利普斯','就业弹性'],
    13: ['人力资本','教育投资','培训投资','一般培训','特殊培训','高等教育','内部收益率'],
    14: ['劳动合同','竞业限制','解除','经济补偿','试用期','劳务派遣','非全日制','违约金','服务期'],
    15: ['社会保险','养老','医疗','工伤','失业','生育','缴费','参保','社保','保险待遇'],
    16: ['社会保险基金','统筹','个人账户','待遇领取','缴费基数','社会化管理'],
    17: ['劳动争议','仲裁','调解','诉讼','举证','终局裁决','仲裁时效'],
    18: ['法律责任','行政处罚','行政责任','民事赔偿','刑事责任','劳动监察','罚款'],
    19: ['人力资源开发','人才开发','职业资格','技能人才','人才评价','职称','继续教育','人才流动','终身学习'],
}

CH_TO_MODULE = {}
for ch in range(1,4): CH_TO_MODULE[ch] = 'org_behavior'
for ch in range(4,10): CH_TO_MODULE[ch] = 'hr_management'
for ch in range(10,14): CH_TO_MODULE[ch] = 'labor_econ'
for ch in range(14,20): CH_TO_MODULE[ch] = 'labor_law'

MODULE_NAMES = {
    'org_behavior': '组织行为学',
    'hr_management': '人力资源管理',
    'labor_econ': '劳动力市场',
    'labor_law': '劳动法律与社会保险',
}

# ─── 难度推断 ───
def infer_difficulty(q):
    t = q.get('type','single')
    stem = q.get('stem','')
    tags = q.get('tags',[])
    # 多选/案例默认+1难度
    if t in ('multiple','case'):
        return min(5, 4)
    # 含"错误的是""不属于"等否定词 → 难度+1
    if re.search(r'错误|不属于|不正确|不是|不包括|除了', stem):
        return min(5, q.get('difficulty',3) + 1)
    # 真题通常3-4
    if q.get('source_type') == '真题':
        return 4
    return q.get('difficulty', 3) or 3

# ─── 标准化处理 ───
def process_file(filepath):
    sid = detect_subject(filepath)
    if not sid: return []

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except:
        return []
    if not isinstance(data, list):
        return []

    source_type = detect_source_type(filepath)
    source_name = os.path.basename(filepath).replace('_题库.json','') + '.pdf'
    results = []

    for q in data:
        stem = q.get('stem','').strip()
        # 过滤
        if len(stem) < 5: continue
        if re.search(r'QQ|微信|关注|免费|押题|扫码|加微信', stem, re.I): continue

        # 题型检测
        qtype = detect_type(q)

        # 章节推断（仅人力有完整关键词）
        chapter = 0
        tags = list(q.get('tags', []))
        if sid == 'hr':
            best_ch, best_score = 0, 0
            for ch, keywords in HR_CHAPTERS.items():
                score = sum(1 for kw in keywords if kw in stem)
                if score > best_score:
                    best_score, best_ch = score, ch
            if best_score >= 2:
                chapter = best_ch
                tags = [f'第{best_ch}章'] + [kw for kw in HR_CHAPTERS.get(best_ch,[]) if kw in stem][:3]

        module = CH_TO_MODULE.get(chapter, '') if chapter > 0 else ''
        difficulty = infer_difficulty({'type':qtype,'stem':stem,'difficulty':q.get('difficulty',3),'source_type':source_type,'tags':tags})

        results.append({
            'id': str(uuid.uuid4())[:12],
            'type': qtype,
            'stem': stem,
            'options': q.get('options', []),
            'answer': q.get('answer', '').strip(),
            'analysis': q.get('analysis', '').strip(),
            'difficulty': difficulty,
            'tags': tags if tags else q.get('tags', []),
            'module': module,
            'chapter': chapter,
            'mnemonic': q.get('mnemonic', ''),
            'newContent': q.get('newContent', False),
            'accuracy': q.get('accuracy', 0.6) or 0.6,
            'source_type': source_type,
            'source': source_name,
        })

    return results

# ─── 主流程 ───
all_qs = {}
files = glob.glob(os.path.join(SOURCE_DIR, '**', '*_题库.json'), recursive=True)
print(f'Processing {len(files)} files...')

for fp in files:
    qs = process_file(fp)
    if not qs: continue
    sid = detect_subject(fp)
    if sid not in all_qs: all_qs[sid] = []
    all_qs[sid].extend(qs)

# 去重
for sid in all_qs:
    seen = set()
    uniq = []
    for q in all_qs[sid]:
        key = q['stem'][:60]
        if key in seen: continue
        seen.add(key)
        uniq.append(q)
    all_qs[sid] = uniq

    # 重新生成顺序ID
    for i, q in enumerate(all_qs[sid]):
        q['id'] = f"{sid}-q{i+1:05d}"

    # 保存
    outdir = os.path.join(OUTPUT_DIR, sid)
    os.makedirs(outdir, exist_ok=True)
    outfile = os.path.join(outdir, 'questions.json')
    with open(outfile, 'w', encoding='utf-8') as f:
        json.dump(all_qs[sid], f, ensure_ascii=False, indent=2)

    # 统计
    chs = set(q['chapter'] for q in all_qs[sid] if q['chapter']>0)
    types = {}
    srcs = {}
    for q in all_qs[sid]:
        types[q['type']] = types.get(q['type'],0)+1
        srcs[q.get('source_type','?')] = srcs.get(q.get('source_type','?'),0)+1

    print(f'\n{sid}: {len(all_qs[sid])} questions')
    print(f'  Chapters: {len(chs)}/19, Types: {types}')
    print(f'  Sources: {srcs}')

    # 上传
    try:
        r = requests.post(f'{API}/api/questions/batch',
            json={'subjectId':sid,'questions':all_qs[sid]}, timeout=300)
        res = r.json()
        ins = res.get('inserted', 0)
        tot = res.get('afterCount', 0)
        print(f'  API: inserted={ins}, total={tot}')
    except Exception as e:
        print(f'  API error: {e}')

print('\nDone.')
