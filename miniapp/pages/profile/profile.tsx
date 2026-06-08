// 个人中心
import { Component } from 'react';
import { View, Text, Button, ScrollView, Switch } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './profile.scss';

interface State {
  loggedIn: boolean;
  userId: string;
  daysStudied: number;
  fontSize: string;
  eyeProtect: boolean;
}

export default class ProfilePage extends Component<{}, State> {
  state: State = {
    loggedIn: false, userId: '', daysStudied: 1,
    fontSize: 'normal', eyeProtect: false,
  };

  componentDidMount() {
    try {
      const raw = Taro.getStorageSync('mmj_state');
      if (raw) {
        const state = JSON.parse(raw);
        this.setState({
          loggedIn: !!state.userId, userId: state.userId || '',
          daysStudied: state.daysStudied || 1, fontSize: state.fontSizeClass || 'normal',
          eyeProtect: state.eyeProtectMode || false,
        });
      }
    } catch (e) {}
  }

  handleLogin() {
    // MVP: 调起微信登录
    Taro.login({
      success: (res) => {
        if (res.code) {
          Taro.showToast({ title: '登录成功', icon: 'success' });
          this.setState({ loggedIn: true, userId: '微信用户' });
        }
      },
    });
  }

  toggleFontSize(size: string) {
    this.setState({ fontSize: size });
  }

  toggleEyeProtect(e: any) {
    this.setState({ eyeProtect: e.detail.value });
  }

  handleFeedback() {
    Taro.showModal({ title: '问题反馈', editable: true, placeholderText: '请描述问题...' });
  }

  render() {
    const { loggedIn, userId, daysStudied, fontSize, eyeProtect } = this.state;

    return (
      <ScrollView className='page' scrollY>
        {/* 用户信息 */}
        <View className='profile-card'>
          <View className='avatar'>👤</View>
          <View className='user-info'>
            <Text className='user-name'>{loggedIn ? userId : '未登录'}</Text>
            <Text className='user-meta'>🔥 已坚持 {daysStudied} 天</Text>
          </View>
          {!loggedIn && (
            <Button className='login-btn' onClick={() => this.handleLogin()}>
              微信登录
            </Button>
          )}
        </View>

        {/* 大龄关怀设置 */}
        <View className='section'>
          <View className='section-title'>🛠️ 大龄考生关怀</View>
          <View className='setting-row'>
            <Text>阅读字号</Text>
            <View className='size-row'>
              {['normal','medium','large'].map(s => (
                <Text
                  key={s}
                  className={`size-btn ${fontSize === s ? 'active' : ''}`}
                  onClick={() => this.toggleFontSize(s)}
                >
                  {s === 'normal' ? '常规' : s === 'medium' ? '中' : '大'}
                </Text>
              ))}
            </View>
          </View>
          <View className='setting-row'>
            <Text>护眼模式</Text>
            <Switch checked={eyeProtect} onChange={(e) => this.toggleEyeProtect(e)} color='#0f766e' />
          </View>
        </View>

        {/* 入口 */}
        <View className='section'>
          <View className='menu-item' onClick={() => this.handleFeedback()}>
            <Text>💬 问题反馈</Text>
            <Text className='arrow'>→</Text>
          </View>
          <View className='menu-item'>
            <Text>👥 考生微信群</Text>
            <Text className='arrow'>→</Text>
          </View>
          <View className='menu-item'>
            <Text>ℹ️ 关于职考通</Text>
            <Text className='meta'>V1.0.0 · 大龄备考专属</Text>
          </View>
        </View>

        <View className='slogan'>🎯 大龄备考不硬背，职场证书轻松过</View>
      </ScrollView>
    );
  }
}
