// api.js — L1: API通信层
// 单一职责: 所有HTTP请求·错误处理·请求重试
// 接口通信: 组件只通过api.js访问后端，禁止直接fetch

const API = {
  BASE: '',

  async request(method, url, body) {
    const options = { method, headers: {} };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const res = await fetch(API.BASE + url, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  },

  get(url)     { return API.request('GET', url); },
  post(url, b) { return API.request('POST', url, b); },

  // ── 支付 ──
  payment: {
    create(productId, userId) {
      return API.post('/api/payments/create', { productId, userId: userId || 'guest' });
    },
    status(orderId) {
      return API.get('/api/payments/status/' + orderId);
    },
    products() {
      return API.get('/api/payments/products');
    },
  },

  // ── 题库 ──
  questions: {
    bySubject(subjectId) {
      return API.get('/api/questions/' + subjectId);
    },
    count(subjectId) {
      return API.get('/api/questions/' + subjectId + '/count');
    },
  },

  // ── 健康 ──
  health() {
    return API.get('/api/health');
  },

  // ── AI ──
  ai: {
    ask(question) {
      return API.post('/api/ai/ask', { question });
    },
    examInfo() {
      return API.get('/api/ai/exam-info');
    },
  },

  // ── 数据管道 ──
  pipeline: {
    report() {
      return API.get('/api/pipeline/report');
    },
  },
};

export default API;
