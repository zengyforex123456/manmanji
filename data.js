// data.js - 「慢慢记」全职业考试通用备考数据库

const COURSE_DATA = {
  subjects: [
    { id: "econ", name: "中级经济师·经济基础" },
    { id: "hr", name: "中级经济师·人力资源" },
    { id: "biz", name: "中级经济师·工商管理" }
  ],
  
  chapters: {
    econ: [
      { id: "econ-ch1", name: "第一部分 经济学基础 - 需求与弹性" },
      { id: "econ-ch2", name: "第二部分 财政 - 财政政策乘数" }
    ],
    accounting: [
      { id: "acc-ch1", name: "第一章 资产 - 固定资产折旧" },
      { id: "acc-ch2", name: "第二章 负债及所有者权益 - 资产减值" }
    ],
    teacher: [
      { id: "teach-ch1", name: "第一部分 职业理念 - 素质教育" },
      { id: "teach-ch2", name: "第二部分 教师职业道德 - 规范守则" }
    ],
    social: [
      { id: "soc-ch1", name: "第一章 社会工作价值观 - 专业核心" }
    ],
    construct: [
      { id: "con-ch1", name: "第一章 施工管理 - 质量事故处理" }
    ],
    hr: [
      { id: "hr-ch1", name: "第一章 人力资源规划 - 需求预测" },
      { id: "hr-ch2", name: "第二章 招聘与配置 - 面试技巧" }
    ],
    tax: [
      { id: "tax-ch1", name: "第一章 税法一 - 增值税基础" },
      { id: "tax-ch2", name: "第二章 税法二 - 企业所得税" }
    ],
    acc_junior: [
      { id: "accj-ch1", name: "第一章 会计概述 - 会计要素" },
      { id: "accj-ch2", name: "第二章 资产 - 应收账款" }
    ]
  },
  
  keyPoints: {
    econ: [
      {
        id: "econ-kp101",
        chapterId: "econ-ch1",
        title: "需求价格弹性与总销售收入",
        star: 3,
        term: "需求价格弹性 (Elasticity of Demand)",
        interpretation: "昂贵的奢侈品降价能吸引很多人买（高弹性），商家应该【降价促销】；柴米油盐涨价大家也得买（低弹性），商家应该【适当涨价】。",
        mnemonic: "高弹降价，低弹涨价",
        contrast: {
          title: "定价销售策略对比",
          leftTitle: "高弹性商品 (Ed > 1)",
          leftContent: "价格微降，销量大增。必须【降价】来增加收入。",
          rightTitle: "低弹性商品 (Ed < 1)",
          rightContent: "价格大涨，需求不减。适合【涨价】来增加收入。"
        },
        shortSentences: [
          "1. 需求价格弹性衡量需求量对价格变化的敏感度。",
          "2. 弹性大于1降价增收；弹性小于1涨价增收。",
          "3. 考试高频商品：奢侈品高弹性，医药低弹性。"
        ]
      },
      {
        id: "econ-kp102",
        chapterId: "econ-ch2",
        title: "财政乘数的正负号与大小",
        star: 3,
        term: "财政乘数 (Fiscal Multipliers)",
        interpretation: "政府花钱（投资拉动）是往池子里倒水，拉动经济为正数；政府多收税是从百姓兜里抢水，抑制消费为负数。支出乘数永远比税收乘数绝对值大1。",
        mnemonic: "税收乘数为负，支出乘数为正",
        contrast: {
          title: "财政政策工具效果对比",
          leftTitle: "政府购买支出乘数 (正值)",
          leftContent: "资金直接进入循环，乘数为正，扩大国民收入。",
          rightTitle: "税收乘数 (负值)",
          rightContent: "拿走民间资本，乘数为负，收缩国民收入。"
        },
        shortSentences: [
          "1. 政府购买支出乘数是正数，国民收入倍数增加。",
          "2. 税收乘数是负数，税收增加国民收入反而减少。",
          "3. 绝对值差值恒等于1（政府支出乘数大）。"
        ]
      }
    ],
    accounting: [
      {
        id: "acc-kp101",
        chapterId: "acc-ch1",
        title: "固定资产折旧计提方法",
        star: 3,
        term: "折旧计提方法 (Depreciation Methods)",
        interpretation: "固定资产折旧最常考双倍余额递减法和年数总和法。这两种方法在初期折旧扣得多，后面扣得少，是为了早点收回资金、推迟纳税。",
        mnemonic: "双倍直线，年数递减",
        contrast: {
          title: "双倍余额递减法 vs 年数总和法",
          leftTitle: "双倍余额递减法 (初期不减残值)",
          leftContent: "折旧率 = 2 / 折旧年限。前几年计提时不扣除预计净残值，最后两年改为直线法扣除残值。",
          rightTitle: "年数总和法 (扣除残值计算)",
          rightContent: "折旧率 = 尚可使用年限 / 年数总和。计算时每一期都必须扣除预计净残值。"
        },
        shortSentences: [
          "1. 两种方法都属于加速折旧法，初期折旧额大，后期折旧额小。",
          "2. 双倍法前中期不扣残值，年数法全程必须扣残值。",
          "3. 最后两年双倍余额法必须改回平均年限法计提。"
        ]
      },
      {
        id: "acc-kp102",
        chapterId: "acc-ch2",
        title: "固定资产减值准备的不得转回",
        star: 3,
        term: "资产减值损失 (Asset Impairment)",
        interpretation: "公司买的厂房、设备如果贬值了，要记“资产减值损失”。为了防止公司老板利用减值损失在赚钱年份和亏钱年份来回操纵利润，国家规定：固定资产减值一经计提，以后年份绝对不能转回！",
        mnemonic: "减值一记，不得转回",
        contrast: {
          title: "固定资产减值 vs 存货跌价准备",
          leftTitle: "固定资产减值 (长期资产)",
          leftContent: "一经计提，在持有期间内【绝对不能转回】。防止利润操纵。",
          rightTitle: "存货跌价准备 (流动资产)",
          rightContent: "价值回升时【可以转回】，并冲减资产减值损失。"
        },
        shortSentences: [
          "1. 适用无形资产、固定资产等长期资产减值准则的资产，计提后不得转回。",
          "2. 存货、金融资产的减值准备在符合条件时可以转回。"
        ]
      }
    ],
    teacher: [
      {
        id: "teach-kp101",
        chapterId: "teach-ch1",
        title: "素质教育的核心内涵",
        star: 3,
        term: "素质教育内涵 (Quality Education)",
        interpretation: "考教资必背大题！素质教育就是：提高全民素质（提素）、面向全体学生（两全）、促进学生全面发展、促进学生个性发展（个性）、以培养学生的创新精神和实践能力为重点（创）。",
        mnemonic: "提素个性创两全",
        contrast: {
          title: "素质教育 vs 应试教育",
          leftTitle: "素质教育 (全面健康发展)",
          leftContent: "面向全体，着眼于学生德智体美全面素质，鼓励个性化与创新能力开发。",
          rightTitle: "应试教育 (分数至上选拔)",
          rightContent: "面向少数尖子生，片面追求升学率，死记硬背以应付考试。"
        },
        shortSentences: [
          "1. 素质教育是面向全体学生的教育，不是精英教育。",
          "2. 素质教育倡导全面发展，而非单一科目分数。",
          "3. 创新精神和实践能力是素质教育的灵魂和核心。"
        ]
      },
      {
        id: "teach-kp102",
        chapterId: "teach-ch2",
        title: "中小学教师职业道德规范",
        star: 3,
        term: "教师职业道德 (Teacher Ethics)",
        interpretation: "教资考试核心大题背诵。道德规范有六条：爱国守法、爱岗敬业（三爱）、关爱学生、教书育人、为人师表（两人）、终身学习（一终身）。",
        mnemonic: "三爱两人一终身",
        contrast: {
          title: "教书育人 vs 为人师表规范",
          leftTitle: "教书育人 (核心天职)",
          leftContent: "循循善诱，因材施教。不唯分数论，培养学生良好品行。",
          rightTitle: "为人师表 (职业要求)",
          rightContent: "作风正派，严于律己，廉洁从教（不接受家长礼品/不开小灶）。"
        },
        shortSentences: [
          "1. 关爱学生是师德的灵魂，要求尊重学生人格，不体罚或变相体罚。",
          "2. 终身学习是教师专业发展的动力，要求不断提升学术水平和教育方法。"
        ]
      }
    ],
    social: [
      {
        id: "soc-kp101",
        chapterId: "soc-ch1",
        title: "社会工作专业价值观核心",
        star: 3,
        term: "社会工作专业价值观 (Social Work Values)",
        interpretation: "社工在帮人时要遵循什么准则？第一是接纳对方并给予绝对尊重；第二是不能强行替服务对象拿主意，要让他们自己做选择（自决）；第三是必须对对象的隐私高度保密。",
        mnemonic: "接纳尊重，自决私密",
        contrast: {
          title: "案主自决 vs 社工家长式指导",
          leftTitle: "案主自决 (尊重自决权)",
          leftContent: "向案主分析利弊，由【案主自己做决定】。承认服务对象的主动权。",
          rightTitle: "限制自决 (专业家长制)",
          rightContent: "当案主无决定能力（如幼儿、精神障碍）或决定自残、危害他人时，社工需介入代决。"
        },
        shortSentences: [
          "1. 接纳不等同于赞同，而是承认其作为人的基本权利与独立性。",
          "2. 自决是服务对象在知情同意下的自主权，但不是无限制的。"
        ]
      }
    ],
    construct: [
      {
        id: "con-kp101",
        chapterId: "con-ch1",
        title: "施工质量事故处理程序",
        star: 3,
        term: "质量事故处理程序 (Quality Accident Handling)",
        interpretation: "工地出了质量问题，处理有五个标准步骤：先向上级【汇报】；再进行现场事故【调查】；接着【制定处理方案】；然后实施【方案处理】；最后检查【核实】处理效果是否合格。",
        mnemonic: "报、调、案、处、核",
        contrast: {
          title: "事故处理步骤顺序",
          leftTitle: "前置步骤 (摸清底细)",
          leftContent: "【报】（事故报告）➔ 【调】（事故调查，分清责任和原因）。必须先调查清楚再制定对策。",
          rightTitle: "后置步骤 (方案落实)",
          rightContent: "【案】（方案设计）➔ 【处】（事故处理）➔ 【核】（验收核实效果）。"
        },
        shortSentences: [
          "1. 质量事故必须坚持“先调查、后设计、再施工处理”的科学顺序。",
          "2. 处理完成后必须进行严格的核实与检查验收，形成最终处理结论。"
        ]
      }
    ],
    hr: [
      {
        id: "hr-kp101",
        chapterId: "hr-ch1",
        title: "人力资源需求预测方法",
        star: 3,
        term: "需求预测法 (Demand Forecasting)",
        interpretation: "公司要招多少人？有两种预测方法：定性法靠专家拍脑袋开会讨论（德尔菲法）；定量法靠数据算数（回归分析法）。考试最爱考德尔菲法的特点：匿名、多轮、反馈、统计。",
        mnemonic: "定性靠专家，定量靠数据",
        contrast: {
          title: "定性预测 vs 定量预测",
          leftTitle: "定性法 (经验判断)",
          leftContent: "德尔菲法：匿名问卷→多轮反馈→最终统计。靠专家主观经验。",
          rightTitle: "定量法 (数据驱动)",
          rightContent: "回归分析法：用历史数据建模预测未来需求。靠客观数字说话。"
        },
        shortSentences: [
          "1. 德尔菲法核心四特点：匿名性、多轮反馈、统计汇总、专家独立判断。",
          "2. 定量法适合数据充足的大企业，定性法适合新兴行业。"
        ]
      },
      {
        id: "hr-kp102",
        chapterId: "hr-ch2",
        title: "结构化面试与非结构化面试",
        star: 3,
        term: "面试类型 (Interview Types)",
        interpretation: "面试分两种：结构化面试就像考试——题目固定、评分标准统一、每个人问一样的问题；非结构化面试就像聊天——面试官想问啥问啥，灵活但主观性强。",
        mnemonic: "结构像考试，非结构像聊天",
        contrast: {
          title: "结构化 vs 非结构化面试",
          leftTitle: "结构化面试 (标准化)",
          leftContent: "题目预设、评分统一、公平性高。适合大规模招聘筛选。",
          rightTitle: "非结构化面试 (灵活化)",
          rightContent: "无固定题目、面试官自由发挥。深度了解候选人但评价标准不统一。"
        },
        shortSentences: [
          "1. 结构化面试信度和效度最高，公平性最强。",
          "2. 非结构化面试灵活但容易产生面试官偏见。"
        ]
      }
    ],
    tax: [
      {
        id: "tax-kp101",
        chapterId: "tax-ch1",
        title: "增值税一般纳税人与小规模纳税人",
        star: 3,
        term: "纳税人分类 (Taxpayer Classification)",
        interpretation: "增值税把纳税人分两类：年销售额超500万的是【一般纳税人】，可以抵扣进项税（买东西的税能退回来）；没超500万的是【小规模纳税人】，税率低但不能抵扣。",
        mnemonic: "五百万分界，一般能抵扣",
        contrast: {
          title: "一般纳税人 vs 小规模纳税人",
          leftTitle: "一般纳税人 (年销>500万)",
          leftContent: "适用13%/9%/6%税率，可以用进项税抵扣销项税，税负可控。",
          rightTitle: "小规模纳税人 (年销≤500万)",
          rightContent: "适用3%征收率（疫情期间可减按1%），不能抵扣进项税，简易计税。"
        },
        shortSentences: [
          "1. 年应税销售额超过500万元必须登记为一般纳税人。",
          "2. 一般纳税人核心优势：进项税额可以抵扣。"
        ]
      }
    ],
    acc_junior: [
      {
        id: "accj-kp101",
        chapterId: "accj-ch1",
        title: "会计六大要素",
        star: 3,
        term: "会计要素 (Accounting Elements)",
        interpretation: "会计把公司的钱分成六个抽屉来管：资产（公司有的东西）、负债（欠别人的钱）、所有者权益（老板的钱）——这三个看家底；收入（赚的钱）、费用（花的钱）、利润（赚减花）——这三个看赚亏。",
        mnemonic: "资负所看家底，收费利看赚亏",
        contrast: {
          title: "静态要素 vs 动态要素",
          leftTitle: "静态三要素 (资产负债表)",
          leftContent: "资产 = 负债 + 所有者权益。反映某一时点的财务状况（家底）。",
          rightTitle: "动态三要素 (利润表)",
          rightContent: "利润 = 收入 - 费用。反映某一期间的经营成果（赚亏）。"
        },
        shortSentences: [
          "1. 会计恒等式：资产 = 负债 + 所有者权益，永远成立。",
          "2. 利润 = 收入 - 费用，是衡量企业经营成果的核心公式。"
        ]
      }
    ]
  },
  
  audios: {
    econ: [
      {
        id: "econ-aud1",
        chapterId: "econ-ch1",
        title: "5分钟速记：需求价格弹性与商家定价策略",
        duration: "04:50",
        notes: "本期重点掌握“高弹降价、低弹涨价”的商业应用。食盐海量消费且无替代品，属于低弹性，适合适当涨价；名牌奢侈品降价能极大刺激消费，属于高弹性，适合降价促销。",
        subtitles: [
          { time: 0, text: "大龄考生朋友们好，今天我们用白话学一个必考点：需求弹性。" },
          { time: 5, text: "什么叫弹性？就是价格变动对买家购买数量的影响程度。" },
          { time: 11, text: "请记住口诀：高弹降价，低弹涨价。" },
          { time: 16, text: "比如食盐，哪怕价格涨一倍，你家炒菜也得放盐，不可能少吃。" },
          { time: 22, text: "这就是低弹性。对于这种少不了的东西，商家涨价，销售额反而会上升。" },
          { time: 29, text: "再比如名牌皮包，价格贵一点点，大家就去买别的牌子了。" },
          { time: 35, text: "这就是高弹性。对于可买可不买的东西，商家要想多赚钱，就得降价促销。" },
          { time: 42, text: "考试看到低弹性商品，选涨价；看到高弹性商品，选降价促销。下期再见！" }
        ]
      }
    ],
    accounting: [
      {
        id: "acc-aud1",
        chapterId: "acc-ch1",
        title: "6分钟精讲：搞懂固定资产折旧的加速计算",
        duration: "05:10",
        notes: "中级会计师核心难点：双倍余额递减法和年数总和法。口诀是“双倍直线，年数递减”。前者前中期不扣残值，年数法全程必须扣除预计净残值计算折旧额。",
        subtitles: [
          { time: 0, text: "各位大龄会计备考考友，今天我们来讲固定资产加速折旧。" },
          { time: 5, text: "大家记熟八字口诀：双倍直线，年数递减。" },
          { time: 10, text: "双倍余额递减法，前面的年份折旧率是折旧年限倒数的两倍。" },
          { time: 16, text: "算的时候千万别扣除残值。直到最后两年，才改为直线折旧法并扣除残值。" },
          { time: 23, text: "而年数总和法，是用时尚可使用年限除以使用年数总和。" },
          { time: 29, text: "记住，年数总和法从第一年开始，计算时就必须先减去预计净残值！" },
          { time: 36, text: "考试经常在这两个残值扣不扣的细节上挖坑。熟记口诀，轻松避开陷阱。" }
        ]
      }
    ],
    teacher: [
      {
        id: "teach-aud1",
        chapterId: "teach-ch1",
        title: "6分钟大题通关：素质教育核心内涵",
        duration: "05:40",
        notes: "教师资格证必考大题，素质教育的内涵。口诀：“提素个性创两全”。背熟这句口诀，大题能拿到80%的分数！",
        subtitles: [
          { time: 0, text: "大龄备考教资的朋友们，今天来攻克科目一必考的材料分析大题。" },
          { time: 6, text: "题目问到素质教育内涵，口诀是：提素个性创两全。" },
          { time: 12, text: "提素：即提高国民素质是根本宗旨。个性：促进学生个性发展。" },
          { time: 18, text: "创：以培养创新精神和实践能力为重点。这是素质教育的核心。" },
          { time: 24, text: "两全：面向全体学生，以及促进学生全面发展。" },
          { time: 30, text: "答大题时，先写出这几个内涵，再结合材料分析，分数就稳稳拿下了！" }
        ]
      }
    ],
    social: [
      {
        id: "soc-aud1",
        chapterId: "soc-ch1",
        title: "5分钟秒杀：社会工作专业价值观金律",
        duration: "04:30",
        notes: "社会工作师价值观考点。口诀：“接纳尊重，自决私密”。社工要尊重服务对象的选择权，并保护其个人隐私。",
        subtitles: [
          { time: 0, text: "大家好，今天来学社会工作价值观。很多人容易把专业指导跟强行决定混淆。" },
          { time: 6, text: "请牢记口诀：接纳尊重，自决私密。" },
          { time: 11, text: "社工对待服务对象，无论其背景如何，都要表示接纳与尊重。" },
          { time: 17, text: "自决就是尊重对象的自主决定权，不能越俎代庖替他选。" },
          { time: 23, text: "私密则是保密原则，案主的家庭秘密、隐私信息，不能向外界泄露。" },
          { time: 29, text: "自决也有例外，如自残、危害社会时应限制自决。记牢口诀下期见！" }
        ]
      }
    ],
    construct: [
      {
        id: "con-aud1",
        chapterId: "con-ch1",
        title: "5分钟精通：建造师事故处理五个标准程序",
        duration: "04:15",
        notes: "二级建造师质量管理核心点。事故处理步骤口诀：“报、调、案、处、核”。必须严格遵循科学顺序。",
        subtitles: [
          { time: 0, text: "建工考友们好，今天我们讲施工质量事故的处理流程。" },
          { time: 5, text: "工地出了事故不能慌。顺序口诀：报、调、案、处、核。" },
          { time: 11, text: "报：先打报告往上层汇报；调：派专人去事故现场作原因调查；" },
          { time: 17, text: "案：针对原因制定专门的设计处理方案；处：照着方案实施处理；" },
          { time: 24, text: "核：处理完进行质量核实，合格才算完工。记好顺序，稳拿两分！" }
        ]
      }
    ],
    hr: [
      {
        id: "hr-aud1",
        chapterId: "hr-ch1",
        title: "5分钟速记：德尔菲法四大核心特征",
        duration: "04:40",
        notes: "人力资源管理师高频考点。德尔菲法口诀："定性靠专家，定量靠数据"。记住四个关键词：匿名、多轮、反馈、统计。",
        subtitles: [
          { time: 0, text: "备考HR的朋友们好，今天我们学人力资源需求预测的核心考点。" },
          { time: 6, text: "记住八字口诀：定性靠专家，定量靠数据。" },
          { time: 12, text: "定性法最爱考的是德尔菲法，它有四个特点：匿名、多轮、反馈、统计。" },
          { time: 18, text: "就是找一群专家，匿名填问卷，反复几轮后汇总统计结果。" },
          { time: 24, text: "定量法则是用历史数据建模型来预测。记住口诀，选择题稳拿分！" }
        ]
      }
    ],
    tax: [
      {
        id: "tax-aud1",
        chapterId: "tax-ch1",
        title: "6分钟搞懂：增值税纳税人分类标准",
        duration: "05:20",
        notes: "税务师增值税必考点。口诀："五百万分界，一般能抵扣"。年销售额500万是分水岭。",
        subtitles: [
          { time: 0, text: "税务师备考的朋友们好，增值税纳税人分类是必考必拿分的考点。" },
          { time: 6, text: "口诀：五百万分界，一般能抵扣。" },
          { time: 12, text: "年应税销售额超过500万，必须登记为一般纳税人。" },
          { time: 18, text: "一般纳税人最大的好处是进项税额可以抵扣，买东西付的税能退回来。" },
          { time: 24, text: "小规模纳税人虽然征收率低只有3%，但不能抵扣进项税。记住口诀！" }
        ]
      }
    ],
    acc_junior: [
      {
        id: "accj-aud1",
        chapterId: "accj-ch1",
        title: "5分钟牢记：会计六大要素与恒等式",
        duration: "04:50",
        notes: "初级会计师第一章核心。口诀："资负所看家底，收费利看赚亏"。六大要素分两组理解。",
        subtitles: [
          { time: 0, text: "初级会计的朋友们好，今天来学最基础但必考的会计六大要素。" },
          { time: 6, text: "口诀：资负所看家底，收费利看赚亏。" },
          { time: 12, text: "资产、负债、所有者权益是静态要素，反映企业某一时点的家底。" },
          { time: 18, text: "收入、费用、利润是动态要素，反映企业一段时间赚了还是亏了。" },
          { time: 24, text: "记住会计恒等式：资产等于负债加所有者权益，这个公式永远成立！" }
        ]
      }
    ]
  },
  
  quizzes: {
    econ: [
      {
        id: "econ-q1",
        chapterId: "econ-ch1",
        keyPointId: "econ-kp101",
        question: "某商品的需求价格弹性系数小于1，在其他条件不变的情况下，为了增加销售收入，企业应当采取的定价策略是：",
        options: [
          { key: "A", text: "降低商品价格" },
          { key: "B", text: "提高商品价格" },
          { key: "C", text: "保持价格不变" },
          { key: "D", text: "先降价，后涨价" }
        ],
        answer: "B",
        explanation: "【大白话解析】弹性系数小于1，说明是“低弹性”商品（如柴米油盐）。这类商品大家少不了，即使适当涨价大家也得照买不误，因此商家【提高价格（涨价）】能直接带来更多的总销售收入，符合口诀“低弹涨价”。",
        mnemonicLink: "口诀：高弹降价，低弹涨价。"
      },
      {
        id: "econ-q2",
        chapterId: "econ-ch2",
        keyPointId: "econ-kp102",
        question: "下列关于财政乘数效果的叙述中，正确的是：",
        options: [
          { key: "A", text: "税收乘数是正数，政府支出乘数是负数" },
          { key: "B", text: "政府购买支出乘数是正数，说明支出增加会导致国民收入倍数增加" },
          { key: "C", text: "税收乘数的绝对值大于政府购买支出乘数" },
          { key: "D", text: "税收乘数和政府购买支出乘数大小完全相等，方向相同" }
        ],
        answer: "B",
        explanation: "【大白话解析】根据口诀“税收乘数为负，支出乘数为正”。政府带头投资是给经济注水（正数），国民收入会倍数拉动，所以B正确。多收税是把水抽走，是负数，所以A、C、D都讲反了。",
        mnemonicLink: "口诀：税收乘数是负数，支出乘数是正数。"
      }
    ],
    accounting: [
      {
        id: "acc-q1",
        chapterId: "acc-ch1",
        keyPointId: "acc-kp101",
        question: "某企业采用双倍余额递减法计提固定资产折旧。关于该方法折旧计算的表述，正确的是：",
        options: [
          { key: "A", text: "在计提折旧的前中期，计算时不扣除预计净残值" },
          { key: "B", text: "折旧率随着尚可使用年限递减" },
          { key: "C", text: "每年折旧基数必须扣除预计净残值" },
          { key: "D", text: "折旧率固定为直线折旧率的1.5倍" }
        ],
        answer: "A",
        explanation: "【大白话解析】根据口诀“双倍直线，年数递减”。双倍余额递减法最特别的地方在于：在前中期计算折旧额时，用固定资产的期初账面余额乘以双倍直线折旧率，折旧基数【不需要减去预计净残值】。只有在折旧期的最后两年，才改为直线折旧法并扣除残值。所以A正确。",
        mnemonicLink: "口诀：双倍法前中期折旧基数不扣除预计残值。"
      },
      {
        id: "acc-q2",
        chapterId: "acc-ch2",
        keyPointId: "acc-kp102",
        question: "某项固定资产发生贬值，企业对其计提了固定资产减值准备。此后该资产升值，下列会计处理正确的是：",
        options: [
          { key: "A", text: "资产减值准备应予以转回，计入当期损益" },
          { key: "B", text: "资产减值一经确认，在持有期间内绝对不能转回" },
          { key: "C", text: "调高固定资产的账面价值并确认为其他综合收益" },
          { key: "D", text: "通过累计折旧科目调增资产价值" }
        ],
        answer: "B",
        explanation: "【大白话解析】口诀：“减值一记，不得转回”。为了防止大老板们通过资产减值随意揉捏利润，国家准则卡死了口子：长期固定资产计提的减值损失，在以后的持有期间【绝对不允许转回】！因此正确答案为B。",
        mnemonicLink: "口诀：长期资产减值一记，不得转回。"
      }
    ],
    teacher: [
      {
        id: "teach-q1",
        chapterId: "teach-ch1",
        keyPointId: "teach-kp101",
        question: "张老师在教学中不仅关注优等生的发展，而且对班级内的后进生也倾注了大量精力，注重因材施教和促进个性开发。张老师的教育行为主要体现了：",
        options: [
          { key: "A", text: "应试教育对尖子生的选拔理念" },
          { key: "B", text: "素质教育是面向全体学生并注重个性发展的理念" },
          { key: "C", text: "教师只注重应付教育管理部门的检查要求" },
          { key: "D", text: "忽视了学科核心知识传授的现象" }
        ],
        answer: "B",
        explanation: "【大白话解析】根据素质教育口诀：“提素个性创两全”。两全包括“全体学生”和“全面发展”。张老师对后进生也倾注大量精力，不抛弃任何一个，且因材施教（个性），正是面向全体、促进个性发展的素质教育实践，完全契合口诀要求。因此选B。",
        mnemonicLink: "口诀：提素个性创两全。"
      },
      {
        id: "teach-q2",
        chapterId: "teach-ch2",
        keyPointId: "teach-kp102",
        question: "某青年教师在教学过程中遇到不懂的问题，经常向资深教师请教，积极参加教研活动，订阅了大量教学前沿期刊，这体现了师德规范中的：",
        options: [
          { key: "A", text: "为人师表" },
          { key: "B", text: "终身学习" },
          { key: "C", text: "爱国守法" },
          { key: "D", text: "教书育人" }
        ],
        answer: "B",
        explanation: "【大白话解析】题目说教师“积极请教”、“参加教研”、“订阅前沿期刊”，这都是不断给自己充电、努力学习新理念新技能的行为。对应口诀“三爱两人一终身”中的“一终身（终身学习）”。为人师表侧重于作风正派和廉洁，教书育人侧重于因材施教不唯分数，因此选B。",
        mnemonicLink: "口诀：三爱两人一终身。"
      }
    ],
    social: [
      {
        id: "soc-q1",
        chapterId: "soc-ch1",
        keyPointId: "soc-kp101",
        question: "在社会工作实务中，社会工作者针对案主的困境进行深度剖析，向其分析了多种解决途径，但最终的决定由案主自己做出。这体现了专业价值观中的：",
        options: [
          { key: "A", text: "社会工作者家长的干预权" },
          { key: "B", text: "尊重服务对象的接纳原则" },
          { key: "C", text: "尊重服务对象的自决权" },
          { key: "D", text: "对服务对象隐私的绝对保密" }
        ],
        answer: "C",
        explanation: "【大白话解析】口诀：“接纳尊重，自决私密”。社会工作者只当顾问分析利弊，把【最后的主动选择权交还给服务对象本人】，这在专业上叫做“自决原则”，尊重服务对象的自我选择与自决权，答案为C。",
        mnemonicLink: "口诀：接纳尊重，自决私密。"
      }
    ],
    construct: [
      {
        id: "con-q1",
        chapterId: "con-ch1",
        keyPointId: "con-kp101",
        question: "工程项目施工现场某处混凝土结构发现严重蜂窝麻面，施工项目部开展质量事故处理。在事故调查完成之后，下一步应进行的工作是：",
        options: [
          { key: "A", text: "进行质量事故验收核实" },
          { key: "B", text: "制定事故设计处理方案" },
          { key: "C", text: "开始施工现场修复处理" },
          { key: "D", text: "向上级建设主管部门报告" }
        ],
        answer: "B",
        explanation: "【大白话解析】根据工地质量事故处理口诀：“报、调、案、处、核”。题目已经说了“事故调查完成”（即“调”完成），下一个英文字母步骤就是“案”（即制定处理方案），然后才是实施处理（处）和核实检查（核）。因此正确答案为B。",
        mnemonicLink: "口诀：报、调、案、处、核。"
      }
    ],
    hr: [
      {
        id: "hr-q1",
        chapterId: "hr-ch1",
        keyPointId: "hr-kp101",
        question: "某企业需要预测未来三年的人力资源需求，采用了匿名问卷的方式征求多位专家意见，经过多轮反馈后汇总得出结论。该企业采用的预测方法是：",
        options: [
          { key: "A", text: "回归分析法" },
          { key: "B", text: "德尔菲法" },
          { key: "C", text: "比率分析法" },
          { key: "D", text: "趋势外推法" }
        ],
        answer: "B",
        explanation: "【大白话解析】题目说了三个关键词：匿名问卷、多位专家、多轮反馈。完美对应德尔菲法的四大特征：匿名性、多轮反馈、统计汇总、专家独立判断。口诀"定性靠专家"，选B。",
        mnemonicLink: "口诀：定性靠专家，定量靠数据。"
      },
      {
        id: "hr-q2",
        chapterId: "hr-ch2",
        keyPointId: "hr-kp102",
        question: "在招聘面试中，所有应聘者被问到相同的问题，面试官按照统一的评分标准进行打分。这种面试方式属于：",
        options: [
          { key: "A", text: "非结构化面试" },
          { key: "B", text: "压力面试" },
          { key: "C", text: "结构化面试" },
          { key: "D", text: "情景模拟面试" }
        ],
        answer: "C",
        explanation: "【大白话解析】题目说"相同问题"和"统一评分标准"，这就像标准化考试一样。口诀"结构像考试"，完全对应结构化面试的特征。选C。",
        mnemonicLink: "口诀：结构像考试，非结构像聊天。"
      }
    ],
    tax: [
      {
        id: "tax-q1",
        chapterId: "tax-ch1",
        keyPointId: "tax-kp101",
        question: "某企业年应征增值税销售额为600万元。根据增值税法规定，该企业应当登记为：",
        options: [
          { key: "A", text: "小规模纳税人" },
          { key: "B", text: "一般纳税人" },
          { key: "C", text: "免税纳税人" },
          { key: "D", text: "可自行选择纳税人类型" }
        ],
        answer: "B",
        explanation: "【大白话解析】口诀"五百万分界"。600万超过了500万的分水岭，必须登记为一般纳税人。一般纳税人的好处是进项税可以抵扣。选B。",
        mnemonicLink: "口诀：五百万分界，一般能抵扣。"
      }
    ],
    acc_junior: [
      {
        id: "accj-q1",
        chapterId: "accj-ch1",
        keyPointId: "accj-kp101",
        question: "下列各项中，属于反映企业某一特定日期财务状况的会计要素是：",
        options: [
          { key: "A", text: "收入" },
          { key: "B", text: "费用" },
          { key: "C", text: "利润" },
          { key: "D", text: "资产" }
        ],
        answer: "D",
        explanation: "【大白话解析】口诀"资负所看家底"。看某一特定日期的财务状况就是看家底，对应静态三要素：资产、负债、所有者权益。收入、费用、利润是看赚亏的动态要素。选D。",
        mnemonicLink: "口诀：资负所看家底，收费利看赚亏。"
      }
    ]
  }
};

