// server/community.js — 社群积分 + 邀请裂变 + 学习排行榜
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// 积分规则
const POINTS = {
  daily_login: 5,
  answer_question: 1,
  correct_answer: 2,
  complete_mode: 10,
  invite_friend: 50,
  friend_paid: 200,
  share_content: 5,
  streak_3days: 15,
  streak_7days: 35,
  streak_30days: 150,
};

// 勋章
const BADGES = {
  first_blood:   { name: '初次刷题', icon: '🎯', condition: { totalAnswers: 1 } },
  hundred:       { name: '百题斩',   icon: '⚔️', condition: { totalAnswers: 100 } },
  thousand:      { name: '千题王',   icon: '👑', condition: { totalAnswers: 1000 } },
  streak_7:      { name: '七日连刷', icon: '🔥', condition: { streak: 7 } },
  streak_30:     { name: '月满勤',   icon: '🌟', condition: { streak: 30 } },
  accuracy_80:   { name: '学霸',     icon: '📚', condition: { accuracy: 80, totalAnswers: 100 } },
  speed_demon:   { name: '闪电作答', icon: '⚡', condition: { avgTime: 30, totalAnswers: 50 } },
  inviter:       { name: '引路人',   icon: '🤝', condition: { invites: 3 } },
  early_bird:    { name: '早起鸟',   icon: '🌅', condition: { morningSessions: 5 } },
  night_owl:     { name: '夜猫子',   icon: '🦉', condition: { nightSessions: 10 } },
};

// 排行榜数据（生产环境应使用数据库）
const leaderboardFile = path.join(__dirname, '..', 'data', 'leaderboard.json');
function loadLeaderboard() {
  try { return JSON.parse(fs.readFileSync(leaderboardFile, 'utf-8')); }
  catch(e) { return []; }
}
function saveLeaderboard(data) {
  fs.writeFileSync(leaderboardFile, JSON.stringify(data, null, 2));
}

// ═══ 积分记录 ═══
router.post('/points/:userId', function(req, res) {
  var action = req.body.action;
  var points = POINTS[action] || 0;
  if (points === 0) return res.status(400).json({ error: 'Unknown action: ' + action });

  var board = loadLeaderboard();
  var user = board.find(function(u) { return u.userId === req.params.userId; });
  if (!user) {
    user = { userId: req.params.userId, points: 0, badges: [], totalAnswers: 0, streak: 0, invites: 0 };
    board.push(user);
  }

  user.points += points;
  if (action === 'answer_question') user.totalAnswers = (user.totalAnswers || 0) + 1;
  if (action === 'correct_answer') user.totalAnswers = (user.totalAnswers || 0) + 1;
  if (action === 'streak_3days' || action === 'streak_7days' || action === 'streak_30days') user.streak = (user.streak || 0) + 1;
  if (action === 'invite_friend') user.invites = (user.invites || 0) + 1;

  // 检查勋章
  Object.entries(BADGES).forEach(function(entry) {
    var badgeId = entry[0];
    var badge = entry[1];
    if (user.badges.includes(badgeId)) return;
    var cond = badge.condition;
    if ((cond.totalAnswers && user.totalAnswers >= cond.totalAnswers) ||
        (cond.streak && user.streak >= cond.streak) ||
        (cond.invites && user.invites >= cond.invites)) {
      user.badges.push(badgeId);
    }
  });

  saveLeaderboard(board);
  res.json({ userId: req.params.userId, points: user.points, earned: points, badges: user.badges });
});

// ═══ 排行榜 ═══
router.get('/leaderboard', function(req, res) {
  var board = loadLeaderboard();
  var type = req.query.type || 'points';

  var sorted;
  if (type === 'streak') {
    sorted = board.sort(function(a, b) { return (b.streak || 0) - (a.streak || 0); });
  } else if (type === 'answers') {
    sorted = board.sort(function(a, b) { return (b.totalAnswers || 0) - (a.totalAnswers || 0); });
  } else {
    sorted = board.sort(function(a, b) { return (b.points || 0) - (a.points || 0); });
  }

  res.json({
    type: type,
    top10: sorted.slice(0, 10).map(function(u, i) {
      return { rank: i + 1, userId: u.userId, points: u.points, badges: u.badges, totalAnswers: u.totalAnswers || 0, streak: u.streak || 0 };
    }),
    total: board.length,
  });
});

// ═══ 用户状态 ═══
router.get('/user/:userId', function(req, res) {
  var board = loadLeaderboard();
  var user = board.find(function(u) { return u.userId === req.params.userId; });
  if (!user) return res.json({ userId: req.params.userId, points: 0, badges: [], totalAnswers: 0, streak: 0, rank: board.length + 1 });

  var sorted = board.slice().sort(function(a, b) { return (b.points || 0) - (a.points || 0); });
  var rank = sorted.findIndex(function(u) { return u.userId === req.params.userId; }) + 1;

  res.json({ userId: user.userId, points: user.points, badges: user.badges, totalAnswers: user.totalAnswers || 0, streak: user.streak || 0, invites: user.invites || 0, rank: rank, total: board.length });
});

// ═══ 邀请裂变 ═══
router.post('/invite', function(req, res) {
  var inviterId = req.body.inviterId;
  var inviteeName = req.body.inviteeName;
  var board = loadLeaderboard();

  var inviter = board.find(function(u) { return u.userId === inviterId; });
  if (!inviter) {
    inviter = { userId: inviterId, points: 0, badges: [], totalAnswers: 0, streak: 0, invites: 0 };
    board.push(inviter);
  }

  inviter.points += POINTS.invite_friend;
  inviter.invites = (inviter.invites || 0) + 1;
  if (inviter.invites >= 3 && !inviter.badges.includes('inviter')) {
    inviter.badges.push('inviter');
  }

  saveLeaderboard(board);
  res.json({
    success: true,
    inviter: { userId: inviterId, points: inviter.points, invites: inviter.invites },
    inviteLink: '/?ref=' + inviterId,
    message: '邀请成功！好友付费后你还将获得200积分',
  });
});

// ═══ 积分规则 ═══
router.get('/rules', function(req, res) {
  res.json({ points: POINTS, badges: BADGES });
});

export default router;
