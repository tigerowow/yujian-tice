/* report.js — 报告HTML模板（自包含内联样式，供PDF导出使用）
   结构：班级总体情况 → 各项目得分 → 优势/薄弱项目与训练建议 → 训练计划 → 学生成绩明细
   分类采用男女专属项目拆分（9类）。 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const R = {};

  /* ---- 基础样式与构件（内联，不依赖应用CSS） ---- */
  const INK = "#1f3a57";
  const BLUE = "#2a78d6";
  const DARK = "#184f95";
  const BORDER = "#c9ddef";
  const HEAD_BG = "#e8f1fa";
  const RED = "#d03b3b";
  const GREEN = "#0ca30c";

  function esc(s) { return FCS.util.esc(s); }
  /* 每个内容单元包装为 .rep-block（PDF导出按块分页，表格块按行切页）。
     间距用块内padding实现（html2canvas不渲染margin，会导致块间无间距）。 */
  function block(inner, cls, style) {
    return '<div class="rep-block' + (cls ? " " + cls : "") + '" style="' + (style || "") + '">' + inner + "</div>";
  }
  function h1(t) { return block('<div style="font-size:24px;font-weight:700;color:' + DARK + ';text-align:center">' + esc(t) + "</div>", "", "padding:4px 0 2px"); }
  function sub(t) { return block('<div style="font-size:12px;color:#5a7a9c;text-align:center">' + esc(t) + "</div>", "", "padding:0 0 12px"); }
  function h2(t) { return block('<div style="font-size:17px;font-weight:700;color:' + BLUE + ';border-left:4px solid ' + BLUE + ';padding-left:8px">' + esc(t) + "</div>", "", "padding:14px 0 6px"); }
  function h3(t) { return block('<div style="font-size:14px;font-weight:700;color:' + DARK + '">' + esc(t) + "</div>", "", "padding:8px 0 4px"); }
  function p(t, color) {
    return block('<div style="font-size:12.5px;line-height:1.7;color:' + (color || INK) + '">' + t + "</div>", "", "padding:2px 0");
  }
  /* 报告表格用【flex布局的div】实现，不使用 <table> 标签：
     个别浏览器对表格元素存在布局bug（列宽塌缩、单元格竖排），而本软件界面的
     flex布局在其上表现正常——用已验证可靠的布局方式渲染，彻底规避该问题。
     行容器带 class rep-row（供PDF分页的行检测与DOM兜底使用）。 */
  /* 当前表格的列宽比例（表头与数据行共用，保证各列对齐） */
  let currentWidths = null;
  function tableStart(headers, widths) {
    currentWidths = widths || null;
    /* 表格宽度用100%自适应容器：纵向页=734px，横向页=1038px，自动占满居中 */
    let h = '<div class="rep-block rep-table" style="padding-bottom:12px">' +
      '<div style="width:100%;font-size:12px;color:' + INK + '">' +
      '<div class="rep-row" style="display:flex;background:' + HEAD_BG + ';color:' + DARK + '">';
    headers.forEach(function (th, i) {
      const flex = currentWidths ? currentWidths[i] : 1;
      h += '<div style="flex:' + flex + ' 1 0%;min-width:0;border:1px solid ' + BORDER +
        ';padding:5px 6px;font-weight:700;text-align:center;word-break:break-all">' + esc(th) + "</div>";
    });
    return h + "</div>";
  }
  function row(cells, opts) {
    opts = opts || {};
    let h = '<div class="rep-row" style="display:flex' + (opts.bg ? ";background:" + opts.bg : "") + '">';
    cells.forEach(function (c, i) {
      const flex = currentWidths ? currentWidths[i] : 1;
      /* 统一转义防特殊字符破坏结构；break-all 让长数字(学籍号)在窄列内折行 */
      h += '<div style="flex:' + flex + ' 1 0%;min-width:0;border:1px solid ' + BORDER +
        ';padding:5px 6px;text-align:center;word-break:break-all">' + esc(c) + "</div>";
    });
    return h + "</div>";
  }
  function tableEnd() { currentWidths = null; return "</div></div>"; }
  /* 从PNG base64头解析宽高（IHDR），给图片固定高度——避免异步解码导致的布局跳动 */
  function pngDims(base64) {
    try {
      const raw = atob(base64.split(",").pop());
      const w = ((raw.charCodeAt(16) << 24) | (raw.charCodeAt(17) << 16) | (raw.charCodeAt(18) << 8) | raw.charCodeAt(19)) >>> 0;
      const h = ((raw.charCodeAt(20) << 24) | (raw.charCodeAt(21) << 16) | (raw.charCodeAt(22) << 8) | raw.charCodeAt(23)) >>> 0;
      return w > 0 && h > 0 ? { w: w, h: h } : null;
    } catch (e) {
      return null;
    }
  }
  function img(base64, w) {
    const dims = base64 ? pngDims(base64) : null;
    const h = dims ? Math.round(w * dims.h / dims.w) : null;
    return block('<div style="text-align:center"><img src="' + base64 + '" style="width:' + (w || 560) + 'px' +
      (h ? ";height:" + h + "px" : "") + '"></div>', "", "padding:8px 0");
  }
  function dash(v) { return v === null || v === undefined ? "—" : v; }
  function pct(v) { return v === null || v === undefined ? "—" : v + "%"; }

  /* ---- 班级报告 ---- */
  /* opts: {className, teacher, batch, stats, charts:{pie,bar,hist}, weakAll, weakMale, weakFemale, suggestions, plan, planOnly}
     planOnly=true 时只输出训练计划部分（训练计划页的PDF导出用）。 */
  R.classReportHTML = function (opts) {
    const S = FCS.scoring;
    const U = FCS.util;
    const stats = opts.stats;
    const defs = FCS.charts.axisDefs();
    let h = "";

    h += h1(opts.className + (opts.planOnly ? " 训练计划" : " 体质测试分析报告"));
    h += sub((opts.batch ? opts.batch.name + "（" + opts.batch.testDate + "）　·　" : "") + "教师：" + (opts.teacher || "—") + "　·　生成日期：" + U.nowStamp());

    if (opts.planOnly) {
      /* 只保留训练计划部分 */
      if (opts.plan && opts.plan.planWeeks) {
        h += h2("训练计划（每周1次体育课，共" + opts.plan.weeks + "周）");
        opts.plan.planWeeks.forEach(function (wk) {
          h += h3("第" + wk.week + "周　" + wk.theme);
          h += p("● 热身（10分钟）", BLUE);
          wk.warmup.forEach(function (w) { h += p(esc(w)); });
          h += p("● 主体训练（25分钟）", BLUE);
          wk.main.forEach(function (block) {
            if (block.genderLabel) h += p("— " + esc(block.genderLabel) + " —", DARK);
            if (block.entries) {
              block.entries.forEach(function (e) {
                h += p("· " + esc(e.title) + "：" + esc(e.steps) + "（" + esc(e.dosage) + (e.notes ? "；" + esc(e.notes) : "") + "）");
              });
            }
            if (block.items) block.items.forEach(function (it) { h += p("· " + esc(it)); });
          });
          h += p("● 放松整理（5分钟）", BLUE);
          wk.cooldown.forEach(function (w) { h += p(esc(w)); });
          h += p("● 课后作业", BLUE);
          wk.homework.forEach(function (w) { h += p("· " + esc(w)); });
        });
      }
      return h;
    }

    /* 一、总体情况 */
    h += h2("一、班级总体情况");
    const mkStatRow = function (label, st) {
      return [label, st.count, st.completeCount, st.avg !== null ? st.avg : "—", pct(st.passRate), pct(st.goodRate), st.excellentCount, st.gradeDist["不及格"], st.incompleteCount];
    };
    h += tableStart(["", "人数", "完整录入", "平均分", "及格率", "优良率", "优秀人数", "不及格", "缺项"]);
    h += row(mkStatRow("全班", stats.total));
    h += row(mkStatRow("男生", stats.male));
    h += row(mkStatRow("女生", stats.female));
    h += tableEnd();
    h += tableStart(["等级", "优秀", "良好", "及格", "不及格"]);
    h += row(["人数", stats.total.gradeDist["优秀"], stats.total.gradeDist["良好"], stats.total.gradeDist["及格"], stats.total.gradeDist["不及格"]]);
    h += tableEnd();
    if (opts.charts && opts.charts.pie) h += img(opts.charts.pie, 600);

    /* 二、各项目得分明细（与班级分析页一致，含权重）
       项目列≈6.5个中文字符宽（约15%），保证"1000米跑（男）"等名称单行显示；其余列短内容单行，行高统一 */
    h += h2("二、各项目得分明细");
    h += tableStart(["项目", "权重", "男生平均分", "女生平均分", "全班平均分", "男生及格率", "女生及格率", "全班及格率"],
      [1.25, 1, 1, 1, 1, 1, 1, 1]);
    defs.forEach(function (d) {
      const it = stats.items[d.key][d.gender];
      const m = stats.items[d.key].male;
      const f = stats.items[d.key].female;
      h += row([
        d.label,
        (S.itemMeta[d.key].weight * 100) + "%",
        d.gender === "female" ? "—" : dash(m.avgScore),
        d.gender === "male" ? "—" : dash(f.avgScore),
        dash(it.avgScore),
        d.gender === "female" ? "—" : pct(m.passRate),
        d.gender === "male" ? "—" : pct(f.passRate),
        pct(it.passRate),
      ]);
    });
    h += tableEnd();
    if (opts.charts && opts.charts.bar) h += img(opts.charts.bar, 640);
    if (opts.charts && opts.charts.hist) h += img(opts.charts.hist, 420);
    if (opts.charts && opts.charts.radar) h += img(opts.charts.radar, 560);

    /* 三、优劣势与建议 */
    h += h2("三、优势项目与薄弱项目分析");
    const weakBlocks = [
      { label: "全班", data: opts.weakAll },
      { label: "男生", data: opts.weakMale },
      { label: "女生", data: opts.weakFemale },
    ];
    weakBlocks.forEach(function (wb) {
      if (!wb.data) return;
      h += h3(wb.label);
      if (wb.data.weaknesses && wb.data.weaknesses.length) {
        h += p("薄弱项目：", RED);
        /* 项目1/4、平均分1/8、及格率1/8、判定理由1/2（用户确认比例） */
        h += tableStart(["项目", "平均分", "及格率", "判定理由"], [2, 1, 1, 4]);
        wb.data.weaknesses.forEach(function (w) {
          h += row([w.label, w.avgScore, pct(w.passRate), w.reason]);
        });
        h += tableEnd();
      } else {
        h += p("无明显薄弱项目，整体表现均衡。", GREEN);
      }
      if (wb.data.strengths && wb.data.strengths.length) {
        h += p("优势项目：", GREEN);
        h += tableStart(["项目", "平均分", "及格率", "判定理由"], [2, 1, 1, 4]);
        wb.data.strengths.forEach(function (w) {
          h += row([w.label, w.avgScore, pct(w.passRate), w.reason]);
        });
        h += tableEnd();
      }
    });
    if (opts.suggestions && opts.suggestions.length) {
      h += h3("训练建议");
      opts.suggestions.forEach(function (s) { h += p(esc(s)); });
    }

    /* 四、训练计划 */
    if (opts.plan && opts.plan.planWeeks) {
      h += h2("四、训练计划（每周1次体育课，共" + opts.plan.weeks + "周）");
      opts.plan.planWeeks.forEach(function (wk) {
        h += h3("第" + wk.week + "周　" + wk.theme);
        h += p("● 热身（10分钟）", BLUE);
        wk.warmup.forEach(function (w) { h += p(esc(w)); });
        h += p("● 主体训练（25分钟）", BLUE);
        wk.main.forEach(function (block) {
          if (block.genderLabel) h += p("— " + esc(block.genderLabel) + " —", DARK);
          if (block.entries) {
            block.entries.forEach(function (e) {
              h += p("· " + esc(e.title) + "：" + esc(e.steps) + "（" + esc(e.dosage) + (e.notes ? "；" + esc(e.notes) : "") + "）");
            });
          }
          if (block.items) block.items.forEach(function (it) { h += p("· " + esc(it)); });
        });
        h += p("● 放松整理（5分钟）", BLUE);
        wk.cooldown.forEach(function (w) { h += p(esc(w)); });
        h += p("● 课后作业", BLUE);
        wk.homework.forEach(function (w) { h += p("· " + esc(w)); });
      });
    }

    /* 五、学生成绩明细（可选：仅在需要完整名单时开启 opts.includeDetail） */
    if (opts.includeDetail) {
      h += h2("五、学生成绩明细");
      const computed = stats.computed.slice().sort(function (a, b) {
        if (a.complete !== b.complete) return a.complete ? -1 : 1;
        return (b.total || 0) - (a.total || 0);
      });
      const detailHeaders = ["排名", "学籍号", "姓名", "性别"].concat(defs.map(function (d) { return d.label; }), ["总分", "等级"]);
      h += tableStart(detailHeaders, [4, 12, 7, 4, 7, 6, 6, 6, 7, 7, 7, 7, 7, 5, 5]);
      computed.forEach(function (x, i) {
        const cells = [i + 1, x.studentNo, x.name, x.gender === "male" ? "男" : "女"];
        defs.forEach(function (d) {
          if (d.gender !== "all" && d.gender !== x.gender) { cells.push("—"); return; }
          cells.push(x.itemScores[d.key] !== null ? x.itemScores[d.key] : "—");
        });
        cells.push(x.total !== null ? x.total : "缺项");
        cells.push(x.grade || "—");
        h += row(cells, { bg: !x.complete ? "#fdf2f2" : null });
      });
      h += tableEnd();
    }
    return h;
  };

  /* ---- 对比分析报告 ---- */
  /* opts: mode 'long'|'interclass'
     long: {className, batchA, batchB, cmp, chartPng, searchText, detailList, part}
       part: 'all'(完整) | 'summary'(本页其他项目=总体变化+图表) | 'improved'(进步名单)
           | 'declined'(退步名单) | 'detail'(每名学生变化明细)
     interclass: {pairs(compareClasses结果), classChartPng} */
  R.compareReportHTML = function (opts) {
    const U = FCS.util;
    const defs = FCS.charts.axisDefs();
    const part = opts.part || "all";
    const num = part === "all" ? { summary: "一、总体变化", improved: "二、进步名单", declined: "三、退步名单", detail: "四、每名学生变化明细" } : null;
    let h = "";
    if (opts.mode === "long") {
      const cmp = opts.cmp;
      if (!opts.skipHeader) {
        h += h1(opts.className + " 纵向对比分析报告" + (part !== "all" ? "（" + ({ summary: "总体变化+图表", improved: "进步名单", declined: "退步名单", detail: "每名学生变化明细" }[part] || "") + "）" : ""));
        h += sub("对比批次：" + opts.batchA.name + "（" + opts.batchA.testDate + "）　→　" +
          opts.batchB.name + "（" + opts.batchB.testDate + "）　·　生成日期：" + U.nowStamp() +
          (opts.searchText ? "　·　筛选条件：" + opts.searchText : ""));
      }

      if (part === "all" || part === "summary") {
        h += h2(num ? num.summary : "总体变化");
        h += tableStart(["对比项", "上次", "本次", "变化"]);
        h += row(["全班平均分", cmp.statsA.total.avg !== null ? cmp.statsA.total.avg : "—",
          cmp.statsB.total.avg !== null ? cmp.statsB.total.avg : "—",
          cmp.classAvgDelta !== null ? (cmp.classAvgDelta > 0 ? "+" : "") + cmp.classAvgDelta : "—"]);
        h += row(["及格率", pct(cmp.statsA.total.passRate), pct(cmp.statsB.total.passRate),
          cmp.statsB.total.passRate !== null && cmp.statsA.total.passRate !== null
            ? ((cmp.statsB.total.passRate - cmp.statsA.total.passRate) > 0 ? "+" : "") + Math.round((cmp.statsB.total.passRate - cmp.statsA.total.passRate) * 10) / 10 + "%"
            : "—"]);
        h += row(["对比学生数", cmp.matched.length, "", ""]);
        h += row(["进步人数（总分提高≥1分）", cmp.improved.length, "", ""]);
        h += row(["退步人数（总分下降≥1分）", cmp.declined.length, "", ""]);
        h += tableEnd();
        if (opts.chartPng) h += img(opts.chartPng, opts.wideChart ? 1000 : 640);
      }

      const mkNameList = function (title, list) {
        h += h2(title + "（共 " + list.length + " 人）");
        if (!list.length) { h += p("无", "#8aa5c2"); return; }
        h += tableStart(["学籍号", "姓名", "上次总分", "本次总分", "变化"]);
        list.forEach(function (m) {
          h += row([m.studentNo, m.name,
            m.before.total !== null ? m.before.total : "缺项",
            m.after.total !== null ? m.after.total : "缺项",
            m.totalDelta !== null ? (m.totalDelta > 0 ? "+" : "") + m.totalDelta : "—"]);
        });
        h += tableEnd();
      };
      if (part === "all" || part === "improved") mkNameList(num ? num.improved : "进步名单", cmp.improved);
      if (part === "all" || part === "declined") mkNameList(num ? num.declined : "退步名单", cmp.declined);

      if (part === "all" || part === "detail") {
        h += h2((num ? num.detail : "每名学生变化明细") + (opts.searchText ? "（筛选：" + opts.searchText + "，共 " + opts.detailList.length + " 人）" : ""));
        const detailHeaders = ["学籍号", "姓名", "性别"].concat(defs.map(function (d) { return d.label; }), ["上次总分", "本次总分", "变化"]);
        h += tableStart(detailHeaders);
        opts.detailList.forEach(function (m) {
          const cells = [m.studentNo, m.name, m.gender === "male" ? "男" : "女"];
          defs.forEach(function (d) {
            const delta = (d.gender !== "all" && d.gender !== m.gender) ? null : m.itemDeltas[d.key];
            cells.push(delta !== null ? (delta > 0 ? "+" : "") + delta : "—");
          });
          cells.push(m.before.total !== null ? m.before.total : "缺项",
            m.after.total !== null ? m.after.total : "缺项",
            m.totalDelta !== null ? (m.totalDelta > 0 ? "+" : "") + m.totalDelta : "—");
          h += row(cells);
        });
        h += tableEnd();
      }
    } else {
      h += h1("班级横向对比分析报告");
      h += sub("对比班级（使用各班最新测试批次）　·　生成日期：" + U.nowStamp());
      if (opts.classChartPng) h += img(opts.classChartPng, opts.wideChart ? 1000 : 640);
      h += tableStart(["班级", "批次", "人数", "平均分", "及格率", "优良率", "优秀人数"]);
      opts.pairs.forEach(function (c) {
        h += row([c.className, c.batchName, c.count,
          c.avg !== null ? c.avg : "—", pct(c.passRate), pct(c.goodRate), c.excellentCount]);
      });
      h += tableEnd();
    }
    return h;
  };

  /* ---- 个人报告 ---- */
  /* opts: {rep, className, batchName, suggestions, radarPng, compare} */
  R.studentReportHTML = function (opts) {
    const S = FCS.scoring;
    const U = FCS.util;
    const rep = opts.rep;
    let h = "";

    h += h1(rep.name + " 体测个人报告");
    h += sub((opts.className || "") + (opts.batchName ? "　·　" + opts.batchName : "") + "　·　生成日期：" + U.nowStamp());

    h += h2("一、基本信息与总体成绩");
    h += tableStart(["学籍号", "姓名", "性别", "总分", "等级", "班级排名", "性别排名"]);
    h += row([rep.studentNo, rep.name, rep.gender === "male" ? "男" : "女",
      rep.total !== null ? rep.total : "缺项", rep.grade || "—",
      rep.classRank ? rep.classRank + "/" + rep.classCount : "—",
      rep.genderRank ? rep.genderRank + "/" + rep.genderCount : "—"]);
    h += tableEnd();

    h += h2("二、各项目得分");
    h += tableStart(["项目", "原始成绩", "得分", "权重"]);
    const rawShow = function (s, k) {
      const raw = s.raw || {};
      if (k === "endurance") return raw.endurance ? raw.endurance.display : "—";
      if (k === "bmi") return raw.height && raw.weight ? raw.height + "cm / " + raw.weight + "kg" : "—";
      if (raw[k] === null || raw[k] === undefined) return "—";
      return String(raw[k]);
    };
    S.items.forEach(function (k) {
      h += row([S.itemLabel(k, rep.gender), rawShow(rep, k), rep.itemScores[k] !== null ? rep.itemScores[k] : "—", (S.itemMeta[k].weight * 100) + "%"]);
    });
    h += tableEnd();
    h += p("BMI：" + (rep.bmi !== null ? rep.bmi : "—"), "#5a7a9c");
    if (opts.radarPng) h += img(opts.radarPng, 460);

    h += h2("三、薄弱项目与训练建议");
    const must = rep.weakItems.must, rel = rep.weakItems.relative;
    if (must.length) {
      h += p("必练项目（低于60分）：", RED);
      h += tableStart(["项目", "得分"]);
      must.forEach(function (w) { h += row([S.itemLabel(w.key, rep.gender), w.score]); });
      h += tableEnd();
    }
    if (rel.length) {
      h += p("相对薄弱项目：", "#a06f00");
      h += tableStart(["项目", "得分", "低于个人总分"]);
      rel.forEach(function (w) { h += row([S.itemLabel(w.key, rep.gender), w.score, w.gap + " 分"]); });
      h += tableEnd();
    }
    if (!must.length && !rel.length) h += p("各项目均衡发展，继续保持！", GREEN);
    (opts.suggestions || []).forEach(function (s) { h += p(esc(s)); });

    if (opts.compare) {
      h += h2("四、与上次测试对比（" + esc(opts.compare.batchName) + "）");
      const c = opts.compare;
      h += tableStart(["对比项", "上次总分", "本次总分", "变化"]);
      const dd = function (v) { return v !== null ? (v > 0 ? "+" : "") + v : "—"; };
      h += row(["总分", c.before.total !== null ? c.before.total : "缺项", c.after.total !== null ? c.after.total : "缺项", dd(c.totalDelta)]);
      h += tableEnd();
      const defs = FCS.charts.axisDefs();
      h += tableStart(["项目变化"].concat(defs.map(function (d) { return d.label; })));
      const cells = ["变化"];
      defs.forEach(function (d) {
        const delta = (d.gender !== "all" && d.gender !== rep.gender) ? null : c.itemDeltas[d.key];
        cells.push(delta !== null ? (delta > 0 ? "+" : "") + delta : "—");
      });
      h += row(cells);
      h += tableEnd();
    }
    return h;
  };

  FCS.report = R;
})();
