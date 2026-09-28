/* view-classes.js — 班级与测试批次管理 */
(function () {
  "use strict";
  const FCS = window.FCS;

  const data = function () { return FCS.app.data; };

  /* 新建/编辑班级弹窗 */
  function showClassModal(existing) {
    const U = FCS.util;
    const body = document.createElement("div");
    body.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:12px;min-width:380px">' +
      '<div><label class="field">班级名称（如：2024级体育教育1班）</label>' +
      '<input id="m-cls-name" class="input" style="width:100%" value="' + U.esc(existing ? existing.name : "") + '"></div>' +
      '<div><label class="field">任课教师</label>' +
      '<input id="m-cls-teacher" class="input" style="width:100%" value="' + U.esc(existing ? existing.teacher : "") + '"></div>' +
      '<div><label class="field">学期（如：2025-2026学年第一学期）</label>' +
      '<input id="m-cls-semester" class="input" style="width:100%" value="' + U.esc(existing ? existing.semester : "") + '"></div>' +
      "</div>";
    const m = U.showModal({
      title: existing ? "编辑班级" : "新建班级",
      body: body,
      actions: [
        { text: "取消", onClick: function (api) { api.close(); } },
        {
          text: "保存", primary: true, onClick: function (api) {
            const name = document.getElementById("m-cls-name").value.trim();
            if (!name) { U.toast("请填写班级名称", "warn"); return; }
            if (existing) {
              existing.name = name;
              existing.teacher = document.getElementById("m-cls-teacher").value.trim();
              existing.semester = document.getElementById("m-cls-semester").value.trim();
            } else {
              FCS.storage.createClass(data(), {
                name: name,
                teacher: document.getElementById("m-cls-teacher").value.trim(),
                semester: document.getElementById("m-cls-semester").value.trim(),
              });
            }
            FCS.storage.save(data());
            api.close();
            U.toast("已保存", "success");
            FCS.app.refresh();
          },
        },
      ],
    });
  }

  /* 新建批次弹窗 */
  function showBatchModal(classId) {
    const U = FCS.util;
    const cls = FCS.storage.findClass(data(), classId);
    const body = document.createElement("div");
    let copyOptions = "";
    cls.batches.forEach(function (b) {
      copyOptions += '<option value="' + b.id + '">' + U.esc(b.name + "（" + b.testDate + "）") + "</option>";
    });
    body.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:12px;min-width:400px">' +
      '<div><label class="field">批次名称（如：2026年10月复测）</label>' +
      '<input id="m-b-name" class="input" style="width:100%" placeholder="如：2026年10月复测"></div>' +
      '<div><label class="field">测试日期</label>' +
      '<input id="m-b-date" class="input" type="date" style="width:100%" value="' + U.today() + '"></div>' +
      "<div><label class=\"field\">复制名单（可选）</label>" +
      '<select id="m-b-copy" class="input" style="width:100%"><option value="">不复制（空批次）</option>' + copyOptions + "</select>" +
      '<div class="text-sm text-2 mt8">复测时选择上次的批次，可一键复制学号、姓名、性别，成绩留空重新录入</div></div>' +
      "</div>";
    const m = U.showModal({
      title: "新建测试批次",
      body: body,
      actions: [
        { text: "取消", onClick: function (api) { api.close(); } },
        {
          text: "创建", primary: true, onClick: function (api) {
            const name = document.getElementById("m-b-name").value.trim() || ("测试批次 " + (cls.batches.length + 1));
            const b = FCS.storage.createBatch(data(), classId, {
              name: name,
              testDate: document.getElementById("m-b-date").value || U.today(),
              copyFromBatchId: document.getElementById("m-b-copy").value || null,
            });
            api.close();
            FCS.app.setClass(classId);
            FCS.app.setBatch(b.id);
            U.toast("批次已创建", "success");
          },
        },
      ],
    });
  }

  FCS.app.registerView("classes", {
    title: "班级管理",
    render: function (el) {
      const U = FCS.util;
      const UC = FCS.uiCommon;
      const esc = U.esc;
      const d = data();

      let html = UC.viewHead("班级管理", "新建班级与测试批次；复测可从上次批次一键复制名单",
        '<button class="btn btn-primary" onclick="FCS.uiViews.showClassModal()">＋ 新建班级</button>');
      if (!d.classes.length) {
        html += UC.empty("还没有班级，点击右上角「新建班级」开始",
          '<button class="btn btn-primary" onclick="FCS.uiViews.showClassModal()">＋ 新建班级</button>');
        el.innerHTML = html;
        return;
      }
      html += '<div class="class-grid">';
      d.classes.forEach(function (c) {
        const studentCount = c.batches.reduce(function (s, b) { return s + b.students.length; }, 0);
        html += '<div class="card class-card">' +
          '<div class="flex space-between items-center">' +
          '<div class="cc-name">' + esc(c.name) + "</div>" +
          '<div class="flex gap8">' +
          '<button class="btn btn-sm" onclick="FCS.uiViews.showClassModal(\'' + c.id + '\')">编辑</button>' +
          '<button class="btn btn-sm btn-danger" onclick="FCS.uiViews.removeClass(\'' + c.id + '\')">删除</button>' +
          "</div></div>" +
          '<div class="cc-meta">教师：' + esc(c.teacher || "未填写") + "　·　学期：" + esc(c.semester || "未填写") + "</div>" +
          '<div class="cc-meta">批次 ' + c.batches.length + " 个　·　学生记录 " + studentCount + " 条</div>" +
          '<div class="cc-batches">';
        c.batches.forEach(function (b) {
          const isCur = b.id === FCS.app.ctx.batchId;
          html += '<div class="batch-row' + (isCur ? " current" : "") + '" onclick="FCS.uiViews.openBatch(\'' + c.id + "','" + b.id + '\')">' +
            '<div><div class="bold">' + esc(b.name) + '</div>' +
            '<div class="text-sm text-2">' + esc(b.testDate) + " · " + b.students.length + " 名学生" + (b.note ? " · " + esc(b.note) : "") + "</div></div>" +
            '<div class="flex gap8 no-print">' +
            '<button class="btn btn-sm" onclick="event.stopPropagation();FCS.uiViews.renameBatch(\'' + c.id + "','" + b.id + '\')">改名</button>' +
            '<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();FCS.uiViews.removeBatch(\'' + c.id + "','" + b.id + '\')">删除</button>' +
            "</div></div>";
        });
        html += "</div>" +
          '<button class="btn mt8" style="width:100%" onclick="FCS.uiViews.showBatchModal(\'' + c.id + '\')">＋ 新建测试批次</button>' +
          "</div>";
      });
      html += "</div>";
      el.innerHTML = html;
    },
  });

  /* 暴露给 onclick 使用 */
  FCS.uiViews = FCS.uiViews || {};
  const V = FCS.uiViews;
  V.showClassModal = function (id) { showClassModal(id ? FCS.storage.findClass(data(), id) : null); };
  V.showBatchModal = showBatchModal;
  V.openBatch = function (classId, batchId) {
    FCS.app.setClass(classId);
    FCS.app.setBatch(batchId);
    FCS.app.navigate("#/entry");
  };
  V.removeClass = function (id) {
    const U = FCS.util;
    const c = FCS.storage.findClass(data(), id);
    const d = data();
    U.confirm("确定要删除班级「" + c.name + "」吗？该班级下所有批次和成绩将被删除。<br>建议先到「设置」页导出数据备份。", { danger: true, okText: "删除" }).then(function (ok) {
      if (!ok) return;
      d.classes = d.classes.filter(function (x) { return x.id !== id; });
      if (FCS.app.ctx.classId === id) { FCS.app.ctx.classId = null; FCS.app.ctx.batchId = null; }
      d.ui.lastClassId = FCS.app.ctx.classId;
      d.ui.lastBatchId = null;
      FCS.storage.save(d);
      U.toast("班级已删除", "success");
      FCS.app.refresh();
    });
  };
  V.removeBatch = function (classId, batchId) {
    const U = FCS.util;
    const c = FCS.storage.findClass(data(), classId);
    const b = c.batches.find(function (x) { return x.id === batchId; });
    const d = data();
    U.confirm("确定要删除批次「" + b.name + "」吗？批次内 " + b.students.length + " 名学生的成绩将一并删除。<br>建议先到「设置」页导出数据备份。", { danger: true, okText: "删除" }).then(function (ok) {
      if (!ok) return;
      c.batches = c.batches.filter(function (x) { return x.id !== batchId; });
      if (FCS.app.ctx.batchId === batchId) FCS.app.ctx.batchId = c.batches.length ? c.batches[c.batches.length - 1].id : null;
      d.ui.lastBatchId = FCS.app.ctx.batchId;
      FCS.storage.save(d);
      U.toast("批次已删除", "success");
      FCS.app.refresh();
    });
  };
  V.renameBatch = function (classId, batchId) {
    const U = FCS.util;
    const c = FCS.storage.findClass(data(), classId);
    const b = c.batches.find(function (x) { return x.id === batchId; });
    const body = document.createElement("div");
    body.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:12px;min-width:380px">' +
      '<div><label class="field">批次名称</label><input id="m-rb-name" class="input" style="width:100%" value="' + U.esc(b.name) + '"></div>' +
      '<div><label class="field">测试日期</label><input id="m-rb-date" class="input" type="date" style="width:100%" value="' + U.esc(b.testDate) + '"></div>' +
      "</div>";
    U.showModal({
      title: "批次设置",
      body: body,
      actions: [
        { text: "取消", onClick: function (api) { api.close(); } },
        {
          text: "保存", primary: true, onClick: function (api) {
            b.name = document.getElementById("m-rb-name").value.trim() || b.name;
            b.testDate = document.getElementById("m-rb-date").value || b.testDate;
            FCS.storage.save(data());
            api.close();
            FCS.app.refresh();
          },
        },
      ],
    });
  };
})();
