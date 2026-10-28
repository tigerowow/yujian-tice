/* view-import.js — Excel 导入流程：选择文件 → 解析 → 预览确认 → 导入
   支持「AI智能导入」：对解析失败的错误行发给Coze纠错，逐行勾选确认后导入 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const data = function () { return FCS.app.data; };

  /* 当前解析结果（供AI纠错后重新预览复用） */
  let currentResult = null, currentFile = null;

  /* 性别专属项目列名（与 importer 的 GENDER_COLS 对应），用于从原始单元格回填 */
  const MALE_ENDURANCE_COLS = ["1000米跑", "1000米", "1000m跑", "1000m"];
  const FEMALE_ENDURANCE_COLS = ["800米跑", "800米", "800m跑", "800m"];
  const MALE_STRENGTH_COLS = ["引体向上"];
  const FEMALE_STRENGTH_COLS = ["仰卧起坐", "一分钟仰卧起坐"];

  function cellValue(cells, colNames) {
    for (let i = 0; i < (cells || []).length; i++) {
      if (colNames.indexOf(cells[i].col) >= 0) return cells[i].val;
    }
    return null;
  }

  /* 把AI返回的修正建议构建成一条可导入的学生记录（复用本地 parseCell 校验）
     cells：该行原始单元格，性别确定后用它回填耐力/力量（性别不明时AI给不出这两个值） */
  function buildRowFromCorrection(c, cells) {
    const studentNo = String(c.studentNo == null ? "" : c.studentNo).trim().replace(/\.0+$/, "");
    const name = String(c.name == null ? "" : c.name).trim();
    let gender = null;
    if (c.gender === "男" || c.gender === "male") gender = "male";
    else if (c.gender === "女" || c.gender === "female") gender = "female";
    const raw = {};
    const fieldErrors = [];
    ["height", "weight", "vitalCapacity", "run50", "standJump", "sitReach", "strength"].forEach(function (f) {
      if (c[f] === null || c[f] === undefined || c[f] === "") return;
      const parsed = FCS.importer.parseCell(f, c[f]);
      if (!parsed.ok) { fieldErrors.push(parsed.error); return; }
      if (parsed.value !== null && parsed.value !== undefined) raw[f] = parsed.value;
    });
    if (c.endurance !== null && c.endurance !== undefined && c.endurance !== "") {
      const parsed = FCS.importer.parseCell("endurance", c.endurance);
      if (!parsed.ok) fieldErrors.push(parsed.error);
      else raw.endurance = parsed.value;
    }
    /* 性别确定后，耐力/力量若AI未给出，回填原始单元格里对应性别的项目 */
    if (gender) {
      if (raw.endurance === undefined) {
        const ev = cellValue(cells, gender === "male" ? MALE_ENDURANCE_COLS : FEMALE_ENDURANCE_COLS);
        if (ev !== null && ev !== undefined && ev !== "") {
          const parsed = FCS.importer.parseCell("endurance", ev);
          if (parsed.ok && parsed.value !== null && parsed.value !== undefined) raw.endurance = parsed.value;
        }
      }
      if (raw.strength === undefined) {
        const sv = cellValue(cells, gender === "male" ? MALE_STRENGTH_COLS : FEMALE_STRENGTH_COLS);
        if (sv !== null && sv !== undefined && sv !== "") {
          const parsed = FCS.importer.parseCell("strength", sv);
          if (parsed.ok && parsed.value !== null && parsed.value !== undefined) raw.strength = parsed.value;
        }
      }
    }
    if (!studentNo) fieldErrors.push("缺少学籍号");
    if (!name) fieldErrors.push("缺少姓名");
    if (!gender) fieldErrors.push("性别无法识别");
    if (fieldErrors.length) return { ok: false, errors: fieldErrors, studentNo: studentNo, name: name };
    return { ok: true, row: { rowNum: c.rowNum, studentNo: studentNo, name: name, gender: gender, raw: raw } };
  }

  /* 应用已勾选的修正：从 errors 移到 rows；仍失败的保留在错误区 */
  function applyCorrections(errList, corrections) {
    const result = currentResult;
    const byRow = {};
    corrections.forEach(function (c) { byRow[c.rowNum] = c; });
    let applied = 0, failed = 0;
    errList.forEach(function (item) {
      const c = byRow[item.error.rowNum];
      if (!c) return;
      const sr = result.sheetRows[item.sheetIdx];
      const r = buildRowFromCorrection(c, item.error.cells);
      sr.errors = sr.errors.filter(function (e) { return e.rowNum !== item.error.rowNum; });
      if (r.ok) {
        const dup = sr.rows.some(function (x) { return x.studentNo === r.row.studentNo; });
        if (dup) {
          sr.errors.push({ rowNum: item.error.rowNum, studentNo: r.row.studentNo, name: r.row.name, errors: ["学籍号仍重复"], cells: item.error.cells });
          failed++;
        } else {
          sr.rows.push(r.row);
          applied++;
        }
      } else {
        sr.errors.push({ rowNum: item.error.rowNum, studentNo: r.studentNo || item.error.studentNo, name: r.name || item.error.name, errors: r.errors, cells: item.error.cells });
        failed++;
      }
    });
    return { applied: applied, failed: failed };
  }

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

    /* AI智能导入：解析后若有错误行，先自动纠错再预览 */
    openAI: function () {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xlsx,.xls";
      input.onchange = function () {
        if (!input.files.length) return;
        FCS.importUI.preview(input.files[0], { ai: true });
      };
      input.click();
    },

    preview: function (file, opts) {
      const U = FCS.util;
      FCS.importer.readTemplate(file).then(function (result) {
        currentResult = result;
        currentFile = file;
        if (!result.sheetRows.length) {
          U.toast("Excel中没有找到可导入的数据（" + (result.warnings[0] || "格式不符") + "）", "error");
          return;
        }
        result.warnings.forEach(function (w) { U.toast(w, "warn"); });
        const totalErrors = result.sheetRows.reduce(function (s, sr) { return s + sr.errors.length; }, 0);
        if (opts && opts.ai && totalErrors > 0) {
          if (!FCS.aiAPI.isConfigured()) { U.toast("AI智能导入需要先在设置页配置Coze", "error"); FCS.importUI.renderPreview(); return; }
          FCS.importUI.aiCorrect();
        } else {
          FCS.importUI.renderPreview();
        }
      }).catch(function (e) {
        U.toast("读取Excel失败：" + e.message, "error");
      });
    },

    /* 渲染导入预览弹窗（读取 currentResult/currentFile） */
    renderPreview: function () {
      const U = FCS.util;
      const result = currentResult;
      const file = currentFile;
      if (!result || !file) return;

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
        '<div class="ps-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M6 2.5h9l5 5V21.5H6z"/><path d="M14 2.5v5h5"/></svg>工作表：<b>' + result.sheetRows.length + "</b></div>" +
        '<div class="ps-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>可导入学生：<b class="text-success">' + totalRows + "</b></div>" +
        '<div class="ps-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 4L2.5 20h19z"/><path d="M12 10v4"/><circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none"/></svg>错误行：<b class="' + (totalErrors ? "text-danger" : "text-success") + '">' + totalErrors + "</b></div>" +
        "</div>" +
        '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">' +
        '<div><label class="field">班级名称</label><input id="imp-class" class="input" style="width:100%" value="' + U.esc(guessValue(result, "classNameGuess") || (FCS.app.getClass() ? FCS.app.getClass().name : "")) + '"></div>' +
        '<div><label class="field">任课教师</label><input id="imp-teacher" class="input" style="width:100%" value="' + U.esc(guessValue(result, "teacherGuess") || (FCS.app.getClass() ? FCS.app.getClass().teacher : "")) + '"></div>' +
        "</div>" +
        '<label style="display:block;margin-bottom:10px"><input type="checkbox" id="imp-new" ' + (forceNew ? "checked disabled" : "") + "> 导入到新建班级（当前班级：" + (FCS.app.getClass() ? U.esc(FCS.app.getClass().name) : "无") + "）</label>" +
        "<div class='text-sm text-2 mb8'>导入到当前批次：" + (curBatch ? U.esc(curBatch.name) : "（当前未选择批次，将自动新建）") + "</div>";

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

      body.innerHTML += '<div class="bold mb8">导入策略：</div>' +
        '<label style="display:block;margin-bottom:6px"><input type="radio" name="imp-mode" value="update" checked> 覆盖已有学生成绩（同名学籍号更新为本次成绩）</label>' +
        '<label style="display:block;margin-bottom:12px"><input type="radio" name="imp-mode" value="skip"> 跳过已有学生（保留原成绩）</label>';

      if (totalErrors) {
        let errHtml = '<div class="bold mb8 text-danger">错误行（共 ' + totalErrors + ' 行，将不会导入）：</div>' +
          '<button class="btn mb8" onclick="FCS.importUI.aiCorrect()">🤖 AI智能纠错（' + totalErrors + ' 行）</button>' +
          '<div class="import-errors"><ul>';
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
    },

    /* AI智能纠错：收集错误行 → 发Coze → 展示修正建议 */
    aiCorrect: function () {
      const U = FCS.util;
      const result = currentResult;
      if (!result) return;
      if (!FCS.aiAPI.isConfigured()) { U.toast("请先在设置页配置Coze，再使用AI纠错", "error"); return; }
      const errList = [];
      result.sheetRows.forEach(function (sr, si) {
        (sr.errors || []).forEach(function (e) { errList.push({ sheetIdx: si, error: e }); });
      });
      if (!errList.length) { U.toast("没有需要纠错的错误行", "warn"); return; }
      const loading = U.showModal({
        title: "AI智能纠错",
        body: '<div style="padding:16px;line-height:1.8">正在由 AI 分析并纠正 <b>' + errList.length + '</b> 行错误数据，请稍候…<br><span class="text-sm text-2">（联网请求可能需要几秒到几十秒）</span></div>',
        actions: [],
        closable: false,
      });
      FCS.aiAPI.correctImportErrors(errList.map(function (x) { return x.error; })).then(function (r) {
        loading.close();
        if (!r.ok) { U.toast("AI纠错失败：" + r.error, "error"); return; }
        FCS.importUI.showCorrections(errList, r.corrections);
      });
    },

    /* 展示AI修正建议（逐行勾选确认；姓名/学籍号/性别可直接编辑补充） */
    showCorrections: function (errList, corrections) {
      const U = FCS.util;
      const esc = U.esc;
      const body = document.createElement("div");
      let html = '<div class="text-sm text-2 mb8">AI 给出 <b>' + corrections.length + '</b> 条修正建议。AI 无法确定的<b>姓名、学籍号、性别</b>，请直接在下方补充或修改（红框=需补充），其余项目已由 AI 修正：</div>';
      corrections.forEach(function (c, idx) {
        const e = errList.find(function (x) { return x.error.rowNum === c.rowNum; });
        const originals = e ? (e.error.cells || []).map(function (cc) { return cc.col + "=" + cc.val; }).join("，") : "";
        const genderMale = c.gender === "男" || c.gender === "male";
        const genderFemale = c.gender === "女" || c.gender === "female";
        const needName = !c.name || String(c.name).trim() === "";
        const needNo = !c.studentNo || String(c.studentNo).trim() === "";
        const needGender = !genderMale && !genderFemale;
        html += '<div class="ai-fix-card">' +
          '<label class="flex items-center gap8 ai-fix-head">' +
          '<input type="checkbox" class="ai-fix" data-idx="' + idx + '" checked>' +
          '第 <b>' + c.rowNum + '</b> 行' + (e ? ' <span class="text-2">' + esc(e.error.name || "") + '</span>' : '') +
          '</label>' +
          '<div class="ai-fix-fields">' +
          '<label class="field">姓名<input class="input ai-name" data-idx="' + idx + '" value="' + esc(c.name || "") + '" placeholder="请补充姓名"' + (needName ? ' style="border-color:var(--danger)"' : "") + '></label>' +
          '<label class="field">学籍号<input class="input ai-no" data-idx="' + idx + '" value="' + esc(c.studentNo || "") + '" placeholder="请补充学籍号"' + (needNo ? ' style="border-color:var(--danger)"' : "") + '></label>' +
          '<label class="field">性别<select class="input ai-gender" data-idx="' + idx + '"' + (needGender ? ' style="border-color:var(--danger)"' : "") + '>' +
          '<option value=""' + (!genderMale && !genderFemale ? " selected" : "") + '>请选择</option>' +
          '<option value="male"' + (genderMale ? " selected" : "") + '>男</option>' +
          '<option value="female"' + (genderFemale ? " selected" : "") + '>女</option>' +
          '</select></label>' +
          '</div>' +
          '<div class="text-sm text-2">原始：' + esc(originals || "（无原始值）") + '</div>' +
          '<div class="text-sm text-success">AI修正：' + esc(c.note || "已按规范格式修正") + '</div>' +
          '</div>';
      });
      body.innerHTML = html;
      U.showModal({
        title: "AI智能纠错结果",
        body: body,
        width: "660px",
        actions: [
          { text: "取消", onClick: function (api) { api.close(); FCS.importUI.renderPreview(); } },
          {
            text: "应用并重新预览", primary: true, onClick: function (api) {
              const checked = [];
              body.querySelectorAll(".ai-fix").forEach(function (cb) { if (cb.checked) checked.push(parseInt(cb.getAttribute("data-idx"), 10)); });
              api.close();
              const accepted = [];
              corrections.forEach(function (c, idx) {
                if (checked.indexOf(idx) < 0) return;
                const c2 = {
                  rowNum: c.rowNum, studentNo: c.studentNo, name: c.name, gender: c.gender,
                  height: c.height, weight: c.weight, vitalCapacity: c.vitalCapacity,
                  run50: c.run50, standJump: c.standJump, sitReach: c.sitReach,
                  endurance: c.endurance, strength: c.strength, note: c.note,
                };
                const nameEl = body.querySelector('.ai-name[data-idx="' + idx + '"]');
                const noEl = body.querySelector('.ai-no[data-idx="' + idx + '"]');
                const gEl = body.querySelector('.ai-gender[data-idx="' + idx + '"]');
                if (nameEl) c2.name = nameEl.value.trim();
                if (noEl) c2.studentNo = noEl.value.trim();
                if (gEl) c2.gender = gEl.value;
                accepted.push(c2);
              });
              const r = applyCorrections(errList, accepted);
              U.toast("已应用 " + r.applied + " 条修正" + (r.failed ? "，仍有 " + r.failed + " 行未能修正" : ""), r.failed ? "warn" : "success");
              FCS.importUI.renderPreview();
            },
          },
        ],
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
