/** 知己页面：同一个答题界面按题库配置展示目录、问题和结果。 */
import { ZHIJI_QUIZZES, evaluateZhijiQuiz } from './zhiji-quizzes.js';

/** 进入目录或题目，作答与结果只保留在当前页面。 */
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

  /** 展示当前答卷的解读，并允许清空本次答卷重测。 */
  function showResult() {
    const outcome = evaluateZhijiQuiz(quiz, answers);
    if (!outcome) return;
    const {result, age} = outcome;
    target.innerHTML = `<section class="zhiji">
      <a class="breadcrumb" href="#zhiji">返回知己</a>
      <h1>${quiz.title}</h1>
      <article class="zhiji-sheet zhiji-result">
        ${age === null ? '' : `<p class="zhiji-age">${age}<span>岁</span></p>`}
        <h2 tabindex="-1">${result.title}</h2>
        <p>${result.detail}</p>
        <p class="help">结果来自这次选择，仅供自我观察与娱乐。${age === null ? '' : '年龄数字是娱乐刻度。'}</p>
        <div class="zhiji-actions"><a class="primary" href="#zhiji">挑下一套</a><button class="secondary" type="button" data-restart>再测一次</button></div>
      </article>
    </section>`;
    target.querySelector('h2').focus({preventScroll:true});
    target.querySelector('[data-restart]').addEventListener('click', () => {
      answers.length = 0;
      step = 0;
      showQuestion();
    });
  }

  showQuestion();
}
