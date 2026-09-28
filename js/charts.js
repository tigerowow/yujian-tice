/* charts.js — ECharts 封装：统一淡蓝主题、图表工厂 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const C = {};

  /* 统一配色 */
  C.COLORS = {
    male: "#2a78d6",
    female: "#eb6834",
    grades: { 优秀: "#0ca30c", 良好: "#2a78d6", 及格: "#fab219", 不及格: "#d03b3b" },
    up: "#006300",
    down: "#d03b3b",
    blue: "#2a78d6",
    series: ["#2a78d6", "#eb6834", "#0ca30c", "#fab219", "#6ba3e8", "#8a5cd6", "#d03b3b", "#3ba7a0"],
  };

  /* 图表实例管理：切换视图时全部销毁 */
  C._charts = [];
  C.create = function (dom) {
    const chart = echarts.init(dom, null, { renderer: "canvas" });
    C._charts.push(chart);
    return chart;
  };
  C.disposeAll = function () {
    C._charts.forEach(function (ch) {
      try { ch.dispose(); } catch (e) { /* ignore */ }
    });
    C._charts = [];
  };

  /* 底部有图例时，为图例预留专门空间（避免图例压住横轴标签） */
  const GRID_WITH_LEGEND = { left: 8, right: 16, top: 36, bottom: 44, containLabel: true };
  const FONT = '"Segoe UI","微软雅黑",system-ui,sans-serif';
  /* 横轴标签样式：9个分类全部显示；男女专属项目的"（男）/（女）"换行到项目名下一行并居中 */
  const AXIS_LABEL = {
    interval: 0,
    fontSize: 10.5,
    lineHeight: 12,
    formatter: function (v) {
      const m = String(v).match(/^(.+?)（(男|女)）$/);
      return m ? m[1] + "\n（" + m[2] + "）" : v;
    },
  };

  /* 项目分类定义：公共5项用全体数据；耐力跑/力量按性别拆分为男女两项 */
  C.axisDefs = function () {
    const S = FCS.scoring;
    const defs = [];
    ["bmi", "vitalCapacity", "run50", "standJump", "sitReach"].forEach(function (k) {
      defs.push({ label: S.itemLabel(k, "male"), key: k, gender: "all" });
    });
    defs.push({ label: S.itemLabel("endurance", "male") + "（男）", key: "endurance", gender: "male" });
    defs.push({ label: S.itemLabel("strength", "male") + "（男）", key: "strength", gender: "male" });
    defs.push({ label: S.itemLabel("endurance", "female") + "（女）", key: "endurance", gender: "female" });
    defs.push({ label: S.itemLabel("strength", "female") + "（女）", key: "strength", gender: "female" });
    return defs;
  };

  /* 等级分布环图 */
  C.renderGradePie = function (dom, gradeDist) {
    const chart = C.create(dom);
    const data = Object.keys(gradeDist).map(function (g) {
      return { name: g, value: gradeDist[g], itemStyle: { color: C.COLORS.grades[g] } };
    });
    chart.setOption({
      animation: false,
      textStyle: { fontFamily: FONT },
      title: { text: "等级分布", left: "center", top: 0, textStyle: { fontSize: 14, color: "#1f3a57" } },
      tooltip: { trigger: "item", formatter: "{b}：{c} 人（{d}%）" },
      legend: { bottom: 0, left: "center" },
      series: [{
        type: "pie", radius: ["42%", "66%"], center: ["50%", "52%"],
        label: { formatter: "{b}\n{c}人" },
        data: data,
      }],
    });
    return chart;
  };

  /* 各项目平均分条形图（custom系列精确控制柱位）：
     公共项目 → 男生/女生两柱分列左右；男女专属项目 → 单柱居中于项目名称。
     柱宽随绘图区宽度自适应（半宽卡片下变细，保证相邻项目不重叠）。
     系列级颜色保证图例图标正确：蓝色=男生，橙色=女生。 */
  C.renderItemBar = function (dom, itemStats, opts) {
    opts = opts || {};
    const chart = C.create(dom);
    const defs = C.axisDefs();
    const cats = defs.map(function (d) { return d.label; });
    const mkSeries = function (name, gender) {
      return {
        type: "custom",
        name: name,
        itemStyle: { color: gender === "male" ? C.COLORS.male : C.COLORS.female },
        data: defs.map(function (d) { return { label: d.label, key: d.key, gender: d.gender }; }),
        renderItem: function (params, api) {
          try {
            const d = defs[params.dataIndex];
            /* 专属分类只由对应性别的系列绘制 */
            if (d.gender !== "all" && d.gender !== gender) return { type: "group", children: [] };
            const v = itemStats[d.key][gender].avgScore;
            if (v === null || v === undefined) return { type: "group", children: [] };
            const px = api.coord([params.dataIndex, v]);
            const py = api.coord([params.dataIndex, 0]);
            const h = py[1] - px[1];
            if (!(h > 0)) return { type: "group", children: [] };
            /* 自适应柱宽：随绘图区宽度缩放，保证相邻项目之间留白 */
            const band = Math.max(40, api.getWidth() / defs.length);
            const barW = Math.max(12, Math.min(26, Math.round(band * 0.25)));
            const gap = Math.max(4, Math.round(barW * 0.35));
            /* 公共分类双柱分列左右；专属分类单柱居中 */
            const x = d.gender === "all"
              ? px[0] + (gender === "male" ? -(barW + gap / 2) : gap / 2)
              : px[0] - barW / 2;
            return {
              type: "rect",
              shape: { x: x, y: px[1], width: barW, height: h, r: [2, 2, 0, 0] },
              style: api.style(),
            };
          } catch (e) {
            return { type: "group", children: [] };
          }
        },
      };
    };
    const option = {
      animation: false,
      textStyle: { fontFamily: FONT },
      title: { text: opts.title || "各项目平均得分", left: "center", top: 0, textStyle: { fontSize: 14, color: "#1f3a57" } },
      tooltip: {
        trigger: "axis",
        formatter: function (params) {
          const lines = [];
          (params || []).forEach(function (p) {
            if (!p.value || !p.value.key) return;
            const v = itemStats[p.value.key][p.seriesName === "男生" ? "male" : "female"].avgScore;
            if (v !== null && v !== undefined) lines.push(p.seriesName + "：" + v + " 分");
          });
          return lines.join("<br>");
        },
      },
      legend: { bottom: 0 },
      grid: GRID_WITH_LEGEND,
      xAxis: { type: "category", data: cats, axisLabel: AXIS_LABEL },
      yAxis: { type: "value", min: 0, max: 100, name: "分" },
      series: [mkSeries("男生", "male"), mkSeries("女生", "female")],
    };
    chart.setOption(option);
    return chart;
  };

  /* 总分分布直方图：显式区间 + 计数数组（最稳妥的写法），无数据时显示提示 */
  C.renderHistogram = function (dom, totals) {
    const chart = C.create(dom);
    const bins = ["<50", "50-59", "60-69", "70-79", "80-89", "90-100"];
    const counts = [0, 0, 0, 0, 0, 0];
    (totals || []).forEach(function (t) {
      if (t < 50) counts[0]++;
      else if (t < 60) counts[1]++;
      else if (t < 70) counts[2]++;
      else if (t < 80) counts[3]++;
      else if (t < 90) counts[4]++;
      else counts[5]++;
    });
    const option = {
      animation: false,
      textStyle: { fontFamily: FONT },
      title: { text: "总分分布", left: "center", top: 0, textStyle: { fontSize: 14, color: "#1f3a57" } },
      tooltip: { trigger: "axis" },
      /* 右侧多留空间，供X轴名称"总分区间"放在轴右端显示（与Y轴"人数"对应） */
      grid: { left: 8, right: 40, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: "category", data: bins,
        name: "总分", nameLocation: "end", nameGap: 6,
        nameTextStyle: { align: "left", verticalAlign: "middle" },
        axisLabel: { fontSize: 12 },
      },
      yAxis: { type: "value", min: 0, name: "人数", minInterval: 1 },
      series: [{
        name: "人数", type: "bar",
        data: counts,
        barMaxWidth: 44,
        itemStyle: { color: C.COLORS.blue },
      }],
    };
    if (!totals || !totals.length) {
      option.graphic = {
        type: "text", left: "center", top: "middle",
        style: { text: "暂无完整录入的学生成绩", fill: "#8aa5c2", fontSize: 14 },
      };
    }
    chart.setOption(option);
    return chart;
  };

  /* 雷达图。indicators: [{name,max}]；seriesList: [{name, values(与indicators对齐的数组), color}] */
  C.renderRadar = function (dom, indicators, seriesList, opts) {
    opts = opts || {};
    const chart = C.create(dom);
    chart.setOption({
      animation: false,
      textStyle: { fontFamily: FONT },
      title: { text: opts.title || "各项目得分雷达", left: "center", top: 0, textStyle: { fontSize: 14, color: "#1f3a57" } },
      tooltip: {},
      legend: seriesList.length > 1 ? { bottom: 0 } : undefined,
      radar: {
        indicator: indicators,
        radius: "62%",
        axisName: { fontSize: 12 },
      },
      series: [{
        type: "radar",
        data: seriesList.map(function (s) {
          return {
            name: s.name,
            value: s.values,
            areaStyle: seriesList.length > 1 ? { opacity: 0.08 } : { opacity: 0.25 },
            itemStyle: { color: s.color || C.COLORS.blue },
            lineStyle: { color: s.color || C.COLORS.blue },
          };
        }),
      }],
    });
    return chart;
  };

  /* 前后两批次项目平均分对比（纵向）。
     分类含男女专属项目：公共项目用全体平均分，1000米跑（男）/800米跑（女）等按性别取值。 */
  C.renderCompareBars = function (dom, statsA, statsB, opts) {
    opts = opts || {};
    const chart = C.create(dom);
    const defs = C.axisDefs();
    const cats = defs.map(function (d) { return d.label; });
    const beforeVals = defs.map(function (d) { return statsA.items[d.key][d.gender].avgScore; });
    const afterVals = defs.map(function (d) { return statsB.items[d.key][d.gender].avgScore; });
    chart.setOption({
      animation: false,
      textStyle: { fontFamily: FONT },
      title: { text: opts.title || "前后各项目平均分对比", left: "center", top: 0, textStyle: { fontSize: 14, color: "#1f3a57" } },
      tooltip: { trigger: "axis", valueFormatter: function (v) { return v === null ? "—" : v + " 分"; } },
      legend: { bottom: 0 },
      grid: GRID_WITH_LEGEND,
      xAxis: { type: "category", data: cats, axisLabel: AXIS_LABEL },
      yAxis: { type: "value", min: 0, max: 100, name: "分" },
      series: [
        { name: opts.labelA || "上次", type: "bar", data: beforeVals, itemStyle: { color: "#9db9d9" } },
        { name: opts.labelB || "本次", type: "bar", data: afterVals, itemStyle: { color: C.COLORS.blue } },
      ],
    });
    return chart;
  };

  /* 班级间对比条形图：平均分与及格率并列柱形（避免折线压住柱子） */
  C.renderClassBar = function (dom, classStats, opts) {
    opts = opts || {};
    const chart = C.create(dom);
    const names = classStats.map(function (c) { return c.className; });
    chart.setOption({
      animation: false,
      textStyle: { fontFamily: FONT },
      title: { text: opts.title || "班级平均分对比", left: "center", top: 0, textStyle: { fontSize: 14, color: "#1f3a57" } },
      tooltip: { trigger: "axis" },
      legend: { bottom: 0 },
      grid: GRID_WITH_LEGEND,
      xAxis: {
        type: "category", data: names,
        axisLabel: {
          interval: 0, fontSize: 12, hideOverlap: true,
          formatter: function (v) { const s = String(v); return s.length > 9 ? s.slice(0, 8) + "…" : s; },
        },
      },
      yAxis: { type: "value", min: 0, max: 100, name: "分" },
      series: [
        { name: "平均分", type: "bar", barMaxWidth: 40, data: classStats.map(function (c) { return c.avg; }), itemStyle: { color: C.COLORS.blue } },
        { name: "及格率(%)", type: "bar", barMaxWidth: 40, data: classStats.map(function (c) { return c.passRate; }), itemStyle: { color: "#8ab8e8" } },
      ],
    });
    return chart;
  };

  /* 图表转 PNG：等待图表完成首次渲染后再截图（避免截到空白图）。
     返回 Promise<string|null>。 */
  C.getPng = function (chart) {
    return new Promise(function (resolve) {
      let done = false;
      const capture = function () {
        if (done) return;
        done = true;
        try {
          resolve(chart.getDataURL({
            type: "png",
            pixelRatio: 2,
            backgroundColor: "#ffffff",
            excludeComponents: ["toolbox"],
          }));
        } catch (e) {
          resolve(null); /* 图表已销毁等情况 */
        }
      };
      try {
        if (chart.isDisposed && chart.isDisposed()) { resolve(null); return; }
        chart.on("rendered", function () { setTimeout(capture, 60); });
        setTimeout(capture, 600); /* 兜底：已渲染完成的图表直接截图 */
      } catch (e) {
        resolve(null);
      }
    });
  };

  FCS.charts = C;
})();
