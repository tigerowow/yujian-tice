/* app.js — 应用壳：启动、hash路由、视图注册、全局上下文（当前班级/批次）
   必须最后加载。 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const A = {};

  A.views = {};      /* id → {title, icon, render(el)} */
  A.data = null;     /* 全局数据 */
  A.ctx = { classId: null, batchId: null };

  /* 注册视图 */
  A.registerView = function (id, def) {
    A.views[id] = def;
  };

  /* 导航 */
  A.navigate = function (hash) {
    if (location.hash !== hash) location.hash = hash;
    else A.render();
  };

  /* 当前班级/批次对象 */
  A.getClass = function () { return A.ctx.classId ? FCS.storage.findClass(A.data, A.ctx.classId) : null; };
  A.getBatch = function () { return A.ctx.batchId ? FCS.storage.findBatch(A.data, A.ctx.classId, A.ctx.batchId) : null; };

  /* 切换上下文并持久化 */
  A.setClass = function (classId) {
    A.ctx.classId = classId || null;
    if (A.ctx.classId) {
      const c = A.getClass();
      if (!c.batches.length) A.ctx.batchId = null;
      else if (!c.batches.some(function (b) { return b.id === A.ctx.batchId; })) {
        A.ctx.batchId = c.batches[c.batches.length - 1].id;
      }
    } else {
      A.ctx.batchId = null;
    }
    A.data.ui.lastClassId = A.ctx.classId;
    A.data.ui.lastBatchId = A.ctx.batchId;
    FCS.storage.save(A.data);
    A.renderTopbar();
    A.render();
  };
  A.setBatch = function (batchId) {
    A.ctx.batchId = batchId || null;
    A.data.ui.lastBatchId = A.ctx.batchId;
    FCS.storage.save(A.data);
    A.render();
  };

  /* 数据变更后重绘（保存由调用方负责） */
  A.refresh = function () {
    A.renderTopbar();
    A.render();
  };

  /* 渲染顶栏（班级/批次选择器） */
  A.renderTopbar = function () {
    const classSel = document.getElementById("ctx-class");
    const batchSel = document.getElementById("ctx-batch");
    if (!classSel || !batchSel) return;
    const prevClass = A.ctx.classId;
    let html = '<option value="">— 选择班级 —</option>';
    A.data.classes.forEach(function (c) {
      html += '<option value="' + c.id + '"' + (c.id === A.ctx.classId ? " selected" : "") + ">" + FCS.util.esc(c.name) + "</option>";
    });
    classSel.innerHTML = html;
    const cls = A.getClass();
    if (cls) {
      let bhtml = '<option value="">— 选择测试批次 —</option>';
      cls.batches.forEach(function (b) {
        bhtml += '<option value="' + b.id + '"' + (b.id === A.ctx.batchId ? " selected" : "") + ">" +
          FCS.util.esc(b.name + "（" + b.testDate + "）") + "</option>";
      });
      batchSel.innerHTML = bhtml;
      batchSel.disabled = false;
    } else {
      batchSel.innerHTML = '<option value="">— 选择测试批次 —</option>';
      batchSel.disabled = true;
    }
    if (prevClass !== A.ctx.classId) {
      batchSel.value = A.ctx.batchId || "";
    }
  };

  /* 渲染当前视图 */
  A.render = function () {
    const container = document.getElementById("view-container");
    const hash = location.hash || "#/home";
    const parts = hash.replace(/^#\//, "").split("/");
    const viewId = parts[0];
    const view = A.views[viewId] || A.views.home;
    /* 顶栏：班级管理/对比分析/设置页面用不到班级与批次选择器，隐藏顶栏 */
    const topbar = document.getElementById("topbar");
    if (topbar) {
      topbar.style.display = (viewId === "classes" || viewId === "compare" || viewId === "settings" || viewId === "ai") ? "none" : "flex";
    }
    /* 侧边栏高亮 */
    document.querySelectorAll(".side-nav a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#/" + viewId);
    });
    container.innerHTML = "";
    try {
      view.render(container, parts.slice(1));
    } catch (e) {
      console.error("视图渲染失败", e);
      container.innerHTML = '<div class="card"><div class="empty-tip">页面加载出错：' + FCS.util.esc(e.message) + "</div></div>";
    }
  };

  /* 启动 */
  A.boot = function () {
    A.data = FCS.storage.load();
    /* 恢复上下文 */
    if (A.data.ui.lastClassId && FCS.storage.findClass(A.data, A.data.ui.lastClassId)) {
      A.ctx.classId = A.data.ui.lastClassId;
      const c = A.getClass();
      if (A.data.ui.lastBatchId && c && c.batches.some(function (b) { return b.id === A.data.ui.lastBatchId; })) {
        A.ctx.batchId = A.data.ui.lastBatchId;
      } else if (c && c.batches.length) {
        A.ctx.batchId = c.batches[c.batches.length - 1].id;
      }
    }
    /* 顶栏事件 */
    document.getElementById("ctx-class").addEventListener("change", function (e) {
      A.setClass(e.target.value || null);
    });
    document.getElementById("ctx-batch").addEventListener("change", function (e) {
      A.setBatch(e.target.value || null);
    });
    window.addEventListener("hashchange", A.render);
    A.renderTopbar();
    A.render();
  };

  FCS.app = A;
})();