// 会员权益体系配置
const MEMBERSHIP_CONFIG = {
  tiers: [
    {
      id: "free",
      name: "免费体验",
      price: "¥0",
      period: "",
      badge: "🆓",
      color: "#64748b",
      features: [
        "各科目基础考点免费查看",
        "每日限量3道真题试做",
        "基础打卡记录",
        "部分音频试听"
      ],
      disabled: [
        "智能艾宾浩斯复盘",
        "全套音频无限听",
        "无限刷题模式",
        "考前口诀押题",
        "专属备考规划",
        "批量资料下载"
      ]
    },
    {
      id: "single",
      name: "单科年度会员",
      price: "¥99",
      period: "/科/年",
      badge: "⭐",
      color: "#0f766e",
      features: [
        "单科全部考点内容解锁",
        "单科无限音频听学",
        "单科无限刷题+错题专项",
        "智能艾宾浩斯复盘",
        "考前口诀押题清单",
        "专属备考规划表"
      ],
      disabled: []
    },
    {
      id: "vip",
      name: "全站通用年度通卡",
      price: "¥299",
      period: "/年",
      badge: "👑",
      color: "#d97706",
      recommended: true,
      features: [
        "全平台所有科目全解锁",
        "全科无限音频+无限刷题",
        "全科智能复盘+错题专项",
        "全科考前口诀押题",
        "多科目并行备考规划",
        "PC端批量资料下载",
        "大屏全真模考无限次",
        "优先客服答疑通道"
      ],
      disabled: []
    }
  ]
};

