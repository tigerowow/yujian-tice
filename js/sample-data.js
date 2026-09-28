/* sample-data.js — 参赛演示示例数据（设置页"加载示例数据"按钮与 tools/gen-sample-xlsx.js 共用同一生成器）
   生成两个示例班级：应用化学一班（24男16女）、应用化学二班（22男18女），每班40人、两次测试批次（初测+复测），无缺项。
   叙事特点：一班=初测中等偏下（及格率约78%）→复测整体提升（个别退步）；
            二班=初测总体较好但耐力/力量短板明显→复测两项专项突破（进步榜亮眼，初测有2-3名85+尖子）。
   全部成绩由确定性伪随机数生成（种子固定），每次加载完全一致。 */
(function () {
  "use strict";
  const FCS = window.FCS;

  /* 确定性伪随机数（保证每次生成的示例数据完全一致） */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Box-Muller 正态分布（μ均值 σ标准差） */
  function gauss(rng, mu, sigma) {
    const u1 = Math.max(rng(), 1e-9);
    const u2 = rng();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  /* Fisher-Yates 洗牌（确定性：使用传入的 rng） */
  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* 姓名池（洗牌后顺序取用，跨班不重名） */
  const MALE_NAMES = [
    "张伟", "李强", "王磊", "刘洋", "陈杰", "杨帆", "赵鹏", "黄鑫", "周涛", "吴迪",
    "徐峰", "孙浩", "马超", "朱晨", "胡斌", "郭宇", "林涛", "何俊", "高翔", "罗成",
    "郑凯", "梁栋", "谢飞", "宋健", "唐磊", "韩旭", "冯亮", "曹阳", "彭博", "曾毅",
    "萧然", "邓超", "沈杰", "卢毅", "蒋鹏", "蔡明", "丁浩", "魏然", "薛宁", "叶飞",
    "阎峰", "余磊", "杜江", "夏宇", "田博", "任强", "姜浩", "范宇", "方杰", "石磊",
    "姚远", "谭斌", "廖明", "邹鹏", "熊伟", "金鑫", "陆峰", "邱磊", "顾超", "侯亮",
  ];
  const FEMALE_NAMES = [
    "王芳", "李娜", "张敏", "刘静", "陈雨", "杨雪", "赵丽", "黄婷", "周颖", "吴霞",
    "徐璐", "孙悦", "马丽", "朱琳", "胡倩", "郭燕", "林佳", "何倩", "高媛", "罗丹",
    "郑洁", "梁婷", "谢萌", "宋佳", "唐瑶", "韩雪", "冯琳", "曹颖", "彭静", "曾莉",
    "邓雯", "沈月", "卢珊", "蒋欣", "蔡琳", "丁蕾", "魏丹", "薛梅", "叶青", "阎妮",
  ];

  /* 初测各项目目标分分布（μ/σ，男女同参数——计分表已按性别归一；不含bmi） */
  const CLASS1_INIT = { vitalCapacity: [65, 14], run50: [63, 14], standJump: [61, 14], sitReach: [63, 14], endurance: [61, 14], strength: [59, 14] };
  const CLASS2_INIT = { vitalCapacity: [74, 13], run50: [72, 13], standJump: [70, 13], sitReach: [72, 13], endurance: [48, 12], strength: [44, 12] };
  /* 二班尖子（roster位次 → 全项加分；耐力/力量额外+10，BMI固定正常区） */
  const CLASS2_STARS = [{ idx: 2, bonus: 26 }, { idx: 16, bonus: 22 }, { idx: 32, bonus: 20 }];

  /* 复测增量（分数空间，μ/σ；不含bmi） */
  const CLASS1_DELTAS = { vitalCapacity: [6.0, 2.0], run50: [6.0, 2.0], standJump: [6.0, 2.0], sitReach: [6.0, 2.0], endurance: [6.0, 2.0], strength: [6.0, 2.0] };
  const CLASS2_DELTAS = { vitalCapacity: [2, 1.5], run50: [2, 1.5], standJump: [2, 1.5], sitReach: [2, 1.5], endurance: [11, 2.5], strength: [13, 2.5] };
  /* 一班退步生（roster位次 → 学号 2026010101/…13/…27），总分约降2.3分（退步名单阈值1分） */
  const CLASS1_DECLINERS = [0, 12, 26];

  const CLASS_DEFS = [
    { name: "应用化学一班", teacher: "王老师", males: 24, females: 16, noStart: 2026010101,
      init: CLASS1_INIT, deltas: CLASS1_DELTAS, decliners: CLASS1_DECLINERS, stars: null },
    { name: "应用化学二班", teacher: "李老师", males: 22, females: 18, noStart: 2026010201,
      init: CLASS2_INIT, deltas: CLASS2_DELTAS, decliners: null, stars: CLASS2_STARS },
  ];
  const BATCH_DEFS = [
    { name: "2026年9月7日初测", testDate: "2026-09-07", note: "示例数据：第一次体测" },
    { name: "2026年9月25日复测", testDate: "2026-09-25", note: "示例数据：复测" },
  ];
  const SEMESTER = "2026-2027学年第一学期";

  /* 目标分对齐到计分表档位（分数只存在于表值，向下取最近的档位） */
  function snapScore(t, s) {
    for (let i = 0; i < t.table.length; i++) {
      if (s >= t.table[i][1]) return t.table[i][1];
    }
    return t.table[t.table.length - 1][1];
  }

  /* 目标分 → 原始值（档内留余量，防四舍五入跳档） */
  function scoreToRaw(gender, key, score, rng) {
    const t = FCS.scoring.TABLES[gender][key];
    score = snapScore(t, score);
    let lo = null, hi = null; /* lo=本档阈值，hi=上一档（更高分）阈值 */
    for (let i = 0; i < t.table.length; i++) {
      if (score >= t.table[i][1]) { lo = t.table[i][0]; hi = i > 0 ? t.table[i - 1][0] : null; break; }
    }
    if (lo === null) { lo = t.table[t.table.length - 1][0]; hi = t.table[t.table.length - 2][0]; }
    let v;
    if (t.type === "gte") {
      if (hi === null) v = lo + rng() * lo * 0.12;      /* 满分档：阈值以上0~12% */
      else v = lo + rng() * (hi - lo - 0.5);             /* -0.5 余量防舍入跳档 */
    } else { /* lte：50米/耐力，值越小越好 */
      if (hi === null) v = lo * 0.92 + rng() * lo * 0.08; /* 满分档：阈值以下8% */
      else if (key === "endurance") v = hi + 0.5 + rng() * (lo - hi - 1.0); /* 整数：round落在(hi,lo] */
      else v = hi + 0.1 + rng() * (lo - hi - 0.2);        /* run50：round1落在(hi,lo] */
    }
    if (key === "run50" || key === "sitReach") return Math.round(v * 10) / 10;
    return Math.round(v);
  }

  /* 按目标分反查原始成绩（身高体重沿用base，BMI两批一致） */
  function makeRaw(gender, base, scores, rng) {
    const raw = { height: base.height, weight: base.weight };
    FCS.scoring.items.forEach(function (k) {
      if (k === "bmi") return;
      raw[k] = scoreToRaw(gender, k, scores[k], rng);
    });
    raw.endurance = { seconds: raw.endurance, display: FCS.util.formatEndurance(raw.endurance) };
    return raw;
  }

  /* 生成两个示例班级（各含初测/复测两批，同一名单同学号，无缺项） */
  function buildSample() {
    const rng = mulberry32(20260928);
    const U = FCS.util;
    const malePool = shuffle(MALE_NAMES.slice(), rng);
    const femalePool = shuffle(FEMALE_NAMES.slice(), rng);
    let mi = 0, fi = 0;
    return CLASS_DEFS.map(function (def) {
      const cls = { id: U.uid("c"), name: def.name, teacher: def.teacher, semester: SEMESTER, createdAt: new Date().toISOString(), batches: [] };
      const batches = BATCH_DEFS.map(function (bd) {
        return { id: U.uid("b"), name: bd.name, testDate: bd.testDate, note: bd.note, createdAt: new Date().toISOString(), students: [] };
      });
      /* 名单：男女交错排列（观感自然） */
      const roster = [];
      const pairCount = Math.min(def.males, def.females);
      for (let i = 0; i < pairCount; i++) roster.push("male", "female");
      for (let i = 0; i < def.males - pairCount; i++) roster.push("male");
      for (let i = 0; i < def.females - pairCount; i++) roster.push("female");

      /* 每生只生成一次的基础信息：姓名、身高体重（BMI分两批一致）、初测目标分 */
      const base = {};
      roster.forEach(function (gender, i) {
        const studentNo = String(def.noStart + i);
        const name = gender === "male" ? malePool[mi++] : femalePool[fi++];
        const h = gender === "male"
          ? Math.round(clamp(gauss(rng, 174.5, 5.5), 162, 192))
          : Math.round(clamp(gauss(rng, 161.5, 5), 150, 180));
        /* BMI 三分支：55%正常区(100分) / 35%边缘区(80分) / 10%超重(60分)；尖子固定正常区 */
        const isStar = def.stars && def.stars.some(function (st) { return st.idx === i; });
        const b = rng();
        const nl = gender === "male" ? 17.9 : 17.2;
        let bmi;
        if (isStar) bmi = nl + rng() * (23.9 - nl);
        else if (b < 0.55) bmi = nl + rng() * (23.9 - nl);
        else if (b < 0.9) bmi = (rng() < 0.5) ? nl - 0.7 - rng() * 0.5 : 23.9 + rng() * 3.6;
        else bmi = 28.2 + rng() * 2.3;
        const w = Math.round(clamp(bmi * Math.pow(h / 100, 2), 40, 110) * 10) / 10;
        const initScores = {};
        FCS.scoring.items.forEach(function (k) {
          if (k === "bmi") return;
          const d = def.init[k];
          initScores[k] = clamp(gauss(rng, d[0], d[1]), 38, 100);
        });
        if (def.stars) def.stars.forEach(function (st) {
          if (st.idx === i) FCS.scoring.items.forEach(function (k) {
            if (k === "bmi") return;
            const extra = (k === "endurance" || k === "strength") ? 10 : 0;
            initScores[k] = clamp(initScores[k] + st.bonus + extra + gauss(rng, 0, 2.5), 38, 100);
          });
        });
        base[studentNo] = { gender: gender, name: name, height: h, weight: w, initScores: initScores };
      });

      batches[0].students = roster.map(function (gender, i) {
        const studentNo = String(def.noStart + i);
        const bd = base[studentNo];
        return { id: U.uid("s"), studentNo: studentNo, name: bd.name, gender: gender, raw: makeRaw(gender, bd, bd.initScores, rng) };
      });
      batches[1].students = roster.map(function (gender, i) {
        const studentNo = String(def.noStart + i);
        const bd = base[studentNo];
        const retestScores = {};
        FCS.scoring.items.forEach(function (k) {
          if (k === "bmi") return;
          let d;
          if (def.decliners && def.decliners.indexOf(i) >= 0) {
            d = k === "sitReach" ? clamp(gauss(rng, 1, 1), -1, 4) : clamp(gauss(rng, -3.2, 1.5), -8, -0.8);
          } else {
            const dd = def.deltas[k];
            d = gauss(rng, dd[0], dd[1]);
          }
          retestScores[k] = clamp(bd.initScores[k] + d, 38, 100);
        });
        return { id: U.uid("s"), studentNo: studentNo, name: bd.name, gender: gender, raw: makeRaw(gender, bd, retestScores, rng) };
      });

      cls.batches = batches;
      return cls;
    });
  }

  FCS.sampleData = { build: buildSample };
})();
