// 刷题页面
import { Component } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './quiz.scss';

interface Question {
  id: string; type: string; stem: string; options: string[];
  answer: string; analysis: string; mnemonic: string; chapter: number; tags: string[];
}

interface State {
  questions: Question[];
  currentIndex: number;
  selectedAnswer: string;
  showFeedback: boolean;
  correctCount: number;
  mode: string;
}

export default class QuizPage extends Component<{}, State> {
  state: State = {
    questions: [], currentIndex: 0, selectedAnswer: '',
    showFeedback: false, correctCount: 0, mode: 'beginner',
  };

  componentDidMount() {
    const params = Taro.getCurrentInstance().router?.params || {};
    const mode = params.mode || 'beginner';
    const count = parseInt(params.count || '10', 10);
    this.setState({ mode });
    this.loadQuestions(mode, count);
  }

  loadQuestions(_mode: string, _count: number) {
    // MVP: 从本地存储加载缓存的题目
    Taro.showLoading({ title: '加载题目...' });
    try {
      const cached = Taro.getStorageSync('mmj_cached_questions');
      if (cached) {
        const all = JSON.parse(cached);
        const shuffled = all.sort(() => Math.random() - 0.5).slice(0, _count);
        this.setState({ questions: shuffled });
      } else {
        // 演示数据
        this.setState({ questions: this.getDemoQuestions() });
      }
    } catch (e) {
      this.setState({ questions: this.getDemoQuestions() });
    }
    Taro.hideLoading();
  }

  getDemoQuestions(): Question[] {
    return [
      { id: '1', type: 'single', stem: '某商品的需求价格弹性系数小于1，为了增加销售收入，企业应当采取的定价策略是？',
        options: ['A. 降低商品价格','B. 提高商品价格','C. 保持价格不变','D. 先降价后涨价'],
        answer: 'B', analysis: '弹性<1是低弹性商品，涨价增收。口诀：高弹降价，低弹涨价。',
        mnemonic: '高弹降价，低弹涨价', chapter: 2, tags: ['需求价格弹性'] },
      { id: '2', type: 'single', stem: '政府购买支出乘数是正数，说明支出增加会导致国民收入？',
        options: ['A. 减少','B. 不变','C. 倍数增加','D. 无法确定'],
        answer: 'C', analysis: '财政乘数：支出乘数为正，资金直接进入循环扩大国民收入。',
        mnemonic: '税收乘数为负，支出乘数为正', chapter: 17, tags: ['财政乘数'] },
    ];
  }

  handleSelect(letter: string) {
    if (this.state.showFeedback) return;
    this.setState({ selectedAnswer: letter, showFeedback: true });
    const q = this.state.questions[this.state.currentIndex];
    const correct = q.answer.includes(letter);
    if (correct) {
      this.setState(prev => ({ correctCount: prev.correctCount + 1 }));
    }
  }

  nextQuestion() {
    const { currentIndex, questions } = this.state;
    if (currentIndex + 1 >= questions.length) {
      this.finish();
      return;
    }
    this.setState({
      currentIndex: currentIndex + 1, selectedAnswer: '', showFeedback: false,
    });
  }

  finish() {
    const { correctCount, questions, mode } = this.state;
    const total = questions.length;
    Taro.showModal({
      title: `${mode === 'mock' ? '模考成绩' : '刷题完成'}`,
      content: `正确率: ${Math.round(correctCount/total*100)}%\n${correctCount}/${total} 题正确`,
      confirmText: '再来一组',
      cancelText: '返回首页',
      success: (res) => {
        if (res.confirm) {
          this.loadQuestions(mode, total);
        } else {
          Taro.switchTab({ url: '/pages/index/index' });
        }
      },
    });
  }

  render() {
    const { questions, currentIndex, selectedAnswer, showFeedback, mode } = this.state;
    if (!questions.length) {
      return <View className='page'><View className='empty'>暂无可用题目</View></View>;
    }
    const q = questions[currentIndex];
    const total = questions.length;
    const userCorrect = showFeedback && q.answer.includes(selectedAnswer);
    const modeLabel = { beginner: '新手模式', advanced: '进阶模式', mock: '全真模考', mistake: '错题重做' }[mode] || '';

    return (
      <View className='page'>
        {/* 顶栏 */}
        <View className='quiz-header'>
          <Text className='mode-label'>{modeLabel}</Text>
          <Text className='progress'>{currentIndex + 1}/{total}</Text>
        </View>

        {/* 题型标签 */}
        <View className='badge-row'>
          <Text className='type-badge'>{q.type === 'multiple' ? '多选题' : '单选题'}</Text>
          {q.chapter > 0 && <Text className='chapter-badge'>第{q.chapter}章</Text>}
        </View>

        {/* 题干 */}
        <View className='stem'>{q.stem}</View>

        {/* 选项 */}
        <View className='options'>
          {q.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            let cls = 'option';
            if (showFeedback) {
              cls += q.answer.includes(letter) ? ' correct' : '';
              cls += !q.answer.includes(letter) && selectedAnswer === letter ? ' wrong' : '';
            }
            return (
              <View key={letter} className={cls} onClick={() => this.handleSelect(letter)}>
                <Text>{opt}</Text>
              </View>
            );
          })}
        </View>

        {/* 反馈 */}
        {showFeedback && (
          <ScrollView className='feedback' scrollY>
            <Text className={`result-text ${userCorrect ? 'correct-text' : 'wrong-text'}`}>
              {userCorrect ? '✅ 回答正确！' : `❌ 回答错误！正确答案：${q.answer}`}
            </Text>
            {q.analysis && <Text className='analysis-text'>📖 {q.analysis}</Text>}
            {q.mnemonic && <Text className='mnemonic-text'>🔗 口诀：{q.mnemonic}</Text>}
            <Button className='next-btn' onClick={() => this.nextQuestion()}>
              {currentIndex + 1 >= total ? '完成，查看结果 →' : '下一题 →'}
            </Button>
          </ScrollView>
        )}
      </View>
    );
  }
}
