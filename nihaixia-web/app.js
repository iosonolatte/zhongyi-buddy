/* 中医Buddy · Web 应用主逻辑 */
(function () {
  'use strict';
  const R = window.RULES;
  const DATA = window.DATA;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ============ 导航 ============ */
  function initNav() {
    const items = $$('.nav-item, .bottom-nav .bn-item');
    items.forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.nav-item, .bottom-nav .bn-item').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.view;
        $$('.view').forEach((v) => v.classList.remove('active'));
        const target = $('#view-' + view);
        target.classList.add('active');
        if (window.innerWidth <= 880) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    const toggleTheme = () => {
      const el = document.documentElement;
      const next = el.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      el.setAttribute('data-theme', next);
      try { localStorage.setItem('tcm-theme', next); } catch (e) {}
    };
    $('#themeToggle').addEventListener('click', toggleTheme);
    const mt = $('#themeToggleMobile');
    if (mt) mt.addEventListener('click', toggleTheme);
  }

  /* ============ 辨证问诊 ============ */
  const Diagnosis = {
    eng: null,
    transcript: [],
    selectedChiefs: [],
    followUpIdx: 0,
    resultShown: false,
  };

  const DIAG_STEPS = ['主诉', '寒热', '舌脉', '十问', '定位', '结果'];
  function setStep(n) {
    const prog = $('#diagProgress'); if (!prog) return;
    prog.innerHTML = DIAG_STEPS.map((s, i) => {
      const cls = i < n ? 'done' : (i === n ? 'cur' : '');
      const mark = i < n ? '✓' : (i + 1);
      return `<span class="dp-step ${cls}"><span class="dp-dot">${mark}</span><span class="dp-lbl">${s}</span></span>`;
    }).join('<span class="dp-line"></span>');
  }

  function loadHistory() { try { return JSON.parse(localStorage.getItem('tcm-diag-history') || '[]'); } catch (e) { return []; } }
  function saveHistory(arr) { try { localStorage.setItem('tcm-diag-history', JSON.stringify(arr.slice(0, 20))); } catch (e) {} }
  function addHistory(entry) { const arr = loadHistory(); arr.unshift(entry); saveHistory(arr); renderHistory(); }
  function renderHistory() {
    const box = $('#diagHistory'); if (!box) return;
    const arr = loadHistory();
    box.innerHTML = arr.length
      ? '<div class="hist-title">最近 ' + arr.length + ' 次问诊（点击可重新展示结果）</div>' +
        arr.map((e, i) => `<div class="hist-item" data-i="${i}"><div class="hi-main"><b>${esc(e.meridian)}经</b> · ${esc(e.pattern)}</div><div class="hi-sub">${esc(e.formula || '—')} · ${new Date(e.t).toLocaleString('zh-CN')}</div></div>`).join('')
      : '<div class="empty-hint" style="padding:24px">暂无历史记录</div>';
    box.querySelectorAll('.hist-item').forEach((el) => el.addEventListener('click', () => {
      const e = loadHistory()[+el.dataset.i];
      if (e && e.html) { pushBot(e.html); const c = $('#chat'); c.scrollTop = c.scrollHeight; }
    }));
  }

  function initDiagnosis() {
    $('#restartBtn').addEventListener('click', () => restartDiagnosis());
    const hb = $('#historyBtn');
    if (hb) hb.addEventListener('click', () => { const b = $('#diagHistory'); b.style.display = b.style.display === 'none' ? '' : 'none'; });
    renderHistory();
    restartDiagnosis();
  }

  function restartDiagnosis() {
    Diagnosis.eng = new window.DiagnosticEngine();
    Diagnosis.eng.setFormulas(window.DATA.formulas || []);
    Diagnosis.transcript = [];
    Diagnosis.selectedChiefs = [];
    Diagnosis.followUpIdx = 0;
    Diagnosis.resultShown = false;
    $('#chat').innerHTML = '';
    $('#chatInput').innerHTML = '';
    pushBot(Diagnosis.eng.getInitialGreeting());
    setStep(0);
    renderChiefs();
  }

  function pushBot(html) { Diagnosis.transcript.push({ role: 'bot', html }); syncChat(); }
  function pushUser(html) { Diagnosis.transcript.push({ role: 'user', html }); syncChat(); }
  function syncChat() {
    const chat = $('#chat');
    chat.innerHTML = Diagnosis.transcript.map((t) => `<div class="bubble ${t.role}">${t.html}</div>`).join('');
    chat.scrollTop = chat.scrollHeight;
  }

  function renderChiefs() {
    const input = $('#chatInput');
    input.innerHTML = '';
    const opts = R.chiefComplaints;
    const wrap = document.createElement('div');
    wrap.className = 'options';
    opts.forEach((o) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = `<span class="opt-emoji">${o.emoji || ''}</span>${esc(o.label)}<span class="opt-desc">${esc(o.description || '')}</span>`;
      b.addEventListener('click', () => {
        const i = Diagnosis.selectedChiefs.indexOf(o.key);
        if (i >= 0) { Diagnosis.selectedChiefs.splice(i, 1); b.classList.remove('selected'); }
        else { Diagnosis.selectedChiefs.push(o.key); b.classList.add('selected'); }
      });
      wrap.appendChild(b);
    });
    input.appendChild(wrap);
    const next = document.createElement('button');
    next.className = 'primary-btn';
    next.textContent = '下一步 →';
    next.style.marginTop = '14px';
    next.addEventListener('click', () => {
      if (!Diagnosis.selectedChiefs.length) { next.textContent = '请先选择至少一项 →'; return; }
      Diagnosis.selectedChiefs.forEach((k) => Diagnosis.eng.selectChiefComplaint(k));
      const labels = R.chiefComplaints.filter((o) => Diagnosis.selectedChiefs.includes(o.key)).map((o) => o.label);
      pushUser('主诉：' + labels.join('、'));
      renderTemperature();
    });
    input.appendChild(next);
  }

  function renderTemperature() {
    const input = $('#chatInput');
    input.innerHTML = '';
    setStep(1);
    pushBot('<span class="q-title">寒热辨经</span>请选择最符合的寒热表现：');
    const wrap = document.createElement('div');
    wrap.className = 'options';
    R.temperaturePatterns.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = `${esc(t.label)}<span class="opt-desc">${esc(t.description)}</span>`;
      b.addEventListener('click', () => {
        Diagnosis.eng.answerTemperaturePattern(t.key);
        pushUser(t.label);
        renderTonguePulse();
      });
      wrap.appendChild(b);
    });
    input.appendChild(wrap);
  }

  function renderTonguePulse() {
    const input = $('#chatInput');
    input.innerHTML = '';
    setStep(2);
    pushBot('<span class="q-title">舌诊 · 脉诊</span>请选择舌象与脉象（可各选一项）：');
    const mk = (title, list, key) => {
      const block = document.createElement('div');
      block.style.margin = '10px 0';
      block.innerHTML = `<div style="font-size:13px;color:var(--ink-soft);margin-bottom:6px">${title}</div>`;
      const wrap = document.createElement('div');
      wrap.className = 'options';
      const state = { val: null };
      list.forEach((v) => {
        const b = document.createElement('button');
        b.className = 'opt';
        b.textContent = v;
        b.addEventListener('click', () => {
          wrap.querySelectorAll('.opt').forEach((x) => x.classList.remove('selected'));
          b.classList.add('selected');
          state.val = v;
          pending[key] = v;
        });
        wrap.appendChild(b);
      });
      block.appendChild(wrap);
      return { block, state };
    };
    const pending = {};
    const c = mk('舌苔', R.tongueCoatingOptions, 'tongueCoating');
    const s = mk('舌质', R.tongueShapeOptions, 'tongueShape');
    const p = mk('脉象', R.pulseOptions, 'pulseType');
    input.appendChild(c.block); input.appendChild(s.block); input.appendChild(p.block);
    const next = document.createElement('button');
    next.className = 'primary-btn';
    next.textContent = '下一步 →';
    next.style.marginTop = '10px';
    next.addEventListener('click', () => {
      if (!pending.tongueCoating || !pending.tongueShape || !pending.pulseType) { next.textContent = '三项都要选哦 →'; return; }
      Diagnosis.eng.answerTonguePulse(pending);
      pushUser(`舌：苔${pending.tongueCoating}／质${pending.tongueShape}；脉：${pending.pulseType}`);
      renderTenQuestions();
    });
    input.appendChild(next);
  }

  function renderTenQuestions() {
    const input = $('#chatInput');
    input.innerHTML = '';
    setStep(3);
    const tenQs = Diagnosis.eng.getTenQuestions();
    const idx = Diagnosis.eng.tenQuestionIndex;
    if (idx >= tenQs.length) { renderFollowUps(); return; }
    const q = tenQs[idx];
    pushBot('<span class="q-title">倪海厦十问 · ' + (idx + 1) + '/' + tenQs.length + '</span>' + esc(q.question));
    const wrap = document.createElement('div');
    wrap.className = 'options';
    q.options.forEach((opt) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.textContent = opt;
      b.addEventListener('click', () => {
        Diagnosis.eng.answerTenQuestion(q.key, opt);
        pushUser(opt);
        renderTenQuestions();
      });
      wrap.appendChild(b);
    });
    input.appendChild(wrap);
  }

  function renderFollowUps() {
    const input = $('#chatInput');
    input.innerHTML = '';
    setStep(4);
    const meridian = Diagnosis.eng.meridianDirection;
    const fus = Diagnosis.eng.getFollowUpQuestions(meridian);
    if (Diagnosis.followUpIdx >= fus.length) { renderResultButton(); return; }
    const fq = fus[Diagnosis.followUpIdx];
    pushBot('<span class="q-title">六经定位 · ' + meridian + '经</span>' + esc(fq.question));
    const wrap = document.createElement('div');
    wrap.className = 'options';
    fq.options.forEach((opt) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.textContent = opt;
      b.addEventListener('click', () => {
        Diagnosis.eng.answerFollowUp(fq.key, opt);
        pushUser(opt);
        Diagnosis.followUpIdx++;
        renderFollowUps();
      });
      wrap.appendChild(b);
    });
    input.appendChild(wrap);
  }

  function renderResultButton() {
    const input = $('#chatInput');
    input.innerHTML = '';
    setStep(5);
    const b = document.createElement('button');
    b.className = 'primary-btn';
    b.textContent = '🔍 查看辨证结果';
    b.addEventListener('click', () => {
      const r = Diagnosis.eng.diagnose();
      if (!r) { pushBot('抱歉，信息不足，无法辨证。请点击「重新问诊」补全。'); return; }
      const html = buildResultHTML(r);
      pushBot(html);
      addHistory({ t: Date.now(), meridian: r.meridian, pattern: r.pattern, formula: r.prescription ? r.prescription.formulaName : (r.formula || '—'), html });
      input.innerHTML = '<div style="color:var(--ink-faint);font-size:13px">辨证完成。可点击「重新问诊」再诊一次，或点「📋 历史」回看。</div>';
    });
    input.appendChild(b);
  }

  function meridianMeta(m) {
    const d = (R.meridianDetails && R.meridianDetails[m]) || {};
    return { emoji: d.emoji || '📍', color: d.color || '#2f6b5e' };
  }

  function buildResultHTML(r) {
    const meta = meridianMeta(r.meridian);
    let h = '';
    h += `<div class="result-card">`;
    h += `<span class="meridian-badge" style="background:${meta.color}">${meta.emoji} ${esc(r.meridian)}经</span>`;
    if (r.combinedMeridian) h += ` <span class="meridian-badge" style="background:var(--gold)">合病 · ${esc(r.combinedMeridian)}</span>`;
    h += `<div class="result-title">${esc(r.pattern)}</div>`;
    h += `<div class="result-sub">六经辨证结论</div>`;
    if (r.patternDetail) h += `<div class="result-pattern">${esc(r.patternDetail)}</div>`;

    // 处方
    if (r.prescription) {
      const p = r.prescription;
      h += `<div class="section-h">💊 推荐经方</div>`;
      h += `<div class="formula-name">${esc(p.formulaName)}</div>`;
      if (p.alias) h += `<div class="meta">别名：${esc(p.alias)} · ${esc(p.meridian)} · ${esc(p.category)}</div>`;
      if (p.components && p.components.length) {
        h += `<div class="table-scroll"><table class="compo-table"><thead><tr><th>药材</th><th>剂量</th><th>作用</th></tr></thead><tbody>`;
        p.components.forEach((c) => {
          h += `<tr><td>${esc(c.name)}</td><td>${esc(c.dosage || '—')}</td><td class="role">${esc(c.role || '')}</td></tr>`;
        });
        h += `</tbody></table></div>`;
      }
      if (p.preparation) h += `<p><span class="label">煎服法：</span>${esc(p.preparation)}</p>`;
      if (p.indication) h += `<p><span class="label">主治：</span>${esc(p.indication)}</p>`;
      if (p.explanation) h += `<p><span class="label">方义：</span>${esc(p.explanation)}</p>`;
      if (p.contraindication) h += `<p><span class="label">禁忌：</span>${esc(p.contraindication)}</p>`;
      if (p.modifications && p.modifications.length) {
        h += `<div class="section-h">🔄 随证加减</div><div class="chips">`;
        p.modifications.forEach((m) => h += `<span class="chip">${esc(m.condition)} → ${esc(m.description)}</span>`);
        h += `</div>`;
      }
    } else {
      h += `<div class="section-h">💊 推荐经方</div><div class="note-box warn">方名「${esc(r.formula)}」未在方剂库中收录，请核对《伤寒论》《金匮要略》原方。</div>`;
    }

    // 置信度
    const conf = Math.round((r.confidence || 0.8) * 100);
    h += `<div class="confidence"><div class="bar"><div class="fill" style="width:${conf}%"></div></div><div class="lbl">辨证置信度 ${conf}%</div></div>`;

    // 鉴别诊断
    if (r.differential) {
      const d = r.differential;
      h += `<div class="section-h">🔍 鉴别诊断</div><div class="dif-grid">`;
      h += `<div class="dif-col"><h4>${esc(d.name1)}</h4><div class="meta">${esc(d.formula1)}</div><div style="font-size:13px">${esc(d.details ? (d.details[d.name1] || '') : '')}</div></div>`;
      h += `<div class="dif-col"><h4>${esc(d.name2)}</h4><div class="meta">${esc(d.formula2)}</div><div style="font-size:13px">${esc(d.details ? (d.details[d.name2] || '') : '')}</div></div>`;
      h += `</div>`;
      if (d.keyDifference) h += `<p style="font-size:13px;color:var(--ink-soft)">鉴别要点：${esc(d.keyDifference)}</p>`;
    }

    // 调护
    if (r.careAdvice) {
      const c = r.careAdvice;
      h += `<div class="section-h">🌿 调护建议</div><div class="care-grid">`;
      ['饮食', '休息', '艾灸', '禁忌'].forEach((k) => {
        if (c[k] && c[k].length) {
          h += `<div class="care-col"><h4>${k}</h4>${c[k].map((x) => `<div style="font-size:13px">· ${esc(x)}</div>`).join('')}</div>`;
        }
      });
      h += `</div>`;
    }

    // 各类警示
    if (r.trueFalseHeatCold) {
      const tf = r.trueFalseHeatCold;
      const dims = tf.dimensions ? Object.keys(tf.dimensions).map((k) => `${k}：${tf.dimensions[k]}`).join('　') : '';
      h += `<div class="note-box warn"><b>⚠️ ${esc(tf.type || '真寒假热 / 真热假寒')}</b><br>${esc(tf.description || '')}${dims ? '<br><span class="label">辨象：</span>' + esc(dims) : ''}</div>`;
    }
    if (r.pulseTongueContradiction) h += `<div class="note-box warn"><b>脉舌矛盾</b><br>${esc(r.pulseTongueContradiction)}</div>`;
    if (r.transmissionWarning) h += `<div class="note-box warn"><b>传变警示</b><br>${esc(r.transmissionWarning)}</div>`;
    if (r.bloodStasisSigns && r.bloodStasisSigns.length) {
      h += `<div class="note-box"><b>瘀血指征（瘀血五法）</b>`;
      r.bloodStasisSigns.forEach((m) => {
        h += `<div style="font-size:13px;margin-top:4px">· <b>${esc(m.method || '')}</b>：${esc(m.description || '')}</div>`;
      });
      h += `</div>`;
    }
    if (r.medicationRules && r.medicationRules.length) {
      h += `<div class="note-box"><b>用药铁律</b>`;
      r.medicationRules.forEach((m) => {
        h += `<div style="font-size:13px;margin-top:4px">· <b>${esc(m.condition || '')}</b>：${esc(m.prohibition || '')}${m.reason ? '（' + esc(m.reason) + '）' : ''}</div>`;
      });
      h += `</div>`;
    }
    if (r.sweatingContraindications && r.sweatingContraindications.length) {
      h += `<div class="note-box warn"><b>汗法禁忌</b>`;
      r.sweatingContraindications.forEach((m) => {
        h += `<div style="font-size:13px;margin-top:4px">· <b>${esc(m.condition || '')}</b>：${esc(m.reason || '')}${m.consequence ? ' → ' + esc(m.consequence) : ''}</div>`;
      });
      h += `</div>`;
    }
    if (r.pulseCombination) {
      const pc = r.pulseCombination;
      h += `<div class="note-box"><b>组合脉象</b><br>${esc(pc.pulse1)} + ${esc(pc.pulse2 || '')} → ${esc(pc.description || '')}${pc.formula ? '（' + esc(pc.formula) + '）' : ''}</div>`;
    }

    h += `<button class="copy-btn" data-copy="1">📋 复制处方文本</button>`;
    h += `</div>`;
    return h;
  }

  /* ============ 方剂查询 ============ */
  function initFormulas() {
    const formulas = window.DATA.formulas || [];
    const cats = Array.from(new Set(formulas.map((f) => f.category).filter(Boolean))).sort();
    const sel = $('#formulaCategory');
    sel.innerHTML = '<option value="">全部类别</option>' + cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    const render = () => {
      const q = $('#formulaSearch').value.trim();
      const cat = sel.value;
      const list = formulas.filter((f) => {
        if (cat && f.category !== cat) return false;
        if (!q) return true;
        const hay = [f.name, f.alias, f.indication, f.explanation, f.category, (f.components || []).map((c) => c.name).join(''), (f.keywords || []).join('')].join(' ');
        return hay.indexOf(q) >= 0;
      });
      const box = $('#formulaList');
      box.innerHTML = list.length ? list.slice(0, 200).map((f, i) => `<div class="list-item" data-i="${i}"><div class="li-title">${esc(f.name)}</div><div class="li-sub">${esc(f.meridian)} · ${esc(f.category)}</div></div>`).join('') : '<div class="empty-hint">无匹配方剂</div>';
      box.querySelectorAll('.list-item').forEach((el) => {
        el.addEventListener('click', () => {
          box.querySelectorAll('.list-item').forEach((x) => x.classList.remove('active'));
          el.classList.add('active');
          showFormula(list[+el.dataset.i]);
        });
      });
    };
    $('#formulaSearch').addEventListener('input', render);
    sel.addEventListener('change', render);
    render();
  }

  function showFormula(f) {
    const d = $('#formulaDetail');
    let h = `<h2>${esc(f.name)}</h2>`;
    if (f.alias) h += `<div class="meta">别名：${esc(f.alias)} · ${esc(f.meridian)} · ${esc(f.category)}</div>`;
    if (f.components && f.components.length) {
      h += `<div class="section-h" style="border:none;margin:14px 0 4px">组成</div>`;
      h += `<div class="table-scroll"><table class="compo-table"><thead><tr><th>药材</th><th>剂量</th><th>作用</th></tr></thead><tbody>`;
      f.components.forEach((c) => h += `<tr><td>${esc(c.name)}</td><td>${esc(c.dosage || '—')}</td><td class="role">${esc(c.role || '')}</td></tr>`);
      h += `</tbody></table></div>`;
    }
    if (f.indication) h += `<p><span class="label">主治：</span>${esc(f.indication)}</p>`;
    if (f.dosage) h += `<p><span class="label">煎服法：</span>${esc(f.dosage)}</p>`;
    if (f.explanation) h += `<p><span class="label">方义：</span>${esc(f.explanation)}</p>`;
    if (f.contraindication) h += `<p><span class="label">禁忌：</span>${esc(f.contraindication)}</p>`;
    if (f.keywords && f.keywords.length) h += `<div class="chips">` + f.keywords.map((k) => `<span class="chip">${esc(k)}</span>`).join('') + `</div>`;
    d.innerHTML = h;
    if (window.innerWidth <= 880) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ============ 中药查询 ============ */
  function initHerbs() {
    const herbs = window.DATA.herbs || [];
    const cats = Array.from(new Set(herbs.map((h) => h.category).filter(Boolean))).sort();
    const sel = $('#herbCategory');
    sel.innerHTML = '<option value="">全部类别</option>' + cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    const render = () => {
      const q = $('#herbSearch').value.trim();
      const cat = sel.value;
      const list = herbs.filter((h) => {
        if (cat && h.category !== cat) return false;
        if (!q) return true;
        const hay = [h.name, h.category, h.action, h.original, h.clinical_notes, h.nature_category, h.flavor].join(' ');
        return hay.indexOf(q) >= 0;
      });
      const box = $('#herbList');
      box.innerHTML = list.length ? list.slice(0, 200).map((h, i) => `<div class="list-item" data-i="${i}"><div class="li-title">${esc(h.name)}</div><div class="li-sub">${esc(h.category || '')} · ${esc(h.nature_category || '')}</div></div>`).join('') : '<div class="empty-hint">无匹配中药</div>';
      box.querySelectorAll('.list-item').forEach((el) => {
        el.addEventListener('click', () => {
          box.querySelectorAll('.list-item').forEach((x) => x.classList.remove('active'));
          el.classList.add('active');
          showHerb(list[+el.dataset.i]);
        });
      });
    };
    $('#herbSearch').addEventListener('input', render);
    sel.addEventListener('change', render);
    render();
  }

  function showHerb(h) {
    const d = $('#herbDetail');
    let html = `<h2>${esc(h.name)}</h2>`;
    html += `<div class="meta">${esc(h.category || '')} · 性味：${esc(h.nature_category || '—')}${h.flavor ? ' / ' + esc(h.flavor) : ''}</div>`;
    if (h.meridians && h.meridians.length) html += `<p><span class="label">归经：</span>${h.meridians.map((m) => esc(m)).join('、')}</p>`;
    if (h.action) html += `<p><span class="label">功效：</span>${esc(h.action)}</p>`;
    if (h.dosage) html += `<p><span class="label">剂量：</span>${esc(h.dosage)}</p>`;
    if (h.contraindication) html += `<p><span class="label">禁忌：</span>${esc(h.contraindication)}</p>`;
    if (h.original) html += `<p><span class="label">本经原文：</span>${esc(h.original.slice(0, 240))}${h.original.length > 240 ? '…' : ''}</p>`;
    if (h.clinical_notes) html += `<p><span class="label">倪师讲解：</span>${esc(h.clinical_notes.slice(0, 200))}${h.clinical_notes.length > 200 ? '…' : ''}</p>`;
    d.innerHTML = html;
    if (window.innerWidth <= 880) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ============ 针灸经络 ============ */
  function initAcupuncture() {
    const acu = window.DATA.acupuncture || {};
    const cats = (acu.acupuncture && acu.acupuncture.categories) || [];
    const entries = [];
    cats.forEach((c) => (c.entries || []).forEach((e) => entries.push({ cat: c.name, entry: e })));

    const renderSymptom = () => {
      const q = ($('#acuList').dataset.q || '');
      const list = entries.filter((it) => !q || it.entry.symptom.indexOf(q) >= 0 || (it.entry.aliases || []).join('').indexOf(q) >= 0);
      const box = $('#acuList');
      box.innerHTML = list.length ? list.slice(0, 200).map((it, i) => `<div class="list-item" data-i="${i}"><div class="li-title">${esc(it.entry.symptom)}</div><div class="li-sub">${esc(it.cat)} · ${(it.entry.acupoints || []).length} 穴</div></div>`).join('') : '<div class="empty-hint">无匹配症状</div>';
      box.dataset.list = JSON.stringify(list.map((it) => it.entry));
      box.querySelectorAll('.list-item').forEach((el) => {
        el.addEventListener('click', () => {
          box.querySelectorAll('.list-item').forEach((x) => x.classList.remove('active'));
          el.classList.add('active');
          const arr = JSON.parse(box.dataset.list);
          showAcu(arr[+el.dataset.i]);
        });
      });
    };
    // search box
    const sb = document.createElement('input');
    sb.type = 'search'; sb.placeholder = '搜索症状…'; sb.className = 'search-bar-input';
    sb.style.cssText = 'width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);margin-bottom:10px;font-size:14px';
    sb.addEventListener('input', () => { $('#acuList').dataset.q = sb.value.trim(); renderSymptom(); });
    $('#view-acupuncture .split').parentNode; // noop
    $('#acuSymptom').insertBefore(sb, $('#acuList'));
    renderSymptom();

    // 透针
    const pen = (acu.penetration || []);
    const pbox = $('#acuPenetration');
    pbox.innerHTML = pen.length ? pen.map((p, i) => `<div class="list-item" data-i="${i}"><div class="li-title">${esc(p.name)}</div><div class="li-sub">${(p.indications || []).map((x) => esc(x)).join('、')}</div></div>`).join('') : '<div class="empty-hint">无数据</div>';
    pbox.querySelectorAll('.list-item').forEach((el) => {
      el.addEventListener('click', () => {
        pbox.querySelectorAll('.list-item').forEach((x) => x.classList.remove('active'));
        el.classList.add('active');
        const p = pen[+el.dataset.i];
        $('#acuDetail').innerHTML = `<h2>${esc(p.name)}</h2>` +
          (p.indications ? `<div class="chips">${p.indications.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : '') +
          (p.source ? `<p><span class="label">配穴：</span>${esc(p.source)}</p>` : '') +
          (p.clinicalInsight ? `<p><span class="label">临床：</span>${esc(p.clinicalInsight)}</p>` : '') +
          (p.medicalCase ? `<p><span class="label">医案：</span>${esc(p.medicalCase)}</p>` : '');
      });
    });

    // tabs
    $$('#acuTabs .tab').forEach((t) => {
      t.addEventListener('click', () => {
        $$('#acuTabs .tab').forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        const kind = t.dataset.acu;
        $('#acuSymptom').style.display = kind === 'symptom' ? '' : 'none';
        $('#acuPenetration').style.display = kind === 'penetration' ? '' : 'none';
      });
    });
  }

  function showAcu(e) {
    const d = $('#acuDetail');
    let h = `<h2>${esc(e.symptom)}</h2>`;
    if (e.aliases && e.aliases.length) h += `<div class="meta">别名：${e.aliases.map((a) => esc(a)).join('、')}</div>`;
    h += `<div class="section-h" style="border:none;margin:14px 0 6px">推荐穴位</div><div class="chips">` +
      (e.acupoints || []).map((a) => `<span class="chip">${esc(a.name)}</span>`).join('') + `</div>`;
    if (e.notes) h += `<p><span class="label">按语：</span>${esc(e.notes)}</p>`;
    if (e.medicalCase) h += `<p><span class="label">医案：</span>${esc(e.medicalCase)}</p>`;
    d.innerHTML = h;
    if (window.innerWidth <= 880) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ============ 实用工具 ============ */
  function initTools() {
    buildZiwu();
    buildDosage();
    $$('#toolTabs .tab').forEach((t) => {
      t.addEventListener('click', () => {
        $$('#toolTabs .tab').forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        const kind = t.dataset.tool;
        $('#ziwuPanel').style.display = kind === 'ziwu' ? '' : 'none';
        $('#dosagePanel').style.display = kind === 'dosage' ? '' : 'none';
      });
    });
  }

  function buildZiwu() {
    const tianGan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const diZhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const ganToOrgan = { '甲': '胆', '乙': '肝', '丙': '小肠', '丁': '心', '戊': '胃', '己': '脾', '庚': '大肠', '辛': '肺', '壬': '膀胱', '癸': '肾' };
    const zhiToMeridian = { '子': ['胆经', '23:00–01:00'], '丑': ['肝经', '01:00–03:00'], '寅': ['肺经', '03:00–05:00'], '卯': ['大肠经', '05:00–07:00'], '辰': ['胃经', '07:00–09:00'], '巳': ['脾经', '09:00–11:00'], '午': ['心经', '11:00–13:00'], '未': ['小肠经', '13:00–15:00'], '申': ['膀胱经', '15:00–17:00'], '酉': ['肾经', '17:00–19:00'], '戌': ['心包经', '19:00–21:00'], '亥': ['三焦经', '21:00–23:00'] };
    const benXue = { '胆经': '临泣', '肝经': '行间', '小肠经': '阳谷', '心经': '少府', '胃经': '足三里', '脾经': '太白', '大肠经': '二间', '肺经': '经渠', '膀胱经': '通谷', '肾经': '阴谷' };
    function getBenXue(m) { if (m === '心包经') return '阴谷（归癸·肾经）'; if (m === '三焦经') return '通谷（寄壬·膀胱经）'; return benXue[m] || ''; }
    const wuMen = [['甲', '己', '土', '临泣+太白'], ['乙', '庚', '金', '行间+二间'], ['丙', '辛', '水', '阳谷+经渠'], ['丁', '壬', '木', '少府+通谷'], ['戊', '癸', '火', '足三里+阴谷']];
    function getWuMen(g) { for (const w of wuMen) if (w[0] === g || w[1] === g) return `${w[0]}${w[1]}合化${w[2]}（${w[3]}）`; return ''; }
    const baseGanIndex = 6;
    function dayGanIndex(date) { const base = new Date(2000, 0, 1); const diff = Math.floor((date - base) / 86400000); return ((baseGanIndex + diff) % 10 + 10) % 10; }
    function shichenIndex(dt) { const m = dt.getHours() * 60 + dt.getMinutes(); if (m >= 1380 || m < 60) return 0; if (m < 180) return 1; if (m < 300) return 2; if (m < 420) return 3; if (m < 540) return 4; if (m < 660) return 5; if (m < 780) return 6; if (m < 900) return 7; if (m < 1020) return 8; if (m < 1140) return 9; if (m < 1260) return 10; return 11; }

    const panel = $('#ziwuPanel');
    panel.innerHTML = `
      <div class="tool-card">
        <div style="font-family:var(--serif);font-size:18px;margin-bottom:12px">选择时间</div>
        <div class="tool-row">
          <label>日期</label><input type="date" id="zwDate">
          <label>时辰</label><input type="time" id="zwTime">
          <button class="primary-btn" id="zwNow" style="padding:8px 16px">当前时间</button>
        </div>
        <div class="tool-result" id="zwOut"></div>
      </div>
      <div class="tool-card">
        <div style="font-family:var(--serif);font-size:16px;margin-bottom:8px">参考表</div>
        <div class="table-scroll"><table class="ref-table">
          <tr><th>天干</th><td>${tianGan.map((g) => `${g}→${ganToOrgan[g]}`).join('　')}</td></tr>
          <tr><th>地支→经络</th><td>${diZhi.map((z) => `${z} ${zhiToMeridian[z][0]}`).join('　')}</td></tr>
          <tr><th>本穴</th><td>${Object.keys(benXue).map((k) => `${k}→${benXue[k]}`).join('　')}　心包经→阴谷（归癸）　三焦经→通谷（寄壬）</td></tr>
          <tr><th>五门十变</th><td>${wuMen.map((w) => `${w[0]}${w[1]}合化${w[2]}`).join('　')}</td></tr>
        </table></div>
      </div>`;

    const dEl = $('#zwDate'), tEl = $('#zwTime'), out = $('#zwOut');
    function compute() {
      const dt = new Date(dEl.value + 'T' + (tEl.value || '00:00'));
      if (isNaN(dt)) { out.innerHTML = '<span style="color:var(--ink-faint)">请选择日期与时间</span>'; return; }
      const gi = dayGanIndex(dt);
      const gan = tianGan[gi];
      const organ = ganToOrgan[gan];
      const si = shichenIndex(dt);
      const zhi = diZhi[si];
      const [mer, range] = zhiToMeridian[zhi];
      const bx = getBenXue(mer);
      const wm = getWuMen(gan);
      out.innerHTML = `
        <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center">
          <div><div style="font-size:12px;color:var(--ink-soft)">时辰</div><div class="big">${zhi}时</div><div style="font-size:13px;color:var(--ink-soft)">${range}</div></div>
          <div><div style="font-size:12px;color:var(--ink-soft)">日天干→脏腑</div><div class="big" style="font-size:22px">${gan} → ${organ}</div></div>
          <div><div style="font-size:12px;color:var(--ink-soft)">当令经络</div><div class="big" style="font-size:22px;color:var(--gold)">${mer}</div></div>
        </div>
        <div style="margin-top:14px;font-size:15px"><b>本穴推荐：</b>${bx}（${mer}经气最旺，纳子法取本穴）</div>
        <div style="margin-top:6px;font-size:15px"><b>五门十变：</b>${wm}</div>`;
    }
    function fillNow() { const n = new Date(); dEl.value = n.toISOString().slice(0, 10); tEl.value = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); compute(); }
    dEl.addEventListener('change', compute);
    tEl.addEventListener('change', compute);
    $('#zwNow').addEventListener('click', fillNow);
    fillNow();
  }

  function buildDosage() {
    const standards = ['汉制', '台制', '唐制'];
    const weightUnits = ['两', '铢', '斤', '石', '钱'];
    const weightFactors = [
      { '两': 15.625, '铢': 0.65, '斤': 248, '石': 29760, '钱': 1.5625 },
      { '两': 37.5, '斤': 600, '钱': 3.75 },
      { '两': 13.75, '铢': 0.573, '斤': 220 },
    ];
    const volumeUnits = ['升', '合', '圭', '撮'];
    const volumeFactors = { '升': 200.0, '合': 20.0, '圭': 0.5, '撮': 2.0 };
    const lengthUnits = ['尺', '寸'];
    const lengthFactors = { '尺': 23.1, '寸': 2.31 };
    const specialVol = [['半夏', '一升', '130g'], ['蜀椒', '一升', '50g'], ['吴茱萸', '一升', '50g'], ['五味子', '一升', '50g'], ['虻虫', '一升', '16g'], ['葶苈子', '一升', '60g']];
    const specialCount = [['附子（大者）', '1枚', '20~30g'], ['附子（中者）', '1枚', '15g'], ['强乌头（小者）', '1枚', '3g'], ['强乌头（大者）', '1枚', '5~6g'], ['杏仁（大者）', '10枚', '4g'], ['枳实', '1枚', '14.4g'], ['瓜蒌', '1枚', '46g'], ['栀子', '10枚', '15g'], ['石膏（鸡蛋大）', '1枚', '约40g'], ['厚朴', '1尺', '约30g'], ['竹叶', '一握', '约12g']];

    const panel = $('#dosagePanel');
    panel.innerHTML = `
      <div class="tool-card">
        <div style="font-size:13px;color:var(--ink-soft);margin-bottom:8px">度量标准</div>
        <div class="tabs" id="doseStd">
          ${standards.map((s, i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-s="${i}">${s}</button>`).join('')}
        </div>
        <div class="tool-row" style="margin-top:14px">
          <label>数值</label><input type="number" id="doseVal" value="1" min="0" step="0.5" style="width:110px">
          <label>单位</label><select id="doseUnit"></select>
        </div>
        <div class="tool-result" id="doseOut"></div>
      </div>
      <div class="tool-card">
        <div style="font-family:var(--serif);font-size:16px;margin-bottom:8px">药物特殊换算（容积→重量）</div>
        <div class="table-scroll"><table class="ref-table"><tr><th>药物</th><th>容积</th><th>重量</th></tr>${specialVol.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table></div>
      </div>
      <div class="tool-card">
        <div style="font-family:var(--serif);font-size:16px;margin-bottom:8px">药物特殊换算（枚数→重量）</div>
        <div class="table-scroll"><table class="ref-table"><tr><th>药物</th><th>数量</th><th>重量</th></tr>${specialCount.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table></div>
      </div>
      <div class="tool-card">
        <div style="font-family:var(--serif);font-size:16px;margin-bottom:8px">换算常数参考</div>
        <p style="font-size:13px">汉制：1石=29760g, 1斤=16两=248g, 1两=24铢=15.625g, 1铢=0.65g</p>
        <p style="font-size:13px">台制：1斤=600g, 1两=10钱=37.5g, 1钱=3.75g</p>
        <p style="font-size:13px">唐制：1斤=220g, 1两≈13.75g</p>
        <p style="font-size:13px">容量：1升=200ml, 1合=20ml, 1撮=2ml, 1圭=0.5ml　|　长度：1尺=23.1cm, 1寸=2.31cm</p>
        <p style="font-size:13px">倪师剂量参考：胖子五钱起，普通人三钱，小孩半钱~一钱；甘草病久五钱、刚得病二钱</p>
      </div>`;

    let std = 0;
    const unitSel = $('#doseUnit');
    const valEl = $('#doseVal');
    const out = $('#doseOut');
    function refreshUnits() {
      const f = weightFactors[std];
      const units = [];
      units.push('<optgroup label="重量">');
      weightUnits.forEach((u) => { if (u in f) units.push(`<option value="${u}">${u}</option>`); });
      units.push('</optgroup><optgroup label="容量">');
      volumeUnits.forEach((u) => units.push(`<option value="${u}">${u}</option>`));
      units.push('</optgroup><optgroup label="长度">');
      lengthUnits.forEach((u) => units.push(`<option value="${u}">${u}</option>`));
      units.push('</optgroup>');
      unitSel.innerHTML = units.join('');
    }
    function convert() {
      const input = parseFloat(valEl.value);
      if (isNaN(input) || input <= 0) { out.innerHTML = '<span style="font-size:22px">—</span>'; return; }
      const unit = unitSel.value;
      const f = weightFactors[std];
      let res;
      if (unit in f) res = (input * f[unit]).toFixed(3).replace(/\.?0+$/, '') + ' 克';
      else if (unit in volumeFactors) res = (input * volumeFactors[unit]).toFixed(2).replace(/\.?0+$/, '') + ' 毫升';
      else if (unit in lengthFactors) res = (input * lengthFactors[unit]).toFixed(2).replace(/\.?0+$/, '') + ' 厘米';
      else res = '—';
      out.innerHTML = `<div style="font-size:16px;color:var(--ink-soft)">${valEl.value} ${unit}</div><div class="big" style="margin:4px 0">${res}</div><div style="font-size:12px;color:var(--ink-soft)">${standards[std]}标准</div>`;
    }
    $$('#doseStd .tab').forEach((b) => b.addEventListener('click', () => {
      $$('#doseStd .tab').forEach((x) => x.classList.remove('active'));
      b.classList.add('active'); std = +b.dataset.s; refreshUnits(); convert();
    }));
    unitSel.addEventListener('change', convert);
    valEl.addEventListener('input', convert);
    refreshUnits(); convert();
  }

  /* ============ 启动 ============ */
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await window.loadAllData();
    } catch (e) {
      document.body.insertAdjacentHTML('afterbegin', `<div style="background:var(--red);color:#fff;padding:12px;text-align:center;font-size:14px">数据加载失败：${esc(e.message)}。请通过本地服务器（如 http-server）打开本页面。</div>`);
      return;
    }
    initNav();
    initDiagnosis();
    initFormulas();
    initHerbs();
    initAcupuncture();
    initTools();

    // 复制处方
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-copy]');
      if (!btn) return;
      const card = btn.closest('.result-card');
      const txt = card.innerText;
      navigator.clipboard && navigator.clipboard.writeText(txt);
      btn.textContent = '✓ 已复制';
      setTimeout(() => (btn.textContent = '📋 复制处方文本'), 1500);
    });
  });
})();
