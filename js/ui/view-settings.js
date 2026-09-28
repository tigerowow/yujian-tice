/* view-settings.js — 设置/数据管理：备份导出导入、清空、示例数据、帮助 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const data = function () { return FCS.app.data; };

  FCS.settingsUI = FCS.settingsUI || {};
  FCS.settingsUI.exportBackup = function () {
    const name = FCS.storage.exportBackup(data());
    FCS.util.toast("备份已下载：" + name + "，请妥善保存这个文件", "success");
    FCS.app.refresh();
  };
  FCS.settingsUI.importBackup = function () {
    const U = FCS.util;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = function () {
      if (!input.files.length) return;
      FCS.storage.importBackup(input.files[0]).then(function (r) {
        if (!r.ok) { U.toast("导入失败：" + r.error, "error"); return; }
        const p = r.data._preview;
        delete r.data._preview;
        U.confirm("备份文件包含：<b>" + p.classCount + " 个班级、" + p.batchCount + " 个批次、" + p.studentCount + " 名学生</b>。<br><br>导入将<b>完全替换</b>当前软件中的全部数据，确定继续吗？<br>（建议先导出当前数据备份）", { danger: true, okText: "导入并替换" }).then(function (ok) {
          if (!ok) return;
          FCS.app.data = r.data;
          FCS.app.ctx.classId = null;
          FCS.app.ctx.batchId = null;
          FCS.storage.save(r.data);
          U.toast("备份导入成功", "success");
          FCS.app.refresh();
        });
      });
    };
    input.click();
  };
  FCS.settingsUI.clearAll = function () {
    const U = FCS.util;
    U.confirm("<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><path d=\"M12 4L2.5 20h19z\"/><path d=\"M12 10v4\"/><circle cx=\"12\" cy=\"17.2\" r=\"0.6\" fill=\"currentColor\" stroke=\"none\"/></svg>确定要<b>清空全部数据</b>吗？所有班级、批次和成绩都会被删除，且无法恢复！<br><br>强烈建议先导出数据备份。", { danger: true, okText: "我确定，清空" }).then(function (ok) {
      if (!ok) return;
      FCS.app.data = FCS.storage.emptyData();
      FCS.app.ctx.classId = null;
      FCS.app.ctx.batchId = null;
      FCS.storage.save(FCS.app.data);
      U.toast("已清空全部数据", "success");
      FCS.app.refresh();
    });
  };
  FCS.settingsUI.loadSample = function () {
    const U = FCS.util;
    const d = data();
    const samples = FCS.sampleData.build();
    const exists = d.classes.some(function (c) {
      return c.name === samples[0].name || c.name === samples[1].name;
    });
    if (exists) {
      U.toast("示例班级已存在（应用化学一班、二班），无需重复加载", "warn");
      return;
    }
    const add = function () {
      samples.forEach(function (c) { d.classes.push(c); });
      FCS.storage.save(d);
      U.toast("示例班级已添加：应用化学一班、二班（每班40人，各含初测/复测）", "success");
      FCS.app.refresh();
    };
    if (d.classes.length) {
      U.confirm("加载示例数据将添加应用化学一班、二班（每班40人，含初测和复测两次数据），不会覆盖现有数据。确定继续吗？").then(function (ok) {
        if (ok) add();
      });
    } else {
      add();
    }
  };
  FCS.settingsUI.help = function () {
    const U = FCS.util;
    U.showModal({
      title: "使用帮助",
      body: "<div style='line-height:1.9;font-size:14px'>" +
        "<b>1. 建班级、建批次</b><br>班级管理 → 新建班级 → 新建测试批次（复测可选「复制名单」一键带出上次的学生）<br>" +
        "<b>2. 录成绩</b><br>数据录入 → 导入Excel（支持学校模板）或手动填写表格，得分自动计算<br>" +
        "<b>3. 看分析</b><br>班级分析 → 平均分/及格率/各项目得分/优势与薄弱项目<br>" +
        "<b>4. 训练计划</b><br>按薄弱项生成每周1次课的4周计划，可导出PDF<br>" +
        "<b>5. 一个月后复测</b><br>新建复测批次 → 录入新成绩 → 对比分析 → 查看进步与不足<br>" +
        "<b>6. 备份数据</b><br>数据保存在浏览器中！请定期到本页导出备份文件并妥善保存，清理浏览器数据会丢失软件内的数据<br>" +"<b>7. 演示流程</b><br>加载示例数据 → 班级分析 → 对比分析 → 训练计划 → AI教练（如问“应用化学二班哪些项目最薄弱？”）→ 导入Excel体验<br>" +
        "</div>",
      actions: [{ text: "知道了", primary: true, onClick: function (api) { api.close(); } }],
    });
  };

  FCS.app.registerView("settings", {
    title: "设置与数据管理",
    render: function (el) {
      const U = FCS.util;
      const UC = FCS.uiCommon;
      const esc = U.esc;
      const d = data();
      const days = FCS.storage.backupDays(d);
      const size = FCS.storage.formatSize(FCS.storage.estimateSize(d));
      let html = UC.viewHead("设置与数据管理", "数据安全最重要：请定期导出备份文件");
      html += '<div class="card settings-block">' +
        '<div class="card-title">数据备份</div>' +
        '<div class="setting-row"><div><div class="sr-title">导出数据备份</div>' +
        '<div class="sr-desc">下载一个 .json 备份文件到电脑，建议存在U盘或网盘。上次备份：' + (days === null ? "从未备份" : U.dateTime(d.lastBackupAt) + "（" + days + " 天前）") + "</div></div>" +
        '<button class="btn btn-primary" onclick="FCS.settingsUI.exportBackup()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 4v10.5\"/><path d=\"M7.5 10L12 14.5 16.5 10\"/><path d=\"M4.5 19.5h15\"/></svg>导出备份</button></div>' +
        '<div class="setting-row"><div><div class="sr-title">导入数据备份</div>' +
        '<div class="sr-desc">换电脑或数据丢失时，用备份文件恢复全部数据（将替换当前数据）</div></div>' +
        '<button class="btn" onclick="FCS.settingsUI.importBackup()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 14.5V4\"/><path d=\"M7.5 8.5L12 4l4.5 4.5\"/><path d=\"M4.5 19.5h15\"/></svg>导入备份</button></div>' +
        '<div class="setting-row"><div><div class="sr-title">当前数据占用</div>' +
        '<div class="sr-desc">' + esc(size) + "（浏览器本地存储上限约5MB，本软件正常使用远不会达到）</div></div></div>" +
        "</div>" +
        "</div>" +
        '<div class="card settings-block mt16">' +
        '<div class="card-title">其他</div>' +
        '<div class="setting-row"><div><div class="sr-title">加载示例数据</div>' +
        '<div class="sr-desc">生成应用化学一班、二班示例班级（每班40人，含初测和复测两次数据），便于体验各项功能</div></div>' +
        '<button class="btn" onclick="FCS.settingsUI.loadSample()">加载示例</button></div>' +
        '<div class="setting-row"><div><div class="sr-title">清空全部数据</div>' +
        '<div class="sr-desc text-danger">删除所有班级、批次和成绩，不可恢复</div></div>' +
        '<button class="btn btn-danger" onclick="FCS.settingsUI.clearAll()">清空数据</button></div>' +
        '<div class="setting-row"><div><div class="sr-title">使用帮助</div>' +
        '<div class="sr-desc">查看软件使用步骤说明</div></div>' +
        '<button class="btn" onclick="FCS.settingsUI.help()">查看帮助</button></div>' +
        '<div class="setting-row"><div><div class="sr-title">关于</div>' +
        '<div class="sr-desc">育健AI体测数据分析软件 v4.26（网页版）</div></div></div>' +
        "</div>";
      el.innerHTML = html;
      FCS.aiAPI.fillForm();
    },
  });
})();
