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
        el.innerHTML = UC.needContext("请从「数据录入」或「班级分析」页点击学生姓名，进入个人报告。");
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
      /* 该生在本班的历次记录（按学籍号匹配，批次顺序=测试日期升序）：用于批次切换胶囊与成长曲线 */
      const history = [];
      if (cls) {
        cls.batches.forEach(function (b) {
          const st = b.students.find(function (s) { return s.studentNo === rep.studentNo; });
          if (st) history.push({ batch: b, student: st, computed: FCS.analysis.computeStudent(st) });
        });
      }
      history.sort(function (a, b) { return String(a.batch.testDate).localeCompare(String(b.batch.testDate)); });
      const curIdx = history.findIndex(function (h) { return h.batch.id === batch.id; });

      /* 前后对比：与「上一次」测试对比（历史中排在当前批次前一位的那次） */
      let compare = null;
      const prev = curIdx > 0 ? history[curIdx - 1] : null;
      if (prev) {
        const beforeC = prev.computed;
        const afterC = rep;
        const itemDeltas = {};
        S.items.forEach(function (k) {
          const va = beforeC.itemScores[k], vb = afterC.itemScores[k];
          itemDeltas[k] = (va !== null && vb !== null) ? Math.round((vb - va) * 10) / 10 : null;
        });
        compare = {
          batchName: prev.batch.name, before: beforeC, after: afterC,
          totalDelta: (beforeC.complete && afterC.complete) ? Math.round((afterC.total - beforeC.total) * 10) / 10 : null,
          itemDeltas: itemDeltas,
        };
      }
      /* 个人建议（suggestForWeakItems 需要 {key} 对象，传字符串会静默返回空） */
      const weakKeys = rep.weakItems.must.concat(rep.weakItems.relative).map(function (w) { return { key: w.key }; });
      const suggestions = FCS.training.suggestForWeakItems(weakKeys, rep.gender);

      let html = '<div class="card mb16"><div class="student-hero">' +
        '<div class="student-avatar">' + esc(rep.name.charAt(0)) + "</div>" +
        '<div><div class="text-lg bold">' + esc(rep.name) + "　" + UC.genderBadge(rep.gender) + "　" + UC.gradeBadge(rep.grade) + "</div>" +
        '<div class="text-2 mt8">学籍号：' + esc(rep.studentNo) + "　·　" + esc(cls ? cls.name : "") + "　·　" + esc(batch.name) + "</div>" +
        '<div class="text-2">总分：<b class="text-lg">' + (rep.total !== null ? rep.total + " 分" : "缺项") + "</b>　·　班级排名 " + (rep.classRank || "—") + "/" + rep.classCount +
        "　·　" + (rep.gender === "male" ? "男生" : "女生") + "排名 " + (rep.genderRank || "—") + "/" + rep.genderCount + "</div>" +
        /* 测试批次切换（本页顶栏已隐藏，只能在这里切换查看该生其它批次成绩） */
        (history.length > 1
          ? '<div class="text-sm text-2 mt8">测试批次（点击切换查看该生其它批次成绩）：</div>' +
            '<div class="st-batch-chips">' + history.map(function (h) {
              const isCur = h.batch.id === batch.id;
              const sc = h.computed.complete ? h.computed.total + " 分" : "缺项";
              return '<div class="focus-chip' + (isCur ? " on" : "") + '" title="' + esc(UC.batchLabel(h.batch)) + '"' +
                ' onclick="FCS.app.navigate(\'#/student/' + h.student.id + '\')">' +
                esc(h.batch.name) + '<span class="fc-score">' + esc(sc) + "</span></div>";
            }).join("") + "</div>"
          : "") +
        "</div>" +
        '<div class="flex gap8" style="margin-left:auto">' +
        '<button class="btn" onclick="window.print()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linejoin=\"round\"><path d=\"M7 8V3h10v5\"/><path d=\"M7 16.5H4.5v-6a2.5 2.5 0 012.5-2.5h10a2.5 2.5 0 012.5 2.5v6H17\"/><path d=\"M7 14h10v7H7z\"/></svg>打印</button>' +
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

      /* 薄弱项与训练建议：左栏项目（名称 / 原始成绩 / 得分），右栏对应的训练建议 */
      const must = rep.weakItems.must, rel = rep.weakItems.relative;
      const planRow = function (w, tone) {
        const sug = FCS.training.suggestForWeakItems([{ key: w.key }], rep.gender)[0] || "";
        const sugText = sug.replace(/^【.+?】\s*/, "").trim() ||
          "暂无对应训练方法，可到「训练计划」页为本班生成系统的周训练方案。";
        return '<div class="wp-row ' + tone + '">' +
          '<div class="wp-left">' +
          '<div class="wp-name">' + esc(S.itemLabel(w.key, rep.gender)) + "</div>" +
          '<div class="wp-data">' + esc(rawShow(rep, w.key)) + "</div>" +
          '<div class="wp-score" style="color:' + (w.score < 60 ? "var(--danger)" : "#a06f00") + '">' + w.score + " 分</div>" +
          (w.gap !== undefined && w.gap !== null ? '<div class="wp-data">低于个人总分 ' + w.gap + " 分</div>" : "") +
          "</div>" +
          '<div class="wp-right">' + esc(sugText) + "</div>" +
          "</div>";
      };
      html += '<div class="card mb16"><div class="card-title">薄弱项与训练建议</div>';
      if (must.length) {
        html += '<div class="bold text-danger mb8">必练项目（低于60分）</div>';
        must.forEach(function (w) { html += planRow(w, "must"); });
      }
      if (rel.length) {
        html += '<div class="bold mb8' + (must.length ? " mt16" : "") + '" style="color:#a06f00">相对薄弱项目（明显低于个人总分）</div>';
        rel.forEach(function (w) { html += planRow(w, "rel"); });
      }
      if (!must.length && !rel.length) {
        html += '<div class="text-success bold">各项目均衡发展，无明显薄弱项，继续保持！</div>';
      }
      html += "</div>";

      /* 与上次测试对比：紧凑对比条（上次→本次→变化）+ 全宽明细表（行=项目，列=上次/本次/变化） */
      if (compare) {
        const d = function (v) { return v === null ? "—" : v; };
        const delta = compare.totalDelta;
        const deltaCls = delta === null || delta === 0 ? "delta-zero" : delta > 0 ? "delta-up" : "delta-down";
        html += '<div class="card mb16"><div class="card-title">与上次测试对比（' + esc(compare.batchName) + "）</div>" +
          '<div class="cmp-strip">' +
          "<span>上次总分 <b>" + d(compare.before.total) + "</b> 分</span>" +
          '<span class="cs-arrow">➜</span>' +
          "<span>本次总分 <b>" + d(compare.after.total) + "</b> 分</span>" +
          (delta !== null
            ? '<span class="cs-delta ' + deltaCls + '">' + (delta > 0 ? "▲ +" : delta < 0 ? "▼ " : "") + delta + " 分</span>" +
              '<span class="text-2">' + (delta > 0 ? "进步！" : delta < 0 ? "需要加油" : "与上次持平") + "</span>"
            : '<span class="text-3">（有缺项，无法计算总分变化）</span>') +
          "</div>" +
          '<div class="table-wrap"><table class="tbl" id="cmp-detail"><thead><tr>' +
          "<th>项目</th><th>上次得分</th><th>本次得分</th><th>变化</th></tr></thead><tbody>";
        S.items.forEach(function (k) {
          const dd = compare.itemDeltas[k];
          html += "<tr><td class='bold'>" + S.itemLabel(k, rep.gender) + "</td>" +
            "<td>" + UC.scoreSpan(compare.before.itemScores[k]) + "</td>" +
            "<td>" + UC.scoreSpan(compare.after.itemScores[k]) + "</td>" +
            "<td>" + (dd !== null ? (dd > 0 ? '<span class="delta-up">+' + dd + "</span>" : dd < 0 ? '<span class="delta-down">' + dd + "</span>" : '<span class="delta-zero">0</span>') : '<span class="text-3">—</span>') + "</td></tr>";
        });
        html += "</tbody></table></div></div>";
      }

      /* 个人成长曲线：该生历次测试的总分折线 */
      html += '<div class="card"><div class="card-title">个人成长曲线</div>';
      if (history.length < 2) {
        html += '<div class="empty-tip" style="padding:18px 0">该生目前只有 ' + history.length +
          " 次测试记录，暂无成长曲线。<br>新建复测批次并录入该生成绩后，即可看到总分变化趋势。</div>";
      } else {
        html += '<div id="st-trend" class="chart-box" style="height:320px"></div>' +
          '<div class="text-sm text-2 mt8">历次测试：' + history.map(function (h) {
            return esc(h.batch.name) + " " + (h.computed.complete ? h.computed.total + " 分" : "缺项");
          }).join("　➜　") + "</div>";
      }
      html += "</div>";

      el.innerHTML = html;

      /* 雷达图：项目名按学生性别显示（女生为800米跑/仰卧起坐） */
      FCS.charts.disposeAll();
      const radarChart = FCS.charts.renderRadar(document.getElementById("st-radar"),
        S.items.map(function (k) { return { name: S.itemLabel(k, rep.gender), max: 100 }; }),
        [{
          name: rep.name,
          values: S.items.map(function (k) { return rep.itemScores[k]; }),
          color: rep.gender === "male" ? FCS.charts.COLORS.male : FCS.charts.COLORS.female,
        }],
        { title: rep.name + " 各项目得分雷达" });

      /* 个人成长曲线：该生总分随各次测试批次变化的折线（含及格/良好/优秀参考线） */
      let trendChart = null;
      if (history.length >= 2) {
        trendChart = FCS.charts.renderTrendLine(document.getElementById("st-trend"),
          history.map(function (h) { return h.batch.name; }),
          [{
            name: rep.name + " 总分",
            values: history.map(function (h) { return h.computed.complete ? h.computed.total : null; }),
            color: rep.gender === "male" ? FCS.charts.COLORS.male : FCS.charts.COLORS.female,
          }],
          { title: rep.name + " 总分变化趋势" });
      }

      /* 缓存导出数据（图表PNG渲染完成后截图） */
      FCS.studentUI._cache = {
        rep: rep, compare: compare, suggestions: suggestions, cls: cls, batch: batch,
        history: history.map(function (h) {
          return { name: h.batch.name, total: h.computed.complete ? h.computed.total : null };
        }),
        radarPromise: FCS.charts.getPng(radarChart),
        trendPromise: trendChart ? FCS.charts.getPng(trendChart) : Promise.resolve(null),
      };
    },
  });

  FCS.studentUI = FCS.studentUI || {};
  FCS.studentUI.exportReport = function (studentId) {
    const c = FCS.studentUI._cache;
    if (!c || c.rep.id !== studentId) { FCS.util.toast("请先打开个人报告页", "warn"); return; }
    Promise.all([Promise.resolve(c.radarPromise || null), Promise.resolve(c.trendPromise || null)]).then(function (arr) {
      const html = FCS.report.studentReportHTML({
        rep: c.rep,
        className: c.cls ? c.cls.name : "",
        batchName: c.batch.name,
        suggestions: c.suggestions,
        radarPng: arr[0],
        trendPng: arr[1],
        history: c.history,
        compare: c.compare,
      });
      FCS.pdfExport.toastResult(
        FCS.pdfExport.exportHTML(html, c.rep.name + "_体测个人报告.pdf"),
        "个人PDF报告");
    });
  };
})();
