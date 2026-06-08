// server/cache.js – Simple LRU cache for question data
import NodeCache from 'node-cache';
import fs from 'fs';
import path from 'path';

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5 min ttl

/**
 * Get questions for a subject, using in‑memory cache.
 * @param {string} dataDir - base data directory (public/data)
 * @param {string} subjectId
 * @returns {Array} questions array
 */
export function getQuestions(dataDir, subjectId) {
  const cacheKey = `questions_${subjectId}`;
  let questions = cache.get(cacheKey);
  if (!questions) {
    const file = path.join(dataDir, subjectId, 'questions.json');
    if (!fs.existsSync(file)) return [];
    try {
      questions = JSON.parse(fs.readFileSync(file, 'utf-8'));
      cache.set(cacheKey, questions);
    } catch (e) {
      console.error('Failed to load questions:', e);
      return [];
    }
  }
  return questions;
}

/**
 * Clear cache for a subject (e.g., after upload).
 */
export function invalidateSubjectCache(subjectId) {
  cache.del(`questions_${subjectId}`);
}
