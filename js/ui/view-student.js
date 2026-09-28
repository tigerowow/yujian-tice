/* view-student.js — 个人报告：得分雷达、排名、薄弱项与个人训练建议、前后对比 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const S = FCS.scoring;
  const data = function () { return FCS.app.data; };

  FCS.app.registerView("student", {
    title: "个人报告",
    render: function (el, params) {
      const U = FCS.util;
      const UC = FCS.uiCommon;
      const esc = U.esc;
      const studentId = params[0];
      if (!studentId) {
        el.innerHTML = UC.needContext("请先在顶栏选择班级和测试批次，并从录入/分析页点击学生姓名进入个人报告。");
        return;
      }
      /* 跨批次查找：先查当前批次，再查同班其它批次，最后全局查找
         （姓名链接可能来自任意批次，与顶栏当前选中批次无关） */
      const findBatch = function (list) {
        return list.find(function (b) {
          return b.students.some(function (s) { return s.id === studentId; });
        }) || null;
      };
      let batch = null;
      let cls = null;
      const curBatch = FCS.app.getBatch();
      const curCls = FCS.app.getClass();
      if (curBatch && curBatch.students.some(function (s) { return s.id === studentId; })) {
        batch = curBatch;
        cls = curCls;
      }
      if (!batch && curCls) {
        batch = findBatch(curCls.batches);
        if (batch) cls = curCls;
      }
      if (!batch) {
        FCS.app.data.classes.some(function (c) {
          batch = findBatch(c.batches);
          if (batch) { cls = c; return true; }
          return false;
        });
      }
      if (!batch) {
        el.innerHTML = UC.empty("未找到该学生（可能已被删除）。");
        return;
      }
      const rep = FCS.analysis.studentReport(batch, studentId);
      if (!rep) {
        el.innerHTML = UC.empty("未找到该学生（可能已被删除）。");
        return;
      }
      /* 前后对比：找同班另一批次 */
      let compare = null;
      if (cls && cls.batches.length > 1) {
        const other = cls.batches.find(function (b) { return b.id !== batch.id && b.students.some(function (s) { return s.studentNo === rep.studentNo; }); });
        if (other) {
          const otherS = other.students.find(function (s) { return s.studentNo === rep.studentNo; });
          const beforeC = FCS.analysis.computeStudent(otherS);
          const afterC = rep;
          const itemDeltas = {};
          S.items.forEach(function (k) {
            const va = beforeC.itemScores[k], vb = afterC.itemScores[k];
            itemDeltas[k] = (va !== null && vb !== null) ? Math.round((vb - va) * 10) / 10 : null;
          });
          compare = {
            batchName: other.name, before: beforeC, after: afterC,
            totalDelta: (beforeC.complete && afterC.complete) ? Math.round((afterC.total - beforeC.total) * 10) / 10 : null,
            itemDeltas: itemDeltas,
          };
        }
      }
      /* 个人建议 */
      const weakKeys = rep.weakItems.must.map(function (w) { return w.key; })
        .concat(rep.weakItems.relative.map(function (w) { return w.key; }));
      const suggestions = FCS.training.suggestForWeakItems(weakKeys, rep.gender);

      let html = '<div class="card mb16"><div class="student-hero">' +
        '<div class="student-avatar">' + esc(rep.name.charAt(0)) + "</div>" +
        '<div><div class="text-lg bold">' + esc(rep.name) + "　" + UC.genderBadge(rep.gender) + "　" + UC.gradeBadge(rep.grade) + "</div>" +
        '<div class="text-2 mt8">学籍号：' + esc(rep.studentNo) + "　·　" + esc(cls ? cls.name : "") + "　·　" + esc(batch.name) + "</div>" +
        '<div class="text-2">总分：<b class="text-lg">' + (rep.total !== null ? rep.total + " 分" : "缺项") + "</b>　·　班级排名 " + (rep.classRank || "—") + "/" + rep.classCount +
        "　·　" + (rep.gender === "male" ? "男生" : "女生") + "排名 " + (rep.genderRank || "—") + "/" + rep.genderCount + "</div></div>" +
        '<div class="flex gap8" style="margin-left:auto">' +
        '<button class="btn btn-primary" onclick="FCS.studentUI.exportReport(\'' + studentId + '\')" ' + (!rep.complete ? "disabled" : "") + "><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><path d=\"M6 2.5h9l5 5V21.5H6z\"/><path d=\"M14 2.5v5h5\"/></svg>导出PDF报告</button>" +
        "</div></div></div>";

      if (!rep.complete) {
        html += '<div class="banner banner-warn">该生有缺项：' + rep.missing.map(function (k) { return S.itemLabel(k, rep.gender); }).join("、") + "，请先补录成绩。</div>";
      }

      html += '<div class="chart-grid">' +
        '<div class="card"><div id="st-radar" class="chart-box"></div></div>' +
        '<div class="card"><div class="card-title">各项目得分</div><div class="table-wrap"><table class="tbl"><thead><tr>' +
        "<th>项目</th><th>原始成绩</th><th>得分</th><th>权重</th></tr></thead><tbody>";
      const rawShow = function (s, k) {
        const raw = s.raw || {};
        if (k === "endurance") return raw.endurance ? raw.endurance.display : "—";
        if (k === "bmi") return raw.height && raw.weight ? raw.height + "cm / " + raw.weight + "kg" : "—";
        if (raw[k] === null || raw[k] === undefined) return "—";
        return String(raw[k]);
      };
      S.items.forEach(function (k) {
        html += "<tr><td class='bold'>" + S.itemLabel(k, rep.gender) + "</td>" +
          "<td>" + esc(rawShow(rep, k)) + "</td>" +
          "<td>" + UC.scoreSpan(rep.itemScores[k]) + "</td>" +
          "<td>" + (S.itemMeta[k].weight * 100) + "%</td></tr>";
      });
      html += "</tbody></table></div>" +
        '<div class="text-sm text-2 mt8">BMI：' + (rep.bmi !== null ? rep.bmi : "—") + "</div></div></div>";

      /* 薄弱项与建议 */
      html += '<div class="card mb16"><div class="card-title">薄弱项与训练建议</div>';
      if (rep.weakItems.must.length) {
        html += '<div class="bold text-danger mb8">必练项目（低于60分）：</div>';
        rep.weakItems.must.forEach(function (w) {
          html += '<div class="weak-item-card weak"><div class="wi-head"><span class="wi-name">' + esc(S.itemLabel(w.key, rep.gender)) +
            "</span>" + UC.scoreSpan(w.score) + "</div></div>";
        });
      }
      if (rep.weakItems.relative.length) {
        html += '<div class="bold mb8" style="color:#a06f00">相对薄弱项目（明显低于个人总分）：</div>';
        rep.weakItems.relative.forEach(function (w) {
          html += '<div class="weak-item-card" style="border-left:5px solid var(--warning)"><div class="wi-head"><span class="wi-name">' +
            esc(S.itemLabel(w.key, rep.gender)) + "</span>" + UC.scoreSpan(w.score) +
            '<span class="text-sm text-2">低于个人总分 ' + w.gap + ' 分</span></div></div>';
        });
      }
      if (!rep.weakItems.must.length && !rep.weakItems.relative.length) {
        html += '<div class="text-success bold">👍 各项目均衡发展，无明显薄弱项，继续保持！</div>';
      }
      suggestions.forEach(function (s) { html += '<div class="wi-suggest mb8">' + esc(s) + "</div>"; });
      html += "</div>";

      /* 前后对比 */
      if (compare) {
        const d = function (v) { return v === null ? "—" : v; };
        html += '<div class="card"><div class="card-title">与上次测试对比（' + esc(compare.batchName) + "）</div>" +
          '<div class="stat-row">' +
          UC.statCard("上次总分", d(compare.before.total), "") +
          UC.statCard("本次总分", d(compare.after.total), "") +
          UC.statCard("变化", compare.totalDelta !== null ? (compare.totalDelta > 0 ? "+" : "") + compare.totalDelta + " 分" : "—",
            compare.totalDelta !== null && compare.totalDelta > 0 ? "进步！" : compare.totalDelta !== null && compare.totalDelta < 0 ? "需要加油" : "持平",
            compare.totalDelta !== null && compare.totalDelta >= 0 ? "highlight" : "danger") +
          "</div>" +
          '<table class="tbl"><thead><tr><th>项目</th>' +
          S.items.map(function (k) { return "<th>" + S.itemLabel(k, rep.gender) + "</th>"; }).join("") +
          "</tr></thead><tbody><tr><td class='bold'>变化</td>";
        S.items.forEach(function (k) {
          const dd = compare.itemDeltas[k];
          html += "<td>" + (dd !== null ? (dd > 0 ? '<span class="delta-up">+' + dd + "</span>" : dd < 0 ? '<span class="delta-down">' + dd + "</span>" : '<span class="delta-zero">0</span>') : '<span class="text-3">—</span>') + "</td>";
        });
        html += "</tr></tbody></table></div>";
      }

      el.innerHTML = html;

      /* 雷达图：项目名按学生性别显示（女生为800米跑/仰卧起坐） */
      FCS.charts.disposeAll();
      FCS.charts.renderRadar(document.getElementById("st-radar"),
        S.items.map(function (k) { return { name: S.itemLabel(k, rep.gender), max: 100 }; }),
        [{
          name: rep.name,
          values: S.items.map(function (k) { return rep.itemScores[k]; }),
          color: rep.gender === "male" ? FCS.charts.COLORS.male : FCS.charts.COLORS.female,
        }],
        { title: rep.name + " 各项目得分雷达" });

      /* 缓存导出数据（雷达PNG等图表渲染完成后截图） */
      const radarChart = FCS.charts._charts[FCS.charts._charts.length - 1];
      FCS.studentUI._cache = {
        rep: rep, compare: compare, suggestions: suggestions, cls: cls, batch: batch,
        radarPromise: FCS.charts.getPng(radarChart),
      };
    },
  });

  FCS.studentUI = FCS.studentUI || {};
  FCS.studentUI.exportReport = function (studentId) {
    const c = FCS.studentUI._cache;
    if (!c || c.rep.id !== studentId) { FCS.util.toast("请先打开个人报告页", "warn"); return; }
    Promise.resolve(c.radarPromise || null).then(function (radarPng) {
      const html = FCS.report.studentReportHTML({
        rep: c.rep,
        className: c.cls ? c.cls.name : "",
        batchName: c.batch.name,
        suggestions: c.suggestions,
        radarPng: radarPng,
        compare: c.compare,
      });
      FCS.pdfExport.toastResult(
        FCS.pdfExport.exportHTML(html, c.rep.name + "_体测个人报告.pdf"),
        "个人PDF报告");
    });
  };
})();
