/**
 * @fileoverview InterviewAI — UI Behavior
 * Vanilla ES6+, no frameworks. All listeners attached here.
 * Depends on window.AnswerAnalyzer (loaded via analyzer.js).
 */

'use strict';

(function () {

  /* ── CONSTANTS ─────────────────────────────────────────── */
  const SCROLL_SHADOW_PX   = 10;
  const BACK_TO_TOP_PX     = 600;
  const DEBOUNCE_MS        = 300;
  const HISTORY_KEY        = 'interviewai_history';
  const THEME_KEY          = 'interviewai_theme';
  const MAX_HISTORY        = 5;
  const ANIMATION_DURATION = 1200;

  const QUESTIONS = [
    'Tell me about a time you solved a difficult technical problem.',
    'Describe a situation where you had to meet a tight deadline.',
    'Give an example of when you showed leadership on a project.',
    'Tell me about a time you disagreed with a teammate and how you handled it.',
    'Describe a project you are most proud of and your specific contribution.'
  ];

  /* ── UTILITIES ─────────────────────────────────────────── */
  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  }

  /** Return a CSS color token string based on score value */
  function scoreColor(score) {
    if (score >= 75) return 'var(--clr-green)';
    if (score >= 50) return 'var(--clr-yellow)';
    return '#ef4444';
  }

  /* ── 1. THEME TOGGLE ───────────────────────────────────── */
  function initTheme() {
    const btn = qs('#theme-toggle');
    if (!btn) return;

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.textContent = theme === 'dark' ? '☀' : '🌙';
    }

    const saved  = lsGet(THEME_KEY);
    const osDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (osDark ? 'dark' : 'light'));

    btn.addEventListener('click', function () {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      lsSet(THEME_KEY, next);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!lsGet(THEME_KEY)) applyTheme(e.matches ? 'dark' : 'light');
    });
  }

  /* ── 2. NAVBAR BEHAVIOR ────────────────────────────────── */
  function initNavbar() {
    const toggle   = qs('#nav-toggle');
    const header   = qs('header');
    const navLinks = qsa('.nav-links a');

    navLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        if (toggle) toggle.checked = false;
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle && toggle.checked) toggle.checked = false;
    });

    if (header) {
      window.addEventListener('scroll', debounce(function () {
        header.classList.toggle('header--scrolled', window.scrollY > SCROLL_SHADOW_PX);
      }, 50), { passive: true });
    }

    const sections = qsa('main section[id]');
    if (sections.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            navLinks.forEach(function (link) {
              link.classList.toggle('nav-link--active', link.getAttribute('href') === '#' + entry.target.id);
            });
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      sections.forEach(function (s) { io.observe(s); });
    }
  }

  /* ── 3. SCROLL REVEAL ──────────────────────────────────── */
  function initScrollReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const targets = qsa('.section-header, .step-card, .feature-card, .feedback-browser, .cta-inner, .try-it-card, .az-history');
    targets.forEach(function (el) { el.classList.add('reveal'); });

    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal--visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    targets.forEach(function (el) { io.observe(el); });
  }

  /* ── 4. FEEDBACK PREVIEW ANIMATION ────────────────────── */
  function initFeedbackAnimation() {
    const section = qs('#feedback');
    if (!section || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let animated = false;
    const io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && !animated) {
        animated = true;
        io.disconnect();
        animateFeedbackWidgets(section);
      }
    }, { threshold: 0.25 });
    io.observe(section);
  }

  function animateFeedbackWidgets(section) {
    qsa('.score-ring', section).forEach(function (ring) {
      const circle = ring.querySelector('circle:last-child');
      const numEl  = ring.querySelector('span');
      if (!circle || !numEl) return;

      const targetDash = parseFloat(circle.getAttribute('stroke-dasharray')) || 0;
      const targetNum  = parseInt(numEl.textContent, 10) || 0;

      circle.style.strokeDasharray = '0 100';
      numEl.textContent = '0';

      const start = performance.now();
      (function step(now) {
        const t    = Math.min((now - start) / ANIMATION_DURATION, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        circle.style.strokeDasharray = (ease * targetDash) + ' 100';
        numEl.textContent = Math.round(ease * targetNum);
        if (t < 1) requestAnimationFrame(step);
      })(performance.now());
    });

    qsa('.skill-fill', section).forEach(function (fill) {
      const target = parseFloat(fill.style.width) || 0;
      fill.style.width = '0%';
      const start = performance.now();
      (function step(now) {
        const t    = Math.min((now - start) / ANIMATION_DURATION, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        fill.style.width = (ease * target) + '%';
        if (t < 1) requestAnimationFrame(step);
      })(performance.now());
    });
  }

  /* ── 5. ANSWER ANALYZER UI ─────────────────────────────── */
  function initAnalyzer() {
    const form        = qs('#analyzer-form');
    const select      = qs('#question-select');
    const textarea    = qs('#answer-textarea');
    const wordCountEl = qs('#word-count');
    const resultsEl   = qs('#analyzer-results');
    const errorEl     = qs('#analyzer-error');
    const historyList = qs('#history-list');
    const clearBtn    = qs('#clear-history-btn');

    if (!form || !textarea) return;

    // Populate question selector
    if (select) {
      QUESTIONS.forEach(function (q, i) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = q;
        select.appendChild(opt);
      });
    }

    // Live word counter
    textarea.addEventListener('input', debounce(function () {
      if (!wordCountEl || !window.AnswerAnalyzer) return;
      const count = window.AnswerAnalyzer.countWords(textarea.value);
      wordCountEl.textContent = count + ' word' + (count !== 1 ? 's' : '');
    }, DEBOUNCE_MS));

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      runAnalysis();
    });

    function runAnalysis() {
      if (!window.AnswerAnalyzer) return;
      const result = window.AnswerAnalyzer.analyse(textarea.value.trim());

      if (errorEl) errorEl.textContent = '';

      if (!result.valid) {
        if (errorEl) errorEl.textContent = result.error;
        if (resultsEl) {
          resultsEl.classList.remove('az-results--visible');
          resultsEl.hidden = true;
        }
        return;
      }

      renderResults(result);
      saveHistory(result, select ? select.value : '0');
      renderHistory();
    }

    /* ── Render results ── */
    function renderResults(r) {
      if (!resultsEl) return;

      // Score ring — color by score
      const ringCircle = qs('.az-score-circle', resultsEl);
      const ringNum    = qs('.az-score-num', resultsEl);
      if (ringCircle) {
        ringCircle.setAttribute('stroke', scoreColor(r.score));
      }

      // Metric bars — store targets as data attributes for animation
      const starCount = Object.values(r.star).filter(Boolean).length;
      const barTargets = {
        '.az-bar-star':   Math.round((starCount / 4) * 100),
        '.az-bar-length': r.length.status === 'ideal' ? 100 : r.length.status === 'too_short' ? Math.round((r.length.words / 90) * 100) : 70,
        '.az-bar-filler': Math.max(0, 100 - Math.round(r.fillers.ratio * 1000)),
        '.az-bar-quant':  r.hasQuant ? 100 : 0
      };

      Object.entries(barTargets).forEach(function ([sel, pct]) {
        const fill = qs(sel, resultsEl);
        if (fill) fill.dataset.target = pct;
      });

      // STAR checklist
      ['situation', 'task', 'action', 'result'].forEach(function (part) {
        const item = qs('.az-star-' + part, resultsEl);
        if (!item) return;
        item.classList.toggle('az-star--found',   r.star[part]);
        item.classList.toggle('az-star--missing', !r.star[part]);
        const icon = qs('.az-star-icon', item);
        if (icon) icon.textContent = r.star[part] ? '✓' : '✗';
      });

      // Tips
      const tipsList = qs('.az-tips-list', resultsEl);
      if (tipsList) {
        tipsList.textContent = '';
        r.tips.forEach(function (tip) {
          const li = document.createElement('li');
          li.textContent = tip;
          tipsList.appendChild(li);
        });
      }

      // Length note
      const lengthNote = qs('.az-length-note', resultsEl);
      if (lengthNote) {
        const map = { ideal: 'Ideal length ✓', too_short: 'Too short — add more detail', too_long: 'A bit long — consider trimming' };
        lengthNote.textContent = r.length.words + ' words · ' + (map[r.length.status] || '');
      }

      // Filler note
      const fillerNote = qs('.az-filler-note', resultsEl);
      if (fillerNote) {
        fillerNote.textContent = r.fillers.count > 0
          ? 'Filler words found: ' + r.fillers.found.join(', ')
          : 'No significant filler words detected ✓';
      }

      // Show results with fade-in
      resultsEl.hidden = false;
      requestAnimationFrame(function () {
        resultsEl.classList.add('az-results--visible');
      });

      // Animate ring and bars after reveal
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animateResultRing(resultsEl, r.score, ringNum);
        animateResultBars(resultsEl);
      } else {
        // No animation — just set final values
        if (ringNum) ringNum.textContent = r.score;
        qsa('.az-metric-fill', resultsEl).forEach(function (fill) {
          fill.style.width = (fill.dataset.target || 0) + '%';
        });
      }
    }

    function animateResultRing(root, score, numEl) {
      const circle = qs('.az-score-circle', root);
      if (!circle || !numEl) return;
      const targetDash = (score / 100) * 94;
      circle.setAttribute('stroke-dasharray', '0 100');
      numEl.textContent = '0';
      const start = performance.now();
      (function step(now) {
        const t    = Math.min((now - start) / 800, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        circle.setAttribute('stroke-dasharray', (ease * targetDash) + ' 100');
        numEl.textContent = Math.round(ease * score);
        if (t < 1) requestAnimationFrame(step);
      })(performance.now());
    }

    function animateResultBars(root) {
      qsa('.az-metric-fill', root).forEach(function (fill) {
        const target = parseFloat(fill.dataset.target) || 0;
        fill.style.width = '0%';
        // Double rAF ensures the 0% paint happens before transition starts
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            fill.style.transition = 'width 0.9s cubic-bezier(0.16,1,0.3,1)';
            fill.style.width = target + '%';
          });
        });
      });
    }

    /* ── History ── */
    function saveHistory(result, questionIdx) {
      const history = lsGet(HISTORY_KEY) || [];
      history.unshift({
        ts:       Date.now(),
        question: QUESTIONS[parseInt(questionIdx, 10)] || 'Custom question',
        score:    result.score
      });
      lsSet(HISTORY_KEY, history.slice(0, MAX_HISTORY));
    }

    function renderHistory() {
      if (!historyList) return;
      const history = lsGet(HISTORY_KEY) || [];
      historyList.textContent = '';

      if (history.length === 0) {
        const li = document.createElement('li');
        li.className = 'history-empty';
        li.textContent = 'No attempts yet — analyze an answer to get started.';
        historyList.appendChild(li);
        return;
      }

      history.forEach(function (item) {
        const li = document.createElement('li');
        li.className = 'history-item';

        const date = document.createElement('span');
        date.className = 'history-date';
        date.textContent = new Date(item.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        const q = document.createElement('span');
        q.className = 'history-q';
        q.textContent = item.question.length > 55 ? item.question.slice(0, 52) + '…' : item.question;

        const score = document.createElement('span');
        score.className = 'history-score';
        score.textContent = item.score + '/100';
        // Color the score badge dynamically
        score.style.color = scoreColor(item.score);
        score.style.borderColor = scoreColor(item.score);

        li.appendChild(date);
        li.appendChild(q);
        li.appendChild(score);
        historyList.appendChild(li);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        lsSet(HISTORY_KEY, []);
        renderHistory();
      });
    }

    renderHistory();
  }

  /* ── 6. BACK TO TOP ────────────────────────────────────── */
  function initBackToTop() {
    const btn = qs('#back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', debounce(function () {
      btn.classList.toggle('btt--visible', window.scrollY > BACK_TO_TOP_PX);
    }, 100), { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── BOOT ──────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initNavbar();
    initScrollReveal();
    initFeedbackAnimation();
    initAnalyzer();
    initBackToTop();
  });

})();
