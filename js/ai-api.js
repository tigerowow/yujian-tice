/* ai-api.js — 扣子（coze.cn）API客户端：联网问答
   配置存独立 localStorage 键 fcs_ai_config，不进 data 主结构（防止备份导出泄露密钥、导入备份覆盖）
   流程：POST /v3/chat → 轮询 /v3/chat/retrieve 到 completed → GET /v3/chat/message/list 取 assistant 回答
   api.coze.cn 已实测允许浏览器直连（Access-Control-Allow-Origin:*），file:// 下可用 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const A = {};

  A.CONFIG_KEY = "fcs_ai_config";
  const API_BASE = "https://api.coze.cn";

  A.getConfig = function () {
    try {
      const v = JSON.parse(localStorage.getItem(A.CONFIG_KEY) || "{}");
      if (v.enabled && v.botId && v.token) return { botId: v.botId, token: v.token, enabled: true };
    } catch (e) {}
    /* 用户端场景：预置配置（管理端打包时注入的 ai-config.js），界面无需填写 */
    try {
      if (window.AI_CONFIG && window.AI_CONFIG.botId && window.AI_CONFIG.token) {
        return { botId: String(window.AI_CONFIG.botId), token: String(window.AI_CONFIG.token), enabled: true };
      }
    } catch (e) {}
    return { botId: "", token: "", enabled: false };
  };

  A.saveConfig = function (cfg) {
    localStorage.setItem(A.CONFIG_KEY, JSON.stringify({ botId: cfg.botId || "", token: cfg.token || "", enabled: !!cfg.enabled }));
  };

  /* 智能体ID：支持纯数字ID或完整链接（取链接中最后一段≥8位的数字） */
  A.parseBotId = function (v) {
    const s = String(v || "").trim();
    const ms = s.match(/\d{8,}/g);
    return ms && ms.length ? ms[ms.length - 1] : "";
  };

  A.isConfigured = function () {
    const cfg = A.getConfig();
    return cfg.enabled && !!A.parseBotId(cfg.botId) && !!cfg.token;
  };

  A.userId = function () {
    try {
      let id = localStorage.getItem("fcs_ai_uid");
      if (!id) { id = FCS.util.uid("u"); localStorage.setItem("fcs_ai_uid", id); }
      return id;
    } catch (e) { return "local_user"; }
  };

  /* 扣子错误码 → 中文提示 */
  A.friendlyError = function (code, msg) {
    if (code === 4101 || code === 4010) return "密钥没有被Coze识别：新令牌可能需等几分钟才生效；也可能是复制不完整，或令牌与智能体不在同一个账号下";
    if (code === 4020) return "令牌没有chat权限：请在Coze后台重新生成令牌并勾选chat（会话）权限";
    if (code === 4000) return "请求参数有误：请把下面括号里的错误码发给开发者检查";
    if (code === 404 || code === 4040) return "智能体不存在或未发布：请检查智能体ID是否正确，并在Coze后台将智能体发布为API服务";
    if (code === 429) return "提问太频繁，请稍等片刻再试";
    if (code === 500) return "Coze服务器繁忙，请稍后再试";
    return "Coze返回错误" + (code ? "（" + code + "）" : "") + (msg ? "：" + msg : "");
  };

  /* 构造发送给AI的上下文：身份设定 + 全部班级最新批次的数据概要 + 问题中点名学生的详细数据 + 用户问题 */
  A.buildContext = function (q) {
    const lines = ["你是育健体测分析软件内置的AI教练——一位资深体育老师与运动训练专家，请用中文回答。回答规则：①涉及软件数据的问题（学生或班级的成绩、排名、薄弱项、进步、训练安排等），必须严格依据下面提供的数据，数据里没有的内容不要编造；若用户问到没有数据的学生，请明确告知软件里没有该学生的成绩。②数据之外的运动与健康问题（如运动后饮食、睡眠与恢复、伤病预防、体质改善、训练原理、运动营养、各项运动知识等），请以运动专家身份直接专业解答，可结合运动科学常识与自身知识；若你具备联网搜索能力，可搜索最新信息补充。回答范围不限于计分规则与训练，凡运动健康相关问题都应尽力解答。③口吻像一位经验丰富的体育老师：专业、实用、易懂，给出行之有效的具体建议。"];
    const classes = FCS.app.data.classes;
    classes.forEach(function (cls) {
      const batch = cls.batches.length ? cls.batches[cls.batches.length - 1] : null;
      if (!batch || !batch.students.length) return;
      lines.push("【班级】" + cls.name);
      /* 该班所有批次概要（用户可能问到任意批次） */
      lines.push("【该班所有批次】" + cls.batches.map(function (b) {
        const bs = FCS.analysis.batchStats(b);
        return b.name + "(" + b.testDate + ")共" + b.students.length + "人 平均" + (bs.total.avg === null ? "—" : bs.total.avg) + " 及格率" + (bs.total.passRate === null ? "—" : bs.total.passRate + "%");
      }).join("；"));
      lines.push("【最新批次】" + batch.name + "（" + batch.testDate + "）");
      const stats = FCS.analysis.batchStats(batch);
      lines.push("【统计】共" + stats.total.count + "人，平均分" + stats.total.avg + "，及格率" + stats.total.passRate + "%");
      const wk = FCS.analysis.weakItems(stats, { gender: "all" });
      if (wk.weaknesses.length) {
        lines.push("【薄弱项目】" + wk.weaknesses.map(function (w) { return w.label + "（平均" + w.avgScore + "分、及格率" + w.passRate + "%）"; }).join("；"));
      }
      if (wk.strengths.length) {
        lines.push("【优势项目】" + wk.strengths.map(function (w) { return w.label + "（平均" + w.avgScore + "分）"; }).join("；"));
      }
      lines.push("【学生】" + stats.computed.slice(0, 20).map(function (x) {
        return x.name + (x.gender === "male" ? "(男)" : "(女)") + (x.complete ? "总分" + x.total + "分" + x.grade : "成绩不全");
      }).join("、"));
      /* 前后两次对比数据（进步最明显类问题要用） */
      if (cls.batches.length >= 2) {
        const prev = cls.batches[cls.batches.length - 2];
        const cmp = FCS.analysis.compareBatches(prev, batch);
        lines.push("【对比数据】" + prev.name + "→" + batch.name + "：全班平均分" +
          (cmp.statsA.total.avg === null ? "—" : cmp.statsA.total.avg) + "→" +
          (cmp.statsB.total.avg === null ? "—" : cmp.statsB.total.avg) +
          "，进步" + cmp.improved.length + "人、退步" + cmp.declined.length + "人");
        if (cmp.improved.length) {
          lines.push("【进步前10】" + cmp.improved.slice(0, 10).map(function (m) { return m.name + " +" + m.totalDelta + "分"; }).join("、"));
        }
        if (cmp.declined.length) {
          lines.push("【退步前3】" + cmp.declined.slice(0, 3).map(function (m) { return m.name + " -" + Math.abs(m.totalDelta) + "分"; }).join("、"));
        }
      }
    });
    /* 问题中提到某个学生 → 附带该生的详细数据（全名单搜索，1480人也找得到） */
    let foundS = null;
    try { foundS = FCS.aiBrain.findStudent(q); } catch (e) { foundS = null; }
    if (foundS) {
      const S = FCS.scoring;
      lines.push("【问题中提到的学生】" + foundS.s.name + "（" + (foundS.s.gender === "male" ? "男" : "女") + "，" + foundS.cls.name + "·" + foundS.batch.name + "）");
      const rep = FCS.analysis.studentReport(foundS.batch, foundS.s.id);
      if (rep.complete) {
        lines.push("【该生数据】总分" + rep.total + "分（" + rep.grade + "），全班第" + rep.classRank + "名、" + (foundS.s.gender === "male" ? "男生" : "女生") + "中第" + rep.genderRank + "名");
        const itemLines = [];
        S.items.forEach(function (k) {
          itemLines.push(S.itemLabel(k, foundS.s.gender) + (rep.itemScores[k] === null ? "未填" : rep.itemScores[k] + "分"));
        });
        lines.push("【该生各项目得分】" + itemLines.join("、"));
        const weak = rep.weakItems.must.concat(rep.weakItems.relative);
        if (weak.length) {
          lines.push("【该生薄弱项】" + weak.map(function (w) { return S.itemLabel(w.key, foundS.s.gender) + w.score + "分"; }).join("、"));
          lines.push("【该生训练建议】" + FCS.training.suggestForWeakItems(weak.map(function (w) { return { key: w.key }; }), foundS.s.gender).join("；"));
        }
      } else {
        const filled = [];
        S.items.forEach(function (k) {
          if (rep.itemScores[k] !== null) filled.push(S.itemLabel(k, foundS.s.gender) + rep.itemScores[k] + "分");
        });
        lines.push("【该生数据】成绩不完整，已有项目：" + (filled.length ? filled.join("、") : "无"));
      }
      /* 该生在各批次的数据（全部批次，不只最新） */
      const allBatch = [];
      foundS.cls.batches.forEach(function (b) {
        const st = b.students.filter(function (x) { return x.studentNo === foundS.s.studentNo; });
        if (st.length) {
          const rep2 = FCS.analysis.studentReport(b, st[0].id);
          allBatch.push(b.name + "：" + (rep2.complete ? "总分" + rep2.total + "分(" + rep2.grade + ")" : "成绩不全"));
        }
      });
      if (allBatch.length > 1) lines.push("【该生各批次成绩】" + allBatch.join("；"));
      /* 进步/复测类问题 → 附带前后对比 */
      if (/进步|退步|复测|对比|变化|提高|提升|下降/.test(q)) {
        const idx = foundS.cls.batches.indexOf(foundS.batch);
        if (idx > 0) {
          const cmp = FCS.analysis.compareBatches(foundS.cls.batches[idx - 1], foundS.batch);
          const row = cmp.matched.filter(function (m) { return m.studentNo === foundS.s.studentNo; })[0];
          if (row && row.totalDelta !== null) {
            lines.push("【该生前后对比】上次总分" + row.before.total + "分，本次" + row.after.total + "分，变化" + (row.totalDelta >= 0 ? "+" : "") + row.totalDelta + "分");
          }
        }
      }
    }
    lines.push("【用户问题】" + q);
    const text = lines.join("\n");
    return text.length > 3000 ? text.slice(0, 3000) : text;
  };

  function apiFetch(url, opts) {
    return fetch(url, opts).then(function (r) { return r.json(); });
  }

  A.pollRetrieve = function (chatId, convId, token, n) {
    if (n >= 30) return Promise.reject({ friendly: "AI响应超时，请稍后再试" });
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        apiFetch(API_BASE + "/v3/chat/retrieve?conversation_id=" + encodeURIComponent(convId) + "&chat_id=" + encodeURIComponent(chatId), {
          headers: { "Authorization": "Bearer " + token },
        }).then(function (res) {
          if (!res || res.code !== 0) return reject({ friendly: A.friendlyError(res && res.code, res && res.msg), code: res && res.code, msg: res && res.msg });
          const st = res.data && res.data.status;
          if (st === "completed") return resolve();
          if (st === "failed" || st === "requires_action") return reject({ friendly: "智能体执行失败，请检查智能体的配置" });
          A.pollRetrieve(chatId, convId, token, n + 1).then(resolve, reject);
        }, function () {
          reject({ friendly: "联网失败，请检查网络后重试" });
        });
      }, 500);
    });
  };

  /* 提问 → Promise<{ok:true,answer} | {ok:false,error}>；失败时软件一切照常 */
  A.ask = function (question) {
    const cfg = A.getConfig();
    if (!A.isConfigured()) return Promise.resolve({ ok: false, error: "尚未配置Coze" });
    const botId = A.parseBotId(cfg.botId);
    let chatId = null, convId = null;
    return apiFetch(API_BASE + "/v3/chat", {
      method: "POST",
      headers: { "Authorization": "Bearer " + cfg.token, "Content-Type": "application/json" },
      body: JSON.stringify({
        bot_id: botId,
        user_id: A.userId(),
        stream: false,
        auto_save_history: true,
        additional_messages: [{ role: "user", content: A.buildContext(question), content_type: "text" }],
      }),
    }).then(function (res) {
      if (!res || res.code !== 0) return Promise.reject({ friendly: A.friendlyError(res && res.code, res && res.msg), code: res && res.code, msg: res && res.msg });
      chatId = res.data.id;
      convId = res.data.conversation_id;
      return A.pollRetrieve(chatId, convId, cfg.token, 0);
    }).then(function () {
      return apiFetch(API_BASE + "/v3/chat/message/list?conversation_id=" + encodeURIComponent(convId) + "&chat_id=" + encodeURIComponent(chatId), {
        headers: { "Authorization": "Bearer " + cfg.token },
      });
    }).then(function (res) {
      if (!res || res.code !== 0) return Promise.reject({ friendly: A.friendlyError(res && res.code, res && res.msg), code: res && res.code, msg: res && res.msg });
      const list = res.data || [];
      let answer = "";
      for (let i = list.length - 1; i >= 0; i--) {
        const m = list[i];
        if (m.role === "assistant" && m.type === "answer" && m.content) { answer = String(m.content); break; }
      }
      if (!answer.trim()) return Promise.reject({ friendly: "AI没有返回内容，请检查智能体的回复设置" });
      return { ok: true, answer: answer };
    }).catch(function (e) {
      if (e && e.friendly) return { ok: false, error: e.friendly, code: e.code, msg: e.msg };
      return { ok: false, error: "联网失败，请检查网络后重试" };
    });
  };

  /* ---- 设置页表单 ---- */
  A.fillForm = function () {
    const cfg = A.getConfig();
    const b = document.getElementById("ai-bot-id");
    const t = document.getElementById("ai-token");
    const e = document.getElementById("ai-enabled");
    if (b) b.value = cfg.botId;
    if (t) t.value = cfg.token;
    if (e) e.checked = !!cfg.enabled;
    A.renderStatus();
  };

  A.renderStatus = function () {
    const st = document.getElementById("ai-status");
    if (!st) return;
    if (A.isConfigured()) {
      st.innerHTML = "<span style='color:var(--success)'>已配置，联网问答已就绪</span>";
    } else {
      st.innerHTML = "<span style='color:var(--text-2)'>尚未配置（本地大脑不受影响，始终可用）</span>";
    }
  };

  A.saveFromForm = function (silent) {
    const b = document.getElementById("ai-bot-id");
    const t = document.getElementById("ai-token");
    const e = document.getElementById("ai-enabled");
    const enabled = e ? e.checked : false;
    const botRaw = b ? b.value.trim() : "";
    const token = t ? t.value.trim() : "";
    if (enabled && (!A.parseBotId(botRaw) || !token)) {
      FCS.util.toast("启用联网问答需要填写智能体ID和API密钥", "error");
      A.renderStatus();
      return;
    }
    A.saveConfig({ botId: botRaw, token: token, enabled: enabled });
    A.renderStatus();
    if (!silent) FCS.util.toast(enabled ? "AI教练配置已保存" : "已关闭联网问答", "success");
  };

  /* 导出用户端配置文件（管理端专用）：把当前配置写入 ai-config.js 下载，打包用户端或发布网页版时自动注入 */
  A.exportUserConfig = function () {
    const cfg = A.getConfig();
    if (!A.isConfigured()) {
      FCS.util.toast("请先保存并启用AI配置，再导出用户端配置", "error");
      return;
    }
    const content = "/* 育健体测分析 用户端/网页版AI配置（管理端生成；密钥30天有效，过期请由管理员更新） */\n" +
      "window.AI_CONFIG = { botId: " + JSON.stringify(A.parseBotId(cfg.botId)) + ", token: " + JSON.stringify(cfg.token) + " };";
    FCS.util.downloadText("ai-config.js", content);
    FCS.util.toast("已下载 ai-config.js，请把该文件放到软件文件夹根目录（与 index.html 同级），打包用户端或发布网页版时会自动注入", "success");
  };

  /* 测试连接：即运行时CORS验证（直连+发布+权限三件事一次验证） */
  A.testFromForm = function () {
    A.saveFromForm(true);
    if (!A.isConfigured()) return;
    const st = document.getElementById("ai-status");
    if (st) st.innerHTML = "正在测试连接…";
    A.ask("你好，请只回复四个字：连接成功").then(function (r) {
      const st2 = document.getElementById("ai-status");
      if (r.ok) {
        if (st2) st2.innerHTML = "<span style='color:var(--success)'>连接成功！联网问答已就绪</span>";
        FCS.util.toast("Coze连接成功", "success");
      } else {
        const detail = r.error + (r.code ? "（错误码 " + r.code + (r.msg ? "：" + r.msg : "") + "）" : "");
        if (st2) st2.innerHTML = "<span style='color:var(--danger)'>测试失败：" + FCS.util.esc(detail) + "</span>";
        FCS.util.toast("测试失败：" + detail, "error");
      }
    });
  };

  FCS.aiAPI = A;
})();
