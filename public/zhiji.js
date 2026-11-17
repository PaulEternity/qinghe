/** 知己页面：同一个答题界面按题库配置展示目录、问题和结果。 */
import { ZHIJI_QUIZZES, ZHIJI_QUIZ_VERSION, evaluateZhijiQuiz } from './zhiji-quizzes.js';

// 仅在用户从结果页前往登录时使用，回到同一测评后取出并清除。
const LOGIN_DRAFT_KEY = 'qinghe.zhiji.login-draft';

/** 共用结果卡，文本通过 DOM 写入，历史札记直接展示保存时的结果。 */
export function renderZhijiResult(target, { result, age, questionCount }) {
  target.innerHTML = `<article class="zhiji-sheet zhiji-result">
    <p class="zhiji-age" hidden><span>岁</span></p>
    <h2 tabindex="-1"></h2>
    <p data-detail></p>
    <p class="help" data-summary></p>
  </article>`;
  const card = target.querySelector('article');
  if (age !== null) {
    const ageLine = card.querySelector('.zhiji-age');
    ageLine.prepend(String(age));
    ageLine.hidden = false;
  }
  card.querySelector('h2').textContent = result.title;
  card.querySelector('[data-detail]').textContent = result.detail;
  card.querySelector('[data-summary]').textContent = `本次完成 ${questionCount} 题。结果仅供自我观察与娱乐。${age === null ? '' : '年龄数字是娱乐刻度。'}`;
  return card;
}

/** 进入目录或题目，在完成后由用户选择是否保存结果。 */
export function showZhiji(target, id) {
  // 只用路由 ID 查找已知主题，未知链接回到目录。
  const quiz = ZHIJI_QUIZZES.find(item => item.id === id);
  if (!quiz) {
    target.innerHTML = `<section class="zhiji">
      <div class="zhiji-intro"><h1>知己</h1><p>选一套小测，看看自己在不同情境里更自然的反应。</p></div>
      <ul class="zhiji-list">${ZHIJI_QUIZZES.map(item => `<li><a href="#zhiji/${item.id}">
        <div><h2>${item.title}</h2><p>${item.summary}</p></div>
        <span>${item.questions.length} 题 <span aria-hidden="true">↗</span></span>
      </a></li>`).join('')}</ul>
      <p class="help">答题结果仅供自我观察与娱乐。</p>
    </section>`;
    return;
  }

  // 按题号保存所选选项的下标，前后切换时恢复已选项。
  const answers = [];
  // 当前展示的题号，从 0 开始，重测时归零。
  let step = 0;
  const count = quiz.questions.length;

  /** 更新答题表单，保留原生单选键盘操作和必答校验。 */
  function showQuestion() {
    const [prompt, options] = quiz.questions[step];
    target.innerHTML = `<section class="zhiji">
      <a class="breadcrumb" href="#zhiji">返回知己</a>
      <h1>${quiz.title}</h1>
      <form class="zhiji-sheet">
        <div class="zhiji-progress"><span>第 ${step + 1} / ${count} 题</span><progress aria-label="答题进度" value="${step + 1}" max="${count}"></progress></div>
        <fieldset><legend tabindex="-1">${prompt}</legend>
          ${options.map(([label], index) => `<label class="zhiji-option">
            <input type="radio" name="answer" value="${index}" required ${answers[step] === index ? 'checked' : ''}>
            <span>${label}</span>
          </label>`).join('')}
        </fieldset>
        <div class="zhiji-actions">
          <button class="primary" type="submit">${step + 1 === count ? '查看结果' : '下一题'}</button>
          ${step > 0 ? '<button class="secondary" type="button" data-previous>上一题</button>' : ''}
        </div>
      </form>
    </section>`;
    const form = target.querySelector('form');
    form.querySelector('legend').focus({preventScroll:true});
    // 选中时保存，用户直接点上一题也能保留这一题的选择。
    form.addEventListener('change', event => { answers[step] = Number(event.target.value); });
    form.querySelector('[data-previous]')?.addEventListener('click', () => {
      step--;
      showQuestion();
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (step + 1 === count) {
        showResult();
      } else {
        step++;
        showQuestion();
      }
    });
  }

  /** 展示解读，按同一个答卷标识保存或重试。 */
  function showResult(attemptId) {
    const outcome = evaluateZhijiQuiz(quiz, answers);
    if (!outcome) return;
    // 随机答卷标识用于重复点击和网络重试；getRandomValues 也适用于 HTTP 部署。
    const saveAttempt = attemptId ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2,'0')).join('');
    target.innerHTML = `<section class="zhiji">
      <a class="breadcrumb" href="#zhiji">返回知己</a>
      <h1>${quiz.title}</h1>
      <div data-result></div>
    </section>`;
    const card = renderZhijiResult(target.querySelector('[data-result]'), {...outcome,questionCount:count});
    card.insertAdjacentHTML('beforeend', `<div class="zhiji-actions">
      <button class="primary" type="button" data-save>保存到我的札记</button>
      <button class="secondary" type="button" data-restart>再测一次</button>
      <a class="secondary" href="#zhiji">挑下一套</a>
    </div><p class="help" role="status"></p>`);
    card.querySelector('h2').focus({preventScroll:true});
    const saveButton = card.querySelector('[data-save]');
    const notice = card.querySelector('[role=status]');
    card.querySelector('[data-restart]').addEventListener('click', () => {
      answers.length = 0;
      step = 0;
      showQuestion();
    });
    saveButton.addEventListener('click', async () => {
      saveButton.disabled = true;
      notice.textContent = '正在保存…';
      // 只在主动保存时提交答卷，服务端按题库版本重新计分。
      const input = {quizId:quiz.id,quizVersion:ZHIJI_QUIZ_VERSION,attemptId:saveAttempt,answers:[...answers]};
      try {
        const response = await fetch('/api/notes/zhiji', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(input)
        });
        const data = await response.json();
        if (!saveButton.isConnected) return;
        if (response.status === 401 && data.code === 'LOGIN_REQUIRED') {
          const login = document.createElement('a');
          login.href = `#account/login/zhiji/${quiz.id}`;
          login.textContent = '登录后继续保存';
          login.addEventListener('click', event => {
            try { sessionStorage.setItem(LOGIN_DRAFT_KEY, JSON.stringify(input)); }
            catch { event.preventDefault(); notice.textContent = '浏览器无法暂存答卷，请先保留此页。'; }
          });
          notice.replaceChildren('这份测评需要登录后才能保存。', login);
          return;
        }
        if (!response.ok) throw new Error(data.error || '保存失败，请重试');
        location.hash = '#note/' + encodeURIComponent(data.note.id);
      } catch (error) {
        notice.textContent = error instanceof SyntaxError || error instanceof TypeError ? '保存失败，请重试' : error.message;
      } finally {
        saveButton.disabled = false;
      }
    });
  }

  // 恢复同一标签页里等待登录的答卷，恢复后仍由用户确认保存。
  let draft;
  try {
    draft = JSON.parse(sessionStorage.getItem(LOGIN_DRAFT_KEY));
    if (draft?.quizId === quiz.id) sessionStorage.removeItem(LOGIN_DRAFT_KEY);
  } catch {
    // 禁用会话存储时，仍可正常开始本次测评。
  }
  if (draft?.quizId === quiz.id && draft.quizVersion === ZHIJI_QUIZ_VERSION &&
      /^[a-f0-9]{32}$/.test(draft.attemptId) && evaluateZhijiQuiz(quiz,draft.answers)) {
    answers.push(...draft.answers);
    return showResult(draft.attemptId);
  }
  showQuestion();
}
