/* view-ai.js — AI教练视图：聊天界面（本地大脑优先，扣子AI兜底）
   聊天历史存模块级数组，切换页面不丢失（会话内保留） */
(function () {
  "use strict";
  const FCS = window.FCS;
  const AI = {};

  AI.messages = [];   /* {role:'user'|'ai'|'typing', html, tag} */

  /* AI问答模式开关：状态记住（localStorage），打开后所有问题走扣子智能体 */
  try {
    AI.aiModeOn = localStorage.getItem("fcs_ai_mode") === "1";
  } catch (e) { AI.aiModeOn = false; }

  AI.ensureWelcome = function () {
    if (!AI.messages.length) {
      AI.messages.push({
        role: "ai", tag: null,
        html: "你好，我是AI教练，可以回答各班级和学生数据的各种问题。<br>例如：这个班哪些项目最薄弱？某位同学复测进步了吗？引体向上9个多少分？",
      });
    }
  };

  AI.renderDOM = function () {
    const box = document.getElementById("ai-messages");
    if (!box) return;
    const esc = FCS.util.esc;
    box.innerHTML = AI.messages.map(function (m) {
      if (m.role === "user") return '<div class="ai-msg user">' + esc(m.html) + "</div>";
      if (m.role === "typing") {
        return '<div class="ai-msg ai"><span class="ai-typing-dots"><i></i><i></i><i></i></span>' +
          '<span class="ai-typing-label">' + esc(m.html || "正在思考") + "</span></div>";
      }
      return '<div class="ai-msg ai">' + (m.tag ? '<span class="ai-tag">' + esc(m.tag) + "</span>" : "") +
        "<div>" + m.html + "</div>" +
        (m.classOptions && m.classOptions.length
          ? '<div class="ai-opt-row">' + m.classOptions.map(function (cn) {
            return '<span class="ai-opt-chip" data-cn="' + esc(cn) + '" data-q="' + esc(m.classQ || "") + '" onclick="FCS.aiUI.askClassOption(this.getAttribute(\'data-cn\'), this.getAttribute(\'data-q\'))">' + esc(cn) + "</span>";
          }).join("") + "</div>"
          : "") + "</div>";
    }).join("");
    box.scrollTop = box.scrollHeight;
  };

  AI.fillInput = function (t) {
    const i = document.getElementById("ai-input");
    if (i) { i.value = t; i.focus(); }
  };

  AI.send = function () {
    const i = document.getElementById("ai-input");
    const t = (i.value || "").trim();
    if (!t) return;
    i.value = "";
    AI.ask(t);
  };

  AI.clear = function () {
    AI.messages = [];
    AI.ensureWelcome();
    AI.renderDOM();
  };

  AI.setAIMode = function (on) {
    if (on && !FCS.aiAPI.isConfigured()) {
      FCS.util.toast("AI配置未激活，请联系管理员", "error");
      AI.renderMode();
      return false;
    }
    AI.aiModeOn = !!on;
    try { localStorage.setItem("fcs_ai_mode", AI.aiModeOn ? "1" : "0"); } catch (e) {}
    AI.renderMode();
    return true;
  };

  AI.toggleAI = function () {
    AI.setAIMode(!AI.aiModeOn);
  };

  /* 点击班级选项：把原问题里的"这个班"等替换为所选班级名，重新提问 */
  AI.askClassOption = function (cn, origQ) {
    const q0 = String(origQ || "");
    let q = q0.replace(/这个班|该班|本班|咱们班|我们班|全班/g, cn);
    if (q === q0) q = cn + q0;
    return AI.ask(q);
  };

  /* 更新开关样式与输入框提示 */
  AI.renderMode = function () {
    const sw = document.getElementById("ai-switch");
    if (sw) sw.classList.toggle("on", AI.aiModeOn);
    const inp = document.getElementById("ai-input");
    if (inp) {
      inp.placeholder = AI.aiModeOn
        ? "AI问答已开启：所有问题由育健AI教练回答"
        : "问我关于各班级和学生数据的问题，按回车发送";
    }
  };

  AI.replaceTyping = function (m) {
    for (let i = AI.messages.length - 1; i >= 0; i--) {
      if (AI.messages[i].role === "typing") { AI.messages[i] = m; return; }
    }
    AI.messages.push(m);
  };

  AI.ask = function (text) {
    const U = FCS.util;
    AI.ensureWelcome();
    AI.messages.push({ role: "user", html: text });
    AI.messages.push({ role: "typing", html: "正在思考…" });
    AI.renderDOM();
    return new Promise(function (resolve) {
      setTimeout(function () {
        /* AI问答开关打开：所有问题直接走扣子智能体 */
        if (AI.aiModeOn) {
          AI.replaceTyping({ role: "typing", html: "正在询问育健AI教练…" });
          AI.renderDOM();
          FCS.aiAPI.ask(text).then(function (res) {
            if (res.ok) {
              AI.replaceTyping({ role: "ai", html: U.esc(res.answer).replace(/\n/g, "<br>"), tag: "育健AI教练" });
            } else {
              AI.replaceTyping({
                role: "ai", tag: "育健AI教练",
                html: "很抱歉，联网问答没有成功：" + U.esc(res.error) + "<br>可以点输入框旁的「AI问答」开关切回本地问答。",
              });
            }
            AI.renderDOM();
            resolve();
          });
          return;
        }
        const r = FCS.aiBrain.answer(text);
        if (r.matched) {
          const msg = { role: "ai", html: r.answer, tag: r.tag || "本地大脑" };
          if (r.classOptions && r.classOptions.length) { msg.classOptions = r.classOptions; msg.classQ = text; }
          AI.replaceTyping(msg);
          AI.renderDOM();
          resolve();
          return;
        }
        if (!FCS.aiAPI.isConfigured()) {
          AI.replaceTyping({
            role: "ai", tag: "本地大脑",
            html: "这个问题我还没学会。<br>你可以试试问：<br>· 这个班哪些项目最薄弱？<br>· 某位同学的姓名＋怎么样（如“张三怎么样”）<br>· 引体向上9个多少分？<br>想要更灵活的问答，可以到「设置 → AI教练」配置Coze。",
          });
          AI.renderDOM();
          resolve();
          return;
        }
        AI.replaceTyping({
          role: "ai", tag: "本地大脑",
          html: "这个问题我还没学会。<br>你可以试试问：<br>· 这个班哪些项目最薄弱？<br>· 某位同学的姓名＋怎么样（如“张三怎么样”）<br>· 引体向上9个多少分？<br>或者打开输入框旁的「AI问答」开关，让育健AI教练联网回答这个问题。",
        });
        AI.renderDOM();
        resolve();
        return;
        AI.replaceTyping({ role: "typing", html: "正在询问育健AI教练…" });
        AI.renderDOM();
        FCS.aiAPI.ask(text).then(function (res) {
          if (res.ok) {
            AI.replaceTyping({ role: "ai", html: U.esc(res.answer).replace(/\n/g, "<br>"), tag: "育健AI教练" });
          } else {
            AI.replaceTyping({
              role: "ai", tag: "本地大脑",
              html: "很抱歉，联网问答没有成功：" + U.esc(res.error) + "<br>你可以换个问法，或到「设置 → AI教练」检查配置。",
            });
          }
          AI.renderDOM();
          resolve();
        });
      }, 400);
    });
  };

  FCS.app.registerView("ai", {
    title: "AI教练",
    render: function (el) {
      const U = FCS.util;
      const UC = FCS.uiCommon;
      const esc = U.esc;
      AI.ensureWelcome();

      const chips = [
        "这个班哪些项目最薄弱？",
        "全班平均分和及格率怎么样？",
        "男生和女生谁的平均分高？",
        "引体向上9个多少分？",
        "怎么导入成绩？",
      ];
      let dynamicChip = "";
      const defCls = FCS.aiBrain.defaultClass();
      if (defCls && defCls.batches.length && defCls.batches[defCls.batches.length - 1].students.length) {
        const dq = defCls.batches[defCls.batches.length - 1].students[0].name + "复测进步了吗？";
        dynamicChip = '<div class="ai-chip" data-q="' + esc(dq) + '" onclick="FCS.aiUI.fillInput(this.getAttribute(\'data-q\'))">' + esc(dq) + "</div>";
      }

      let html = UC.viewHead("AI教练", "直接提问，可查询全部班级和批次的数据");
      html += '<div class="ai-layout">' +
        '<div class="ai-chat">' +
        '<div class="ai-messages" id="ai-messages"></div>' +
        '<div class="ai-input-row">' +
        '<input id="ai-input" class="input" placeholder="问我关于各班级和学生数据的问题，按回车发送" onkeydown="if(event.key===\'Enter\')FCS.aiUI.send()">' +
        '<div class="ai-switch-wrap" id="ai-switch" onclick="FCS.aiUI.toggleAI()"><span class="ai-switch-label">AI问答</span><span class="ai-switch"><span class="ai-switch-knob"></span></span></div>' +
        '<button class="btn btn-primary" onclick="FCS.aiUI.send()">发送</button>' +
        '<button class="btn" onclick="FCS.aiUI.clear()">清空</button>' +
        "</div></div>" +
        '<div class="ai-side">' +
        '<div class="ai-side-card"><div class="asc-title">我能做什么</div>' +
        '<div class="ai-cap-list">· 查询计分规则（如“引体向上9个多少分”）<br>· 查看学生总分、等级与薄弱项<br>· 查看学生复测进步情况<br>· 分析班级优势与薄弱项目<br>· 查看平均分、及格率等班级指标</div></div>' +
        '<div class="ai-side-card"><div class="asc-title">试试这样问</div>' +
        chips.map(function (t) {
          return '<div class="ai-chip" data-q="' + esc(t) + '" onclick="FCS.aiUI.fillInput(this.getAttribute(\'data-q\'))">' + esc(t) + "</div>";
        }).join("") + dynamicChip + "</div>" +
        '<div class="ai-side-card"><div class="asc-title">提示</div>' +
        '<div class="ai-note">联网问答时，问题中出现的姓名和成绩会发送给Coze平台；本地大脑不受影响，始终离线可用。</div>' +
        (FCS.aiAPI.isConfigured() ? "" : '<div class="ai-note mt8"><span class="stu-link" onclick="FCS.app.navigate(\'#/settings\')">请联系管理员更新AI配置</span></div>') +
        "</div></div></div>";
      el.innerHTML = html;
      AI.renderDOM();
      AI.renderMode();
    },
  });

  FCS.aiUI = AI;
})();
