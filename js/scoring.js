/* scoring.js — 计分引擎（学校计分标准）
   数据来源：计算公式.xlsx（学校体测计分模板）的 IF 公式链。
   语义：按顺序第一个匹配的阈值生效（复刻 Excel 的 IF 链，含跳档区间）。
   注意：引体向上公式原表笔误 ">=29" 已按用户确认修正为 ">=9"（9个→50分）。
   耐力跑阈值统一换算为整数秒存储比较，避免浮点误差。 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const S = {};

  /* 项目元信息 */
  S.items = ["bmi", "vitalCapacity", "run50", "standJump", "sitReach", "endurance", "strength"];
  S.itemMeta = {
    bmi:           { label: "身高体重", sub: "BMI指数",   weight: 0.15, unit: "指数" },
    vitalCapacity: { label: "肺活量",   weight: 0.15, unit: "毫升" },
    run50:         { label: "50米跑",   weight: 0.20, unit: "秒" },
    standJump:     { label: "立定跳远", weight: 0.10, unit: "厘米" },
    sitReach:      { label: "坐位体前屈", weight: 0.10, unit: "厘米" },
    endurance:     { label: "耐力跑",   weight: 0.20, unit: "分'秒", genderLabel: { male: "1000米跑", female: "800米跑" } },
    strength:      { label: "力量",     weight: 0.10, unit: "个",    genderLabel: { male: "引体向上", female: "仰卧起坐" } },
  };
  S.itemLabel = function (key, gender) {
    const m = S.itemMeta[key];
    if (m.genderLabel && gender) return m.genderLabel[gender];
    return m.label;
  };

  /* 耐力跑阈值换算：分.秒 → 整数秒 */
  function ms(min, sec) { return min * 60 + sec; }

  /* 完整计分表 */
  S.TABLES = {
    male: {
      bmi: { type: "bmi", normalLow: 17.9, normalHigh: 23.9, over: 28, scoreOver: 60, scoreNormal: 100, scoreElse: 80 },
      vitalCapacity: { type: "gte", table: [
        [5040, 100], [4920, 95], [4800, 90], [4550, 85], [4300, 80], [4180, 78], [4060, 76], [3940, 74], [3820, 72], [3700, 70],
        [3580, 68], [3460, 66], [3340, 64], [3220, 62], [3100, 60], [2940, 50], [2780, 40], [2620, 30], [2460, 20], [2300, 10]] },
      run50: { type: "lte", table: [
        [6.7, 100], [6.8, 95], [6.9, 90], [7.0, 85], [7.1, 80], [7.3, 78], [7.5, 76], [7.7, 74], [7.9, 72], [8.1, 70],
        [8.3, 68], [8.5, 66], [8.7, 64], [8.9, 62], [9.1, 60], [9.3, 50], [9.5, 40], [9.7, 30], [9.9, 20], [10.1, 10]] },
      standJump: { type: "gte", table: [
        [273, 100], [268, 95], [263, 90], [256, 85], [248, 80], [244, 78], [240, 76], [236, 74], [232, 72], [228, 70],
        [224, 68], [220, 66], [216, 64], [212, 62], [208, 60], [203, 50], [198, 40], [193, 30], [188, 20], [183, 10]] },
      sitReach: { type: "gte", table: [
        [24.9, 100], [23.1, 95], [21.3, 90], [19.5, 85], [17.7, 80], [16.3, 78], [14.9, 76], [13.5, 74], [12.1, 72], [10.7, 70],
        [9.3, 68], [7.9, 66], [6.5, 64], [5.1, 62], [3.7, 60], [2.7, 50], [1.7, 40], [0.7, 30], [-0.3, 20], [-1.3, 10]] },
      endurance: { type: "lte", table: [
        [ms(3, 17), 100], [ms(3, 22), 95], [ms(3, 27), 90], [ms(3, 34), 85], [ms(3, 42), 80], [ms(3, 47), 78], [ms(3, 52), 76], [ms(3, 57), 74], [ms(4, 2), 72], [ms(4, 7), 70],
        [ms(4, 12), 68], [ms(4, 17), 66], [ms(4, 22), 64], [ms(4, 27), 62], [ms(4, 32), 60], [ms(4, 52), 50], [ms(5, 12), 40], [ms(5, 32), 30], [ms(5, 52), 20], [ms(6, 12), 10]] },
      strength: { type: "gte", table: [
        [19, 100], [18, 95], [17, 90], [16, 85], [15, 80], [14, 76], [13, 72], [12, 68], [11, 64], [10, 60],
        [9, 50], [8, 40], [7, 30], [6, 20], [5, 10]] },
    },
    female: {
      bmi: { type: "bmi", normalLow: 17.2, normalHigh: 23.9, over: 28, scoreOver: 60, scoreNormal: 100, scoreElse: 80 },
      vitalCapacity: { type: "gte", table: [
        [3400, 100], [3350, 95], [3300, 90], [3150, 85], [3000, 80], [2900, 78], [2800, 76], [2700, 74], [2600, 72], [2500, 70],
        [2400, 68], [2300, 66], [2200, 64], [2100, 62], [2000, 60], [1960, 50], [1920, 40], [1880, 30], [1840, 20], [1800, 10]] },
      run50: { type: "lte", table: [
        [7.5, 100], [7.6, 95], [7.7, 90], [8.0, 85], [8.3, 80], [8.5, 78], [8.7, 76], [8.9, 74], [9.1, 72], [9.3, 70],
        [9.5, 68], [9.7, 66], [9.9, 64], [10.1, 62], [10.3, 60], [10.5, 50], [10.7, 40], [10.9, 30], [11.1, 20], [11.3, 10]] },
      standJump: { type: "gte", table: [
        [207, 100], [201, 95], [195, 90], [188, 85], [181, 80], [178, 78], [175, 76], [172, 74], [169, 72], [166, 70],
        [163, 68], [160, 66], [157, 64], [154, 62], [151, 60], [146, 50], [141, 40], [136, 30], [131, 20], [126, 10]] },
      sitReach: { type: "gte", table: [
        [25.8, 100], [24, 95], [22.2, 90], [20.6, 85], [19, 80], [17.7, 78], [16.4, 76], [15.1, 74], [13.8, 72], [12.5, 70],
        [11.2, 68], [9.9, 66], [8.6, 64], [7.3, 62], [6, 60], [5.2, 50], [4.4, 40], [3.6, 30], [2.8, 20], [2, 10]] },
      endurance: { type: "lte", table: [
        [ms(3, 18), 100], [ms(3, 24), 95], [ms(3, 30), 90], [ms(3, 37), 85], [ms(3, 44), 80], [ms(3, 49), 78], [ms(3, 54), 76], [ms(3, 59), 74], [ms(4, 4), 72], [ms(4, 9), 70],
        [ms(4, 14), 68], [ms(4, 19), 66], [ms(4, 24), 64], [ms(4, 29), 62], [ms(4, 34), 60], [ms(4, 44), 50], [ms(4, 54), 40], [ms(5, 4), 30], [ms(5, 14), 20], [ms(5, 24), 10]] },
      strength: { type: "gte", table: [
        [56, 100], [54, 95], [52, 90], [49, 85], [46, 80], [44, 78], [42, 76], [40, 74], [38, 72], [36, 70],
        [34, 68], [32, 66], [30, 64], [28, 62], [26, 60], [24, 50], [22, 40], [20, 30], [18, 20], [16, 10]] },
    },
  };

  /* 单项计分：value 为 null → null；未命中任何阈值 → 0分 */
  S.scoreItem = function (key, gender, value) {
    if (value === null || value === undefined || isNaN(value)) return null;
    const t = S.TABLES[gender][key];
    if (t.type === "bmi") {
      if (value >= t.over) return t.scoreOver;
      if (value >= t.normalLow && value <= t.normalHigh) return t.scoreNormal;
      return t.scoreElse;
    }
    if (t.type === "gte") {
      for (let i = 0; i < t.table.length; i++) {
        if (value >= t.table[i][0]) return t.table[i][1];
      }
      return 0;
    }
    if (t.type === "lte") {
      for (let i = 0; i < t.table.length; i++) {
        if (value <= t.table[i][0]) return t.table[i][1];
      }
      return 0;
    }
    return 0;
  };

  /* BMI 计算：身高厘米、体重公斤 → 保留1位小数 */
  S.computeBmi = function (heightCm, weightKg) {
    if (heightCm === null || heightCm === undefined || weightKg === null || weightKg === undefined) return null;
    if (!(heightCm > 0) || !(weightKg > 0)) return null;
    const h = heightCm / 100;
    return Math.round((weightKg / (h * h)) * 10) / 10;
  };

  /* 全量计算。raw: {height(cm), weight, vitalCapacity, run50, standJump, sitReach, endurance:{seconds}, strength}
     返回 {bmi, itemScores, total, grade, missing, complete} */
  S.computeAll = function (gender, raw) {
    raw = raw || {};
    const bmi = S.computeBmi(raw.height, raw.weight);
    const enduranceSeconds = raw.endurance ? raw.endurance.seconds : null;
    const itemScores = {
      bmi: S.scoreItem("bmi", gender, bmi),
      vitalCapacity: S.scoreItem("vitalCapacity", gender, raw.vitalCapacity),
      run50: S.scoreItem("run50", gender, raw.run50),
      standJump: S.scoreItem("standJump", gender, raw.standJump),
      sitReach: S.scoreItem("sitReach", gender, raw.sitReach),
      endurance: S.scoreItem("endurance", gender, enduranceSeconds),
      strength: S.scoreItem("strength", gender, raw.strength),
    };
    const missing = [];
    S.items.forEach(function (k) { if (itemScores[k] === null) missing.push(k); });
    const complete = missing.length === 0;
    let total = null;
    if (complete) {
      let sum = 0;
      S.items.forEach(function (k) { sum += itemScores[k] * S.itemMeta[k].weight; });
      total = Math.round(sum * 10) / 10;
    }
    const grade = total !== null ? S.gradeOf(total) : null;
    return { bmi, itemScores, total, grade, missing, complete };
  };

  /* 等级判定 */
  S.gradeOf = function (total) {
    if (total >= 90) return "优秀";
    if (total >= 80) return "良好";
    if (total >= 60) return "及格";
    return "不及格";
  };
  S.GRADES = ["优秀", "良好", "及格", "不及格"];

  /* 边界自检：返回 {pass, failures:[说明]} */
  S.selfTest = function () {
    const f = [];
    function eq(name, actual, expected) {
      if (actual !== expected) f.push(name + "：应为 " + expected + "，实际 " + actual);
    }
    function eqn(name, actual, expected) {
      if (Math.abs(actual - expected) > 0.001) f.push(name + "：应为 " + expected + "，实际 " + actual);
    }
    // 权重和 = 1
    const wsum = S.items.reduce(function (s, k) { return s + S.itemMeta[k].weight; }, 0);
    eqn("权重和", wsum, 1.0);
    // 与学校Excel样本行对照（计算公式.xlsx 女生R2: 肺活量4442/50米10.2/跳远163/体前屈17.5/800米4.07/仰卧25）
    eq("女生肺活量4442", S.scoreItem("vitalCapacity", "female", 4442), 100);
    eq("女生50米10.2", S.scoreItem("run50", "female", 10.2), 60);
    eq("女生50米7.8(跳档区间)", S.scoreItem("run50", "female", 7.8), 85);
    eq("女生跳远163", S.scoreItem("standJump", "female", 163), 68);
    eq("女生体前屈17.5", S.scoreItem("sitReach", "female", 17.5), 76);
    eq("女生800米4'07", S.scoreItem("endurance", "female", ms(4, 7)), 70);
    eq("女生仰卧起坐25", S.scoreItem("strength", "female", 25), 50);
    eqn("女生样本总分", S.computeAll("female", { height: 172.4, weight: 109.7, vitalCapacity: 4442, run50: 10.2, standJump: 163, sitReach: 17.5, endurance: { seconds: ms(4, 7) }, strength: 25 }).total, 69.4);
    // 男生样本行对照（R2: 肺活量4619/50米7.9/跳远208/体前屈10.2/1000米4.34/引体0）
    eq("男生肺活量4619", S.scoreItem("vitalCapacity", "male", 4619), 85);
    eq("男生50米7.9", S.scoreItem("run50", "male", 7.9), 72);
    eq("男生50米7.2(跳档区间)", S.scoreItem("run50", "male", 7.2), 78);
    eq("男生跳远208", S.scoreItem("standJump", "male", 208), 60);
    eq("男生体前屈10.2", S.scoreItem("sitReach", "male", 10.2), 68);
    eq("男生1000米4'34", S.scoreItem("endurance", "male", ms(4, 34)), 50);
    eq("男生1000米3'58(跳档区间)", S.scoreItem("endurance", "male", ms(3, 58)), 72);
    eq("男生引体向上0", S.scoreItem("strength", "male", 0), 0);
    eq("男生引体向上9(修正笔误)", S.scoreItem("strength", "male", 9), 50);
    // 越界 → 0分
    eq("女生仰卧起坐10", S.scoreItem("strength", "female", 10), 0);
    eq("男生50米11", S.scoreItem("run50", "male", 11), 0);
    // BMI 三分支
    eq("男生BMI 28", S.scoreItem("bmi", "male", 28), 60);
    eq("男生BMI 17.9", S.scoreItem("bmi", "male", 17.9), 100);
    eq("男生BMI 24", S.scoreItem("bmi", "male", 24), 80);
    eq("男生BMI 17.8", S.scoreItem("bmi", "male", 17.8), 80);
    eq("女生BMI 17.2", S.scoreItem("bmi", "female", 17.2), 100);
    eq("女生BMI 17.1", S.scoreItem("bmi", "female", 17.1), 80);
    // 等级边界（1位小数）
    eq("等级59.9", S.gradeOf(59.9), "不及格");
    eq("等级60", S.gradeOf(60), "及格");
    eq("等级79.9", S.gradeOf(79.9), "及格");
    eq("等级80", S.gradeOf(80), "良好");
    eq("等级89.9", S.gradeOf(89.9), "良好");
    eq("等级90", S.gradeOf(90), "优秀");
    // 缺项 → 不计算总分
    const inc = S.computeAll("male", { height: 175, weight: 68 });
    eq("缺项complete", inc.complete, false);
    eq("缺项total", inc.total, null);
    // 表内阈值单调性校验（每张表首尾各测3档）
    ["male", "female"].forEach(function (g) {
      S.items.forEach(function (k) {
        const t = S.TABLES[g][k];
        if (t.type === "bmi") return;
        const tbl = t.table;
        // 检查阈值排序正确：gte 降序 / lte 升序
        for (let i = 1; i < tbl.length; i++) {
          if (t.type === "gte" && tbl[i][0] >= tbl[i - 1][0]) f.push(g + "-" + k + " 阈值表应降序：第" + (i + 1) + "档 " + tbl[i][0]);
          if (t.type === "lte" && tbl[i][0] <= tbl[i - 1][0]) f.push(g + "-" + k + " 阈值表应升序：第" + (i + 1) + "档 " + tbl[i][0]);
        }
      });
    });
    return { pass: f.length === 0, failures: f };
  };

  FCS.scoring = S;
})();
