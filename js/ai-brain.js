/* ai-brain.js — AI教练本地大脑：规则解析 + 全数据查询（全部班级/批次），完全离线
   双保险策略：本地先答；返回 matched:false 时由视图层决定是否转扣子AI */
(function () {
  "use strict";
  const FCS = window.FCS;
  const B = {};

  /* 项目别名表 [别名, 项目key, 默认性别(null=需询问), 单位]；按别名长度降序匹配，防短别名截胡 */
  const ALIASES = [
    ["坐位体前屈", "sitReach", null, "厘米"],
    ["身高体重", "bmi", null, "BMI指数"],
    ["体重指数", "bmi", null, "BMI指数"],
    ["立定跳远", "standJump", null, "厘米"],
    ["仰卧起坐", "strength", "female", "个"],
    ["引体向上", "strength", "male", "个"],
    ["肺活量", "vitalCapacity", null, "毫升"],
    ["1000米跑", "endurance", "male", null],
    ["50米跑", "run50", null, "秒"],
    ["800米跑", "endurance", "female", null],
    ["1000米", "endurance", "male", null],
    ["800米", "endurance", "female", null],
    ["一千米", "endurance", "male", null],
    ["八百米", "endurance", "female", null],
    ["50米", "run50", null, "秒"],
    ["千米", "endurance", "male", null],
    ["长跑", "endurance", null, null],
    ["耐力跑", "endurance", null, null],
    ["引体", "strength", "male", "个"],
    ["仰卧", "strength", "female", "个"],
    ["体前屈", "sitReach", null, "厘米"],
    ["跳远", "standJump", null, "厘米"],
    ["50m跑", "run50", null, "秒"],
    ["1000m", "endurance", "male", null],
    ["800m", "endurance", "female", null],
    ["50m", "run50", null, "秒"],
    ["bmi", "bmi", null, "BMI指数"],
  ];
  ALIASES.sort(function (a, b) { return b[0].length - a[0].length; });

  function findAlias(q) {
    const ql = q.toLowerCase();
    for (let i = 0; i < ALIASES.length; i++) {
      const a = ALIASES[i];
      if (ql.indexOf(a[0].toLowerCase()) >= 0) return { alias: a[0], key: a[1], gender: a[2], unit: a[3] };
    }
    return null;
  }

  /* ---- 寒暄 ---- */
  function greeting(q, ql) {
    if (/^(你好|您好|hi|hello|嗨|哈喽|早上好|中午好|晚上好|老师好)[！!？?。.~～\s]*$/i.test(q)) {
      return "你好！我是AI教练。你可以问我：<br>· 这个班哪些项目最薄弱？<br>· 某位同学复测进步了吗？<br>· 引体向上9个多少分？<br>或者问“你能做什么”看看我的本领。";
    }
    if (/^(在吗|在不在)[！!？?。.~～\s]*$/.test(q)) return "在的！我是AI教练，随时为你服务。想了解什么？";
    if (q.length <= 8 && /谢谢|感谢|多谢/.test(q)) return "不客气！有问题随时问我。";
    if (q.length <= 8 && /再见|拜拜|bye/.test(ql)) return "再见！训练要循序渐进，注意安全哦。";
    return null;
  }

  function capabilityText() {
    return "我是AI教练，可以帮你：<br>· 查计分规则：如“引体向上9个多少分”“1000米4分07秒多少分”<br>· 看学生情况：如“张三怎么样”“张三复测进步了吗”<br>· 分析班级：如“这个班哪些项目最薄弱”“全班平均分和及格率怎么样”<br>· 找重点关注学生：如“2班哪些学生需要重点训练”“2班谁的表现需要重点关注”<br>· 安排训练：如“1班接下来应该怎么训练”“引体向上怎么练”<br>· 班级对比：如“哪个班级需要重点训练”“哪个班平均分最高”<br>· 使用指引：怎么导入成绩、怎么备份等<br>在设置页配置Coze后，我还能联网回答更多灵活的问题。";
  }

  /* ---- 操作指引 ---- */
  function guideAnswer(q) {
    if (/(怎么|如何)导入|导入excel|(怎么|如何)录入|(怎么|如何)录/.test(q)) {
      return "导入成绩：左侧点「数据录入」→「导入Excel」选择成绩表（支持学校模板，男女生分两个工作表），确认预览后导入；也可以在表格里手动录入。";
    }
    if (/(怎么|如何|在哪|哪里)备份/.test(q)) {
      return "数据备份：左侧点「设置」→「导出数据备份」下载 .json 文件保存到U盘或网盘；换电脑时用「导入数据备份」恢复。请养成每次录入后备份的习惯！";
    }
    if (/训练计划(怎么|如何|在哪)|怎么.*训练计划|如何.*训练计划/.test(q)) {
      return "训练计划：左侧点「训练计划」→「按薄弱项自动选择」→「生成训练计划」，得到每周1次课的4周计划（第4周为模拟测试），可导出PDF。";
    }
    if (/个人报告(在哪|怎么)|学生报告(在哪|怎么)/.test(q)) {
      return "个人报告：在「数据录入」页每名学生那行点「报告」按钮；或在对比分析页点学生姓名（蓝色文字）进入。报告含雷达图、薄弱项、训练建议，可导出PDF。";
    }
    if (/(怎么|如何|在哪)导出|(怎么|如何)打印/.test(q)) {
      return "导出：班级分析页可导出PDF报告；训练计划可导出PDF；对比分析可导出「分析结果」PDF和「每名学生变化明细」Excel；页面右上角还有打印按钮。";
    }
    if (/(怎么|如何)删除|(怎么|如何)清空/.test(q)) {
      return "删除班级在「班级管理」页操作；清空全部数据在「设置」页（会弹窗二次确认）。操作前建议先导出数据备份！";
    }
    if (/示例数据|试用/.test(q)) {
      return "在「设置」页点「加载示例数据」，会添加应用化学一班、二班两个示例班级（每班40人，各含初测和复测两次数据），方便体验各项功能；也可用「数据录入」导入软件文件夹「体测成绩示例」里的4份Excel演示导入流程。";
    }
    return null;
  }

  /* ---- 班级解析 ---- */
  /* 默认班级：仅1个班级时返回，多班级返回 null（不自动选择，配合反问） */
  B.defaultClass = function () {
    const classes = FCS.app.data.classes;
    return classes.length === 1 ? classes[0] : null;
  };

  function latestBatch(cls) {
    return cls.batches.length ? cls.batches[cls.batches.length - 1] : null;
  }

  /* 批次解析：问句中带批次名或序号词（第一次/上次/最新…）→ 对应批次；否则最新批次 */
  function resolveBatch(cls, q) {
    const batches = cls.batches;
    if (!batches.length) return null;
    if (/第一次|第1次|首个|最早/.test(q)) return batches[0];
    if (/第二次|第2次/.test(q)) return batches.length >= 2 ? batches[1] : batches[0];
    if (/第三次|第3次/.test(q)) return batches.length >= 3 ? batches[2] : batches[batches.length - 1];
    if (/上次|上一次|前一次|上回/.test(q)) return batches.length >= 2 ? batches[batches.length - 2] : batches[batches.length - 1];
    if (/最新|最近|本次|这次|当前/.test(q)) return batches[batches.length - 1];
    /* 批次名匹配（长度降序防短名误伤） */
    const names = batches.slice().sort(function (a, b) { return b.name.length - a.name.length; });
    for (let i = 0; i < names.length; i++) {
      if (names[i].name && q.indexOf(names[i].name) >= 0) return names[i];
    }
    return batches[batches.length - 1];
  }

  /* 在指定批次里找学生（优先同学号，其次姓名） */
  function findStudentInBatch(cls, batch, q, known) {
    if (!batch) return null;
    const byNo = batch.students.filter(function (s) { return s.studentNo === known.studentNo; });
    if (byNo.length) return { s: byNo[0], cls: cls, batch: batch };
    const names = batch.students.filter(function (s) { return s.name && String(s.name).trim().length >= 2; })
      .sort(function (a, b) { return b.name.length - a.name.length; });
    for (let i = 0; i < names.length; i++) {
      if (q.indexOf(names[i].name) >= 0) return { s: names[i], cls: cls, batch: batch };
    }
    return null;
  }

  /* 班级名匹配：问句中"…班"token、全名、去年级前缀三种方式；单班直接返回；多班未命中→null */
  function matchClass(q) {
    const classes = FCS.app.data.classes;
    if (!classes.length) return null;
    const tokens = [];
    const re = /([一-龥A-Za-z0-9]{0,8}班)/g;
    let m;
    while ((m = re.exec(q)) !== null) tokens.push(m[1]);
    if (tokens.length) {
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        for (let j = 0; j < classes.length; j++) {
          const c = classes[j];
          const shortName = c.name.replace(/^\d{4}级/, "");
          if (c.name === t || shortName === t || c.name.indexOf(t) >= 0 || t.indexOf(c.name) >= 0 || t.indexOf(shortName) >= 0) return c;
        }
      }
      return null; /* 有"班"字样但没匹配到任何班级 */
    }
    for (let i = 0; i < classes.length; i++) {
      const c = classes[i];
      if (q.indexOf(c.name) >= 0) return c;
      const shortName = c.name.replace(/^\d{4}级/, "");
      if (shortName !== c.name && q.indexOf(shortName) >= 0) return c;
    }
    if (classes.length === 1) return classes[0];
    return null;
  }

  /* 多班级且未点名 → 反问是哪个班（附可点击的班级选项） */
  function askWhichClass() {
    const U = FCS.util;
    const classes = FCS.app.data.classes;
    const names = classes.map(function (c) { return "「" + U.esc(c.name) + "」"; }).join("、");
    return {
      matched: true, tag: "本地数据",
      answer: "软件里有 " + classes.length + " 个班级：" + names + "。<br>请点击下方按钮选择班级，或直接说出班级名。<br>也可以直接问跨班问题，比如“哪个班级需要重点训练？”。",
      classOptions: classes.map(function (c) { return c.name; }),
    };
  }

  /* ---- 学生查找（全班级×全批次，最新批次优先；姓名长度降序 + 学号） ---- */
  function findStudent(q) {
    const classes = FCS.app.data.classes;
    const ordered = [];
    classes.forEach(function (c) {
      for (let i = c.batches.length - 1; i >= 0; i--) ordered.push({ cls: c, batch: c.batches[i] });
    });
    if (!ordered.length) return null;
    for (let i = 0; i < ordered.length; i++) {
      /* 只匹配≥2个字的姓名：跳过空名和单字名，防止"这个班"里的单个字误命中学生 */
      const names = ordered[i].batch.students
        .filter(function (s) { return s.name && String(s.name).trim().length >= 2; })
        .sort(function (a, b) { return b.name.length - a.name.length; });
      for (let j = 0; j < names.length; j++) {
        if (q.indexOf(names[j].name) >= 0) return { s: names[j], cls: ordered[i].cls, batch: ordered[i].batch };
      }
    }
    const m = q.match(/\d{6,}/);
    if (m) {
      for (let i = 0; i < ordered.length; i++) {
        const found = ordered[i].batch.students.filter(function (s) { return String(s.studentNo) === m[0]; });
        if (found.length) return { s: found[0], cls: ordered[i].cls, batch: ordered[i].batch };
      }
      for (let i = 0; i < ordered.length; i++) {
        const found = ordered[i].batch.students.filter(function (s) { return String(s.studentNo).indexOf(m[0]) >= 0; });
        if (found.length) return { s: found[0], cls: ordered[i].cls, batch: ordered[i].batch };
      }
    }
    return null;
  }

  function topStudentAnswer(q) {
    const U = FCS.util, A = FCS.analysis;
    const cls = matchClass(q);
    if (!cls) return askWhichClass();
    const batch = resolveBatch(cls, q);
    if (!batch || !batch.students.length) return { matched: true, tag: "本地数据", answer: "「" + U.esc(cls.name) + "」还没有学生成绩。" };
    const stats = A.batchStats(batch);
    const list = stats.computed.filter(function (x) { return x.complete; })
      .sort(function (a, b) { return b.total - a.total; });
    if (!list.length) return { matched: true, tag: "本地数据", answer: "「" + U.esc(cls.name) + "」" + U.esc(batch.name) + "还没有完整成绩的学生，暂时无法判断。" };
    const t = list[0];
    return {
      matched: true, tag: "本地数据",
      answer: "「" + U.esc(cls.name) + "」" + U.esc(batch.name) + "总分最高的是 " + U.esc(t.name) + "（" + (t.gender === "male" ? "男" : "女") + "）：" + t.total + " 分（" + t.grade + "）。",
    };
  }

  /* ---- 学生问答 ---- */
  function studentAnswer(found, q) {
    const U = FCS.util, A = FCS.analysis, S = FCS.scoring, T = FCS.training;
    /* 问句中指定了批次 → 优先用该批次里这个学生的数据 */
    const wantBatch = resolveBatch(found.cls, q);
    if (wantBatch && wantBatch !== found.batch) {
      const alt = findStudentInBatch(found.cls, wantBatch, q, found.s);
      if (alt) found = alt;
    }
    const s = found.s;
    const name = U.esc(s.name);
    if (/进步|退步|变化|复测|对比|提高|下降/.test(q)) return studentCompareAnswer(found);
    const rep = A.studentReport(found.batch, s.id);
    const genderTxt = s.gender === "male" ? "男生" : "女生";
    const where = U.esc(found.cls.name) + "·" + U.esc(found.batch.name);
    let ans = "";
    if (rep.complete) {
      ans += name + "（" + genderTxt + "，" + where + "）：总分 " + rep.total + " 分（" + rep.grade + "），全班第 " + rep.classRank + " 名、" + genderTxt + "中第 " + rep.genderRank + " 名。<br>";
      const lines = [];
      S.items.forEach(function (k) {
        lines.push(S.itemLabel(k, s.gender) + "：" + rep.itemScores[k] + "分");
      });
      ans += "各项目得分：" + lines.join("、") + "。<br>";
      const weak = rep.weakItems.must.concat(rep.weakItems.relative);
      if (weak.length) {
        ans += "薄弱项目：" + weak.map(function (w) {
          return S.itemLabel(w.key, s.gender) + " " + w.score + "分";
        }).join("、") + "。<br>" + T.suggestForWeakItems(weak.map(function (w) { return { key: w.key }; }), s.gender).join("<br>");
      } else {
        ans += "各项目发展均衡，继续保持！";
      }
      return { matched: true, answer: ans, tag: "本地数据" };
    }
    /* 成绩不完整（可能有缺考）：根据已填项目给出有效回答，只提一句缺项 */
    const missing = [], filled = [];
    S.items.forEach(function (k) {
      if (rep.itemScores[k] === null) missing.push(S.itemLabel(k, s.gender));
      else filled.push({ key: k, score: rep.itemScores[k] });
    });
    if (!filled.length) {
      return {
        matched: true, tag: "本地数据",
        answer: name + "（" + genderTxt + "，" + where + "）：还没有填写任何成绩。到「数据录入」补录后，我就能给出完整的分析。",
      };
    }
    ans += name + "（" + genderTxt + "，" + where + "）：有 " + missing.length + " 项未填写（可能是缺考），暂不计算总分；根据已填项目看：<br>";
    const fLines = [];
    S.items.forEach(function (k) {
      const sc = rep.itemScores[k];
      if (sc !== null) fLines.push(S.itemLabel(k, s.gender) + " " + sc + "分（" + S.gradeOf(sc) + "）");
    });
    ans += fLines.join("、") + "。<br>";
    const weakF = filled.filter(function (x) { return x.score < 60; });
    if (weakF.length) {
      ans += "其中 " + weakF.map(function (x) { return S.itemLabel(x.key, s.gender); }).join("、") + " 未达及格线，建议：" +
        T.suggestForWeakItems(weakF.map(function (x) { return { key: x.key }; }), s.gender).join("<br>");
    } else {
      ans += "已填项目都达到了及格线以上，继续保持！<br>";
    }
    ans += "未填项目：" + missing.join("、") + "。补录后就能看到完整的总分和排名分析。";
    return { matched: true, answer: ans, tag: "本地数据" };
  }

  function studentCompareAnswer(found) {
    const U = FCS.util, A = FCS.analysis, S = FCS.scoring;
    const cls = found.cls, batch = found.batch, s = found.s;
    const name = U.esc(s.name);
    const idx = cls.batches.indexOf(batch);
    const prev = idx > 0 ? cls.batches[idx - 1] : null;
    if (!prev) {
      return {
        matched: true, tag: "本地数据",
        answer: name + "目前只有一次测试，还无法对比进步情况。到「班级管理」给「" + U.esc(cls.name) + "」新建复测批次（可复制名单），录入新成绩后就能问：" + name + "复测进步了吗？",
      };
    }
    const cmp = A.compareBatches(prev, batch);
    const row = cmp.matched.filter(function (m) { return m.studentNo === s.studentNo; })[0];
    if (!row) return { matched: true, tag: "本地数据", answer: name + " 没有参加「" + U.esc(prev.name) + "」测试，无法对比。" };
    if (row.totalDelta === null) return { matched: true, tag: "本地数据", answer: name + " 两次测试中成绩不完整，无法计算总分变化。" };
    const d = row.totalDelta;
    let ans = name + "（" + U.esc(cls.name) + "）：总分从 " + row.before.total + " 分（" + row.before.grade + "）到 " + row.after.total + " 分（" + row.after.grade + "），" +
      (d >= 0 ? "提高" : "下降") + " " + Math.abs(d) + " 分，" + (d >= 1 ? "进步了" : (d <= -1 ? "退步了" : "保持稳定")) + "。<br>";
    const itemCh = [];
    S.items.forEach(function (k) {
      if (row.itemDeltas[k] !== null) itemCh.push({ k: k, d: row.itemDeltas[k] });
    });
    itemCh.sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); });
    const top2 = itemCh.slice(0, 2).filter(function (x) { return x.d !== 0; });
    if (top2.length) {
      ans += "变化最大的项目：" + top2.map(function (x) {
        return S.itemLabel(x.k, s.gender) + (x.d >= 0 ? " +" : " ") + x.d + "分";
      }).join("、") + "。";
    }
    return { matched: true, answer: ans, tag: "本地数据" };
  }

  /* ---- 计分问答 ---- */
  function extractTime(rest) {
    const U = FCS.util;
    let m;
    m = rest.match(/(\d{1,2})\s*分(?:钟)?\s*(\d{1,2})\s*秒/);
    if (m) return { seconds: parseInt(m[1], 10) * 60 + parseInt(m[2], 10), display: m[1] + "分" + m[2] + "秒" };
    m = rest.match(/(\d{1,2})\s*[′'"]\s*(\d{1,2})/);
    if (m) return { seconds: parseInt(m[1], 10) * 60 + parseInt(m[2], 10), display: m[1] + "分" + m[2] + "秒" };
    m = rest.match(/(\d{1,2}):(\d{1,2})/);
    if (m) return { seconds: parseInt(m[1], 10) * 60 + parseInt(m[2], 10), display: m[1] + "分" + m[2] + "秒" };
    m = rest.match(/(\d+)\.(\d{1,2})/);
    if (m && parseInt(m[2], 10) < 60) return { seconds: parseInt(m[1], 10) * 60 + parseInt(m[2], 10), display: m[1] + "分" + m[2] + "秒" };
    m = rest.match(/(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      const secs = n >= 60 ? n : n * 60;
      return { seconds: secs, display: U.formatEndurance(secs).replace("'", "分") + "秒" };
    }
    return null;
  }

  function bmiAnswer(q, rest, gender) {
    const S = FCS.scoring;
    let h = null, w = null;
    let m = q.match(/身高\s*(\d+(?:\.\d+)?)\D{0,8}体重\s*(\d+(?:\.\d+)?)/);
    if (m) { h = parseFloat(m[1]); w = parseFloat(m[2]); }
    else {
      m = q.match(/体重\s*(\d+(?:\.\d+)?)\D{0,8}身高\s*(\d+(?:\.\d+)?)/);
      if (m) { w = parseFloat(m[1]); h = parseFloat(m[2]); }
    }
    if (h !== null && w !== null) {
      const hCm = h < 3 ? h * 100 : h;
      const bmi = S.computeBmi(hCm, w);
      if (bmi === null) return null;
      const score = S.scoreItem("bmi", gender, bmi);
      return { matched: true, tag: "本地计分", answer: (gender === "male" ? "男生" : "女生") + "身高" + h + "、体重" + w + " → BMI " + bmi + "：" + score + "分（" + S.gradeOf(score) + "）。" };
    }
    const nm = rest.match(/-?\d+(?:\.\d+)?/);
    if (nm) {
      const n = parseFloat(nm[0]);
      if (n >= 10 && n < 50) {
        const score = S.scoreItem("bmi", gender, n);
        return { matched: true, tag: "本地计分", answer: (gender === "male" ? "男生" : "女生") + "BMI " + n + "：" + score + "分（" + S.gradeOf(score) + "）。" };
      }
      return { matched: true, tag: "本地计分", answer: "请同时告诉我身高和体重，例如：“身高175体重65是多少分”。" };
    }
    return null;
  }

  function ruleAnswer(def, gender) {
    const S = FCS.scoring, U = FCS.util;
    const label = S.itemLabel(def.key, gender);
    const t = S.TABLES[gender][def.key];
    const prefix = (gender === "male" ? "男生" : "女生") + label;
    let ans = prefix + "计分规则：";
    if (def.key === "endurance") {
      let passV = null, fullV = null;
      t.table.forEach(function (row) { if (row[1] === 60) passV = row[0]; if (row[1] === 100) fullV = row[0]; });
      ans += "跑进 " + U.formatEndurance(fullV) + " 以内得100分，跑到 " + U.formatEndurance(passV) + " 以内及格（60分）；";
    } else if (t.type === "bmi") {
      ans += "BMI在 " + t.normalLow + "～" + t.normalHigh + " 之间得100分，达到 " + t.over + " 及以上得60分，其余情况80分；";
    } else {
      let passV = null, fullV = null;
      t.table.forEach(function (row) { if (row[1] === 60) passV = row[0]; if (row[1] === 100) fullV = row[0]; });
      ans += "达到 " + fullV + def.unit + " 得100分，达到 " + passV + def.unit + " 及格（60分）；";
    }
    ans += "该项占总分权重 " + (S.itemMeta[def.key].weight * 100) + "%。";
    return { matched: true, answer: ans, tag: "本地计分" };
  }

  function scoreOrRuleAnswer(def, q) {
    const S = FCS.scoring;
    const rest = q.split(def.alias).join(" ");
    const hasM = q.indexOf("男") >= 0, hasF = q.indexOf("女") >= 0;
    if (hasM && hasF) return { matched: true, tag: "本地计分", answer: "请明确是男生还是女生，例如：引体向上（男生）多少分。" };
    const gender = hasM ? "male" : (hasF ? "female" : def.gender);
    if (!gender) return { matched: true, tag: "本地计分", answer: "请告诉我是男生还是女生，例如：“女生50米跑8秒多少分”。" };
    if (def.key === "bmi") {
      const r = bmiAnswer(q, rest, gender);
      if (r) return r;
    }
    let value = null, display = null;
    if (def.key === "endurance") {
      const t = extractTime(rest);
      if (t) { value = t.seconds; display = t.display; }
    } else {
      const m = rest.match(/-?\d+(?:\.\d+)?/);
      if (m) { value = parseFloat(m[0]); display = value + (def.unit || ""); }
    }
    if (value === null) return ruleAnswer(def, gender);
    const label = S.itemLabel(def.key, gender);
    const score = S.scoreItem(def.key, gender, value);
    const grade = S.gradeOf(score);
    let ans = (gender === "male" ? "男生" : "女生") + label + " " + display + "：" + score + "分（" + grade + "）";
    if (score < 60) ans += "，距离及格还差 " + (60 - score) + " 分";
    return { matched: true, answer: ans + "。", tag: "本地计分" };
  }

  /* ---- 班级问答 ---- */
  function itemStatLine(def, stats, gender) {
    const S = FCS.scoring;
    const parts = [];
    function pushItem(k, g, label) {
      const it = stats.items[k][g];
      if (!it.count) { parts.push(label + "：暂无成绩"); return; }
      parts.push(label + "：平均 " + it.avgScore + " 分、及格率 " + it.passRate + "%");
    }
    if (def.key === "endurance" || def.key === "strength") {
      if (gender === "all") {
        pushItem(def.key, "male", S.itemLabel(def.key, "male") + "（男）");
        pushItem(def.key, "female", S.itemLabel(def.key, "female") + "（女）");
      } else {
        pushItem(def.key, gender, S.itemLabel(def.key, gender));
      }
    } else {
      pushItem(def.key, gender === "all" ? "all" : gender, S.itemLabel(def.key, gender === "all" ? null : gender));
    }
    return parts.join("；") + "。";
  }

  function classTrendAnswer(cls, batch) {
    const U = FCS.util, A = FCS.analysis;
    const idx = cls.batches.indexOf(batch);
    if (idx <= 0) return "「" + U.esc(cls.name) + "」目前只有一个测试批次，还无法对比。到「班级管理」新建复测批次（可复制名单），录入新成绩后就能看全班进步情况。";
    const prev = cls.batches[idx - 1];
    const cmp = A.compareBatches(prev, batch);
    const aAvg = cmp.statsA.total.avg, bAvg = cmp.statsB.total.avg;
    let s = "对比「" + U.esc(prev.name) + "」：全班平均分从 " + (aAvg === null ? "—" : aAvg) + " 分到 " + (bAvg === null ? "—" : bAvg) + " 分" +
      (cmp.classAvgDelta !== null ? "（" + (cmp.classAvgDelta >= 0 ? "+" : "") + cmp.classAvgDelta + " 分）" : "") +
      "；进步 " + cmp.improved.length + " 人、退步 " + cmp.declined.length + " 人。";
    if (cmp.improved.length) s += "进步前3名：" + cmp.improved.slice(0, 3).map(function (m) { return U.esc(m.name) + " +" + m.totalDelta + "分"; }).join("、") + "。";
    return s;
  }

  function classAnswer(q, def) {
    const U = FCS.util, A = FCS.analysis, S = FCS.scoring;
    const classes = FCS.app.data.classes;
    if (!classes.length) return { matched: true, tag: "本地数据", answer: "还没有班级数据。请先到「班级管理」新建班级，再到「数据录入」导入成绩。" };
    const cls = matchClass(q);
    if (!cls) return askWhichClass();
    const batch = resolveBatch(cls, q);
    if (!batch) return { matched: true, tag: "本地数据", answer: "「" + U.esc(cls.name) + "」还没有测试批次。请先到「班级管理」新建测试批次并录入成绩。" };
    if (!batch.students.length) return { matched: true, tag: "本地数据", answer: "「" + U.esc(cls.name) + "」" + U.esc(batch.name) + "还没有学生成绩。请先到「数据录入」导入或录入成绩。" };
    const stats = A.batchStats(batch);
    const hasM = q.indexOf("男") >= 0, hasF = q.indexOf("女") >= 0;
    const gender = hasM && !hasF ? "male" : (!hasM && hasF ? "female" : "all");
    const genderTxt = gender === "male" ? "男生" : (gender === "female" ? "女生" : "全班");
    const sections = [];
    sections.push("「" + U.esc(cls.name) + "」" + U.esc(batch.name) + "（" + batch.testDate + "）");

    if (def) sections.push(itemStatLine(def, stats, gender));
    if (/薄弱|弱项|短板|最差|较差|劣势|拖后腿/.test(q)) {
      const wk = A.weakItems(stats, { gender: gender });
      if (wk.weaknesses.length) {
        sections.push("薄弱项目：" + wk.weaknesses.map(function (w) {
          return w.label + "（平均" + w.avgScore + "分、及格率" + w.passRate + "%" + (w.reason ? "，" + w.reason : "") + "）";
        }).join("；") + "。建议优先安排针对性训练（可在「训练计划」页自动生成）。");
      } else {
        sections.push(genderTxt + "暂时没有明显的薄弱项目。");
      }
    }
    if (/优势|强项|擅长|突出|最好/.test(q)) {
      const wk = A.weakItems(stats, { gender: gender });
      if (wk.strengths.length) {
        sections.push("优势项目：" + wk.strengths.map(function (w) {
          return w.label + "（平均" + w.avgScore + "分、及格率" + w.passRate + "%）";
        }).join("；") + "。");
      } else {
        sections.push(genderTxt + "暂时没有特别突出的优势项目。");
      }
    }
    if (/平均|均分|均值|得分|明细/.test(q) && !def) {
      const lines = [];
      if (gender === "all") {
        ["bmi", "vitalCapacity", "run50", "standJump", "sitReach"].forEach(function (k) {
          const it = stats.items[k].all;
          if (it.count) lines.push(S.itemLabel(k, null) + "：" + it.avgScore + "分");
        });
        const itM = stats.items.endurance.male, itF = stats.items.endurance.female;
        if (itM.count) lines.push("1000米跑（男）：" + itM.avgScore + "分");
        if (itF.count) lines.push("800米跑（女）：" + itF.avgScore + "分");
        const sM = stats.items.strength.male, sF = stats.items.strength.female;
        if (sM.count) lines.push("引体向上（男）：" + sM.avgScore + "分");
        if (sF.count) lines.push("仰卧起坐（女）：" + sF.avgScore + "分");
      } else {
        S.items.forEach(function (k) {
          const it = stats.items[k][gender];
          if (it.count) lines.push(S.itemLabel(k, gender) + "：" + it.avgScore + "分");
        });
      }
      sections.push("各项目平均分：" + lines.join("、") + "。");
    }
    if (/及格率|合格率|通过率/.test(q) && !def) {
      const lines = [];
      if (gender === "all") {
        ["bmi", "vitalCapacity", "run50", "standJump", "sitReach"].forEach(function (k) {
          const it = stats.items[k].all;
          if (it.count) lines.push(S.itemLabel(k, null) + "：" + it.passRate + "%");
        });
        const itM = stats.items.endurance.male, itF = stats.items.endurance.female;
        if (itM.count) lines.push("1000米跑（男）：" + itM.passRate + "%");
        if (itF.count) lines.push("800米跑（女）：" + itF.passRate + "%");
        const sM = stats.items.strength.male, sF = stats.items.strength.female;
        if (sM.count) lines.push("引体向上（男）：" + sM.passRate + "%");
        if (sF.count) lines.push("仰卧起坐（女）：" + sF.passRate + "%");
      } else {
        S.items.forEach(function (k) {
          const it = stats.items[k][gender];
          if (it.count) lines.push(S.itemLabel(k, gender) + "：" + it.passRate + "%");
        });
      }
      sections.push("各项目及格率：" + lines.join("、") + "。");
    }
    if (/优秀|良好|优良|等级|分布/.test(q)) {
      const t = stats.total;
      sections.push("等级分布：优秀 " + t.gradeDist["优秀"] + " 人、良好 " + t.gradeDist["良好"] + " 人、及格 " + t.gradeDist["及格"] + " 人、不及格 " + t.gradeDist["不及格"] + " 人。");
    }
    if (/人数|多少人|几个学生|多少名同学/.test(q)) {
      sections.push("共 " + stats.total.count + " 人（男生 " + stats.male.count + " 人、女生 " + stats.female.count + " 人）。");
    }
    if (/进步|退步|复测|对比|变化|提高|提升|下降|长进/.test(q)) {
      sections.push(classTrendAnswer(cls, batch));
    }
    if (/怎么提高|怎么提升|如何提高|如何提升/.test(q)) {
      sections.push(classTrainingCore(stats));
    }
    if (hasM && hasF && /谁|高|好|强|对比|厉害/.test(q)) {
      const mAvg = stats.male.avg, fAvg = stats.female.avg;
      if (mAvg !== null && fAvg !== null) {
        sections.push("男生平均分 " + mAvg + "、及格率 " + stats.male.passRate + "%；女生平均分 " + fAvg + "、及格率 " + stats.female.passRate + "%。" +
          (mAvg === fAvg ? "双方基本持平。" : (mAvg > fAvg ? "男生更高一些。" : "女生更高一些。")));
      }
    }
    if (sections.length === 1) {
      const t = stats.total;
      let s = "共 " + t.count + " 人，平均分 " + (t.avg === null ? "—（暂无完整成绩的学生）" : t.avg) + "，及格率 " + (t.passRate === null ? "—" : t.passRate + "%") + "。";
      const wk = A.weakItems(stats, { gender: gender });
      if (wk.weaknesses.length) s += "薄弱项目：" + wk.weaknesses.map(function (w) { return w.label; }).join("、") + "。";
      if (wk.strengths.length) s += "优势项目：" + wk.strengths.map(function (w) { return w.label; }).join("、") + "。";
      sections.push(s);
    }
    return { matched: true, answer: sections.join("<br><br>"), tag: "本地数据" };
  }

  /* ---- 训练安排（调用训练模块的知识库与4周计划生成） ---- */
  function classTrainingCore(stats) {
    const S = FCS.scoring, T = FCS.training, A = FCS.analysis;
    const wkM = A.weakItems(stats, { gender: "male" });
    const wkF = A.weakItems(stats, { gender: "female" });
    const hasMale = stats.male.count > 0, hasFemale = stats.female.count > 0;
    const focusMale = wkM.weaknesses.slice(0, 3).map(function (w) { return w.key; });
    const focusFemale = wkF.weaknesses.slice(0, 3).map(function (w) { return w.key; });
    const plan = T.generatePlan({ weeks: 4, focusMale: focusMale, focusFemale: focusFemale, hasMale: hasMale, hasFemale: hasFemale });
    let s = "";
    if (!focusMale.length && !focusFemale.length) {
      s += "该班各项目整体均衡，没有明显短板，按常规保持训练即可。<br>";
    } else {
      const targets = [];
      if (hasMale && focusMale.length) targets.push("男生重点：" + focusMale.map(function (k) { return S.itemLabel(k, "male"); }).join("、"));
      if (hasFemale && focusFemale.length) targets.push("女生重点：" + focusFemale.map(function (k) { return S.itemLabel(k, "female"); }).join("、"));
      s += targets.join("；") + "。<br>";
    }
    s += "接下来4周可以这样安排：<br>";
    plan.planWeeks.forEach(function (wk) {
      if (wk.week === plan.weeks) {
        s += "第" + wk.week + "周：模拟测试课（完整复测，用于对比进步）。<br>";
        return;
      }
      const parts = [];
      wk.main.forEach(function (b) {
        const names = b.entries.map(function (e) { return e.title.replace(/（男生）|（女生）/g, ""); }).join("、");
        if (b.genderLabel) parts.push(b.genderLabel + "：" + names);
        else parts.push(names);
      });
      s += "第" + wk.week + "周：" + parts.join("；") + "。<br>";
    });
    s += "完整计划（含热身、放松、课后作业）可在「训练计划」页点「按薄弱项自动选择」→「生成训练计划」一键生成，并导出PDF。";
    return s;
  }

  function classTrainingAnswer(cls, batch) {
    const U = FCS.util, A = FCS.analysis;
    const stats = A.batchStats(batch);
    return {
      matched: true, tag: "本地数据",
      answer: "「" + U.esc(cls.name) + "」" + U.esc(batch.name) + "的训练安排：<br>" + classTrainingCore(stats),
    };
  }

  /* 单项训练方法（问某个项目的练法，直接调用训练知识库） */
  function itemTrainingAnswer(def, q) {
    const S = FCS.scoring, T = FCS.training;
    const g2 = q.indexOf("男") >= 0 ? "male" : (q.indexOf("女") >= 0 ? "female" : (def.gender || null));
    if (!g2) return null;
    const kb = T.itemToKB(def.key, g2);
    if (!kb) return null;
    let a = (g2 === "male" ? "男生" : "女生") + S.itemLabel(def.key, g2) + "训练：" + kb.intro + "<br>";
    a += kb.methods.map(function (m) {
      return "· " + m.name + "：" + m.steps + "（" + m.dosage + "）" + (m.notes ? "，注意：" + m.notes : "");
    }).join("<br>");
    if (kb.tips && kb.tips.length) a += "<br>小贴士：" + kb.tips.join("；");
    return { matched: true, answer: a, tag: "本地数据" };
  }

  /* ---- 重点关注学生（班级内需要重点训练/关注的学生名单） ---- */
  function focusStudentsAnswer(q) {
    const U = FCS.util, A = FCS.analysis;
    const cls = matchClass(q) || B.defaultClass();
    if (!cls) return askWhichClass();
    const batch = resolveBatch(cls, q);
    if (!batch || !batch.students.length) {
      return { matched: true, tag: "本地数据", answer: "「" + U.esc(cls.name) + "」还没有学生成绩。请先到「数据录入」导入成绩。" };
    }
    const stats = A.batchStats(batch);
    const cap = 20;
    const capText = function (n) { return n > cap ? " 等共 " + n + " 人" : ""; };
    const fail = stats.computed.filter(function (x) { return x.complete && x.total < 60; })
      .sort(function (a, b) { return a.total - b.total; });
    const edge = stats.computed.filter(function (x) { return x.complete && x.total >= 60 && x.total < 70; })
      .sort(function (a, b) { return a.total - b.total; });
    const incomplete = stats.computed.filter(function (x) { return !x.complete; });
    let ans = "「" + U.esc(cls.name) + "」" + U.esc(batch.name) + "需要重点关注的学生：<br>";
    if (fail.length) {
      ans += "总分不及格 " + fail.length + " 人：" + fail.slice(0, cap).map(function (x) {
        return U.esc(x.name) + "（" + x.total + "分·" + (x.gender === "male" ? "男" : "女") + "）";
      }).join("、") + capText(fail.length) + "。建议点开个人报告安排针对性训练。<br>";
    } else if (edge.length) {
      ans += "没有不及格的学生，但处于及格边缘（60-70分）的有 " + edge.length + " 人：" + edge.slice(0, cap).map(function (x) {
        return U.esc(x.name) + "（" + x.total + "分）";
      }).join("、") + capText(edge.length) + "，建议提前巩固。<br>";
    } else {
      ans += "没有不及格的学生。<br>";
    }
    if (incomplete.length) {
      ans += "成绩不完整（缺考/未录）" + incomplete.length + " 人：" + incomplete.slice(0, cap).map(function (x) {
        return U.esc(x.name) + "（缺" + x.missing.length + "项）";
      }).join("、") + capText(incomplete.length) + "。补录后才能参与完整分析。<br>";
    }
    if (!fail.length && !edge.length && !incomplete.length) {
      ans += "该班所有学生成绩完整且全部及格，整体表现不错，继续保持！";
    } else if (batch.students.length) {
      ans += "想给某个学生安排训练，可以问我：“" + U.esc(batch.students[0].name) + "怎么样”或“" + U.esc(batch.students[0].name) + "复测进步了吗”。";
    }
    return { matched: true, answer: ans, tag: "本地数据" };
  }

  /* ---- 进步最明显的学生（前后两批对比） ---- */
  function mostImprovedAnswer(q) {
    const U = FCS.util, A = FCS.analysis;
    const cls = matchClass(q) || B.defaultClass();
    if (!cls) return askWhichClass();
    const batch = resolveBatch(cls, q);
    if (!batch || !batch.students.length) {
      return { matched: true, tag: "本地数据", answer: "「" + U.esc(cls.name) + "」还没有学生成绩。" };
    }
    const idx = cls.batches.indexOf(batch);
    if (idx <= 0) {
      return {
        matched: true, tag: "本地数据",
        answer: "「" + U.esc(cls.name) + "」目前只有一次测试，还无法判断进步情况。到「班级管理」新建复测批次（可复制名单）并录入新成绩后就能对比了。",
      };
    }
    const cmp = A.compareBatches(cls.batches[idx - 1], batch);
    const top = cmp.improved.slice(0, 5);
    if (!top.length) {
      return {
        matched: true, tag: "本地数据",
        answer: "「" + U.esc(cls.name) + "」对比「" + U.esc(cls.batches[idx - 1].name) + "」：目前还没有总分进步的学生" +
          (cmp.declined.length ? "（退步 " + cmp.declined.length + " 人，需要关注）" : "") + "。",
      };
    }
    let ans = "「" + U.esc(cls.name) + "」进步最明显的是 " + U.esc(top[0].name) + "（总分提高 " + top[0].totalDelta + " 分）。<br>";
    if (top.length > 1) {
      ans += "进步前 " + top.length + " 名：" + top.map(function (m) {
        return U.esc(m.name) + " +" + m.totalDelta + "分";
      }).join("、") + "。<br>";
    }
    ans += "全班平均分从 " + (cmp.statsA.total.avg === null ? "—" : cmp.statsA.total.avg) + " 分到 " +
      (cmp.statsB.total.avg === null ? "—" : cmp.statsB.total.avg) + " 分" +
      (cmp.classAvgDelta !== null ? "（" + (cmp.classAvgDelta >= 0 ? "+" : "") + cmp.classAvgDelta + " 分）" : "") +
      "，进步共 " + cmp.improved.length + " 人。";
    if (cmp.declined.length) {
      ans += "需要注意：" + cmp.declined.slice(0, 3).map(function (m) {
        return U.esc(m.name) + " -" + Math.abs(m.totalDelta) + "分";
      }).join("、") + " 有退步。";
    }
    return { matched: true, answer: ans, tag: "本地数据" };
  }

  /* ---- 跨班对比（各班最新批次） ---- */
  function crossClassAnswer() {
    const U = FCS.util, A = FCS.analysis;
    const classes = FCS.app.data.classes;
    if (!classes.length) return { matched: true, tag: "本地数据", answer: "还没有班级数据。" };
    if (classes.length < 2) return { matched: true, tag: "本地数据", answer: "目前只有1个班级（「" + U.esc(classes[0].name) + "」），暂无法进行班级间对比。" };
    const pairs = classes.map(function (c) {
      return { className: c.name, batch: latestBatch(c) };
    }).filter(function (p) { return p.batch && p.batch.students.length; });
    if (pairs.length < 2) return { matched: true, tag: "本地数据", answer: "需要至少2个班级有学生成绩才能对比。" };
    const cmp = A.compareClasses(pairs);
    let ans = "班级横向对比（各班最新批次）：<br>" + cmp.map(function (x) {
      return "「" + U.esc(x.className) + "」平均分 " + (x.avg === null ? "—" : x.avg) + "、及格率 " + (x.passRate === null ? "—" : x.passRate + "%");
    }).join("<br>");
    const withAvg = cmp.filter(function (x) { return x.avg !== null; })
      .sort(function (a, b) { return b.avg - a.avg; });
    if (withAvg.length) {
      ans += "<br>平均分最高的是「" + U.esc(withAvg[0].className) + "」（" + withAvg[0].avg + " 分）。";
      const last = withAvg[withAvg.length - 1];
      ans += "<br>最需要重点训练的是「" + U.esc(last.className) + "」（平均分 " + last.avg + "、及格率 " +
        (last.passRate === null ? "—" : last.passRate + "%") + "）。";
      if (last === withAvg[0]) ans += "各班水平接近。";
    }
    return { matched: true, answer: ans, tag: "本地数据" };
  }

  /* ---- 主入口 ---- */
  B.answer = function (question) {
    const q = String(question || "").trim();
    if (!q) return { matched: false, answer: "", tag: null };
    const ql = q.toLowerCase();
    const U = FCS.util;

    /* 1 寒暄 */
    const g = greeting(q, ql);
    if (g) return { matched: true, answer: g, tag: "本地大脑" };

    /* 2 能力介绍 */
    if (/你能|你会|你是谁|自我介绍|有什么功能|会什么|能做什么|怎么用你|帮助|能帮我什么|介绍一下你/.test(q)) {
      return { matched: true, answer: capabilityText(), tag: "本地大脑" };
    }

    /* 3 学生问答（全数据搜索，不依赖批次选择） */
    const found = findStudent(q);
    if (found) return studentAnswer(found, q);
    if (/第一名|最高分|最好/.test(q) && !/项目/.test(q)) {
      if (!FCS.app.data.classes.length) {
        return { matched: true, tag: "本地数据", answer: "还没有班级数据。请先到「班级管理」新建班级并录入成绩。" };
      }
      return topStudentAnswer(q);
    }

    /* 4 计分问答（排除班级类问法） */
    const def = findAlias(q);
    if (def && !/平均|均分|及格率|合格率|通过率|优良|优秀率|班|全班/.test(q) && /分|及格|得分|多少|满分|怎么算|权重/.test(q)) {
      return scoreOrRuleAnswer(def, q);
    }

    /* 5 单项训练方法（问某个项目的练法，调用训练知识库） */
    if (def && /训练|方法|怎么练|练习|怎么提高|怎么提升/.test(q)) {
      const it = itemTrainingAnswer(def, q);
      if (it) return it;
    }

    /* 6 操作指引（怎么/如何/在哪类，先于数据路由，避免被班级路由截胡） */
    const gd = guideAnswer(q);
    if (gd) return { matched: true, answer: gd, tag: "指引" };

    /* 7 跨班对比 */
    if (/(哪个班|哪个班级|哪班|各班|所有班|所有班级|班际|班级之间|班级间)/.test(q) &&
        /平均|均分|及格率|对比|最高|最好|最差|最低|谁|高|强|优秀|人数|好|重点|训练|提升|差|落后|排名|怎么样|如何|成绩/.test(q)) {
      return crossClassAnswer();
    }

    /* 8 重点关注学生（问班级内哪些学生需要重点训练/关注） */
    if (/(哪些|哪个|谁|什么|有谁|几位)/.test(q) && /学生|同学|人|表现/.test(q) &&
        /重点|关注|差|不及格|落后|需要训练|需要加强|需要提高|拖后腿|边缘/.test(q)) {
      return focusStudentsAnswer(q);
    }

    /* 9 进步最明显的学生（前后两批对比） */
    if (/进步最明显|进步最大|进步最多|进步最快|谁进步|哪位进步|提升最大/.test(q)) {
      return mostImprovedAnswer(q);
    }

    /* 10 训练安排（班级+训练类问法 → 整合4周训练安排） */
    if (/训练|怎么练|练什么|加强/.test(q)) {
      const classes = FCS.app.data.classes;
      if (!classes.length) return { matched: true, tag: "本地数据", answer: "还没有班级数据。请先到「班级管理」新建班级并录入成绩。" };
      const tcls = matchClass(q) || B.defaultClass();
      if (!tcls) return askWhichClass();
      const tbatch = resolveBatch(tcls, q);
      if (!tbatch || !tbatch.students.length) {
        return { matched: true, tag: "本地数据", answer: "「" + U.esc(tcls.name) + "」还没有学生成绩，暂时无法安排训练。请先到「数据录入」导入成绩。" };
      }
      return classTrainingAnswer(tcls, tbatch);
    }

    /* 11 班级问答 */
    if (/班|平均|均分|及格率|合格率|通过率|优秀|良好|优良|等级|分布|人数|进步|退步|复测|对比|变化|提高|提升|下降|长进|薄弱|弱项|短板|最差|劣势|拖后腿|优势|强项|擅长|突出|最好|怎么提高|怎么提升/.test(q)) {
      return classAnswer(q, def);
    }

    /* 12 兜底：交给上层决定是否转Coze AI */
    return { matched: false, answer: "这个问题我还没学会。", tag: null };
  };

  /* 供 ai-api.js 构造上下文复用：按问句查找学生（全班级×全批次） */
  B.findStudent = findStudent;

  FCS.aiBrain = B;
})();
