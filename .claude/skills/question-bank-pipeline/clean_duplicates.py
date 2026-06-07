"""题库清洗：去重 + 错误过滤"""
import json, re, os, requests

INPUT = r'D:\project\kaoshi\public\data\hr\questions.json'
API = 'http://localhost:3001'

with open(INPUT, 'r', encoding='utf-8') as f:
    qs = json.load(f)

print(f'Before: {len(qs)}')

# 过滤规则
stats = {'short':0,'no_opt':0,'no_ans':0,'garbled':0,'ad':0,'header':0,'ans_mismatch':0,'dup':0}

def cn_ratio(text):
    cn = len(re.findall(r'[一-鿿]', text))
    return cn / max(len(text), 1)

def is_garbled(stem):
    return cn_ratio(stem) < 0.25 and len(stem) > 5

AD_RE = re.compile(r'QQ|微信|关注|免费提供|押题|扫码|公众号|VX|wx\d|联系.*课程', re.I)
HEADER_RE = [
    re.compile(r'^\d{4}\.\d{1,2}\.\d{1,2}'),
    re.compile(r'^[一二三四五六七八九十]、\s*(单选|多选|案例|判断|综合)'),
    re.compile(r'^中级经济师'),
    re.compile(r'^第[一二三四五六七八九十\d]+章\s'),
]

valid = []
seen = set()

for q in qs:
    stem = q.get('stem','').strip()
    opts = q.get('options',[])
    ans = q.get('answer','').strip().upper()

    if len(stem) < 10:
        stats['short'] += 1; continue
    if not isinstance(opts, list) or len(opts) < 2:
        stats['no_opt'] += 1; continue
    if not ans:
        stats['no_ans'] += 1; continue
    if is_garbled(stem):
        stats['garbled'] += 1; continue
    if AD_RE.search(stem):
        stats['ad'] += 1; continue

    is_header = False
    for pat in HEADER_RE:
        if pat.match(stem):
            stats['header'] += 1; is_header = True; break
    if is_header: continue

    # 答案验证
    valid_keys = set()
    for o in opts:
        m = re.match(r'^([A-E])', str(o).strip())
        if m: valid_keys.add(m.group(1))
    if not valid_keys:
        valid_keys = set(chr(65+i) for i in range(len(opts)))
    ans_set = set(ans.upper())
    if not ans_set.issubset(valid_keys) and not all(a in 'ABCDE' for a in ans_set):
        stats['ans_mismatch'] += 1; continue

    # 去重
    key = stem[:80].replace(' ','').replace('\n','')
    if key in seen:
        stats['dup'] += 1; continue
    seen.add(key)
    valid.append(q)

# 保存
with open(INPUT, 'w', encoding='utf-8') as f:
    json.dump(valid, f, ensure_ascii=False, indent=2)

removed = len(qs) - len(valid)
for k, v in sorted(stats.items(), key=lambda x: -x[1]):
    if v > 0: print(f'  {k}: {v}')
print(f'After: {len(valid)} (removed {removed})')

# 上传
try:
    r = requests.post(f'{API}/api/questions/batch',
        json={'subjectId':'hr','questions':valid}, timeout=300)
    res = r.json()
    ins = res.get('inserted', 0)
    tot = res.get('afterCount', 0)
    print(f'API: inserted={ins}, total={tot}')
except Exception as e:
    print(f'API error: {e}')
