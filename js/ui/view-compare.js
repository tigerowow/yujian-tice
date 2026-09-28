/* view-compare.js — 对比分析：两大页签
   ① 同一班级纵向对比（同班两次批次前后对比：进步/退步）
   ② 不同班级横向对比（多班级最新批次对比） */
(function () {
  "use strict";
  const FCS = window.FCS;
  const S = FCS.scoring;
  const data = function () { return FCS.app.data; };

  const state = { tab: "long", batchA: null, batchB: null, classSel: {}, longSearch: "" };
  /* 当前对比视图的图表实例（供PDF导出截图用；空状态时为null） */
  let currentChart = null;

  FCS.compareUI = FCS.compareUI || {};
  FCS.compareUI.setTab = function (t) { state.tab = t; FCS.app.render(); };
  FCS.compareUI.setBatchA = function (id) { state.batchA = id; FCS.app.render(); };
  FCS.compareUI.setBatchB = function (id) { state.batchB = id; FCS.app.render(); };
  FCS.compareUI.toggleClass = function (id) { state.classSel[id] = !state.classSel[id]; FCS.app.render(); };
  FCS.compareUI.setLongSearch = function (v) {
    state.longSearch = (v || "").trim();
    FCS.app.render();
  };

  /* 每名学生变化明细导出为Excel（xlsx，SheetJS本地生成，内容完整、不依赖页面渲染） */
  FCS.compareUI.exportDetailExcel = function () {
    const U = FCS.util;
    const cls = FCS.app.getClass();
    if (!cls || cls.batches.length < 2) { U.toast("纵向对比需要至少2个测试批次", "warn"); return; }
    const batches = cls.batches;
    if (!state.batchA || !batches.some(function (b) { return b.id === state.batchA; })) state.batchA = batches[0].id;
    if (!state.batchB || !batches.some(function (b) { return b.id === state.batchB; })) state.batchB = batches[batches.length - 1].id;
    if (state.batchA === state.batchB) {
      state.batchB = batches[batches.length - 1].id === state.batchA ? batches[0].id : batches[batches.length - 1].id;
    }
    const bA = batches.find(function (b) { return b.id === state.batchA; });
    const bB = batches.find(function (b) { return b.id === state.batchB; });
    const cmp = FCS.analysis.compareBatches(bA, bB);
    const kw = state.longSearch;
    const detailList = kw
      ? cmp.matched.filter(function (m) { return m.studentNo.indexOf(kw) >= 0 || m.name.indexOf(kw) >= 0; })
      : cmp.matched;
    const defs = FCS.charts.axisDefs();
    const header = ["学籍号", "姓名", "性别"].concat(defs.map(function (d) { return d.label; }), ["上次总分", "本次总分", "变化"]);
    const rows = [header];
    detailList.forEach(function (m) {
      const cells = [m.studentNo, m.name, m.gender === "male" ? "男" : "女"];
      defs.forEach(function (d) {
        const delta = (d.gender !== "all" && d.gender !== m.gender) ? null : m.itemDeltas[d.key];
        cells.push(delta !== null ? delta : "");
      });
      cells.push(m.before.total !== null ? m.before.total : "缺项",
        m.after.total !== null ? m.after.total : "缺项",
        m.totalDelta !== null ? m.totalDelta : "");
      rows.push(cells);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "学生变化明细");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    U.downloadBlob(cls.name + "_学生变化明细.xlsx",
      new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    U.toast("明细Excel已生成并开始下载（共 " + detailList.length + " 人）", "success");
  };

  /* 导出下拉菜单开关 */
  FCS.compareUI.toggleExportMenu = function () {
    const menu = document.getElementById("export-menu");
    if (!menu) return;
    menu.classList.toggle("open");
  };
  /* 点击下拉以外区域自动收起 */
  document.addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest(".dropdown")) {
      document.querySelectorAll(".dropdown-menu.open").forEach(function (m) { m.classList.remove("open"); });
    }
  });

  /* 分析结果合并导出：总体变化+图表（横向页、图表放大）+ 进步名单 + 退步名单，每项单独起页 */
  FCS.compareUI.exportMerged = function () {
    const U = FCS.util;
    const cls = FCS.app.getClass();
    if (!cls || cls.batches.length < 2) { U.toast("纵向对比需要至少2个测试批次", "warn"); return; }
    const batches = cls.batches;
    if (!state.batchA || !batches.some(function (b) { return b.id === state.batchA; })) state.batchA = batches[0].id;
    if (!state.batchB || !batches.some(function (b) { return b.id === state.batchB; })) state.batchB = batches[batches.length - 1].id;
    if (state.batchA === state.batchB) {
      state.batchB = batches[batches.length - 1].id === state.batchA ? batches[0].id : batches[batches.length - 1].id;
    }
    const bA = batches.find(function (b) { return b.id === state.batchA; });
    const bB = batches.find(function (b) { return b.id === state.batchB; });
    const cmp = FCS.analysis.compareBatches(bA, bB);
    Promise.resolve(currentChart ? FCS.charts.getPng(currentChart) : null).then(function (png) {
      const base = {
        mode: "long", className: cls.name, batchA: bA, batchB: bB,
        cmp: cmp, chartPng: png, searchText: "", detailList: cmp.matched,
      };
      const parts = [
        { orientation: "l", html: FCS.report.compareReportHTML(Object.assign({}, base, { part: "summary", wideChart: true })) },
        { orientation: "p", html: FCS.report.compareReportHTML(Object.assign({}, base, { part: "improved", skipHeader: true, chartPng: null })) },
        { orientation: "p", html: FCS.report.compareReportHTML(Object.assign({}, base, { part: "declined", skipHeader: true, chartPng: null })) },
      ];
      FCS.pdfExport.toastResult(
        FCS.pdfExport.exportMulti(parts, cls.name + "_分析结果.pdf"),
        "分析结果PDF");
    });
  };

  /* 导出对比PDF：part ∈ all(完整) | summary(本页其他项目) | improved(进步名单)
     | declined(退步名单) | detail(每名学生变化明细) */
  FCS.compareUI.exportPdf = function (part) {
    const U = FCS.util;
    part = part || "all";
    if (state.tab === "long") {
      const cls = FCS.app.getClass();
      if (!cls || cls.batches.length < 2) { U.toast("纵向对比需要至少2个测试批次", "warn"); return; }
      const batches = cls.batches;
      if (!state.batchA || !batches.some(function (b) { return b.id === state.batchA; })) state.batchA = batches[0].id;
      if (!state.batchB || !batches.some(function (b) { return b.id === state.batchB; })) state.batchB = batches[batches.length - 1].id;
      if (state.batchA === state.batchB) {
        state.batchB = batches[batches.length - 1].id === state.batchA ? batches[0].id : batches[batches.length - 1].id;
      }
      const bA = batches.find(function (b) { return b.id === state.batchA; });
      const bB = batches.find(function (b) { return b.id === state.batchB; });
      const cmp = FCS.analysis.compareBatches(bA, bB);
      const kw = state.longSearch;
      const detailList = kw
        ? cmp.matched.filter(function (m) { return m.studentNo.indexOf(kw) >= 0 || m.name.indexOf(kw) >= 0; })
        : cmp.matched;
      const nameMap = { all: "纵向对比分析", summary: "纵向对比_总体与图表", improved: "进步名单", declined: "退步名单", detail: "学生变化明细" };
      /* 仅部分导出需要图表 */
      const needChart = part === "all" || part === "summary";
      Promise.resolve(needChart && currentChart ? FCS.charts.getPng(currentChart) : null).then(function (png) {
        const html = FCS.report.compareReportHTML({
          mode: "long",
          className: cls.name,
          batchA: bA, batchB: bB,
          cmp: cmp, chartPng: png,
          searchText: kw, detailList: detailList,
          part: part,
        });
        FCS.pdfExport.toastResult(
          FCS.pdfExport.exportHTML(html, cls.name + "_" + nameMap[part] + ".pdf"),
          "对比PDF报告");
      });
    } else {
      const selected = FCS.app.data.classes.filter(function (c) { return state.classSel[c.id]; });
      const pairs = selected.map(function (c) {
        return { className: c.name, batch: c.batches[c.batches.length - 1] };
      }).filter(function (p) { return p.batch && p.batch.students.length; });
      if (pairs.length < 2) { U.toast("请先勾选至少2个有数据的班级", "warn"); return; }
      const cmpData = FCS.analysis.compareClasses(pairs);
      Promise.resolve(currentChart ? FCS.charts.getPng(currentChart) : null).then(function (png) {
        /* 横向对比：横向页面 + 放大图表 */
        const html = FCS.report.compareReportHTML({ mode: "interclass", pairs: cmpData, classChartPng: png, wideChart: true });
        FCS.pdfExport.toastResult(
          FCS.pdfExport.exportHTML(html, "班级横向对比分析.pdf", "l"),
          "对比PDF报告");
      });
    }
  };

  function deltaHtml(d) {
    if (d === null || d === undefined) return '<span class="text-3">—</span>';
    if (d > 0) return '<span class="delta-up">+' + d + "</span>";
    if (d < 0) return '<span class="delta-down">' + d + "</span>";
    return '<span class="delta-zero">0</span>';
  }

  /* ---- ① 同一班级纵向对比（前后两次批次） ---- */
  function renderLongitudinal(el, cls) {
    const U = FCS.util;
    const UC = FCS.uiCommon;
    const esc = U.esc;
    const batches = cls.batches;
    if (batches.length < 2) {
      currentChart = null;
      el.innerHTML = UC.empty(
        "同一班级纵向对比：用同一班级的两次测试批次（如9月初测与10月复测）对比每名学生的进步与退步。<br>当前班级只有 " + batches.length + " 个测试批次，至少需要 2 个才能对比。",
        '<button class="btn btn-primary" onclick="FCS.app.navigate(\'#/classes\')">去新建复测批次</button>');
      return;
    }
    if (!state.batchA || !batches.some(function (b) { return b.id === state.batchA; })) state.batchA = batches[0].id;
    if (!state.batchB || !batches.some(function (b) { return b.id === state.batchB; })) state.batchB = batches[batches.length - 1].id;
    if (state.batchA === state.batchB) {
      state.batchB = batches[batches.length - 1].id === state.batchA ? batches[0].id : batches[batches.length - 1].id;
    }
    const bA = batches.find(function (b) { return b.id === state.batchA; });
    const bB = batches.find(function (b) { return b.id === state.batchB; });

    let html = '<div class="compare-pair-select">' +
      '<div class="cp-item"><label class="field">对比批次一（上次）</label><select class="input" onchange="FCS.compareUI.setBatchA(this.value)">' +
      batches.map(function (b) { return '<option value="' + b.id + '"' + (b.id === state.batchA ? " selected" : "") + ">" + esc(b.name + "（" + b.testDate + "）") + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="cp-item"><label class="field">对比批次二（本次）</label><select class="input" onchange="FCS.compareUI.setBatchB(this.value)">' +
      batches.map(function (b) { return '<option value="' + b.id + '"' + (b.id === state.batchB ? " selected" : "") + ">" + esc(b.name + "（" + b.testDate + "）") + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="text-sm text-2">按学籍号自动匹配同一学生</div></div>';

    const cmp = FCS.analysis.compareBatches(bA, bB);

    /* 总体变化卡 */
    html += '<div class="stat-row">' +
      UC.statCard("全班平均分变化", cmp.classAvgDelta !== null ? (cmp.classAvgDelta > 0 ? "+" : "") + cmp.classAvgDelta + " 分" : "—",
        cmp.statsA.total.avg + " → " + cmp.statsB.total.avg + " 分",
        cmp.classAvgDelta !== null && cmp.classAvgDelta >= 0 ? "highlight" : "danger") +
      UC.statCard("及格率变化", cmp.statsB.total.passRate !== null && cmp.statsA.total.passRate !== null ? ((cmp.statsB.total.passRate - cmp.statsA.total.passRate) > 0 ? "+" : "") + Math.round((cmp.statsB.total.passRate - cmp.statsA.total.passRate) * 10) / 10 + "%" : "—",
        cmp.statsA.total.passRate + "% → " + cmp.statsB.total.passRate + "%") +
      UC.statCard("进步人数", cmp.improved.length, "总分提高≥1分") +
      UC.statCard("退步人数", cmp.declined.length, "总分下降≥1分", cmp.declined.length > cmp.improved.length ? "danger" : "") +
      "</div>";

    /* 项目平均分对比图 */
    html += '<div class="card mb16"><div id="ch-cmp" class="chart-box" style="height:340px"></div></div>';

    /* 进步/退步名单（名单为空时也显示标题和原因，便于排查） */
    const mkList = function (title, list, tone) {
      let h = '<div class="card mb16"><div class="card-title">' + title + "（" + list.length + " 人）</div>";
      if (!list.length) {
        h += '<div class="text-2" style="padding:6px 0 10px">本批次对比中没有此类学生（总分变化均不足1分）</div>';
      } else {
        h += '<div class="table-wrap" style="max-height:260px"><table class="tbl"><thead><tr><th>学籍号</th><th>姓名</th><th>上次总分</th><th>本次总分</th><th>变化</th></tr></thead><tbody>';
        list.forEach(function (m) {
          h += "<tr><td>" + esc(m.studentNo) + "</td><td>" + UC.studentLink(m.id, m.name) + "</td>" +
            "<td>" + m.before.total + "</td><td>" + m.after.total + "</td><td>" + deltaHtml(m.totalDelta) + "</td></tr>";
        });
        h += "</tbody></table></div>";
      }
      return h + "</div>";
    };
    html += mkList("<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 17l5.5-5.5 3.5 3.5L19.5 7\"/><path d=\"M15.5 7h4v4\"/></svg>进步名单", cmp.improved, "up");
    html += mkList("<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 7l5.5 5.5 3.5-3.5L19.5 17\"/><path d=\"M15.5 17h4v-4\"/></svg>退步名单", cmp.declined, "down");

    /* 每生明细（支持按学籍号/姓名搜索） */
    const kw = state.longSearch;
    const detailList = kw
      ? cmp.matched.filter(function (m) {
          return m.studentNo.indexOf(kw) >= 0 || m.name.indexOf(kw) >= 0;
        })
      : cmp.matched;
    html += '<div class="card"><div class="card-title" style="justify-content:space-between">' +
      "<span>每名学生变化明细</span>" +
      '<span class="flex gap8 items-center" style="font-weight:400">' +
      '<input id="long-search" class="input" placeholder="搜索学籍号 / 姓名" value="' + esc(kw) + '" style="width:180px;padding:4px 10px;font-size:13px" oninput="FCS.compareUI.setLongSearch(this.value)">' +
      '<span class="text-sm text-2">' + (kw ? "筛选出 " + detailList.length + " / 共 " + cmp.matched.length + " 人" : "共 " + cmp.matched.length + " 人") + "</span>" +
      "</span></div>" +
      '<div class="table-wrap" style="max-height:420px"><table class="tbl" id="long-detail-table"><thead><tr>' +
      "<th>学籍号</th><th>姓名</th><th>性别</th>" +
      FCS.charts.axisDefs().map(function (d) { return "<th>" + d.label + "</th>"; }).join("") +
      "<th>上次总分</th><th>本次总分</th><th>变化</th></tr></thead><tbody>";
    detailList.forEach(function (m) {
      html += "<tr><td>" + esc(m.studentNo) + "</td><td>" + UC.studentLink(m.id, m.name) + "</td><td>" + (m.gender === "male" ? "男" : "女") + "</td>";
      FCS.charts.axisDefs().forEach(function (d) {
        const delta = (d.gender !== "all" && d.gender !== m.gender) ? null : m.itemDeltas[d.key];
        html += "<td>" + deltaHtml(delta) + "</td>";
      });
      html += "<td>" + (m.before.total !== null ? m.before.total : "缺项") + "</td>" +
        "<td>" + (m.after.total !== null ? m.after.total : "缺项") + "</td><td class='bold'>" + deltaHtml(m.totalDelta) + "</td></tr>";
    });
    html += "</tbody></table></div>";
    html += "</div>";
    el.innerHTML = html;
    FCS.charts.disposeAll();
    currentChart = FCS.charts.renderCompareBars(document.getElementById("ch-cmp"), cmp.statsA, cmp.statsB, { labelA: bA.name, labelB: bB.name });
    /* 搜索输入框保持焦点（输入即重绘，恢复焦点避免打字中断） */
    if (kw) {
      const si = document.getElementById("long-search");
      if (si) {
        si.focus();
        try { si.setSelectionRange(kw.length, kw.length); } catch (e) { /* ignore */ }
      }
    }
  }

  /* ---- ② 不同班级横向对比（多班级） ---- */
  function renderInterclass(el) {
    const U = FCS.util;
    const UC = FCS.uiCommon;
    const esc = U.esc;
    const d = data();
    if (d.classes.length < 2) {
      currentChart = null;
      el.innerHTML = UC.empty(
        "不同班级横向对比：对比各班最新测试批次的平均分、及格率、优良率。<br>当前只有 " + d.classes.length + " 个班级，再新建一个班级并录入成绩后即可进行对比。",
        '<button class="btn btn-primary" onclick="FCS.app.navigate(\'#/classes\')">去新建班级</button>');
      return;
    }
    /* 勾选班级（每班用其最近批次） */
    const selected = d.classes.filter(function (c) { return state.classSel[c.id]; });
    let html = '<div class="card mb16"><div class="card-title">选择对比班级（使用各班最新测试批次）</div><div class="flex flex-wrap gap8">';
    d.classes.forEach(function (c) {
      const latest = c.batches.length ? c.batches[c.batches.length - 1] : null;
      html += '<label class="focus-chip' + (state.classSel[c.id] ? " on" : "") + '" onclick="FCS.compareUI.toggleClass(\'' + c.id + '\')">' +
        esc(c.name) + "（" + (latest ? latest.students.length + "人" : "无批次") + "）</label>";
    });
    html += "</div></div>";
    if (selected.length < 2) {
      currentChart = null;
      html += UC.empty("请在下方勾选要对比的班级（至少 2 个），勾选后即可看到班级间对比图。");
      el.innerHTML = html;
      return;
    }
    const pairs = selected.map(function (c) {
      return { className: c.name, batch: c.batches[c.batches.length - 1] };
    }).filter(function (p) { return p.batch && p.batch.students.length; });
    if (pairs.length < 2) {
      currentChart = null;
      html += UC.empty("所选班级中至少 2 个需要有学生数据（其余班级可先到「数据录入」导入成绩）。");
      el.innerHTML = html;
      return;
    }
    const cmp = FCS.analysis.compareClasses(pairs);
    html += '<div class="card mb16"><div id="ch-cls" class="chart-box" style="height:340px"></div></div>' +
      '<div class="card"><div class="card-title">班级对比明细</div><div class="table-wrap"><table class="tbl"><thead><tr>' +
      "<th>班级</th><th>批次</th><th>人数</th><th>平均分</th><th>及格率</th><th>优良率</th><th>优秀人数</th></tr></thead><tbody>";
    cmp.forEach(function (c) {
      html += "<tr><td class='bold'>" + esc(c.className) + "</td><td>" + esc(c.batchName) + "</td><td>" + c.count + "</td>" +
        "<td>" + (c.avg !== null ? c.avg : "—") + "</td><td>" + (c.passRate !== null ? c.passRate + "%" : "—") + "</td>" +
        "<td>" + (c.goodRate !== null ? c.goodRate + "%" : "—") + "</td><td>" + c.excellentCount + "</td></tr>";
    });
    html += "</tbody></table></div></div>";
    el.innerHTML = html;
    FCS.charts.disposeAll();
    currentChart = FCS.charts.renderClassBar(document.getElementById("ch-cls"), cmp, { title: "班级平均分与及格率对比" });
  }

  FCS.app.registerView("compare", {
    title: "对比分析",
    render: function (el) {
      const cls = FCS.app.getClass();
      const tabs = [
        ["long", "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 17l5.5-5.5 3.5 3.5L19.5 7\"/><path d=\"M15.5 7h4v4\"/></svg>同一班级纵向对比"],
        ["interclass", "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z\"/></svg>不同班级横向对比"],
      ];
      let exportHtml;
      if (state.tab === "long") {
        exportHtml =
          '<div class="dropdown">' +
          '<button class="btn btn-primary" onclick="event.stopPropagation();FCS.compareUI.toggleExportMenu()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><path d=\"M6 2.5h9l5 5V21.5H6z\"/><path d=\"M14 2.5v5h5\"/></svg>分析结果 ▾</button>' +
          '<div class="dropdown-menu" id="export-menu">' +
          '<button class="dd-item" onclick="FCS.compareUI.toggleExportMenu();FCS.compareUI.exportMerged()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><path d=\"M6 2.5h9l5 5V21.5H6z\"/><path d=\"M14 2.5v5h5\"/></svg>分析结果（总体变化+进步+退步，PDF）</button>' +
          '<button class="dd-item" onclick="FCS.compareUI.toggleExportMenu();FCS.compareUI.exportDetailExcel()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><path d=\"M6 2.5h9l5 5V21.5H6z\"/><path d=\"M14 2.5v5h5\"/><path d=\"M8.5 11h7M8.5 14.5h7M8.5 18h7\"/></svg>每名学生变化明细（Excel）</button>' +
          "</div></div>";
      } else {
        exportHtml = '<button class="btn btn-primary" onclick="FCS.compareUI.exportPdf(\'all\')"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><path d=\"M6 2.5h9l5 5V21.5H6z\"/><path d=\"M14 2.5v5h5\"/></svg>分析结果导出</button>';
      }
      let html = '<div class="flex space-between items-center" style="margin-bottom:16px">' +
        '<div class="tabs" style="flex:1;margin-bottom:0">' + tabs.map(function (t) {
          return '<button class="tab' + (state.tab === t[0] ? " active" : "") + '" onclick="FCS.compareUI.setTab(\'' + t[0] + '\')">' + t[1] + "</button>";
        }).join("") + "</div>" +
        exportHtml +
        "</div>";

      if (state.tab === "interclass") {
        el.innerHTML = html;
        const wrap = document.createElement("div");
        el.appendChild(wrap);
        renderInterclass(wrap);
        return;
      }
      /* 纵向对比需要选择班级 */
      const batch = FCS.app.getBatch();
      if (!batch) {
        el.innerHTML = html + '<div class="card"><div class="empty-tip">请先在顶栏选择班级和测试批次。</div></div>';
        return;
      }
      el.innerHTML = html;
      const wrap = document.createElement("div");
      el.appendChild(wrap);
      if (!cls) { wrap.innerHTML = ""; return; }
      renderLongitudinal(wrap, cls);
    },
  });
})();
