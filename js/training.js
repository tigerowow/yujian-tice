/* training.js — 训练知识库（8项）+ 每周1次课的4周训练计划生成器 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const T = {};

  /* 通用热身/放松条目 */
  T.WARMUP = [
    "慢跑操场2圈（约5分钟），让身体微微出汗",
    "动态热身：开合跳30次、高抬腿30次、弓步走15米×2组",
    "关节活动：肩绕环、髋绕环、膝踝关节各8次",
    "肌肉激活：小步跑20米×2组、后踢腿跑20米×2组",
  ];
  T.COOLDOWN = [
    "慢走操场1圈，调整呼吸",
    "静态拉伸：大腿前侧、后侧、小腿、腰背各拉伸30秒",
    "抖动放松四肢，深呼吸5次",
  ];

  /* 8项训练知识库 */
  T.KB = {
    bmi: {
      title: "身高体重（BMI）",
      genderScope: "all",
      intro: "BMI反映身体形态。评分规律：正常范围（男17.9~23.9，女17.2~23.9）得100分，超重（≥28）仅60分。控制体重需要长期坚持有氧运动与合理饮食，一个月内以调整为目标即可。",
      methods: [
        { name: "慢跑/快走（控重核心）", steps: "以能持续讲话的速度慢跑或快走，心率控制在130~150次/分，每次30分钟以上。体重基数大的同学先快走后慢跑，避免膝盖冲击。", dosage: "每次30~40分钟", notes: "循序渐进，跑后膝盖不适者改快走或游泳" },
        { name: "跳绳", steps: "双脚并拢中速跳绳，手腕摇绳、前脚掌着地，落地轻巧。", dosage: "5组×1分钟，组间休息1分钟", notes: "体重过大者先用无绳空跳代替" },
        { name: "力量训练（增肌型）", steps: "偏瘦同学通过俯卧撑、深蹲、哑铃等力量训练增加肌肉量：俯卧撑、徒手深蹲、弓步蹲。", dosage: "各3组×10~15次，每周3次", notes: "训练后补充蛋白质（鸡蛋、牛奶、瘦肉）" },
      ],
      tips: [
        "饮食：三餐规律，少喝含糖饮料、少吃油炸零食，主食粗细搭配",
        "作息：保证7~8小时睡眠，睡眠不足会影响代谢、增加食欲",
        "每天记录体重，一周一对比，不必追求短期快速变化",
      ],
      safety: "控制体重切忌节食减肥，能量摄入不足会影响体能和健康。",
    },
    vitalCapacity: {
      title: "肺活量",
      genderScope: "all",
      intro: "肺活量反映呼吸机能，主要受有氧耐力和呼吸肌力量影响，通过长跑、游泳等有氧运动和呼吸练习可以稳定提高。",
      methods: [
        { name: "深呼吸练习（呼吸肌）", steps: "腹式呼吸：鼻吸口呼，吸气时腹部鼓起，呼气时缓慢吐尽。每天早晚各做一组，每组10次深呼吸。", dosage: "早晚各10次", notes: "呼气要缓慢彻底，可用吸管对水呼气增加阻力" },
        { name: "吹气球练习", steps: "深吸气后缓慢将气吹入气球，尽量一次吹大；反复进行，练习呼吸肌耐力。", dosage: "每天吹5~8个", notes: "头晕时立即停止休息" },
        { name: "长距离有氧（慢跑/游泳）", steps: "中低强度持续慢跑或游泳，呼吸保持「两步一吸两步一呼」的节奏，扩大肺通气量。", dosage: "每次20~30分钟，每周3次", notes: "注意呼吸节奏稳定，不要憋气" },
      ],
      tips: [
        "测试技巧：测试前做3~5次深呼吸调整，测试时先深吸气再匀速用力呼尽",
        "不吸烟、远离二手烟，保持呼吸系统健康",
      ],
      safety: "呼吸练习中出现头晕、胸闷立即停止休息。",
    },
    run50: {
      title: "50米跑",
      genderScope: "all",
      intro: "50米跑考核速度素质，取决于起跑反应、步频步幅和下肢爆发力。短跑成绩提高相对较慢，重点练好起跑和步频。",
      methods: [
        { name: "起跑反应练习", steps: "站立式起跑：听到口令后前腿蹬地、身体前倾冲出。两人一组听信号出发，练习反应速度。", dosage: "6~8次", notes: "注意力集中，出发时不要先抬头" },
        { name: "高抬腿跑（步频）", steps: "原地或行进间高抬腿，大腿抬至水平，前脚掌快速交替触地，摆臂配合。", dosage: "4组×20秒，组间休息40秒", notes: "身体直立不前倾，频率优先于幅度" },
        { name: "30~60米冲刺间歇", steps: "全力冲刺30~60米后慢走返回，重复进行，提高无氧速度耐力。", dosage: "30米×4次 + 60米×2次", notes: "充分热身后进行，防止拉伤" },
        { name: "下肢爆发力", steps: "立定跳台阶（连续跳上30~40厘米台阶）、弓步跳、深蹲跳。", dosage: "各3组×8~10次", notes: "落地屈膝缓冲" },
      ],
      tips: [
        "课后可练习：每天快跑3~5次30米，用楼梯上下快走",
        "测试技巧：前20米压低重心加速，后30米保持步频、放松摆臂",
      ],
      safety: "冲刺前必须充分热身，大腿后侧有紧绷感时先拉伸再练习。",
    },
    standJump: {
      title: "立定跳远",
      genderScope: "all",
      intro: "立定跳远考核下肢爆发力与全身协调性，动作技术（摆臂、起跳角度、收腿落地）对成绩影响很大，掌握技术后提升较快。",
      methods: [
        { name: "摆臂与起跳协调练习", steps: "预摆2~3次：手臂后摆时屈膝下蹲，前摆时快速蹬地起跳。重点体会摆臂带动起跳的节奏。", dosage: "10次/组，练3组", notes: "蹬地与摆臂要同步，不要先摆臂后蹬地" },
        { name: "收腹跳", steps: "原地起跳后屈膝收腹，大腿尽量贴近胸口，落地轻巧。", dosage: "3组×10次", notes: "连续跳时落地立即再起跳" },
        { name: "蹲跳与蛙跳", steps: "深蹲姿势起跳，双臂上摆带动身体；蛙跳为连续向前跳，体会前跳发力。", dosage: "蹲跳3组×10次，蛙跳3组×8次", notes: "蛙跳距离15~20米，量力而行" },
        { name: "台阶跳", steps: "连续跳上30~40厘米高的台阶或跳箱，增强蹬伸力量。", dosage: "3组×8次", notes: "跳上后站稳再下，注意安全" },
      ],
      tips: [
        "测试技巧：起跳角度约45度，腾空时收腹举腿，落地前小腿前伸、重心前移避免后坐",
        "课后可练：每天蛙跳20米×3组、深蹲30次",
      ],
      safety: "蛙跳对膝关节压力较大，膝盖有伤的同学用深蹲跳代替。",
    },
    sitReach: {
      title: "坐位体前屈",
      genderScope: "all",
      intro: "坐位体前屈考核柔韧性（大腿后侧、腰部）。柔韧性是提升最快的项目之一，坚持每天拉伸，两周即可见效。",
      methods: [
        { name: "站立体前屈", steps: "双脚并拢站直，缓慢弯腰向下，双手尽量触地或脚背，大腿后侧有拉伸感时保持。", dosage: "保持20~30秒×3组", notes: "用呼气帮助身体放松下沉，不要弹压" },
        { name: "坐位分腿压腿", steps: "坐地双腿伸直分开，身体前倾，双手沿腿向前伸展，左右腿各练。", dosage: "每条腿保持20秒×3组", notes: "膝盖保持伸直，背部放松" },
        { name: "PNF牵拉（搭档配合）", steps: "两人一组：一人仰卧抬腿，搭档缓慢推至最大幅度保持10秒，再主动对抗5秒后放松加大幅度。", dosage: "每条腿5次", notes: "配合要柔和，严禁突然发力" },
        { name: "腰背柔韧", steps: "猫式伸展、婴儿式放松腰背，缓解久坐僵硬。", dosage: "各保持20秒×2组", notes: "呼吸均匀" },
      ],
      tips: [
        "每天睡前拉伸10分钟，坚持两周成绩可提高3~5厘米",
        "测试技巧：测试前先慢跑热身后再拉伸，测试时匀速前伸，不要突然发力",
      ],
      safety: "拉伸以轻微酸胀为度，禁止剧烈弹压（易拉伤）。",
    },
    endurance: {
      title: "800米/1000米跑",
      genderScope: "all",
      intro: "中长跑考核心肺耐力，是总分权重最高的项目（20%）。提高耐力需要每周保持有氧跑量，同时掌握配速和呼吸策略，成绩提升空间大。",
      methods: [
        { name: "持续慢跑（打基础）", steps: "以能轻松对话的速度持续跑，跑后仍有余力为宜，逐步延长距离。", dosage: "20~30分钟/次，每周3次", notes: "跑前热身、跑后拉伸不可省略" },
        { name: "400米间歇跑", steps: "以目标配速跑400米，休息1~2分钟后重复，提高速度耐力。", dosage: "4~5组", notes: "组间慢走恢复，不要坐下" },
        { name: "配速练习", steps: "按考试目标分段计时跑：男生1000米前400米稍快（约总目标平均配速），中段保持，最后200米冲刺；女生800米前400米保持节奏，后400米逐渐加速。", dosage: "每节课跑1~2次全程", notes: "学会「前稳后冲」，避免起跑过快后程掉速" },
        { name: "呼吸节奏训练", steps: "跑步中保持「两步一吸、两步一呼」或「三步一吸」节奏，用鼻吸口呼，避免呼吸紊乱。", dosage: "贯穿每次跑步", notes: "出现岔气时减速、按压痛处、加深呼吸" },
      ],
      tips: [
        "课后作业：每周自主慢跑2~3次，每次20分钟以上",
        "测试技巧：起跑不要抢太猛，跟随节奏相近的同学跑，最后200米全力冲刺",
        "前一天保证睡眠，测试前2小时少量进食，避免空腹或过饱",
      ],
      safety: "跑步中出现胸痛、明显头晕立即停止；有心脏病史的同学提前告知老师。",
    },
    pullUp: {
      title: "引体向上",
      genderScope: "male",
      intro: "引体向上考核上肢与背部力量，是多数男生的薄弱项目。力量增长需要规律训练，一个月内从0到及格的关键是「先辅助、再减负、最后自重」。",
      methods: [
        { name: "辅助引体（弹力带/同伴托举）", steps: "用弹力带挂在单杠上支撑脚部，或同伴托扶小腿帮助上拉。拉到下巴过杠，缓慢下放至手臂伸直。", dosage: "4组×6~8次，组间休息90秒", notes: "上拉时肩胛下沉收紧，避免耸肩、摆动借力" },
        { name: "悬垂练习", steps: "双手正握单杠，身体自然下垂，保持核心收紧，增强握力和肩背耐力。", dosage: "3~5组×30~40秒", notes: "肩部主动下沉，不要完全放松" },
        { name: "俯卧撑与划船", steps: "标准俯卧撑（胸部力量）+ 反手俯身划船（用桌子或低杠做反向划船，练背部）。", dosage: "各3组×8~12次", notes: "动作慢起慢落，保证幅度" },
        { name: "离心引体（降阶）", steps: "跳起或借力到下巴过杠位置，然后缓慢（3~5秒）下放至手臂伸直，练肌肉控制力。", dosage: "4组×3~5次", notes: "下放越慢效果越好" },
      ],
      tips: [
        "课后再练：每天悬垂累计1分钟 + 俯卧撑20~30个",
        "减重对引体向上帮助极大，超重同学优先控重",
        "测试技巧：第一次发力前先稳定身体不摆动，引体时下巴必须过杠才算数",
      ],
      safety: "下放时不要突然松手，落地屈膝缓冲；手心起泡可用防滑镁粉。",
    },
    sitUp: {
      title: "仰卧起坐",
      genderScope: "female",
      intro: "仰卧起坐考核腹部力量与耐力，规范动作（完整起坐）比单纯追求数量更重要，坚持核心训练提升很快。",
      methods: [
        { name: "标准仰卧起坐", steps: "屈膝仰卧，同伴压住脚背，双手抱头（不拉扯脖子），用腹部力量卷起上身至肘触膝，再缓慢躺回。", dosage: "4组×20~25次", notes: "用腹部发力，颈部放松，不要用手拽头" },
        { name: "卷腹与平板支撑", steps: "卷腹：下背部贴地，上腹卷起离地即可；平板支撑：肘撑地身体成直线。", dosage: "卷腹3组×15次，平板支撑3组×30~40秒", notes: "平板支撑腰不塌、臀不翘" },
        { name: "核心力量循环", steps: "仰卧举腿、俄罗斯转体、侧平板支撑循环练习，全面强化腹肌。", dosage: "每个动作30秒，循环3轮", notes: "动作放慢，感受腹部收缩" },
        { name: "节奏与呼吸控制", steps: "按测试节奏练习：起来时呼气、躺下时吸气，保持匀速不憋气，1分钟计时练节奏感。", dosage: "1分钟×3组", notes: "找到自己的稳定节奏，避免前快后慢" },
      ],
      tips: [
        "每天睡前平板支撑2分钟 + 卷腹30个",
        "测试技巧：裁判计数以肘触膝为准，动作要到位；全程匀速，最后10秒加速",
      ],
      safety: "腰部不适的同学以卷腹代替完整仰卧起坐，避免腰部代偿。",
    },
  };

  /* 薄弱项key → 知识库条目（耐力/力量按性别细化） */
  T.itemToKB = function (key, gender) {
    if (key === "endurance") return T.KB.endurance;
    if (key === "strength") return gender === "female" ? T.KB.sitUp : T.KB.pullUp;
    return T.KB[key];
  };

  /* 生成训练计划。
     opts: {weeks(默认4), focusMale:[key], focusFemale:[key], genderSplit, hasMale, hasFemale}
     每周1次课：热身(10min) + 主体(25min) + 放松(5min) + 课后作业
     第4周为模拟测试课。 */
  T.generatePlan = function (opts) {
    opts = opts || {};
    const weeks = opts.weeks || 4;
    const focusMale = opts.focusMale || [];
    const focusFemale = opts.focusFemale || [];
    const hasMale = opts.hasMale !== false;
    const hasFemale = opts.hasFemale !== false;
    const planWeeks = [];
    const pickMethods = function (keys, gender, weekIdx) {
      const out = [];
      keys.forEach(function (k, ki) {
        const kb = T.itemToKB(k, gender);
        if (!kb) return;
        /* 每周轮换方法组合：第1周 A+B、第2周 A+C、第3周 B+C… */
        const ms = kb.methods;
        const pattern = [
          [0, 1], [0, 2], [1, 2], [0, 1],
        ][weekIdx % 4];
        pattern.forEach(function (mi) {
          if (ms[mi]) {
            const method = ms[mi];
            let label = method.name;
            if (gender === "male") label += "（男生）"; else label += "（女生）";
            out.push({ title: label, steps: method.steps, dosage: method.dosage, notes: method.notes });
          }
        });
      });
      return out;
    };
    for (let w = 1; w <= weeks; w++) {
      let lesson;
      if (w === weeks) {
        /* 模拟测试课 */
        const testItems = [];
        const mkTestRow = function (label, genderLabel) {
          return "测量" + label + "：" + (genderLabel ? "男生" + genderLabel + " / 女生" + genderLabel : "") + "并记录成绩，用于复测对比";
        };
        testItems.push("按正式体测顺序依次测试：身高体重 → 肺活量 → 坐位体前屈 → 立定跳远 → 50米跑 → 引体向上（男）/仰卧起坐（女） → 800米（女）/1000米（男）");
        testItems.push("测试前充分热身15分钟（慢跑+动态拉伸），避免受伤");
        testItems.push("记录每名同学的成绩，课后录入软件生成复测报告");
        lesson = {
          week: w,
          theme: "模拟测试课（复测）",
          warmup: T.WARMUP,
          main: [{ title: "完整模拟体测", items: testItems }],
          cooldown: T.COOLDOWN,
          homework: ["查看个人复测报告，了解进步与不足"],
        };
      } else {
        const mainBlocks = [];
        if (hasMale && focusMale.length) mainBlocks.push({ genderLabel: "男生", title: "男生主练项目", entries: pickMethods(focusMale, "male", w - 1) });
        if (hasFemale && focusFemale.length) mainBlocks.push({ genderLabel: "女生", title: "女生主练项目", entries: pickMethods(focusFemale, "female", w - 1) });
        if (!mainBlocks.length) {
          /* 无薄弱项：保持提升计划 */
          const keep = [];
          ["vitalCapacity", "run50", "standJump", "sitReach", "endurance", "strength"].forEach(function (k) {
            const kb = T.itemToKB(k, "male");
            const m = kb.methods[0];
            keep.push({ title: m.name, steps: m.steps, dosage: m.dosage, notes: m.notes });
          });
          mainBlocks.push({ genderLabel: "全体", title: "综合保持训练", entries: keep.slice(0, 4) });
        }
        const homework = [];
        const hwKeys = [];
        if (focusMale.length) hwKeys.push({ keys: focusMale.slice(0, 1), gender: "male" });
        if (focusFemale.length) hwKeys.push({ keys: focusFemale.slice(0, 1), gender: "female" });
        if (!hwKeys.length) hwKeys.push({ keys: ["endurance"], gender: null });
        hwKeys.forEach(function (h) {
          const kb = T.itemToKB(h.keys[0], h.gender);
          if (kb && kb.tips.length) {
            const label = h.gender === "male" ? "男生： " : h.gender === "female" ? "女生： " : "";
            homework.push(label + kb.tips[0]);
          }
        });
        homework.push("每天坚持锻炼30分钟以上，量力而行，保证睡眠");
        lesson = { week: w, theme: "第" + w + "周训练课", warmup: T.WARMUP, main: mainBlocks, cooldown: T.COOLDOWN, homework: homework };
      }
      planWeeks.push(lesson);
    }
    return {
      generatedAt: new Date().toISOString(),
      weeks: weeks,
      focusMale: focusMale,
      focusFemale: focusFemale,
      planWeeks: planWeeks,
    };
  };

  /* 为薄弱项生成建议段落（个人/班级报告共用） */
  T.suggestForWeakItems = function (weakList, gender) {
    /* weakList: [{key, score?...}] */
    if (!weakList || !weakList.length) return [];
    const out = [];
    weakList.slice(0, 3).forEach(function (w) {
      const kb = T.itemToKB(w.key, gender);
      if (!kb) return;
      const m0 = kb.methods[0], m1 = kb.methods[1];
      const label = FCS.scoring.itemLabel(w.key, gender);
      let txt = "【" + label + "】" + kb.intro + " 建议训练：" +
        (m0 ? m0.name + "（" + m0.dosage + "）" : "") +
        (m1 ? "、" + m1.name + "（" + m1.dosage + "）" : "") + "。";
      if (kb.tips && kb.tips.length) txt += " " + kb.tips[0] + "。";
      out.push(txt);
    });
    return out;
  };

  FCS.training = T;
})();
