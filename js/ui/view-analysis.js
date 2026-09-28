/* view-analysis.js — 班级分析：统计、图表、优势/薄弱项目、训练建议、导出Word报告 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const S = FCS.scoring;
  const data = function () { return FCS.app.data; };

  /* 汇总建议段落（男女分开） */
  function collectSuggestions(stats) {
    const out = [];
    const weakMale = FCS.analysis.weakItems(stats, { gender: "male" });
    const weakFemale = FCS.analysis.weakItems(stats, { gender: "female" });
    if (weakMale.weaknesses.length) {
      const keys = weakMale.weaknesses.map(function (w) { return w.key; });
      FCS.training.suggestForWeakItems(keys, "male").forEach(function (s) { out.push("男生： " + s); });
    }
    if (weakFemale.weaknesses.length) {
      const keys = weakFemale.weaknesses.map(function (w) { return w.key; });
      FCS.training.suggestForWeakItems(keys, "female").forEach(function (s) { out.push("女生： " + s); });
    }
    return { out: out, weakMale: weakMale, weakFemale: weakFemale };
  }

  /* 导出PDF报告：仅包含班级分析页面的内容（统计、图表、优缺项、各项目得分明细） */
  function exportReport(batch, stats, charts, suggestions) {
    const cls = FCS.app.getClass();
    const weakAll = FCS.analysis.weakItems(stats, { gender: "all" });
    const html = FCS.report.classReportHTML({
      className: cls ? cls.name : "未命名班级",
      teacher: cls ? cls.teacher : "",
      batch: batch,
      stats: stats,
      charts: charts,
      weakAll: weakAll,
      weakMale: suggestions.weakMale,
      weakFemale: suggestions.weakFemale,
      suggestions: suggestions.out,
    });
    const fname = (cls ? cls.name : "班级") + "_" + batch.name + "_体测分析报告.pdf";
    FCS.pdfExport.toastResult(FCS.pdfExport.exportHTML(html, fname), "PDF报告");
  }

  FCS.app.registerView("analysis", {
    title: "班级分析",
    render: function (el) {
      const U = FCS.util;
      const UC = FCS.uiCommon;
      const esc = U.esc;
      const batch = FCS.app.getBatch();
      const cls = FCS.app.getClass();
      if (!batch) {
        el.innerHTML = UC.needContext("请先在顶栏选择班级和测试批次，或到「班级管理」新建。");
        return;
      }
      const stats = FCS.analysis.batchStats(batch);
      const suggestions = collectSuggestions(stats);
      const weakAll = FCS.analysis.weakItems(stats, { gender: "all" });
      const hasComplete = stats.total.completeCount > 0;

      let html = UC.viewHead("班级分析", esc((cls ? cls.name : "") + "  ·  " + batch.name + "  ·  " + batch.testDate),
        '<button class="btn btn-primary" onclick="FCS.analysisUI.exportReport()" ' + (!hasComplete ? "disabled" : "") + "><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><path d=\"M6 2.5h9l5 5V21.5H6z\"/><path d=\"M14 2.5v5h5\"/></svg>导出PDF报告</button>" +
        '<button class="btn" onclick="FCS.app.navigate(\'#/training\')"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><circle cx=\"12\" cy=\"9\" r=\"5.2\"/><path d=\"M8.4 13.6L6.8 21l5.2-2.8L17.2 21l-1.6-7.4z\"/></svg>生成训练计划</button>');

      if (!stats.total.count) {
        html += UC.empty("该批次还没有学生数据，请先到「数据录入」导入或录入成绩。",
          '<button class="btn btn-primary" onclick="FCS.app.navigate(\'#/entry\')">去录入成绩</button>');
        el.innerHTML = html;
        return;
      }

      /* 统计卡片 */
      const mkCards = function (label, st) {
        return UC.statCard(label + "人数", st.count, "完整录入 " + st.completeCount + " 人") +
          UC.statCard(label + "平均分", st.avg !== null ? st.avg + " 分" : "—", "") +
          UC.statCard(label + "及格率", st.passRate !== null ? st.passRate + "%" : "—", "", st.passRate !== null && st.passRate < 80 ? "danger" : "") +
          UC.statCard(label + "优良率", st.goodRate !== null ? st.goodRate + "%" : "—", "优秀 " + st.excellentCount + " 人");
      };
      html += '<div class="stat-row">' + mkCards("全班", stats.total) + "</div>";
      html += '<div class="stat-row">' + mkCards("男生", stats.male) + mkCards("女生", stats.female) + "</div>";

      /* 图表区 */
      html += '<div class="chart-grid">' +
        '<div class="card"><div id="ch-pie" class="chart-box"></div></div>' +
        '<div class="card"><div id="ch-bar" class="chart-box"></div></div>' +
        '<div class="card"><div id="ch-hist" class="chart-box"></div></div>' +
        '<div class="card"><div id="ch-radar" class="chart-box"></div></div>' +
        "</div>";

      /* 优势/薄弱项目 */
      const weakCard = function (title, list, tone) {
        if (!list.length) return "";
        let h = '<div class="card mb16"><div class="card-title">' + esc(title) + "</div>";
        list.forEach(function (w) {
          h += '<div class="weak-item-card ' + (tone === "weak" ? "weak" : "strong") + '">' +
            '<div class="wi-head"><span class="wi-name">' + esc(w.label) + "</span>" +
            UC.scoreSpan(w.avgScore) + '<span class="text-sm text-2">平均 ' + w.avgScore + " 分 · 及格率 " + w.passRate + "%</span></div>" +
            '<div class="wi-reason">判定依据：' + esc(w.reason) + "</div>" +
            (tone === "weak" ? '<div class="wi-suggest">' + esc((FCS.training.suggestForWeakItems([{ key: w.key }], "male")[0] || "").replace(/^【.+?】/, "")) + "</div>" : "") +
            "</div>";
        });
        return h + "</div>";
      };
      html += '<div class="chart-grid">' +
        '<div style="grid-column:1/-1">' +
        weakCard("⚠ 薄弱项目（全班）", weakAll.weaknesses, "weak") +
        weakCard("✔ 优势项目（全班）", weakAll.strengths, "strong") +
        "</div></div>";

      /* 各项目得分明细表：男女专属项目分开列示（9类） */
      html += '<div class="card"><div class="card-title">各项目得分明细</div><div class="table-wrap"><table class="tbl"><thead><tr>' +
        "<th>项目</th><th>权重</th><th>男生平均分</th><th>女生平均分</th><th>全班平均分</th><th>男生及格率</th><th>女生及格率</th><th>全班及格率</th></tr></thead><tbody>";
      FCS.charts.axisDefs().forEach(function (d) {
        const it = stats.items[d.key][d.gender];
        const m = stats.items[d.key].male;
        const f = stats.items[d.key].female;
        html += "<tr><td class='bold'>" + d.label + "</td>" +
          "<td>" + (S.itemMeta[d.key].weight * 100) + "%</td>" +
          "<td>" + (d.gender === "female" ? '<span class="text-3">—</span>' : UC.scoreSpan(m.avgScore)) + "</td>" +
          "<td>" + (d.gender === "male" ? '<span class="text-3">—</span>' : UC.scoreSpan(f.avgScore)) + "</td>" +
          "<td>" + UC.scoreSpan(it.avgScore) + "</td>" +
          "<td>" + (d.gender === "female" ? "—" : (m.passRate !== null ? m.passRate + "%" : "—")) + "</td>" +
          "<td>" + (d.gender === "male" ? "—" : (f.passRate !== null ? f.passRate + "%" : "—")) + "</td>" +
          "<td>" + (it.passRate !== null ? it.passRate + "%" : "—") + "</td></tr>";
      });
      html += "</tbody></table></div></div>";

      el.innerHTML = html;

      /* 渲染图表 */
      FCS.charts.disposeAll();
      const pieChart = FCS.charts.renderGradePie(document.getElementById("ch-pie"), stats.total.gradeDist);
      const barChart = FCS.charts.renderItemBar(document.getElementById("ch-bar"), stats.items, { byGender: true, title: "各项目平均分" });
      const histChart = FCS.charts.renderHistogram(document.getElementById("ch-hist"), stats.totals);
      const defs = FCS.charts.axisDefs();
      const radarChart = FCS.charts.renderRadar(document.getElementById("ch-radar"),
        defs.map(function (d) { return { name: d.label, max: 100 }; }),
        [
          { name: "男生", values: defs.map(function (d) { return d.gender === "female" ? null : stats.items[d.key].male.avgScore; }), color: FCS.charts.COLORS.male },
          { name: "女生", values: defs.map(function (d) { return d.gender === "male" ? null : stats.items[d.key].female.avgScore; }), color: FCS.charts.COLORS.female },
        ], { title: "班级男女各项目得分雷达" });

      /* 缓存图表PNG（等图表渲染完成后截图），供导出使用 */
      FCS.analysisUI._cache = {
        batch: batch,
        stats: stats,
        suggestions: suggestions,
        chartsPromise: Promise.all([
          FCS.charts.getPng(pieChart),
          FCS.charts.getPng(barChart),
          FCS.charts.getPng(histChart),
          FCS.charts.getPng(radarChart),
        ]).then(function (arr) {
          return { pie: arr[0], bar: arr[1], hist: arr[2], radar: arr[3] };
        }),
      };
    },
  });

  FCS.analysisUI = FCS.analysisUI || {};
  FCS.analysisUI.exportReport = function () {
    const c = FCS.analysisUI._cache;
    if (!c) { FCS.util.toast("请先打开班级分析页", "warn"); return; }
    c.chartsPromise.then(function (charts) {
      exportReport(c.batch, c.stats, charts, c.suggestions);
    });
  };
})();
