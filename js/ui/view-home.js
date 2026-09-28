/* view-home.js — 首页 */
(function () {
  "use strict";
  const FCS = window.FCS;

  FCS.app.registerView("home", {
    title: "首页",
    render: function (el) {
      const data = FCS.app.data;
      const U = FCS.util;
      const UC = FCS.uiCommon;
      const batch = FCS.app.getBatch();
      const cls = FCS.app.getClass();
      const esc = U.esc;

      /* 备份提醒 */
      const days = FCS.storage.backupDays(data);
      let banner = "";
      if (days === null) {
        banner = '<div class="banner banner-warn">⚠ 你还没有导出过数据备份。数据保存在浏览器中，清理浏览器数据可能丢失！请尽快到「设置」页导出备份。</div>';
      } else if (days >= 14) {
        banner = '<div class="banner banner-warn">⚠ 距上次数据备份已 ' + days + ' 天，请到「设置」页导出最新备份，防止数据丢失。</div>';
      } else {
        banner = '<div class="banner banner-info">ℹ 上次数据备份：' + U.dateTime(data.lastBackupAt) + "。建议每次录入成绩后都备份一次。</div>";
      }

      /* 概览统计 */
      let totalStudents = 0, totalBatches = 0;
      data.classes.forEach(function (c) {
        c.batches.forEach(function (b) { totalBatches++; totalStudents += b.students.length; });
      });

      let batchStatsHtml = "";
      if (batch) {
        const stats = FCS.analysis.batchStats(batch);
        batchStatsHtml = '<div class="stat-row">' +
          UC.statCard("当前批次", esc(batch.name), esc(batch.testDate)) +
          UC.statCard("人数", stats.total.count, "男 " + stats.male.count + " / 女 " + stats.female.count) +
          UC.statCard("平均分", stats.total.avg !== null ? stats.total.avg + " 分" : "—", "完整录入 " + stats.total.completeCount + " 人") +
          UC.statCard("及格率", stats.total.passRate !== null ? stats.total.passRate + "%" : "—", "优良率 " + (stats.total.goodRate !== null ? stats.total.goodRate + "%" : "—"), stats.total.passRate !== null && stats.total.passRate < 80 ? "danger" : "highlight") +
          "</div>";
      }

      el.innerHTML =
        banner +
        '<div class="stat-row">' +
        UC.statCard("班级数", data.classes.length, "") +
        UC.statCard("测试批次", totalBatches, "") +
        UC.statCard("学生记录", totalStudents, "全部批次合计") +
        "</div>" +
        batchStatsHtml +
        '<div class="card mb16"><div class="card-title">快捷入口</div>' +
        '<div class="home-actions">' +
        '<div class="home-action" onclick="FCS.app.navigate(\'#/entry\')"><div class="ha-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10.5"/><path d="M7.5 10L12 14.5 16.5 10"/><path d="M4.5 19.5h15"/></svg></div><div class="ha-title">导入 / 录入成绩</div><div class="ha-desc">导入Excel或手动录入学生成绩</div></div>' +
        '<div class="home-action" onclick="FCS.app.navigate(\'#/analysis\')"><div class="ha-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 20v-6.5h4.5V20zM9.75 20V4h4.5v16zM15.5 20v-9.5H20V20z"/></svg></div><div class="ha-title">班级分析</div><div class="ha-desc">查看班级整体成绩与优缺项</div></div>' +
        '<div class="home-action" onclick="FCS.app.navigate(\'#/compare\')"><div class="ha-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5.5-5.5 3.5 3.5L19.5 7"/><path d="M15.5 7h4v4"/></svg></div><div class="ha-title">对比分析</div><div class="ha-desc">前后两次测试及班级间对比</div></div>' +
        '<div class="home-action" onclick="FCS.app.navigate(\'#/training\')"><div class="ha-icon"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="9" r="5.2"/><path d="M8.4 13.6L6.8 21l5.2-2.8L17.2 21l-1.6-7.4z"/></svg></div><div class="ha-title">训练计划</div><div class="ha-desc">针对薄弱项目生成训练计划</div></div>' +
        '<div class="home-action" onclick="FCS.app.navigate(\'#/classes\')"><div class="ha-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg></div><div class="ha-title">班级管理</div><div class="ha-desc">新建班级与测试批次</div></div>' +
        '<div class="home-action" onclick="FCS.app.navigate(\'#/settings\')"><div class="ha-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 4.5h13l3 3V19.5H4z"/><path d="M8 4.5v4.5h8"/><path d="M8 19.5v-5h8v5"/></svg></div><div class="ha-title">数据备份</div><div class="ha-desc">导出/导入数据备份文件</div></div>' +
        "</div></div>" +
        '<div class="card"><div class="card-title">使用步骤</div>' +
        '<ol style="padding-left:22px;line-height:2.1">' +
        "<li>到「班级管理」新建班级，再新建本次测试批次（复测可从上次批次一键复制名单）</li>" +
        "<li>到「导入/录入成绩」导入成绩Excel，或直接在表格中录入</li>" +
        "<li>到「班级分析」查看全班成绩、优势与薄弱项目</li>" +
        "<li>到「训练计划」生成每周1次课的4周训练计划</li>" +
        "<li>一个月后复测：新建复测批次 → 到「对比分析」查看进步与不足</li>" +
        "<li>随时到「数据备份」导出备份文件，防止数据丢失</li>" +
        "</ol></div>";
    },
  });
})();
