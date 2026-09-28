/* sample-data.js — 示例班级数据（设置页"加载示例数据"按钮使用）
   包含一个示例班级的两次测试批次（初测+一个月后复测），便于演示对比分析。 */
(function () {
  "use strict";
  const FCS = window.FCS;

  /* 确定性伪随机数（保证每次加载的示例数据一致） */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randBetween(rng, lo, hi) { return Math.round((lo + rng() * (hi - lo)) * 10) / 10; }

  const MALE_NAMES = ["张伟", "李强", "王磊", "刘洋", "陈杰", "杨帆", "赵鹏", "黄鑫", "周涛", "吴迪", "徐峰", "孙浩", "马超", "朱晨", "胡斌", "郭宇", "林涛", "何俊", "高翔", "罗成"];
  const FEMALE_NAMES = ["王芳", "李娜", "张敏", "刘静", "陈雨", "杨雪", "赵丽", "黄婷", "周颖", "吴霞", "徐璐", "孙悦", "马丽", "朱琳", "胡倩", "郭燕", "林佳", "何倩", "高媛", "罗丹"];
  const SURNAMES = ["张", "李", "王", "刘", "陈", "杨", "赵", "黄", "周", "吴"];

  function makeName(rng, gender, used) {
    const pool = gender === "male" ? MALE_NAMES : FEMALE_NAMES;
    let name = pool[Math.floor(rng() * pool.length)];
    while (used[name]) name = pool[Math.floor(rng() * pool.length)];
    used[name] = true;
    return name;
  }

  /* 生成一次测试的原始成绩 */
  function genRaw(rng, gender) {
    const raw = {};
    if (gender === "male") {
      raw.height = randBetween(rng, 166, 187);
      const bmiTarget = randBetween(rng, 17.5, 28.5);
      raw.weight = Math.round(bmiTarget * Math.pow(raw.height / 100, 2) * 10) / 10;
      raw.vitalCapacity = randBetween(rng, 2800, 5100);
      raw.run50 = randBetween(rng, 68, 98) / 10;
      raw.standJump = randBetween(rng, 178, 268);
      raw.sitReach = randBetween(rng, -2, 22);
      const secs = Math.round(randBetween(rng, 210, 345));
      raw.endurance = { seconds: secs, display: FCS.util.formatEndurance(secs) };
      raw.strength = Math.round(randBetween(rng, 0, 18));
    } else {
      raw.height = randBetween(rng, 154, 174);
      const bmiTarget = randBetween(rng, 16.8, 26.5);
      raw.weight = Math.round(bmiTarget * Math.pow(raw.height / 100, 2) * 10) / 10;
      raw.vitalCapacity = randBetween(rng, 1750, 3450);
      raw.run50 = randBetween(rng, 76, 112) / 10;
      raw.standJump = randBetween(rng, 122, 202);
      raw.sitReach = randBetween(rng, 2, 25);
      const secs = Math.round(randBetween(rng, 225, 300));
      raw.endurance = { seconds: secs, display: FCS.util.formatEndurance(secs) };
      raw.strength = Math.round(randBetween(rng, 15, 54));
    }
    return raw;
  }

  /* 复测成绩：在初测基础上，低分项进步、其余小幅波动 */
  function genRetest(raw, gender, rng) {
    const S = FCS.scoring;
    const next = {};
    const improve = function (value, direction, pct) {
      if (value === null || value === undefined) return value;
      const delta = value * pct;
      return Math.round((direction === "up" ? value + delta : value - delta) * 10) / 10;
    };
    const scoreOf = function (key, value) {
      if (key === "endurance") return S.scoreItem(key, gender, value.seconds);
      return S.scoreItem(key, gender, value);
    };
    ["height", "weight"].forEach(function (k) { next[k] = raw[k]; }); /* 身高体重基本不变 */
    const lazy = rng() < 0.2; /* 20%的学生未坚持训练，成绩基本不变 */
    ["vitalCapacity", "run50", "standJump", "sitReach", "strength"].forEach(function (k) {
      if (raw[k] === undefined || raw[k] === null) return;
      const score = scoreOf(k, raw[k]);
      let v = raw[k];
      if (!lazy && score !== null && score < 80) {
        const pct = 0.03 + rng() * 0.05; /* 进步3%~8% */
        v = k === "run50" ? improve(v, "down", pct) : improve(v, "up", pct);
      } else {
        v = rng() < 0.7 ? improve(v, "up", 0.01) : v; /* 小幅波动 */
      }
      /* run50 向下取0.1秒步进 */
      if (k === "run50") v = Math.round(v * 10) / 10;
      next[k] = v;
    });
    if (raw.endurance) {
      const score = scoreOf("endurance", raw.endurance);
      let secs = raw.endurance.seconds;
      if (score !== null && score < 80) secs = Math.max(180, Math.round(secs * (1 - (0.02 + rng() * 0.04))));
      next.endurance = { seconds: secs, display: FCS.util.formatEndurance(secs) };
    }
    return next;
  }

  /* 生成示例班级（含两个批次） */
  function buildSample() {
    const rng = mulberry32(20260910);
    const U = FCS.util;
    const cls = {
      id: U.uid("c"),
      name: "2024级体育教育1班",
      teacher: "王老师",
      semester: "2025-2026学年第一学期",
      createdAt: new Date().toISOString(),
      batches: [],
    };
    const b1 = {
      id: U.uid("b"), name: "2026年9月初测", testDate: "2026-09-08",
      note: "示例数据：第一次体测", createdAt: new Date().toISOString(), students: [],
    };
    const b2 = {
      id: U.uid("b"), name: "2026年10月复测", testDate: "2026-10-08",
      note: "示例数据：一个月后复测", createdAt: new Date().toISOString(), students: [],
    };
    const used = {};
    let no = 2024010101;
    /* 同一学生在两个批次中保持相同学号、姓名、性别，仅成绩不同（便于纵向对比演示） */
    const mkStudentPair = function (gender) {
      const studentNo = String(no++);
      const name = makeName(rng, gender, used);
      const raw1 = genRaw(rng, gender);
      b1.students.push({ id: U.uid("s"), studentNo: studentNo, name: name, gender: gender, raw: raw1 });
      b2.students.push({ id: U.uid("s"), studentNo: studentNo, name: name, gender: gender, raw: genRetest(raw1, gender, rng) });
    };
    /* 12男 + 12女 */
    for (let i = 0; i < 12; i++) mkStudentPair("male");
    for (let i = 0; i < 12; i++) mkStudentPair("female");
    cls.batches.push(b1, b2);
    return cls;
  }

  FCS.sampleData = { build: buildSample };
})();
