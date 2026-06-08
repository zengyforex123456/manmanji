// 首页速学看板
import { Component } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

interface State {
  activeSubject: string;
  dueCount: number;
  mastery: number;
  daysStudied: number;
  loggedIn: boolean;
}

export default class IndexPage extends Component<{}, State> {
  state: State = {
    activeSubject: 'econ',
    dueCount: 0,
    mastery: 0,
    daysStudied: 1,
    loggedIn: false,
  };

  componentDidMount() {
    this.loadStats();
  }

  loadStats() {
    try {
      const storage = Taro.getStorageSync('mmj_state');
      if (storage) {
        const state = JSON.parse(storage);
        this.setState({
          activeSubject: state.activeSubjectId || 'econ',
          daysStudied: state.daysStudied || 1,
          loggedIn: !!state.userId,
        });
      }
    } catch (e) {
      console.error('LoadState failed:', e);
    }
  }

  startMode(mode: string) {
    const countMap: Record<string, number> = {
      beginner: 10, advanced: 20, mock: 105, mistake: 999,
    };
    Taro.navigateTo({
      url: `/pages/quiz/quiz?mode=${mode}&count=${countMap[mode] || 10}&subject=${this.state.activeSubject}`,
    });
  }

  switchSubject(subjectId: string) {
    this.setState({ activeSubject: subjectId });
    try {
      const raw = Taro.getStorageSync('mmj_state');
      if (raw) {
        const state = JSON.parse(raw);
        state.activeSubjectId = subjectId;
        Taro.setStorageSync('mmj_state', JSON.stringify(state));
      }
    } catch (e) {}
  }

  render() {
    const { dueCount, mastery, activeSubject, daysStudied, loggedIn } = this.state;
    const subjects = [
      { id: 'econ', name: '经济基础' },
      { id: 'hr', name: '人力' },
      { id: 'biz', name: '工商' },
    ];

    return (
      <ScrollView className='page' scrollY>
        {/* 科目切换 */}
        <View className='subject-bar'>
          {subjects.map(s => (
            <Text
              key={s.id}
              className={`subject-tag ${activeSubject === s.id ? 'active' : ''}`}
              onClick={() => this.switchSubject(s.id)}
            >
              {s.name}
            </Text>
          ))}
        </View>

        {/* 欢迎行 */}
        <View className='welcome-row'>
          <Text>👋 早上好，{loggedIn ? '考友' : '访客'}</Text>
          <Text className='streak'>🔥 {daysStudied}天</Text>
        </View>

        {/* 统计卡片 */}
        <View className='stats-row'>
          <View className='stat-card'>
            <Text className='stat-label'>待复习</Text>
            <Text className='stat-value'>{dueCount} 题</Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-label'>掌握度</Text>
            <Text className='stat-value'>{mastery}%</Text>
          </View>
        </View>

        {/* 主按钮 */}
        <Button className='cta-btn' onClick={() => this.startMode('beginner')}>
          📝 开始刷题
        </Button>

        {/* 模式入口 */}
        <View className='mode-grid'>
          <View className='mode-btn' onClick={() => this.startMode('beginner')}>
            <Text>🎯 新手10题</Text>
          </View>
          <View className='mode-btn' onClick={() => this.startMode('advanced')}>
            <Text>🔥 进阶20题</Text>
          </View>
          <View className='mode-btn' onClick={() => this.startMode('mock')}>
            <Text>⏱️ 模考105题</Text>
          </View>
          <View className='mode-btn' onClick={() => this.startMode('mistake')}>
            <Text>📖 错题重做</Text>
          </View>
        </View>

        {/* AI分析 */}
        <View className='section'>
          <View className='section-title'>🤖 AI学习分析</View>
          <Text className='section-text'>完成一组刷题后查看分析</Text>
        </View>
      </ScrollView>
    );
  }
}
