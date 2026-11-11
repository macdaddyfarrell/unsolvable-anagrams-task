/* =====================================================================
   UNSOLVABLE ANAGRAM TASK (distress intolerance / persistence)
   jsPsych 8 inside a single Qualtrics question
   ---------------------------------------------------------------------
   Paste this whole file into the question's JavaScript editor
   (question gear icon > "Add JavaScript"), replacing what's there.
   The question's HTML must contain:  <div id="jspsych-target"></div>
   ===================================================================== */

Qualtrics.SurveyEngine.addOnload(function () {
  /* nothing here — everything runs in addOnReady */
});

Qualtrics.SurveyEngine.addOnReady(function () {
  var qthis = this;

  /* ------------------------------ SETTINGS ------------------------------ */
  var CONFIG = {
    TIME_LIMIT_MS: 90000,        // 90 s per anagram
    SHOW_TIMER: true,            // show countdown to participant
    CORRECT_MSG_MS: 1500,        // how long "Correct!" shows before moving on
    ERROR_MSG_MS: 1500,          // how long the error screen shows before returning
    TIMEOUT_MSG_MS: 1500,        // how long "Time's up" shows before moving on
    RANDOMIZE_TEST_ORDER: false, // shuffle the unsolvable items (practice always first)
    JSPSYCH_URL: 'https://unpkg.com/jspsych@8.3.0/dist/index.browser.min.js',
    EMBEDDED_PREFIX: 'anag_'     // prefix for Qualtrics embedded data fields
  };

  // answers: [] = unsolvable. Every unsolvable item below was checked against a
  // ~260,000-word English dictionary and has no valid anagram.
  var ITEMS = [
    { letters: 'UOHSE',  answers: ['house'], phase: 'practice' },
    { letters: 'TPALN',  answers: ['plant'], phase: 'practice' },
    { letters: 'ULRVES', answers: [], phase: 'test' },
    { letters: 'MLNPEA', answers: [], phase: 'test' },
    { letters: 'SAORFT', answers: [], phase: 'test' },
    { letters: 'NIRWTO', answers: [], phase: 'test' },
    { letters: 'RCOKEG', answers: [], phase: 'test' },
    { letters: 'NSLDIO', answers: [], phase: 'test' }
  ];
  /* ---------------------------------------------------------------------- */

  // Hide Qualtrics navigation while the task runs
  qthis.hideNextButton();
  if (qthis.hidePreviousButton) qthis.hidePreviousButton();

  function setED(name, value) {
    var full = CONFIG.EMBEDDED_PREFIX + name;
    var v = String(value);
    try { Qualtrics.SurveyEngine.setEmbeddedData(full, v); } catch (e) {}
    // New/Simple survey layout uses setJSEmbeddedData (field appears as __js_<name>)
    try { if (Qualtrics.SurveyEngine.setJSEmbeddedData) Qualtrics.SurveyEngine.setJSEmbeddedData(full, v); } catch (e) {}
  }

  function loadScript(src, cb) {
    if (window.jsPsychModule) return cb();
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = function () {
      document.getElementById('jspsych-target').innerHTML =
        '<p style="color:#b00">The task could not load. Please check your internet connection and refresh.</p>';
      setED('load_error', 1);
      qthis.showNextButton();
    };
    document.head.appendChild(s);
  }

  function injectCSS() {
    if (document.getElementById('anag-css')) return;
    var css =
      '#jspsych-target{font-family:Arial,Helvetica,sans-serif;text-align:center;min-height:340px;padding:20px 0;}' +
      '#jspsych-target .anag-timer{font-size:18px;color:#555;margin-bottom:18px;height:22px;}' +
      '#jspsych-target .anag-letters{margin:10px 0 28px;}' +
      '#jspsych-target .anag-tile{display:inline-block;width:52px;height:60px;line-height:60px;margin:0 4px;' +
        'font-size:32px;font-weight:bold;border:2px solid #333;border-radius:6px;background:#fafafa;}' +
      '#jspsych-target .anag-input{font-size:24px;padding:8px 12px;width:240px;text-transform:uppercase;' +
        'text-align:center;border:2px solid #888;border-radius:6px;}' +
      '#jspsych-target .anag-btns{margin-top:22px;}' +
      '#jspsych-target .anag-btn{font-size:18px;padding:10px 26px;margin:0 10px;border-radius:6px;cursor:pointer;border:none;}' +
      '#jspsych-target .anag-submit{background:#2a6ebb;color:#fff;}' +
      '#jspsych-target .anag-skip{background:#ddd;color:#222;}' +
      '#jspsych-target .anag-msg{font-size:30px;font-weight:bold;margin-top:110px;}' +
      '#jspsych-target .anag-msg.ok{color:#1f8a3b;}' +
      '#jspsych-target .anag-msg.err{color:#c0392b;}' +
      '#jspsych-target .anag-sub{font-size:18px;color:#444;margin-top:12px;font-weight:normal;}';
    var st = document.createElement('style');
    st.id = 'anag-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function normalize(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }

  loadScript(CONFIG.JSPSYCH_URL, function () {
    injectCSS();
    var PT = jsPsychModule.ParameterType;

    /* ---------------------- custom anagram plugin ---------------------- */
    class AnagramPlugin {
      constructor(jsPsych) { this.jsPsych = jsPsych; }

      trial(display_element, trial) {
        var self = this;
        var t0 = performance.now();
        var attempts = [];
        var timers = [];
        var ended = false;
        var timerInterval = null;

        function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
        function elapsed() { return Math.round(performance.now() - t0); }

        var tiles = trial.letters.split('').map(function (c) {
          return '<span class="anag-tile">' + c + '</span>';
        }).join('');

        display_element.innerHTML =
          '<div class="anag-task">' +
            '<div class="anag-timer"></div>' +
            '<div class="anag-letters">' + tiles + '</div>' +
            '<input class="anag-input" type="text" autocomplete="off" autocorrect="off" ' +
              'autocapitalize="off" spellcheck="false" maxlength="' + trial.letters.length + '">' +
            '<div class="anag-btns">' +
              '<button type="button" class="anag-btn anag-submit">Submit</button>' +
              '<button type="button" class="anag-btn anag-skip">Skip</button>' +
            '</div>' +
          '</div>' +
          '<div class="anag-feedback" style="display:none"></div>';

        var taskDiv = display_element.querySelector('.anag-task');
        var fbDiv = display_element.querySelector('.anag-feedback');
        var input = display_element.querySelector('.anag-input');
        var timerDiv = display_element.querySelector('.anag-timer');

        function updateTimer() {
          if (!trial.show_timer) return;
          var left = Math.max(0, Math.ceil((trial.time_limit_ms - elapsed()) / 1000));
          timerDiv.textContent = 'Time remaining: ' + left + 's';
        }
        updateTimer();
        timerInterval = setInterval(updateTimer, 250);

        function showTask() {
          fbDiv.style.display = 'none';
          taskDiv.style.display = '';
          input.value = '';
          input.focus();
        }
        function showMsg(html) {
          taskDiv.style.display = 'none';
          fbDiv.innerHTML = html;
          fbDiv.style.display = '';
        }

        function end(outcome, rt) {
          if (ended) return;
          ended = true;
          timers.forEach(clearTimeout);
          clearInterval(timerInterval);
          var data = {
            letters: trial.letters,
            phase: trial.phase,
            solvable: trial.answers.length > 0,
            outcome: outcome,               // 'correct' | 'skipped' | 'timeout'
            persistence_ms: rt,             // time from item onset to correct/skip/timeout
            n_attempts: attempts.length,
            attempts: JSON.stringify(attempts)
          };
          display_element.innerHTML = '';
          self.jsPsych.finishTrial(data);
        }

        function submit() {
          if (ended || taskDiv.style.display === 'none') return;
          var resp = normalize(input.value);
          if (resp === '') { input.focus(); return; }   // ignore empty submits
          var rt = elapsed();
          var correct = trial.answers.map(normalize).indexOf(resp) !== -1;
          attempts.push({ response: resp, rt_ms: rt, correct: correct });
          if (correct) {
            showMsg('<div class="anag-msg ok">Correct!</div>');
            later(function () { end('correct', rt); }, trial.correct_msg_ms);
          } else {
            showMsg('<div class="anag-msg err">Incorrect<div class="anag-sub">That is not a valid word. Please try again.</div></div>');
            later(showTask, trial.error_msg_ms);       // back to the same anagram; clock keeps running
          }
        }

        function skip() {
          if (ended || taskDiv.style.display === 'none') return;
          end('skipped', elapsed());
        }

        display_element.querySelector('.anag-submit').addEventListener('click', submit);
        display_element.querySelector('.anag-skip').addEventListener('click', skip);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); }
        });

        // hard time limit (also fires if they're on the error screen)
        later(function () {
          if (ended) return;
          var rt = trial.time_limit_ms;
          timers.forEach(clearTimeout); timers = [];
          clearInterval(timerInterval);
          showMsg('<div class="anag-msg err">Time’s up!<div class="anag-sub">Moving to the next one.</div></div>');
          setTimeout(function () { end('timeout', rt); }, trial.timeout_msg_ms);
        }, trial.time_limit_ms);

        input.focus();
      }
    }
    AnagramPlugin.info = {
      name: 'anagram',
      version: '1.0.0',
      parameters: {
        letters:        { type: PT.STRING, default: '' },
        answers:        { type: PT.STRING, array: true, default: [] },
        phase:          { type: PT.STRING, default: 'test' },
        time_limit_ms:  { type: PT.INT, default: 90000 },
        show_timer:     { type: PT.BOOL, default: true },
        correct_msg_ms: { type: PT.INT, default: 1500 },
        error_msg_ms:   { type: PT.INT, default: 1500 },
        timeout_msg_ms: { type: PT.INT, default: 1500 }
      },
      data: {}
    };
    /* ------------------------------------------------------------------- */

    var practice = ITEMS.filter(function (it) { return it.phase === 'practice'; });
    var test = ITEMS.filter(function (it) { return it.phase !== 'practice'; });
    if (CONFIG.RANDOMIZE_TEST_ORDER) shuffle(test);

    var timeline = practice.concat(test).map(function (it, i) {
      return {
        type: AnagramPlugin,
        letters: it.letters.toUpperCase(),
        answers: it.answers,
        phase: it.phase,
        time_limit_ms: CONFIG.TIME_LIMIT_MS,
        show_timer: CONFIG.SHOW_TIMER,
        correct_msg_ms: CONFIG.CORRECT_MSG_MS,
        error_msg_ms: CONFIG.ERROR_MSG_MS,
        timeout_msg_ms: CONFIG.TIMEOUT_MSG_MS,
        data: { item_index: i + 1 }
      };
    });

    var jsPsych = initJsPsych({
      display_element: 'jspsych-target',
      on_finish: function () {
        var all = jsPsych.data.get().filter({ trial_type: 'anagram' });
        var unsolv = all.filter({ solvable: false });
        var rows = unsolv.values();

        var total = 0, nSkip = 0, nTO = 0, nAtt = 0;
        rows.forEach(function (r) {
          total += r.persistence_ms;
          nAtt += r.n_attempts;
          if (r.outcome === 'skipped') nSkip++;
          if (r.outcome === 'timeout') nTO++;
        });

        setED('unsolv_total_ms', total);
        setED('unsolv_mean_ms', rows.length ? Math.round(total / rows.length) : '');
        setED('unsolv_n_skipped', nSkip);
        setED('unsolv_n_timeout', nTO);
        setED('unsolv_n_attempts', nAtt);
        // one field per item: persistence time in ms
        all.values().forEach(function (r) {
          setED('item' + r.item_index + '_ms', r.persistence_ms);
          setED('item' + r.item_index + '_outcome', r.outcome);
        });
        setED('data_json', JSON.stringify(all.values().map(function (r) {
          return { i: r.item_index, letters: r.letters, phase: r.phase, outcome: r.outcome,
                   ms: r.persistence_ms, n_att: r.n_attempts, attempts: r.attempts };
        })));

        document.getElementById('jspsych-target').innerHTML = '';
        qthis.clickNextButton();
      }
    });

    jsPsych.run(timeline);
  });
});

Qualtrics.SurveyEngine.addOnUnload(function () {
  /* nothing */
});
