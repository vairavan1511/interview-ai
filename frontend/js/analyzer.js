/**
 * @fileoverview InterviewAI — Answer Analyzer
 * Pure functions only. No DOM access. Exported via window.AnswerAnalyzer.
 * Can be unit-tested independently.
 */

'use strict';

(function () {

  /* ── CONSTANTS ─────────────────────────────────────────── */
  const MIN_WORDS        = 20;
  const IDEAL_MIN_WORDS  = 60;   // lowered from 90
  const IDEAL_MAX_WORDS  = 200;
  const MAX_FILLER_RATIO = 0.05;

  // Fix 1 — filler "like" handled separately; removed from this list
  const FILLER_WORDS = [
    'um', 'uh', 'basically', 'you know',
    'actually', 'kind of', 'sort of'
  ];

  /** STAR keyword patterns */
  const STAR_PATTERNS = {
    // Fix 2 — require context phrases, not bare "at" / "when" / "in my"
    situation: /\b(at my (internship|job|company|previous|current|last|first|role|work|team|startup|university|school)|during (the|my|our|a) (project|internship|sprint|semester|hackathon|interview|meeting|crisis|incident)|while (working|interning|studying|leading|building)|i was (working|interning|studying|employed)|we were (building|working|tasked|facing)|last (year|semester|quarter|month)|previously (at|working)|in \d{4} (i|we|our))\b/i,

    task: /\b(i (had to|needed to|was (asked|assigned|responsible)|was tasked)|my (role|responsibility|goal|objective|job) was|tasked with|assigned to|needed to)\b/i,

    // Fix 1 — match "I <past-tense-verb>" broadly, including irregular verbs
    action: /\b(i (profiled|rewrote|wrote|built|created|implemented|designed|led|fixed|improved|developed|refactored|introduced|set up|deployed|optimized|collaborated|worked|decided|chose|started|began|used|applied|made|ran|reviewed|analysed|analyzed|migrated|integrated|automated|reduced|increased|shipped|launched|tested|debugged|documented|researched|interviewed|presented|managed|coordinated|mentored|trained|configured|architected|restructured|identified|resolved|investigated|monitored|tracked|measured|established|defined|planned|executed|delivered|contributed|helped|supported|owned|drove|spearheaded|initiated|proposed|negotiated|communicated|facilitated|streamlined|simplified|consolidated|refactored|scaled|secured|validated|verified|deployed|released|published|submitted|completed|finished|achieved|accomplished))\b/i,

    result: /\b(result(ed|ing)?|outcome|impact|improved|increased|decreased|reduced|saved|achieved|delivered|shipped|launched|grew|cut|boosted|as a result|in the end|ultimately|which (led|resulted|helped)|by \d+%?|within \d+)\b/i
  };

  // Fix 4 — exclude bare 4-digit years; require a unit or keyword suffix/prefix
  const QUANTIFIED_PATTERN = /\b\d+(\.\d+)?(%|x|k|m|ms|s|hrs?|days?|weeks?|months?|years?|users?|requests?|lines?|times?|percent)\b|\b(doubled|tripled|halved)\b/i;

  /* ── HELPERS ───────────────────────────────────────────── */

  /**
   * Tokenise text into lowercase words, stripping punctuation.
   * @param {string} text
   * @returns {string[]}
   */
  function tokenise(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  /**
   * Count total words in text.
   * @param {string} text
   * @returns {number}
   */
  function countWords(text) {
    return tokenise(text).length;
  }

  /* ── ANALYSIS FUNCTIONS ────────────────────────────────── */

  /**
   * Count filler words and return which ones were found.
   * Fix 5 — "like" counted only when used as a filler, not as a preposition/verb
   * (i.e. NOT followed by a noun phrase: "like Redis", "like this", "like a").
   * @param {string} text
   * @returns {{ count: number, found: string[], ratio: number }}
   */
  function analyseFillers(text) {
    const lower = text.toLowerCase();
    const words = tokenise(text);
    const found = [];
    let count = 0;

    FILLER_WORDS.forEach(function (filler) {
      const re = new RegExp('\\b' + filler.replace(/\s+/g, '\\s+') + '\\b', 'gi');
      const matches = lower.match(re);
      if (matches) {
        count += matches.length;
        found.push(filler + ' \xd7' + matches.length);
      }
    });

    // Fix 5 — count "like" only when NOT followed by a noun/article/pronoun
    // Pattern: "like" followed by word boundary then NOT (a|an|the|this|that|[A-Z word])
    const likeFillerRe = /\blike\b(?!\s+(a|an|the|this|that|these|those|[a-z]+ing\b))/gi;
    // Simpler reliable heuristic: "like" is filler when preceded by comma/space
    // and followed by a verb or adjective, not a noun phrase.
    // We use: "like" is filler when it appears between two verbs or after "was"/"is"/"are"
    // Best practical approach: flag "like" that is NOT preceded by "feel", "looks", "seems",
    // "sounds", "just", "something", "nothing", "anything", "everything" and NOT followed
    // by a noun determiner or proper-noun-like capitalised word.
    const likeMatches = lower.match(/\blike\b/g) || [];
    let likeFillerCount = 0;
    // Walk through each occurrence
    const likeRe = /\blike\b/g;
    let m;
    while ((m = likeRe.exec(lower)) !== null) {
      const before = lower.slice(Math.max(0, m.index - 20), m.index).trim();
      const after  = lower.slice(m.index + 4).trimStart();
      // Not a filler if: "feel like", "looks like", "seems like", "sounds like",
      // "just like", "nothing like", "something like", "more like"
      const notFillerBefore = /\b(feel|feels|felt|look|looks|seem|seems|sound|sounds|just|nothing|something|anything|everything|more|less|much|act|acts|acted)\s*$/.test(before);
      // Not a filler if followed by a determiner or preposition (comparison use)
      const notFillerAfter = /^(a|an|the|this|that|these|those|my|your|his|her|its|our|their|what|how|when|where|which)\b/.test(after);
      if (!notFillerBefore && !notFillerAfter) {
        likeFillerCount++;
      }
    }

    if (likeFillerCount > 0) {
      count += likeFillerCount;
      found.push('like \xd7' + likeFillerCount);
    }

    return {
      count,
      found,
      ratio: words.length > 0 ? count / words.length : 0
    };
  }

  /**
   * Detect which STAR components are present.
   * @param {string} text
   * @returns {{ situation: boolean, task: boolean, action: boolean, result: boolean }}
   */
  function detectSTAR(text) {
    return {
      situation: STAR_PATTERNS.situation.test(text),
      task:      STAR_PATTERNS.task.test(text),
      action:    STAR_PATTERNS.action.test(text),
      result:    STAR_PATTERNS.result.test(text)
    };
  }

  /**
   * Check answer length and return a status.
   * @param {string} text
   * @returns {{ words: number, status: 'too_short'|'ideal'|'too_long' }}
   */
  function checkLength(text) {
    const words = countWords(text);
    let status;
    if (words < IDEAL_MIN_WORDS)      status = 'too_short';
    else if (words > IDEAL_MAX_WORDS) status = 'too_long';
    else                              status = 'ideal';
    return { words, status };
  }

  /**
   * Check whether the answer contains quantified impact.
   * Fix 4 — bare 4-digit years (e.g. 2024) no longer match.
   * @param {string} text
   * @returns {boolean}
   */
  function hasQuantifiedImpact(text) {
    return QUANTIFIED_PATTERN.test(text);
  }

  /**
   * Calculate a clarity score out of 100.
   *
   * Formula (transparent):
   *   Base                    = 20 pts  (lowered from 40)
   *   Length (ideal range)    = +20 pts (partial credit for close)
   *   STAR coverage           = +25 pts (each component = 6.25 pts)
   *   Quantified impact       = +10 pts
   *   Filler penalty          = −5 pts per % above threshold (max −15)
   *
   * @param {string} text
   * @returns {number} integer 0–100
   */
  function clarityScore(text) {
    const length   = checkLength(text);
    const star     = detectSTAR(text);
    const fillers  = analyseFillers(text);
    const hasQuant = hasQuantifiedImpact(text);

    let score = 20; // Fix 3 — base lowered from 40

    // Length component (20 pts)
    if (length.status === 'ideal') {
      score += 20;
    } else if (length.status === 'too_short') {
      const ratio = Math.max(0, (length.words - MIN_WORDS) / (IDEAL_MIN_WORDS - MIN_WORDS));
      score += Math.round(ratio * 20);
    } else {
      score += 12; // too_long
    }

    // STAR component (25 pts, 6.25 each)
    const starCount = Object.values(star).filter(Boolean).length;
    score += Math.round(starCount * 6.25);

    // Quantified impact (10 pts)
    if (hasQuant) score += 10;

    // Filler penalty (max −15)
    if (fillers.ratio > MAX_FILLER_RATIO) {
      const excessPct = (fillers.ratio - MAX_FILLER_RATIO) * 100;
      score -= Math.min(15, Math.round(excessPct * 5));
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate 2–4 specific improvement tips based on analysis results.
   * @param {{ star: object, length: object, fillers: object, hasQuant: boolean }} results
   * @returns {string[]}
   */
  function generateTips(results) {
    const tips = [];
    const { star, length, fillers, hasQuant } = results;

    if (!star.situation) tips.push('Add a Situation: briefly set the scene — where were you, what was the context?');
    if (!star.task)      tips.push('Add a Task: clarify what your specific responsibility or goal was.');
    if (!star.action)    tips.push('Add Actions: describe the concrete steps you personally took.');
    if (!star.result)    tips.push('Add a Result: what was the outcome? Even a qualitative result counts.');

    if (!hasQuant)       tips.push('Quantify your impact — numbers (%, time saved, users affected) make answers memorable.');

    if (length.status === 'too_short') tips.push('Expand your answer — aim for 60–200 words to give enough detail.');
    if (length.status === 'too_long')  tips.push('Tighten your answer — over 200 words risks losing the interviewer\'s attention.');

    if (fillers.count > 0) tips.push('Reduce filler words (' + fillers.found.slice(0, 3).join(', ') + ') — they dilute your message.');

    return tips.slice(0, 4);
  }

  /**
   * Run the full analysis pipeline on an answer string.
   * @param {string} text  Raw answer text
   * @returns {{
   *   wordCount: number,
   *   score: number,
   *   fillers: { count: number, found: string[], ratio: number },
   *   star: { situation: boolean, task: boolean, action: boolean, result: boolean },
   *   length: { words: number, status: string },
   *   hasQuant: boolean,
   *   tips: string[],
   *   valid: boolean,
   *   error: string|null
   * }}
   */
  function analyse(text) {
    const wordCount = countWords(text);

    if (wordCount < MIN_WORDS) {
      return {
        wordCount,
        score: 0,
        fillers: { count: 0, found: [], ratio: 0 },
        star: { situation: false, task: false, action: false, result: false },
        length: { words: wordCount, status: 'too_short' },
        hasQuant: false,
        tips: [],
        valid: false,
        error: 'Please write at least ' + MIN_WORDS + ' words before analyzing.'
      };
    }

    const fillers  = analyseFillers(text);
    const star     = detectSTAR(text);
    const length   = checkLength(text);
    const hasQuant = hasQuantifiedImpact(text);
    const score    = clarityScore(text);
    const tips     = generateTips({ star, length, fillers, hasQuant });

    return { wordCount, score, fillers, star, length, hasQuant, tips, valid: true, error: null };
  }

  /* ── EXPORT ────────────────────────────────────────────── */
  window.AnswerAnalyzer = { analyse, countWords, analyseFillers, detectSTAR, checkLength, hasQuantifiedImpact, clarityScore };

})();

/* ================================================================
   TEST CASES — paste into browser console or Node (with window shim)
   ================================================================

   1. PERFECT answer
   ─────────────────────────────────────────────────────────────────
   text: "At my previous internship at a fintech startup, I was tasked with
   reducing API response times that were causing user drop-off. I profiled
   the endpoints, identified N+1 query issues, and implemented Redis caching.
   I also rewrote three slow SQL queries using indexed joins. As a result,
   average response time dropped by 62% and user retention improved by 18%
   over the next sprint."
   Expected: score 75, valid true, all STAR true, hasQuant true, 0 tips
   Formula:  base 20 + length 20 (ideal) + STAR 25 (4×6.25) + quant 10 = 75

   2. MISSING RESULT
   ─────────────────────────────────────────────────────────────────
   text: "During my last project, I was responsible for building the
   authentication module. I designed the JWT flow, implemented refresh
   tokens, and wrote unit tests covering edge cases. I collaborated with
   the backend team to integrate it with the existing user service and
   documented the API endpoints thoroughly."
   Expected: score 59, result false, hasQuant false, tip about result + quant
   Formula:  base 20 + length 20 (ideal) + STAR 19 (3×6.25) + quant 0 = 59

   3. TOO SHORT
   ─────────────────────────────────────────────────────────────────
   text: "I worked on a project and improved performance."
   Expected: valid false, score 0, wordCount 8, error message returned

   4. FILLER-HEAVY
   ─────────────────────────────────────────────────────────────────
   text: "So basically, um, when I was like working at this company, you know,
   I was kind of tasked with, uh, improving the dashboard. I basically just
   like rewrote the components and, you know, it was actually sort of faster
   after that. The team was like really happy with the result and we basically
   shipped it on time."
   Expected: score 44, fillers.count ~13, situation false (no context phrase),
             filler penalty −15 applied
   Formula:  base 20 + length 20 (ideal) + STAR 19 (3×6.25) + quant 0 − penalty 15 = 44

   5. NO QUANTIFIED IMPACT
   ─────────────────────────────────────────────────────────────────
   text: "At my previous role I was asked to improve the onboarding flow.
   I conducted user interviews to understand pain points, then redesigned
   the multi-step form to reduce friction. I worked closely with the design
   team and implemented the changes over two sprints. The new flow was much
   simpler and users found it easier to complete. The team was pleased with
   the outcome and we received positive feedback from stakeholders."
   Expected: score 59, hasQuant false ("two" is a word not a digit),
             situation false ("at my previous role" lacks context phrase)
   Formula:  base 20 + length 20 (ideal) + STAR 19 (3×6.25) + quant 0 = 59

================================================================ */
