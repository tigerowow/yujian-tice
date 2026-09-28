/* view-import.js — Excel 导入流程：选择文件 → 解析 → 预览确认 → 导入 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const data = function () { return FCS.app.data; };

  FCS.importUI = {
    open: function () {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xlsx,.xls";
      input.onchange = function () {
        if (!input.files.length) return;
        FCS.importUI.preview(input.files[0]);
      };
      input.click();
    },

    preview: function (file) {
      const U = FCS.util;
      FCS.importer.readTemplate(file).then(function (result) {
        if (!result.sheetRows.length) {
          U.toast("Excel中没有找到可导入的数据（" + (result.warnings[0] || "格式不符") + "）", "error");
          return;
        }
        result.warnings.forEach(function (w) { U.toast(w, "warn"); });

        /* 汇总 */
        let totalRows = 0, totalErrors = 0;
        result.sheetRows.forEach(function (sr) {
          totalRows += sr.rows.length;
          totalErrors += sr.errors.length;
        });
        const curBatch = FCS.app.getBatch();
        const forceNew = !curBatch;

        const body = document.createElement("div");
        body.innerHTML =
          '<div class="preview-stats">' +
          '<div class="ps-item"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><path d=\"M6 2.5h9l5 5V21.5H6z\"/><path d=\"M14 2.5v5h5\"/></svg>工作表：<b>' + result.sheetRows.length + "</b></div>" +
          '<div class="ps-item"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8.5 12.5l2.5 2.5 4.5-5\"/></svg>可导入学生：<b class="text-success">' + totalRows + "</b></div>" +
          '<div class="ps-item"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><path d=\"M12 4L2.5 20h19z\"/><path d=\"M12 10v4\"/><circle cx=\"12\" cy=\"17.2\" r=\"0.6\" fill=\"currentColor\" stroke=\"none\"/></svg>错误行：<b class="' + (totalErrors ? "text-danger" : "text-success") + '">' + totalErrors + "</b></div>" +
          "</div>" +
          '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">' +
          '<div><label class="field">班级名称</label><input id="imp-class" class="input" style="width:100%" value="' + U.esc(guessValue(result, "classNameGuess") || (FCS.app.getClass() ? FCS.app.getClass().name : "")) + '"></div>' +
          '<div><label class="field">任课教师</label><input id="imp-teacher" class="input" style="width:100%" value="' + U.esc(guessValue(result, "teacherGuess") || (FCS.app.getClass() ? FCS.app.getClass().teacher : "")) + '"></div>' +
          "</div>" +
          '<label style="display:block;margin-bottom:10px"><input type="checkbox" id="imp-new" ' + (forceNew ? "checked disabled" : "") + "> 导入到新建班级（当前班级：" + (FCS.app.getClass() ? U.esc(FCS.app.getClass().name) : "无") + "）</label>" +
          "<div class='text-sm text-2 mb8'>导入到当前批次：" + (curBatch ? U.esc(curBatch.name) : "（当前未选择批次，将自动新建）") + "</div>";

        /* 各工作表性别识别方式 */
        const modeBadge = {
          genderCol: ["badge-male", "✓ 按性别列自动识别"],
          project: ["badge-neutral", "✓ 按项目自动推断"],
          sheet: ["badge-male", "✓ 按工作表名识别"],
          manual: ["badge-fail", "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><path d=\"M12 4L2.5 20h19z\"/><path d=\"M12 10v4\"/><circle cx=\"12\" cy=\"17.2\" r=\"0.6\" fill=\"currentColor\" stroke=\"none\"/></svg>需手动选择"],
        };
        body.innerHTML += '<div class="mb8 bold">工作表与性别识别：</div>';
        result.sheetRows.forEach(function (sr) {
          const maleCnt = sr.rows.filter(function (x) { return x.gender === "male"; }).length;
          const femaleCnt = sr.rows.filter(function (x) { return x.gender === "female"; }).length;
          let sel;
          if (sr.genderMode === "manual") {
            sel = '<select class="input imp-gender" data-sheet="' + U.esc(sr.sheetName) + '">' +
              '<option value="">请选择</option>' +
              '<option value="male">男生</option>' +
              '<option value="female">女生</option>' +
              "</select>";
          } else {
            const mb = modeBadge[sr.genderMode] || modeBadge.manual;
            sel = '<span class="badge ' + mb[0] + '">' + mb[1] + "</span>";
          }
          body.innerHTML += '<div class="flex items-center gap8 mb8" style="font-size:14px">' +
            "工作表「" + U.esc(sr.sheetName) + "」：" + sel +
            '<span class="text-2">共 ' + sr.rows.length + " 人（男 " + maleCnt + " / 女 " + femaleCnt + "）</span></div>";
        });

        /* 覆盖策略 */
        body.innerHTML += '<div class="bold mb8">导入策略：</div>' +
          '<label style="display:block;margin-bottom:6px"><input type="radio" name="imp-mode" value="update" checked> 覆盖已有学生成绩（同名学籍号更新为本次成绩）</label>' +
          '<label style="display:block;margin-bottom:12px"><input type="radio" name="imp-mode" value="skip"> 跳过已有学生（保留原成绩）</label>';

        /* 错误行 */
        if (totalErrors) {
          let errHtml = '<div class="bold mb8 text-danger">错误行（共 ' + totalErrors + ' 行，将不会导入）：</div><div class="import-errors"><ul>';
          result.sheetRows.forEach(function (sr) {
            sr.errors.slice(0, 50).forEach(function (e) {
              errHtml += "<li>「" + U.esc(sr.sheetName) + "」第 " + e.rowNum + " 行 " + U.esc(e.studentNo) + " " + U.esc(e.name) + "：" + U.esc(e.errors.join("、")) + "</li>";
            });
          });
          if (totalErrors > 50) errHtml += "<li>……其余 " + (totalErrors - 50) + " 行略</li>";
          body.innerHTML += errHtml + "</ul></div>";
        }

        U.showModal({
          title: "导入预览：" + file.name,
          body: body,
          width: "640px",
          actions: [
            { text: "取消", onClick: function (api) { api.close(); } },
            {
              text: "确认导入", primary: true, onClick: function (api) {
                /* 收集性别覆盖 */
                const genderOverrides = {};
                let genderMissing = false;
                body.querySelectorAll(".imp-gender").forEach(function (sel) {
                  genderOverrides[sel.getAttribute("data-sheet")] = sel.value || null;
                  if (!sel.value) genderMissing = true;
                });
                if (genderMissing) { U.toast("请为每个工作表指定性别", "warn"); return; }
                const d = data();
                const createNew = document.getElementById("imp-new").checked || forceNew;
                const className = document.getElementById("imp-class").value.trim() || "未命名班级";
                const teacher = document.getElementById("imp-teacher").value.trim();
                let targetClassId = FCS.app.ctx.classId;
                let targetBatchId = FCS.app.ctx.batchId;
                if (createNew || !targetBatchId) {
                  if (createNew) {
                    const cls = FCS.storage.createClass(d, { name: className, teacher: teacher });
                    targetClassId = cls.id;
                    targetBatchId = null;
                  } else if (!targetClassId) {
                    const cls = FCS.storage.createClass(d, { name: className, teacher: teacher });
                    targetClassId = cls.id;
                  }
                  const batchName = createNew ? (curBatch ? className + "（导入）" : "导入批次") : (FCS.storage.findBatch(d, targetClassId, targetBatchId) ? FCS.storage.findBatch(d, targetClassId, targetBatchId).name : "导入批次");
                  const b = FCS.storage.createBatch(d, targetClassId, { name: batchName, testDate: U.today() });
                  targetBatchId = b.id;
                } else {
                  /* 更新当前班级的名称/教师 */
                  const cls = FCS.storage.findClass(d, targetClassId);
                  if (cls && document.getElementById("imp-class").value.trim()) cls.name = className;
                  if (cls && teacher) cls.teacher = teacher;
                }
                const mode = (body.querySelector('input[name="imp-mode"]:checked') || {}).value || "update";
                const r = FCS.importer.applyImport({
                  data: d,
                  classId: targetClassId,
                  batchId: targetBatchId,
                  sheetRows: result.sheetRows,
                  genderOverrides: genderOverrides,
                  mode: mode,
                });
                api.close();
                FCS.app.setClass(targetClassId);
                FCS.app.setBatch(targetBatchId);
                FCS.app.navigate("#/entry");
                U.toast("导入完成：新增 " + r.added + " 人，更新 " + r.updated + " 人，跳过 " + r.skipped + " 人" + (totalErrors ? "（" + totalErrors + " 行错误未导入）" : ""), "success");
              },
            },
          ],
        });
      }).catch(function (e) {
        U.toast("读取Excel失败：" + e.message, "error");
      });
    },
  };

  function guessValue(result, key) {
    for (let i = 0; i < result.sheetRows.length; i++) {
      if (result.sheetRows[i][key]) return result.sheetRows[i][key];
    }
    return "";
  }
})();
