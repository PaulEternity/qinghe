/** 知己计分回归：题库、结果档位和未完成作答。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZHIJI_QUIZZES, evaluateZhijiQuiz } from './public/zhiji-quizzes.js';

test('三套题均可完成，首尾档位与心理年龄的上下限一致', () => {
  assert.equal(ZHIJI_QUIZZES.length, 3);
  for (const quiz of ZHIJI_QUIZZES) {
    // 每题按权重挑答案，确保测试覆盖打乱过的展示顺序。
    const choose = weight => quiz.questions.map(([, options]) => options.findIndex(([, points]) => points === weight));
    const low = evaluateZhijiQuiz(quiz, choose(0));
    const middle = evaluateZhijiQuiz(quiz, choose(1));
    const high = evaluateZhijiQuiz(quiz, choose(2));

    assert.equal(low.result, quiz.results[0]);
    assert.equal(middle.result, quiz.results[1]);
    assert.equal(high.result, quiz.results.at(-1));
    assert.equal(low.age, quiz.id === 'mental-age' ? 18 : null);
    assert.equal(high.age, quiz.id === 'mental-age' ? 65 : null);
    assert.equal(evaluateZhijiQuiz(quiz, choose(0).slice(1)), null);
    assert.equal(evaluateZhijiQuiz(quiz, [undefined, ...choose(0).slice(1)]), null);
  }
});
