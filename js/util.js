/* util.js — 通用工具函数 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const U = {};

  /* 生成唯一ID */
  U.uid = function (prefix) {
    return (prefix || "x") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  /* 容错数字解析："7.4秒"→7.4、""→null、非法→null */
  U.parseNum = function (v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return isFinite(v) ? v : null;
    const s = String(v).trim().replace(/[^\d.\-]/g, "");
    if (s === "" || s === "." || s === "-") return null;
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  };

  /* 耐力跑时间解析：支持 4.07(分.秒) / 4'07 / 4:07 / 4分07秒 / Excel时间文本
     返回 {seconds, display, ok, error} */
  U.parseEndurance = function (v) {
    if (v === null || v === undefined || String(v).trim() === "") return { ok: false, error: "未填写" };
    let s = String(v).trim();
    // 处理Excel把 4:07 存成时间序列的情况（如 0.17≈4:07 的序列值）
    if (typeof v === "number" && v > 0 && v < 1) {
      // 序列值：一天=1，4:07=247秒/86400≈0.00286 —— 这是"凌晨时间"序列
      // 但 4.07 也是数字且在合理范围内，优先按 分.秒 解析，仅当明显是序列值时转换
      const totalSec = Math.round(v * 86400);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      if (min >= 1 && min <= 15 && s.indexOf(".") === -1) {
        s = min + "." + String(sec).padStart(2, "0");
      }
    }
    let m;
    // 4分07秒 / 4分钟07秒
    m = s.match(/^(\d+)\s*分(?:钟)?\s*(\d{1,2})\s*秒?$/);
    if (m) return buildEndurance(parseInt(m[1], 10), parseInt(m[2], 10));
    // 4'07 或 4"07
    m = s.match(/^(\d+)\s*[′'"]\s*(\d{1,2})\s*[″"]?$/);
    if (m) return buildEndurance(parseInt(m[1], 10), parseInt(m[2], 10));
    // 4:07 或 4:07:00（Excel时间格式文本）
    m = s.match(/^(\d+):(\d{1,2})(?::\d{1,2})?\s*$/);
    if (m) return buildEndurance(parseInt(m[1], 10), parseInt(m[2], 10));
    // 4.07 分.秒（小数形式）
    const n = parseFloat(s);
    if (isFinite(n)) {
      const min = Math.floor(n);
      const sec = Math.round((n - min) * 100);
      if (sec >= 60) return { ok: false, error: "秒数应小于60（如 4.07 = 4分07秒）" };
      return buildEndurance(min, sec, v);
    }
    return { ok: false, error: "格式无法识别（支持 4.07 / 4:07 / 4'07 / 4分07秒）" };
  };
  function buildEndurance(min, sec) {
    if (sec >= 60) return { ok: false, error: "秒数应小于60" };
    if (min < 0) return { ok: false, error: "时间不能为负数" };
    const seconds = min * 60 + sec;
    if (seconds <= 0) return { ok: false, error: "时间必须大于0" };
    const display = min + "'" + String(sec).padStart(2, "0");
    return { ok: true, seconds, display };
  }
  U.formatEndurance = function (seconds) {
    if (seconds === null || seconds === undefined) return "—";
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60);
    return min + "'" + String(sec).padStart(2, "0");
  };

  /* 数字格式化：1位小数（总分） */
  U.fmt1 = function (n) { return n === null || n === undefined ? "—" : (Math.round(n * 10) / 10).toFixed(1); };
  U.fmt0 = function (n) { return n === null || n === undefined ? "—" : String(Math.round(n)); };
  U.fmtPct = function (n) { return n === null || n === undefined ? "—" : (Math.round(n * 10) / 10) + "%"; };

  /* 下载Blob文件 */
  U.downloadBlob = function (filename, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }, 500);
  };
  U.downloadText = function (filename, text) {
    U.downloadBlob(filename, new Blob([text], { type: "application/json;charset=utf-8" }));
  };

  /* Toast 提示 */
  U.toast = function (msg, type) {
    let box = document.getElementById("toast-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "toast-box";
      document.body.appendChild(box);
    }
    const el = document.createElement("div");
    el.className = "toast" + (type ? " toast-" + type : "");
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity .4s";
      setTimeout(function () { el.remove(); }, 400);
    }, 2600);
  };

  /* 确认弹窗：注意必须先 resolve 再 close（close 会触发 onClose 兜底 resolve(false)） */
  U.confirm = function (msg, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      U.showModal({
        title: opts.title || "确认操作",
        body: "<div style='font-size:15px;line-height:1.7'>" + msg + "</div>",
        actions: [
          { text: opts.cancelText || "取消", onClick: function (m) { resolve(false); m.close(); } },
          { text: opts.okText || "确定", primary: true, danger: opts.danger, onClick: function (m) { resolve(true); m.close(); } },
        ],
        closable: true,
        onClose: function () { resolve(false); },
      });
    });
  };

  /* 通用弹窗：body 可为HTML字符串或DOM节点；actions: [{text, primary, danger, onClick(modal)}] */
  U.showModal = function (opts) {
    const mask = document.createElement("div");
    mask.className = "modal-mask";
    const modal = document.createElement("div");
    modal.className = "modal";
    if (opts.width) modal.style.width = opts.width;
    const head = document.createElement("div");
    head.className = "modal-head";
    head.innerHTML = "<span></span>";
    head.firstChild.textContent = opts.title || "";
    const x = document.createElement("button");
    x.className = "modal-x";
    x.textContent = "✕";
    x.title = "关闭";
    head.appendChild(x);
    const body = document.createElement("div");
    body.className = "modal-body";
    if (typeof opts.body === "string") body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    modal.appendChild(head);
    modal.appendChild(body);
    const foot = document.createElement("div");
    foot.className = "modal-foot";
    const api = {
      el: modal,
      body: body,
      close: function () {
        mask.remove();
        if (opts.onClose) opts.onClose();
      },
      setTitle: function (t) { head.firstChild.textContent = t; },
    };
    x.onclick = function () { if (opts.closable !== false) api.close(); };
    if (opts.actions && opts.actions.length) {
      opts.actions.forEach(function (a) {
        const btn = document.createElement("button");
        btn.className = "btn" + (a.primary ? " btn-primary" : "") + (a.danger ? " btn-danger" : "");
        btn.textContent = a.text;
        btn.onclick = function () { a.onClick && a.onClick(api); };
        foot.appendChild(btn);
      });
      modal.appendChild(foot);
    } else {
      foot.remove();
    }
    mask.appendChild(modal);
    document.body.appendChild(mask);
    return api;
  };

  /* HTML转义 */
  U.esc = function (s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  /* 当前日期字符串 */
  U.today = function () {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  U.nowStamp = function () {
    const d = new Date();
    return U.today() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  };
  U.dateTime = function (iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  };

  FCS.util = U;
})();
