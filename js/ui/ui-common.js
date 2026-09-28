/* ui-common.js — 视图公共组件：徽章、统计卡、分页等 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const UC = {};
  const esc = function (s) { return FCS.util.esc(s); };

  UC.gradeBadge = function (grade) {
    if (!grade) return '<span class="badge badge-neutral">缺项</span>';
    const map = { 优秀: "excellent", 良好: "good", 及格: "pass", 不及格: "fail" };
    return '<span class="badge badge-' + map[grade] + '">' + grade + "</span>";
  };
  UC.genderBadge = function (gender) {
    return gender === "male" ? '<span class="badge badge-male">男</span>' : '<span class="badge badge-female">女</span>';
  };

  UC.statCard = function (label, value, note, tone) {
    return '<div class="stat-card' + (tone ? " " + tone : "") + '">' +
      '<div class="stat-label">' + esc(label) + "</div>" +
      '<div class="stat-value">' + esc(value === null || value === undefined ? "—" : value) + "</div>" +
      (note ? '<div class="stat-note">' + esc(note) + "</div>" : "") + "</div>";
  };

  /* 视图标题头 */
  UC.viewHead = function (title, sub, actionsHtml) {
    return '<div class="view-head"><div><div class="view-title">' + esc(title) + "</div>" +
      (sub ? '<div class="view-sub">' + esc(sub) + "</div>" : "") + "</div>" +
      (actionsHtml ? '<div class="flex gap8">' + actionsHtml + "</div>" : "") + "</div>";
  };

  /* 空状态提示 */
  UC.empty = function (msg, btnHtml) {
    return '<div class="card"><div class="empty-tip">' + esc(msg) + "</div>" +
      (btnHtml ? '<div style="text-align:center;padding-bottom:28px">' + btnHtml + "</div>" : "") + "</div>";
  };

  /* 需要先选择班级/批次的占位页 */
  UC.needContext = function (msg) {
    return UC.empty(msg, '<button class="btn btn-primary" onclick="FCS.app.navigate(\'#/classes\')">去班级管理</button>');
  };

  /* 简单分页器：opts {page, pageSize, total, onChange} */
  UC.pager = function (opts) {
    const totalPages = Math.max(1, Math.ceil(opts.total / opts.pageSize));
    const p = Math.min(opts.page, totalPages);
    return '<div class="pager">' +
      '<button class="btn btn-sm" ' + (p <= 1 ? "disabled" : "") + ' onclick="' + opts.onChange + "(" + (p - 1) + ')">上一页</button>' +
      "<span>第 " + p + " / " + totalPages + " 页 · 共 " + opts.total + " 人</span>" +
      '<button class="btn btn-sm" ' + (p >= totalPages ? "disabled" : "") + ' onclick="' + opts.onChange + "(" + (p + 1) + ')">下一页</button>' +
      "</div>";
  };

  /* 分数着色 */
  UC.scoreSpan = function (score) {
    if (score === null || score === undefined) return '<span class="text-3">—</span>';
    const cls = score < 60 ? "text-danger bold" : score >= 90 ? "text-success bold" : "";
    return '<span class="' + cls + '">' + score + "</span>";
  };

  /* 学生姓名链接（跳转个人报告） */
  UC.studentLink = function (studentId, name) {
    return '<span class="stu-link" onclick="FCS.app.navigate(\'#/student/' + studentId + '\')">' + esc(name) + "</span>";
  };

  FCS.uiCommon = UC;
})();
