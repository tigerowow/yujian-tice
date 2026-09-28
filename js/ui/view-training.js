/* view-training.js — 训练计划：按薄弱项生成每周1次课的N周计划、导出到Word */
(function () {
  "use strict";
  const FCS = window.FCS;
  const S = FCS.scoring;
  const data = function () { return FCS.app.data; };

  const state = { weeks: 4, focus: {}, generated: false };

  FCS.trainingUI = FCS.trainingUI || {};
  FCS.trainingUI.setWeeks = function (v) { state.weeks = parseInt(v, 10) || 4; FCS.app.render(); };
  FCS.trainingUI.toggleFocus = function (key) {
    state.focus[key] = !state.focus[key];
    FCS.app.render();
  };
  FCS.trainingUI.autoFocus = function () {
    const batch = FCS.app.getBatch();
    if (!batch) return;
    const stats = FCS.analysis.batchStats(batch);
    const wm = FCS.analysis.weakItems(stats, { gender: "male" });
    const wf = FCS.analysis.weakItems(stats, { gender: "female" });
    state.focus = {};
    wm.weaknesses.slice(0, 3).forEach(function (w) { state.focus[w.key] = true; });
    wf.weaknesses.slice(0, 3).forEach(function (w) { state.focus[w.key] = true; });
    FCS.app.render();
  };
  FCS.trainingUI.generate = function () {
    const batch = FCS.app.getBatch();
    if (!batch) return;
    const stats = FCS.analysis.batchStats(batch);
    const focusKeys = Object.keys(state.focus).filter(function (k) { return state.focus[k]; });
    const plan = FCS.training.generatePlan({
      weeks: state.weeks,
      focusMale: focusKeys,
      focusFemale: focusKeys,
      hasMale: stats.male.count > 0,
      hasFemale: stats.female.count > 0,
    });
    data().plans[batch.id] = plan;
    FCS.storage.save(data());
    state.generated = true;
    FCS.app.render();
    FCS.util.toast("训练计划已生成", "success");
  };
  FCS.trainingUI.exportPlan = function () {
    const batch = FCS.app.getBatch();
    const plan = data().plans[batch.id];
    if (!plan) { FCS.util.toast("请先生成训练计划", "warn"); return; }
    const cls = FCS.app.getClass();
    /* 训练计划PDF只包含训练计划本身（planOnly） */
    const html = FCS.report.classReportHTML({
      className: cls ? cls.name : "未命名班级",
      teacher: cls ? cls.teacher : "",
      batch: batch,
      stats: FCS.analysis.batchStats(batch),
      charts: {},
      weakAll: null,
      weakMale: null,
      weakFemale: null,
      suggestions: [],
      plan: plan,
      planOnly: true,
    });
    FCS.pdfExport.toastResult(
      FCS.pdfExport.exportHTML(html, (cls ? cls.name : "班级") + "_" + batch.name + "_训练计划.pdf"),
      "训练计划PDF");
  };

  FCS.app.registerView("training", {
    title: "训练计划",
    render: function (el) {
      const U = FCS.util;
      const UC = FCS.uiCommon;
      const esc = U.esc;
      const batch = FCS.app.getBatch();
      if (!batch) {
        el.innerHTML = UC.needContext("请先在顶栏选择班级和测试批次。");
        return;
      }
      const stats = FCS.analysis.batchStats(batch);
      const plan = data().plans[batch.id];

      let html = UC.viewHead("训练计划", "根据班级薄弱项目生成 · 每周1次体育课 · 默认4周（一个月后复测）");
      html += '<div class="card mb16">' +
        '<div class="card-title">计划设置</div>' +
        '<div class="flex items-center gap16 flex-wrap">' +
        '<div class="flex items-center gap8"><span class="text-sm">训练周数：</span>' +
        '<select class="input" onchange="FCS.trainingUI.setWeeks(this.value)">' +
        [2, 3, 4, 5, 6].map(function (w) { return '<option value="' + w + '"' + (state.weeks === w ? " selected" : "") + ">" + w + " 周</option>"; }).join("") +
        "</select></div>" +
        '<button class="btn" onclick="FCS.trainingUI.autoFocus()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"8.5\"/><circle cx=\"12\" cy=\"12\" r=\"2.6\" fill=\"currentColor\" stroke=\"none\"/></svg>按薄弱项自动选择</button>' +
        '<button class="btn btn-primary" onclick="FCS.trainingUI.generate()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\"><path d=\"M4 7h6.5\"/><circle cx=\"13.5\" cy=\"7\" r=\"2.4\"/><path d=\"M16.5 7H20\"/><path d=\"M4 17h1.5\"/><circle cx=\"8.5\" cy=\"17\" r=\"2.4\"/><path d=\"M11.5 17H20\"/></svg>生成训练计划</button>' +
        (plan ? '<button class="btn btn-success" onclick="FCS.trainingUI.exportPlan()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><path d=\"M6 2.5h9l5 5V21.5H6z\"/><path d=\"M14 2.5v5h5\"/></svg>导出PDF</button>' : "") +
        "</div>" +
        '<div class="text-sm text-2 mt8">重点训练项目（自动选择或点击切换）：</div>' +
        '<div class="training-focus">' +
        S.items.map(function (k) {
          return '<div class="focus-chip' + (state.focus[k] ? " on" : "") + '" onclick="FCS.trainingUI.toggleFocus(\'' + k + '\')">' +
            S.itemLabel(k, "male") + "（男）/ " + S.itemLabel(k, "female") + "（女）</div>";
        }).join("") +
        "</div></div>";

      if (!plan) {
        html += '<div class="card"><div class="empty-tip">点击「按薄弱项自动选择」再「生成训练计划」，即可得到针对本班的训练方案。<br>' +
          "当前班级薄弱项：<b>" + (FCS.analysis.weakItems(stats, { gender: "all" }).weaknesses.map(function (w) { return w.label; }).join("、") || "无") + "</b></div></div>";
        el.innerHTML = html;
        return;
      }

      /* 计划展示 */
      html += '<div class="card mb16"><div class="card-title">计划概览</div>' +
        '<div class="text-sm text-2">生成时间：' + U.dateTime(plan.generatedAt) + " · 共 " + plan.weeks + " 周 · 每周1次体育课</div></div>";
      plan.planWeeks.forEach(function (wk) {
        html += '<div class="week-card"><div class="week-title">第 ' + wk.week + " 周　" + esc(wk.theme) + "</div><div class='week-body'>";
        /* 热身 */
        html += '<div class="lesson-block"><div class="lesson-label"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 2.5c.8 2.8-1.5 4.2-1.5 6.6A4.6 4.6 0 0015 13.7c1.4 1.3 2 2.8 2 4.6a5 5 0 11-10 0c0-1.6.6-3.1 1.6-4.3-.4 1.3.4 2 1.2 1.8.6-.2.8-1.2.8-2.3 0-3 1.4-5.5 2.4-11z\"/></svg>热身（10分钟）</div><ul>';
        wk.warmup.forEach(function (w) { html += "<li>" + esc(w) + "</li>"; });
        html += "</ul></div>";
        /* 主体 */
        html += '<div class="lesson-block"><div class="lesson-label"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linecap=\"round\"><path d=\"M6.5 6.5v11M3.5 9.5v5M17.5 6.5v11M20.5 9.5v5M6.5 12h11\"/></svg>主体训练（25分钟）</div>';
        wk.main.forEach(function (block) {
          if (block.genderLabel) html += '<div class="bold mt8 mb8">— ' + esc(block.genderLabel) + " —</div>";
          if (block.entries) {
            html += "<ul>";
            block.entries.forEach(function (e) {
              html += "<li><b>" + esc(e.title) + "：</b>" + esc(e.steps) + "<span class='text-2'>（" + esc(e.dosage) + (e.notes ? "；" + esc(e.notes) : "") + "）</span></li>";
            });
            html += "</ul>";
          }
          if (block.items) {
            html += "<ul>";
            block.items.forEach(function (it) { html += "<li>" + esc(it) + "</li>"; });
            html += "</ul>";
          }
        });
        html += "</div>";
        /* 放松 */
        html += '<div class="lesson-block"><div class="lesson-label"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linejoin=\"round\"><path d=\"M12 19.5s-6.8-4.2-6.8-9.2A3.8 3.8 0 0112 7.6a3.8 3.8 0 016.8 2.7c0 5-6.8 9.2-6.8 9.2z\"/></svg>放松整理（5分钟）</div><ul>';
        wk.cooldown.forEach(function (w) { html += "<li>" + esc(w) + "</li>"; });
        html += "</ul></div>";
        /* 作业 */
        html += '<div class="lesson-block"><div class="lesson-label"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linejoin=\"round\"><path d=\"M4 20h3.8L19 8.8a2 2 0 00-2.8-2.8L4.8 17.4V20z\"/><path d=\"M13.8 6.4l3.8 3.8\"/></svg>课后作业</div><ul>';
        wk.homework.forEach(function (w) { html += "<li>" + esc(w) + "</li>"; });
        html += "</ul></div>";
        html += "</div></div>";
      });
      html += '<div class="flex gap8 mb16"><button class="btn btn-success" onclick="FCS.trainingUI.exportPlan()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><path d=\"M6 2.5h9l5 5V21.5H6z\"/><path d=\"M14 2.5v5h5\"/></svg>导出训练计划到PDF</button>' +
        '<button class="btn" onclick="window.print()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linejoin=\"round\"><path d=\"M7 8V3h10v5\"/><path d=\"M7 16.5H4.5v-6a2.5 2.5 0 012.5-2.5h10a2.5 2.5 0 012.5 2.5v6H17\"/><path d=\"M7 14h10v7H7z\"/></svg>打印计划</button></div>';
      el.innerHTML = html;
    },
  });
})();
