/* view-entry.js — 数据录入：表格内联编辑 + Excel导入 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const S = FCS.scoring;
  const data = function () { return FCS.app.data; };

  /* 视图状态 */
  const state = {
    page: 1,
    keyword: "",
    genderFilter: "all",
    onlyIncomplete: false,
  };

  /* 解析并写入某个字段：返回是否成功 */
  function parseFieldInput(student, field, rawText) {
    const U = FCS.util;
    const t = String(rawText || "").trim();
    if (t === "") { delete student.raw[field]; return { ok: true }; }
    switch (field) {
      case "height": {
        const n = U.parseNum(t);
        if (n === null) return { ok: false, msg: "身高请输入数字（厘米）" };
        if (n > 3) { student.raw.height = n; return { ok: true }; }
        if (n >= 0.8 && n <= 3) { student.raw.height = Math.round(n * 100 * 10) / 10; return { ok: true }; }
        return { ok: false, msg: "身高数值不合理" };
      }
      case "weight": {
        const n = U.parseNum(t);
        if (n === null) return { ok: false, msg: "体重请输入数字（公斤）" };
        if (n >= 20 && n <= 300) { student.raw.weight = n; return { ok: true }; }
        return { ok: false, msg: "体重数值不合理" };
      }
      case "vitalCapacity": {
        const n = U.parseNum(t);
        if (n === null) return { ok: false, msg: "肺活量请输入数字" };
        if (n >= 100 && n <= 10000) { student.raw.vitalCapacity = n; return { ok: true }; }
        return { ok: false, msg: "肺活量数值不合理" };
      }
      case "run50": {
        const n = U.parseNum(t);
        if (n === null) return { ok: false, msg: "50米请输入数字（秒）" };
        if (n >= 5 && n <= 20) { student.raw.run50 = n; return { ok: true }; }
        return { ok: false, msg: "50米成绩不合理" };
      }
      case "standJump": {
        const n = U.parseNum(t);
        if (n === null) return { ok: false, msg: "立定跳远请输入数字（厘米）" };
        if (n >= 50 && n <= 350) { student.raw.standJump = n; return { ok: true }; }
        return { ok: false, msg: "立定跳远数值不合理" };
      }
      case "sitReach": {
        const n = U.parseNum(t);
        if (n === null) return { ok: false, msg: "坐位体前屈请输入数字（厘米，可为负）" };
        if (n >= -30 && n <= 50) { student.raw.sitReach = n; return { ok: true }; }
        return { ok: false, msg: "坐位体前屈数值不合理" };
      }
      case "endurance": {
        const r = U.parseEndurance(t);
        if (!r.ok) return { ok: false, msg: r.error };
        if (r.seconds < 60 || r.seconds > 900) return { ok: false, msg: "耐力跑时间不合理" };
        student.raw.endurance = { seconds: r.seconds, display: r.display };
        return { ok: true };
      }
      case "strength": {
        const n = U.parseNum(t);
        if (n === null) return { ok: false, msg: "力量项请输入数字（个）" };
        if (n >= 0 && n <= 200) { student.raw.strength = n; return { ok: true }; }
        return { ok: false, msg: "力量项数值不合理" };
      }
      default:
        return { ok: false, msg: "未知字段" };
    }
  }

  /* 单元格修改处理（由 inline onclick 触发） */
  FCS.entryEdit = FCS.entryEdit || {};
  FCS.entryEdit.editField = function (studentId, field) {
    const batch = FCS.app.getBatch();
    if (!batch) return;
    const s = batch.students.find(function (x) { return x.id === studentId; });
    if (!s) return;
    const input = document.getElementById("inp-" + studentId + "-" + field);
    if (!input) return;
    const r = parseFieldInput(s, field, input.value);
    input.classList.remove("invalid");
    if (!r.ok) {
      input.classList.add("invalid");
      FCS.util.toast(s.name + "：" + r.msg, "warn");
      return;
    }
    FCS.storage.save(data());
    /* 重算并重绘该行（简单起见重绘整个视图并保持页码） */
    FCS.app.render();
  };
  FCS.entryEdit.editInfo = function (studentId, field) {
    const batch = FCS.app.getBatch();
    const s = batch.students.find(function (x) { return x.id === studentId; });
    if (!s) return;
    const input = document.getElementById("inp-" + studentId + "-" + field);
    const v = input.value.trim();
    if (field === "studentNo") {
      if (!v) { FCS.util.toast("学籍号不能为空", "warn"); FCS.app.render(); return; }
      const dup = batch.students.find(function (x) { return x.id !== studentId && x.studentNo === v; });
      if (dup) { FCS.util.toast("学籍号与「" + dup.name + "」重复", "warn"); FCS.app.render(); return; }
      s.studentNo = v;
    } else if (field === "name") {
      if (!v) { FCS.util.toast("姓名不能为空", "warn"); FCS.app.render(); return; }
      s.name = v;
    } else if (field === "gender") {
      s.gender = v;
      s.raw = {}; /* 性别变更后原成绩可能不适用，清空重录 */
    }
    FCS.storage.save(data());
    FCS.app.render();
  };
  FCS.entryEdit.removeStudent = function (studentId) {
    const batch = FCS.app.getBatch();
    const s = batch.students.find(function (x) { return x.id === studentId; });
    FCS.util.confirm("确定删除学生「" + s.name + "（" + s.studentNo + "）」的全部成绩吗？", { danger: true, okText: "删除" }).then(function (ok) {
      if (!ok) return;
      FCS.storage.removeStudent(batch, studentId);
      FCS.storage.save(data());
      FCS.app.render();
    });
  };
  FCS.entryEdit.addStudent = function () {
    const batch = FCS.app.getBatch();
    if (!batch) return;
    const s = FCS.storage.createStudent(batch, { studentNo: "", name: "", gender: "male" });
    FCS.storage.save(data());
    FCS.app.render();
    /* 滚动并聚焦新行 */
    const el = document.getElementById("inp-" + s.id + "-studentNo");
    if (el) { el.focus(); el.scrollIntoView({ block: "center" }); }
  };
  FCS.entryEdit.setPage = function (p) { state.page = p; FCS.app.render(); };
  FCS.entryEdit.search = function () {
    state.keyword = document.getElementById("entry-search").value.trim();
    state.page = 1;
    FCS.app.render();
  };
  FCS.entryEdit.filterGender = function (v) { state.genderFilter = v; state.page = 1; FCS.app.render(); };
  FCS.entryEdit.toggleIncomplete = function () {
    state.onlyIncomplete = document.getElementById("entry-incomplete").checked;
    state.page = 1;
    FCS.app.render();
  };

  /* 原始值转输入框显示文本 */
  function rawInputText(s, field) {
    const raw = s.raw || {};
    if (field === "endurance") {
      return raw.endurance ? raw.endurance.display : "";
    }
    const v = raw[field];
    return v === null || v === undefined ? "" : String(v);
  }

  FCS.app.registerView("entry", {
    title: "数据录入",
    render: function (el) {
      const U = FCS.util;
      const UC = FCS.uiCommon;
      const esc = U.esc;
      const batch = FCS.app.getBatch();
      if (!batch) {
        el.innerHTML = UC.needContext("请先在顶栏选择班级和测试批次，或到「班级管理」新建。");
        return;
      }
      const PAGE_SIZE = 50;
      /* 筛选 */
      let list = batch.students.slice();
      if (state.keyword) {
        list = list.filter(function (s) {
          return s.studentNo.indexOf(state.keyword) >= 0 || s.name.indexOf(state.keyword) >= 0;
        });
      }
      if (state.genderFilter !== "all") {
        list = list.filter(function (s) { return s.gender === state.genderFilter; });
      }
      if (state.onlyIncomplete) {
        list = list.filter(function (s) { return !S.computeAll(s.gender, s.raw).complete; });
      }
      const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      state.page = Math.min(state.page, totalPages);
      const pageList = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

      const fields = [
        ["height", "身高(cm)"], ["weight", "体重(kg)"], ["vitalCapacity", "肺活量"],
        ["run50", "50米(秒)"], ["standJump", "跳远(cm)"], ["sitReach", "体前屈(cm)"],
      ];
      /* 男女专属项目分开列项（男生两项在前、女生两项在后）：只有对应性别的学生可以填写 */
      const genderFields = [
        { key: "endurance", gender: "male", label: "1000米跑" },
        { key: "strength", gender: "male", label: "引体向上" },
        { key: "endurance", gender: "female", label: "800米跑" },
        { key: "strength", gender: "female", label: "仰卧起坐" },
      ];

      let html = UC.viewHead("数据录入", esc(batch.name + "  ·  " + batch.testDate),
        '<button class="btn btn-primary btn-lg" onclick="FCS.importUI.open()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 4v10.5\"/><path d=\"M7.5 10L12 14.5 16.5 10\"/><path d=\"M4.5 19.5h15\"/></svg>导入Excel</button>' +
        '<button class="btn" onclick="FCS.entryEdit.addStudent()">＋ 添加学生</button>');
      html += '<div class="entry-toolbar">' +
        '<input id="entry-search" class="input" placeholder="搜索姓名/学籍号" value="' + esc(state.keyword) + '" onchange="FCS.entryEdit.search()" style="width:180px">' +
        '<select class="input" onchange="FCS.entryEdit.filterGender(this.value)">' +
        '<option value="all"' + (state.genderFilter === "all" ? " selected" : "") + ">全部性别</option>" +
        '<option value="male"' + (state.genderFilter === "male" ? " selected" : "") + ">男生</option>" +
        '<option value="female"' + (state.genderFilter === "female" ? " selected" : "") + ">女生</option>" +
        "</select>" +
        '<label class="flex items-center gap8" style="font-size:14px;color:var(--text-2)"><input id="entry-incomplete" type="checkbox" ' + (state.onlyIncomplete ? "checked" : "") + ' onchange="FCS.entryEdit.toggleIncomplete()"> 只看缺项</label>' +
        '<div class="spacer"></div>' +
        UC.pager({ page: state.page, pageSize: PAGE_SIZE, total: list.length, onChange: "FCS.entryEdit.setPage" }) +
        "</div>";

      if (!pageList.length) {
        html += '<div class="card"><div class="empty-tip">' + (batch.students.length ? "没有符合条件的学生" : "批次内还没有学生") + "</div>" +
          '<div style="text-align:center;padding-bottom:28px" class="flex gap8" style="justify-content:center">' +
          '<button class="btn btn-primary" onclick="FCS.importUI.open()"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 4v10.5\"/><path d=\"M7.5 10L12 14.5 16.5 10\"/><path d=\"M4.5 19.5h15\"/></svg>导入Excel</button>' +
          '<button class="btn" onclick="FCS.entryEdit.addStudent()">＋ 手动添加</button>' +
          "</div></div>";
        el.innerHTML = html;
        return;
      }

      /* 表头 */
      html += '<div class="card"><div class="table-wrap"><table class="tbl">' +
        "<thead><tr><th>学籍号</th><th>姓名</th><th>性别</th>";
      fields.forEach(function (f) { html += "<th>" + f[1] + "</th>"; });
      genderFields.forEach(function (g) {
        html += "<th>" + g.label + "<br><span class='text-sm' style='font-weight:400'>" + (g.gender === "male" ? "男生" : "女生") + "</span></th>";
      });
      html += "<th>BMI</th><th>总分</th><th>等级</th><th style='min-width:110px'>各项目得分<br><span class='text-sm' style='font-weight:400'>BMI/肺活量/50米/跳远/体前屈/耐力/力量</span></th><th>操作</th></tr></thead><tbody>";

      pageList.forEach(function (s) {
        const c = S.computeAll(s.gender, s.raw);
        const isIncomplete = !c.complete;
        html += "<tr" + (isIncomplete ? ' class="row-error"' : "") + ">";
        /* 学籍号/姓名/性别 */
        html += '<td><input id="inp-' + s.id + '-studentNo" value="' + esc(s.studentNo) + '" onchange="FCS.entryEdit.editInfo(\'' + s.id + "','studentNo')\" style=\"width:112px\"></td>";
        html += '<td><input id="inp-' + s.id + '-name" value="' + esc(s.name) + '" onchange="FCS.entryEdit.editInfo(\'' + s.id + "','name')\" style=\"width:80px\"></td>";
        html += '<td><select id="inp-' + s.id + '-gender" onchange="FCS.entryEdit.editInfo(\'' + s.id + "','gender')\" style=\"border:1px solid var(--border);border-radius:6px;padding:5px\">" +
          '<option value="male"' + (s.gender === "male" ? " selected" : "") + ">男</option>" +
          '<option value="female"' + (s.gender === "female" ? " selected" : "") + ">女</option>" +
          "</select></td>";
        /* 公共项目成绩输入 */
        fields.forEach(function (f) {
          const key = f[0];
          html += '<td><input id="inp-' + s.id + "-" + key + '" value="' + esc(rawInputText(s, key)) + '" placeholder="—"' +
            ' onchange="FCS.entryEdit.editField(\'' + s.id + "','" + key + '\')"' +
            "></td>";
        });
        /* 男女专属项目：本性别可填写，异性列置灰不可填写 */
        genderFields.forEach(function (g) {
          if (s.gender === g.gender) {
            html += '<td><input id="inp-' + s.id + "-" + g.key + '" value="' + esc(rawInputText(s, g.key)) + '" placeholder="—"' +
              ' onchange="FCS.entryEdit.editField(\'' + s.id + "','" + g.key + '\')"' +
              (g.key === "endurance" ? ' title="格式：4\'07 或 4:07 或 4.07"' : "") +
              "></td>";
          } else {
            html += '<td><input disabled id="inp-' + s.id + "-" + g.key + '-off" placeholder="—"' +
              ' title="仅' + (g.gender === "male" ? "男生" : "女生") + '测试，无需填写"></td>';
          }
        });
        /* BMI */
        html += '<td class="num">' + (c.bmi !== null ? c.bmi : '<span class="text-3">—</span>') + "</td>";
        /* 总分 */
        html += '<td class="num bold">' + (c.total !== null ? c.total : '<span class="text-3">—</span>') + "</td>";
        /* 等级 */
        html += "<td>" + UC.gradeBadge(c.grade) + "</td>";
        /* 各项目得分 */
        html += '<td style="font-size:12px">';
        S.items.forEach(function (k, i) {
          html += (i ? " / " : "") + UC.scoreSpan(c.itemScores[k]);
        });
        html += "</td>";
        /* 操作：查看个人报告 / 删除 */
        html += '<td class="no-print"><button class="btn btn-sm" onclick="FCS.app.navigate(\'#/student/' + s.id + '\')">报告</button>' +
          '<button class="btn btn-sm btn-danger" style="margin-left:6px" onclick="FCS.entryEdit.removeStudent(\'' + s.id + '\')">删除</button></td>';
        html += "</tr>";
      });
      html += "</tbody></table></div>";
      html += '<div class="flex space-between items-center mt16">' +
        '<div class="text-sm text-2">提示：1000米/800米跑可填 4\'07 / 4:07 / 4.07；灰色格为异性项目无需填写；填写后自动计算得分并保存；红色行为有缺项</div>' +
        UC.pager({ page: state.page, pageSize: PAGE_SIZE, total: list.length, onChange: "FCS.entryEdit.setPage" }) +
        "</div></div>";
      el.innerHTML = html;
    },
  });
})();
