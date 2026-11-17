/** 知己计分回归：题库、结果档位和未完成作答。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from './server.mjs';
import { ZHIJI_QUIZZES, ZHIJI_QUIZ_VERSION, evaluateZhijiQuiz } from './public/zhiji-quizzes.js';

test('五套题各有 30～60 题，选项权重位置均衡且结果档位可达', () => {
  assert.deepEqual(ZHIJI_QUIZZES.map(quiz => quiz.id), [
    'mental-age', 'recharge', 'decision', 'disagreement', 'learning'
  ]);
  for (const quiz of ZHIJI_QUIZZES) {
    assert.ok(quiz.questions.length >= 30 && quiz.questions.length <= 60, quiz.id);
    assert.equal(new Set(quiz.questions.map(([prompt]) => prompt)).size, quiz.questions.length, quiz.id);
    // 每行对应一个选项位置，按 0、1、2 分记录出现次数，防止某个位置长期偏向同一档。
    const weightsByPosition = Array.from({length:3}, () => [0, 0, 0]);
    // 每题的三个选项各对应一个权重，避免新增题漏掉分档。
    for (const [prompt, options] of quiz.questions) {
      assert.deepEqual(options.map(([, points]) => points).sort(), [0, 1, 2], prompt);
      options.forEach(([, points], position) => weightsByPosition[position][points]++);
    }
    for (const counts of weightsByPosition) {
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, quiz.id);
    }
    // 每题按权重挑答案，确保测试覆盖打乱过的展示顺序。
    const choose = weight => quiz.questions.map(([, options]) => options.findIndex(([, points]) => points === weight));
    const low = evaluateZhijiQuiz(quiz, choose(0));
    const middle = evaluateZhijiQuiz(quiz, choose(1));
    const high = evaluateZhijiQuiz(quiz, choose(2));

    assert.equal(low.result, quiz.results[0]);
    assert.equal(middle.result, quiz.results[1]);
    assert.equal(high.result, quiz.results.at(-1));
    // 用从全选 0 分逐步改选为 2 分的答卷，覆盖中间各档及四档题的第三档。
    const reached = new Set();
    const twoPointChoices = choose(2);
    const mixedChoices = choose(0);
    reached.add(evaluateZhijiQuiz(quiz, mixedChoices).result);
    for (const [index, option] of twoPointChoices.entries()) {
      mixedChoices[index] = option;
      reached.add(evaluateZhijiQuiz(quiz, mixedChoices).result);
    }
    assert.deepEqual([...reached], quiz.results);
    assert.equal(low.age, quiz.id === 'mental-age' ? 18 : null);
    assert.equal(high.age, quiz.id === 'mental-age' ? 65 : null);
    assert.equal(evaluateZhijiQuiz(quiz, choose(0).slice(1)), null);
    assert.equal(evaluateZhijiQuiz(quiz, [undefined, ...choose(0).slice(1)]), null);
  }
});

test('测评札记按账号保存，服务端重算且重复提交不覆盖或增加札记', async t => {
  // 内存替身模拟现有仓库按账号读取、按 ID 幂等插入的约定。
  const notes = new Map();
  const store = {
    async insert(note, owner) {
      if (!notes.has(note.id)) notes.set(note.id, {note, owner});
      return this.get(note.id, owner);
    },
    async get(id, owner) { const row = notes.get(id); return row?.owner === owner ? row.note : null; },
    async list(owner) { return [...notes.values()].filter(row => row.owner === owner).map(row => row.note); }
  };
  const accounts = {
    async current(req) {
      const id = req.headers['x-test-user'];
      return id ? {user:{id}} : null;
    },
    async handle() { return false; }
  };
  const server = createApp({store, accounts, auth:{handle:async () => false, authorized:() => true}});
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(() => { server.close(); server.closeAllConnections(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  /** 通过真实札记 API 提交作答，账号由测试替身注入。 */
  const post = (path, body, user = 'tester-a') => fetch(base + path, {
    method:'POST',headers:{'Content-Type':'application/json','X-Test-User':user},body:JSON.stringify(body)
  });
  const quiz = ZHIJI_QUIZZES[0];
  const answers = quiz.questions.map(([, options]) => options.findIndex(([, weight]) => weight === 0));
  // 模拟客户端伪造结果，验证数据库只留服务端计算的快照。
  const input = {quizId:quiz.id,quizVersion:ZHIJI_QUIZ_VERSION,attemptId:'f'.repeat(32),answers,result:{title:'伪造结果'}};
  const path = '/api/notes/zhiji';
  assert.equal((await post(path,input,'')).status,401);
  assert.equal((await post(path,{...input,quizVersion:0})).status,409);
  assert.equal((await post(path,{...input,answers:answers.slice(1)})).status,400);
  assert.equal((await post(path,{...input,answers:[String(answers[0]),...answers.slice(1)]})).status,400);
  assert.equal(notes.size,0);

  const saved = await post(path,input);
  assert.equal(saved.status,200);
  const {note} = await saved.json();
  assert.equal(note.record.tool,'zhiji');
  assert.equal(note.record.question,quiz.title);
  assert.deepEqual(note.record.facts.zhiji,{
    quizId:quiz.id,quizVersion:ZHIJI_QUIZ_VERSION,questionCount:answers.length,result:quiz.results[0],age:18
  });
  assert.doesNotMatch(JSON.stringify(note), /"answers"|伪造结果/);
  const retry = await (await post(path,{...input,answers:quiz.questions.map(([, options]) => options.findIndex(([, weight]) => weight === 2))})).json();
  assert.deepEqual(retry.note,note);
  assert.equal(notes.size,1);
  const listed = await (await fetch(base+'/api/notes',{headers:{'X-Test-User':'tester-a'}})).json();
  assert.deepEqual(listed.notes,[note]);
  const other = await (await fetch(base+'/api/notes',{headers:{'X-Test-User':'tester-b'}})).json();
  assert.deepEqual(other.notes,[]);
  const independent = await (await post(path,input,'tester-b')).json();
  assert.notEqual(independent.note.id,note.id);
  // 已保存的测评也不能通过其它札记接口进入 AI 解读或写入翻牌状态。
  assert.equal((await post('/api/interpret',{record:{...note.record,tool:'tarot'}})).status,400);
  assert.equal((await post('/api/notes/reveal',{id:note.id,revealed:[]})).status,400);
});