// 扩充的默认用户科目进度数据结构（多科目并行）
const DEFAULT_USER_STATE = {
  daysStudied: 3,
  learnedPointsCount: 0,
  wrongQuestionsCount: 0,
  dailyTaskCompleted: false,
  studyTimeSeconds: 1420,
  fontSizeClass: "font-normal",
  eyeProtectMode: false,
  activeSubjectId: "econ", // 默认当前激活科目
  membershipTier: "vip", // 开发阶段: 全功能开放
  
  // 各科目独立存储进度
  subjectsState: {
    econ: {
      pointsChecked: [],
      quizDoneCount: 0,
      checkIn: false,
      ebbinghausQueue: [],
      wrongQuestions: []
    },
    accounting: {
      pointsChecked: [],
      quizDoneCount: 0,
      checkIn: false,
      ebbinghausQueue: [],
      wrongQuestions: []
    },
    teacher: {
      pointsChecked: [],
      quizDoneCount: 0,
      checkIn: false,
      ebbinghausQueue: [],
      wrongQuestions: []
    },
    social: {
      pointsChecked: [],
      quizDoneCount: 0,
      checkIn: false,
      ebbinghausQueue: [],
      wrongQuestions: []
    },
    construct: {
      pointsChecked: [],
      quizDoneCount: 0,
      checkIn: false,
      ebbinghausQueue: [],
      wrongQuestions: []
    },
    hr: {
      pointsChecked: [],
      quizDoneCount: 0,
      checkIn: false,
      ebbinghausQueue: [],
      wrongQuestions: []
    },
    tax: {
      pointsChecked: [],
      quizDoneCount: 0,
      checkIn: false,
      ebbinghausQueue: [],
      wrongQuestions: []
    },
    acc_junior: {
      pointsChecked: [],
      quizDoneCount: 0,
      checkIn: false,
      ebbinghausQueue: [],
      wrongQuestions: []
    }
  }
};
