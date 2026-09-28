/* analysis.js — 统计分析：班级统计、薄弱项判定、纵向/横向/班际对比 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const A = {};

  /* 薄弱项判定阈值（集中便于调参） */
  A.TH = {
    passRateThreshold: 70,   // 及格率低于该百分比视为薄弱
    belowAvgOffset: 5,       // 项目平均分低于各项目均分该分值视为薄弱
    strongAvg: 85,           // 优势项平均分下限
    strongPassRate: 95,      // 优势项及格率下限
    topN: 2,                 // 平均分最高/最低的N项
    deltaThreshold: 1,       // 前后对比计入进步/退步名单的最小总分变化
    personalBelowTotal: 10,  // 个人相对薄弱：低于个人总分该分值
  };

  /* 学生计算结果的完整包装（计算+元信息） */
  A.computeStudent = function (s) {
    const c = FCS.scoring.computeAll(s.gender, s.raw);
    return {
      id: s.id, studentNo: s.studentNo, name: s.name, gender: s.gender,
      raw: s.raw, bmi: c.bmi, itemScores: c.itemScores, total: c.total,
      grade: c.grade, missing: c.missing, complete: c.complete,
    };
  };

  /* 批次内全部学生计算结果 */
  A.computeBatch = function (batch) {
    return batch.students.map(A.computeStudent);
  };

  /* ---- 班级统计 ---- */
  A.batchStats = function (batch) {
    const computed = A.computeBatch(batch);
    const mkStats = function (list) {
      const complete = list.filter(function (x) { return x.complete; });
      const n = complete.length;
      let sum = 0, pass = 0, good = 0, excellent = 0;
      const gradeDist = { 优秀: 0, 良好: 0, 及格: 0, 不及格: 0 };
      complete.forEach(function (x) {
        sum += x.total;
        if (x.total >= 60) pass++;
        if (x.total >= 80) good++;
        if (x.total >= 90) excellent++;
        gradeDist[x.grade]++;
      });
      return {
        count: list.length,
        completeCount: n,
        incompleteCount: list.length - n,
        avg: n ? Math.round((sum / n) * 10) / 10 : null,
        passRate: n ? Math.round((pass / n) * 1000) / 10 : null,
        goodRate: n ? Math.round((good / n) * 1000) / 10 : null,
        excellentCount: excellent,
        gradeDist: gradeDist,
      };
    };
    const total = mkStats(computed);
    const male = mkStats(computed.filter(function (x) { return x.gender === "male"; }));
    const female = mkStats(computed.filter(function (x) { return x.gender === "female"; }));

    /* 各项目统计（按性别拆分）：只有填写了该项目（得分非null）的学生计入 */
    const items = {};
    const mkItem = function (key, list) {
      const scores = list.map(function (x) { return x.itemScores[key]; })
        .filter(function (v) { return v !== null; });
      const n = scores.length;
      if (!n) return { count: 0, avgScore: null, passRate: null };
      let sum = 0, pass = 0;
      scores.forEach(function (v) { sum += v; if (v >= 60) pass++; });
      return {
        count: n,
        avgScore: Math.round((sum / n) * 10) / 10,
        passRate: Math.round((pass / n) * 1000) / 10,
      };
    };
    FCS.scoring.items.forEach(function (key) {
      items[key] = {
        all: mkItem(key, computed),
        male: mkItem(key, computed.filter(function (x) { return x.gender === "male"; })),
        female: mkItem(key, computed.filter(function (x) { return x.gender === "female"; })),
      };
    });

    /* 排名（按总分降序，缺项排最后） */
    const sortList = computed.slice().sort(function (a, b) {
      if (a.complete !== b.complete) return a.complete ? -1 : 1;
      return (b.total || 0) - (a.total || 0);
    });
    const mkRank = function (list) {
      return list.slice().sort(function (a, b) {
        if (a.complete !== b.complete) return a.complete ? -1 : 1;
        return (b.total || 0) - (a.total || 0);
      });
    };
    const ranked = mkRank(computed);
    const maleRanked = mkRank(computed.filter(function (x) { return x.gender === "male"; }));
    const femaleRanked = mkRank(computed.filter(function (x) { return x.gender === "female"; }));
    const mkRankMap = function (list) {
      const m = {};
      list.forEach(function (x, i) { m[x.id] = i + 1; });
      return m;
    };
    const rankMap = mkRankMap(ranked);
    const maleRankMap = mkRankMap(maleRanked);
    const femaleRankMap = mkRankMap(femaleRanked);

    return {
      total: total, male: male, female: female,
      items: items,
      computed: computed,
      rankMap: rankMap, maleRankMap: maleRankMap, femaleRankMap: femaleRankMap,
      totals: computed.filter(function (x) { return x.complete; }).map(function (x) { return x.total; }),
    };
  };

  /* ---- 薄弱项/优势项判定 ---- */
  /* opts.gender: 'all'|'male'|'female' */
  A.weakItems = function (stats, opts) {
    opts = opts || {};
    const gender = opts.gender || "all";
    const S = FCS.scoring;
    const th = A.TH;
    const entries = [];
    S.items.forEach(function (key) {
      const item = stats.items[key][gender];
      if (!item.count) return;
      entries.push({ key: key, avgScore: item.avgScore, passRate: item.passRate, count: item.count });
    });
    if (!entries.length) return { strengths: [], weaknesses: [] };
    const meanOfAvgs = entries.reduce(function (s, e) { return s + e.avgScore; }, 0) / entries.length;
    const sortedAsc = entries.slice().sort(function (a, b) { return a.avgScore - b.avgScore; });
    const sortedDesc = entries.slice().sort(function (a, b) { return b.avgScore - a.avgScore; });

    const mkReason = function (e, reasons) {
      const label = S.itemLabel(e.key, gender === "male" ? "male" : gender === "female" ? "female" : null);
      return {
        key: e.key, label: label, avgScore: e.avgScore, passRate: e.passRate, count: e.count,
        reason: reasons.join("；"),
      };
    };

    const weaknesses = [], strengths = [];
    const topNWeak = sortedAsc.slice(0, th.topN);
    const topNStrong = sortedDesc.slice(0, th.topN);
    sortedAsc.forEach(function (e) {
      const reasons = [];
      let isWeak = false;
      if (topNWeak.indexOf(e) >= 0) { reasons.push("班级平均分最低项目之一"); isWeak = true; }
      if (e.passRate < th.passRateThreshold) { reasons.push("及格率仅 " + e.passRate + "%（低于 " + th.passRateThreshold + "%）"); isWeak = true; }
      if (e.avgScore < meanOfAvgs - th.belowAvgOffset) {
        reasons.push("平均分 " + e.avgScore + " 分，比各项目均分 " + (Math.round(meanOfAvgs * 10) / 10) + " 低 " + (Math.round((meanOfAvgs - e.avgScore) * 10) / 10) + " 分");
        isWeak = true;
      }
      if (isWeak) weaknesses.push(mkReason(e, reasons));
    });
    sortedDesc.forEach(function (e) {
      const reasons = [];
      let isStrong = false;
      if (topNStrong.indexOf(e) >= 0) { reasons.push("班级平均分最高项目之一"); isStrong = true; }
      if (e.avgScore >= th.strongAvg && e.passRate >= th.strongPassRate) {
        reasons.push("平均分 " + e.avgScore + " 分、及格率 " + e.passRate + "%");
        isStrong = true;
      }
      if (isStrong) strengths.push(mkReason(e, reasons));
    });
    return { strengths: strengths, weaknesses: weaknesses, meanOfAvgs: Math.round(meanOfAvgs * 10) / 10 };
  };

  /* ---- 个人报告 ---- */
  A.studentReport = function (batch, studentId) {
    const s = batch.students.find(function (x) { return x.id === studentId; });
    if (!s) return null;
    const computed = A.computeStudent(s);
    const stats = A.batchStats(batch);
    computed.classRank = stats.rankMap[s.id] || null;
    computed.genderRank = (s.gender === "male" ? stats.maleRankMap : stats.femaleRankMap)[s.id] || null;
    computed.classCount = stats.total.count;
    computed.genderCount = s.gender === "male" ? stats.male.count : stats.female.count;

    /* 个人薄弱项 */
    const S = FCS.scoring;
    const th = A.TH;
    const must = [], relative = [];
    if (computed.complete) {
      S.items.forEach(function (key) {
        const score = computed.itemScores[key];
        if (score < 60) {
          must.push({ key: key, score: score, loss: (100 - score) * S.itemMeta[key].weight });
        } else if (score < computed.total - th.personalBelowTotal) {
          relative.push({ key: key, score: score, gap: computed.total - score });
        }
      });
      must.sort(function (a, b) { return b.loss - a.loss; });
      relative.sort(function (a, b) { return b.gap - a.gap; });
    }
    computed.weakItems = { must: must, relative: relative };
    computed.rawStats = stats;
    return computed;
  };

  /* ---- 纵向对比：同班两批次 ---- */
  A.compareBatches = function (batchA, batchB) {
    const compA = A.computeBatch(batchA);
    const compB = A.computeBatch(batchB);
    const mapA = {}, mapB = {};
    compA.forEach(function (x) { mapA[x.studentNo] = x; });
    compB.forEach(function (x) { mapB[x.studentNo] = x; });
    const matched = [], onlyInA = [], onlyInB = [];
    compA.forEach(function (x) {
      if (mapB[x.studentNo]) {
        const y = mapB[x.studentNo];
        const itemDeltas = {};
        FCS.scoring.items.forEach(function (k) {
          const va = x.itemScores[k], vb = y.itemScores[k];
          itemDeltas[k] = (va !== null && vb !== null) ? Math.round((vb - va) * 10) / 10 : null;
        });
        matched.push({
          id: x.id, studentNo: x.studentNo, name: x.name, gender: x.gender,
          before: x, after: y,
          totalDelta: (x.complete && y.complete) ? Math.round((y.total - x.total) * 10) / 10 : null,
          itemDeltas: itemDeltas,
        });
      } else {
        onlyInA.push(x);
      }
    });
    compB.forEach(function (x) { if (!mapA[x.studentNo]) onlyInB.push(x); });

    /* 全班各项目平均分变化 */
    const statsA = A.batchStats(batchA), statsB = A.batchStats(batchB);
    const itemAvgDeltas = {};
    FCS.scoring.items.forEach(function (k) {
      const va = statsA.items[k].all.avgScore, vb = statsB.items[k].all.avgScore;
      itemAvgDeltas[k] = (va !== null && vb !== null) ? Math.round((vb - va) * 10) / 10 : null;
    });
    const classAvgDelta = (statsA.total.avg !== null && statsB.total.avg !== null)
      ? Math.round((statsB.total.avg - statsA.total.avg) * 10) / 10 : null;

    const th = A.TH;
    const improved = matched.filter(function (m) { return m.totalDelta !== null && m.totalDelta >= th.deltaThreshold; })
      .sort(function (a, b) { return b.totalDelta - a.totalDelta; });
    const declined = matched.filter(function (m) { return m.totalDelta !== null && m.totalDelta <= -th.deltaThreshold; })
      .sort(function (a, b) { return a.totalDelta - b.totalDelta; });

    return {
      batchA: batchA, batchB: batchB,
      matched: matched, onlyInA: onlyInA, onlyInB: onlyInB,
      statsA: statsA, statsB: statsB,
      itemAvgDeltas: itemAvgDeltas, classAvgDelta: classAvgDelta,
      improved: improved, declined: declined,
    };
  };

  /* ---- 班际对比：多班级各自最新(或指定)批次的总体指标 ---- */
  A.compareClasses = function (pairs) {
    /* pairs: [{className, batch}] */
    return pairs.map(function (p) {
      const stats = A.batchStats(p.batch);
      return {
        className: p.className,
        batchName: p.batch.name,
        count: stats.total.count,
        avg: stats.total.avg,
        passRate: stats.total.passRate,
        goodRate: stats.total.goodRate,
        excellentCount: stats.total.excellentCount,
      };
    });
  };

  FCS.analysis = A;
})();
