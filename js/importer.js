/* importer.js — Excel 导入：学校模板解析、容错、预览、自动性别识别
   支持两种表格结构：
   ① 旧模板（男/女分表）：按工作表名判定性别，每表只有本性别项目列
   ② 男女混合单表：优先读"性别"列（男/女文字）；无性别列时按项目推断
     （填了1000米跑/引体向上=男生，填了800米跑/仰卧起坐=女生）
   表头匹配前会去除所有空白字符（兼容"800\n米跑"等带换行的表头）。 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const IM = {};

  /* 公共列映射（按表头名匹配，不依赖列序） */
  const COMMON_MAP = {
    "学籍号": "studentNo", "学号": "studentNo",
    "姓名": "name", "学生姓名": "name",
    "身高": "height", "体重": "weight",
    "肺活量": "vitalCapacity",
    "50米": "run50", "50米跑": "run50", "50m": "run50", "50m跑": "run50",
    "立定跳远": "standJump", "跳远": "standJump",
    "坐位体前屈": "sitReach", "体前屈": "sitReach",
  };
  /* 男女专属列：分别记录列号，取成绩时按学生性别选列 */
  const GENDER_COLS = {
    maleEndurance: ["1000米跑", "1000米", "1000m跑", "1000m"],
    femaleEndurance: ["800米跑", "800米", "800m跑", "800m"],
    maleStrength: ["引体向上"],
    femaleStrength: ["仰卧起坐", "一分钟仰卧起坐"],
  };
  /* 性别列表头识别（含"性别"即视为性别列） */
  const GENDER_HEADERS = ["性别", "学生性别", "男/女"];

  /* 表头规范化：去除所有空白字符（换行/空格） */
  function normHeader(t) {
    return String(t === null || t === undefined ? "" : t).replace(/\s+/g, "");
  }

  /* 读取工作簿 */
  IM.parseWorkbook = function (file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onerror = function () { reject(new Error("文件读取失败")); };
      reader.onload = function () {
        try {
          const wb = XLSX.read(new Uint8Array(reader.result), { type: "array", cellDates: false });
          resolve(wb);
        } catch (e) {
          reject(new Error("无法解析该Excel文件（支持 .xlsx / .xls）"));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  /* 在前10行内定位表头行（同时含"学籍号"和"姓名"） */
  IM.detectHeaderRow = function (rows2d) {
    for (let i = 0; i < Math.min(rows2d.length, 10); i++) {
      const row = rows2d[i] || [];
      const texts = row.map(normHeader);
      const hasNo = texts.some(function (t) { return t === "学籍号" || t === "学号"; });
      const hasName = texts.some(function (t) { return t === "姓名" || t === "学生姓名"; });
      if (hasNo && hasName) return i;
    }
    return -1;
  };

  /* 解析单个单元格值 */
  function parseCell(field, v) {
    if (v === null || v === undefined) return { ok: true, value: null };
    const s = String(v).trim();
    if (s === "") return { ok: true, value: null };
    switch (field) {
      case "studentNo":
        return { ok: true, value: s.replace(/\.0+$/, "") };
      case "name":
        return { ok: true, value: s };
      case "height": {
        const n = FCS.util.parseNum(v);
        if (n === null) return { ok: false, error: "身高无法识别：" + s };
        if (n > 3) return { ok: true, value: n };
        if (n >= 0.8 && n <= 3) return { ok: true, value: Math.round(n * 100 * 10) / 10 };
        return { ok: false, error: "身高数值不合理：" + s };
      }
      case "weight": {
        const n = FCS.util.parseNum(v);
        if (n === null) return { ok: false, error: "体重无法识别：" + s };
        if (n >= 20 && n <= 300) return { ok: true, value: n };
        return { ok: false, error: "体重数值不合理：" + s };
      }
      case "vitalCapacity": {
        const n = FCS.util.parseNum(v);
        if (n === null) return { ok: false, error: "肺活量无法识别：" + s };
        if (n >= 100 && n <= 10000) return { ok: true, value: n };
        return { ok: false, error: "肺活量数值不合理：" + s };
      }
      case "run50": {
        const n = FCS.util.parseNum(v);
        if (n === null) return { ok: false, error: "50米成绩无法识别：" + s };
        if (n >= 5 && n <= 20) return { ok: true, value: n };
        return { ok: false, error: "50米成绩数值不合理：" + s };
      }
      case "standJump": {
        const n = FCS.util.parseNum(v);
        if (n === null) return { ok: false, error: "立定跳远无法识别：" + s };
        if (n >= 50 && n <= 350) return { ok: true, value: n };
        return { ok: false, error: "立定跳远数值不合理：" + s };
      }
      case "sitReach": {
        const n = FCS.util.parseNum(v);
        if (n === null) return { ok: false, error: "坐位体前屈无法识别：" + s };
        if (n >= -30 && n <= 50) return { ok: true, value: n };
        return { ok: false, error: "坐位体前屈数值不合理：" + s };
      }
      case "endurance": {
        const r = FCS.util.parseEndurance(v);
        if (!r.ok) return { ok: false, error: "耐力跑：" + r.error + "（" + s + "）" };
        if (r.seconds < 60 || r.seconds > 900) return { ok: false, error: "耐力跑时间不合理：" + s };
        return { ok: true, value: { seconds: r.seconds, display: r.display } };
      }
      case "strength": {
        const n = FCS.util.parseNum(v);
        if (n === null) return { ok: false, error: "力量项无法识别：" + s };
        if (n >= 0 && n <= 200) return { ok: true, value: n };
        return { ok: false, error: "力量项数值不合理：" + s };
      }
      default:
        return { ok: true, value: s };
    }
  }

  /* 根据表头行建立列映射：返回 {mapping, genderCols, genderColIdx} */
  IM.mapColumns = function (headerRow) {
    const mapping = {};
    const genderCols = { maleEndurance: null, femaleEndurance: null, maleStrength: null, femaleStrength: null };
    let genderColIdx = null;
    (headerRow || []).forEach(function (raw, i) {
      const t = normHeader(raw);
      if (!t) return;
      if (COMMON_MAP[t] && !mapping[COMMON_MAP[t]]) mapping[COMMON_MAP[t]] = i;
      Object.keys(GENDER_COLS).forEach(function (gk) {
        if (genderCols[gk] === null && GENDER_COLS[gk].indexOf(t) >= 0) genderCols[gk] = i;
      });
      if (genderColIdx === null && GENDER_HEADERS.indexOf(t) >= 0) genderColIdx = i;
    });
    return { mapping: mapping, genderCols: genderCols, genderColIdx: genderColIdx };
  };

  /* 从sheet名推断性别：仅当名称只含单一性别标记（含"男"不含"女"等）才生效，
     避免"男女混合成绩"这类表名被误判 */
  IM.guessGender = function (sheetName) {
    const s = String(sheetName || "");
    const hasMale = s.indexOf("男") >= 0;
    const hasFemale = s.indexOf("女") >= 0;
    if (hasMale && !hasFemale) return "male";
    if (hasFemale && !hasMale) return "female";
    return null;
  };

  /* 性别列单元格 → male/female/null */
  function parseGenderCell(v) {
    const s = String(v === null || v === undefined ? "" : v).trim();
    if (!s) return null;
    if (s.indexOf("男") >= 0 || s === "M" || s === "m") return "male";
    if (s.indexOf("女") >= 0 || s === "F" || s === "f") return "female";
    return null;
  }

  function cellHasValue(row, colIdx) {
    if (colIdx === null || colIdx === undefined) return false;
    const v = row[colIdx];
    return v !== null && v !== undefined && String(v).trim() !== "";
  }

  /* 解析模板文件 → {sheetRows:[{sheetName, genderMode, rows, errors}], warnings:[]}
     genderMode: 'genderCol'（性别列识别）| 'project'（按项目推断）| 'sheet'（按工作表名）| 'manual'（需手动） */
  IM.readTemplate = function (file) {
    return IM.parseWorkbook(file).then(function (wb) {
      const result = { sheetRows: [], warnings: [] };
      wb.SheetNames.forEach(function (name) {
        const ws = wb.Sheets[name];
        /* raw:false 取格式化文本（保留时间显示、前导零等） */
        const rows2d = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
        const headerIdx = IM.detectHeaderRow(rows2d);
        if (headerIdx < 0) {
          result.warnings.push("工作表「" + name + "」中未找到表头（需含「学籍号」和「姓名」列），已跳过");
          return;
        }
        const headerRow = rows2d[headerIdx];
        const { mapping, genderCols, genderColIdx } = IM.mapColumns(headerRow);
        if (mapping.studentNo === undefined || mapping.name === undefined) {
          result.warnings.push("工作表「" + name + "」缺少学籍号或姓名列，已跳过");
          return;
        }
        const sheetGender = IM.guessGender(name);
        /* 识别方式 */
        let genderMode = "manual";
        if (genderColIdx !== null) genderMode = "genderCol";
        else if (sheetGender) genderMode = "sheet";
        else if (genderCols.maleEndurance !== null || genderCols.femaleEndurance !== null ||
                 genderCols.maleStrength !== null || genderCols.femaleStrength !== null) genderMode = "project";

        /* 教师/班级猜测：表头行以下的前20行内找第一个非数字的文本 */
        let teacherGuess = "", classNameGuess = "";
        const teacherIdx = headerRow.findIndex(function (c) { return normHeader(c) === "体测教师"; });
        const classIdx = headerRow.findIndex(function (c) { return normHeader(c) === "班级"; });
        for (let r = headerIdx + 1; r < Math.min(rows2d.length, headerIdx + 21); r++) {
          if (!teacherGuess && teacherIdx >= 0 && rows2d[r][teacherIdx]) {
            const tv = String(rows2d[r][teacherIdx]).trim();
            if (tv && isNaN(parseFloat(tv))) teacherGuess = tv;
          }
          if (!classNameGuess && classIdx >= 0 && rows2d[r][classIdx]) {
            const cv = String(rows2d[r][classIdx]).trim();
            if (cv && isNaN(parseFloat(cv))) classNameGuess = cv;
          }
        }

        const rows = [];
        const seenNos = {};
        const errors = [];
        for (let r = headerIdx + 1; r < rows2d.length; r++) {
          const row = rows2d[r] || [];
          const rawNo = mapping.studentNo !== undefined ? row[mapping.studentNo] : "";
          const rawName = mapping.name !== undefined ? row[mapping.name] : "";
          const noText = String(rawNo === null || rawNo === undefined ? "" : rawNo).trim();
          const nameText = String(rawName === null || rawName === undefined ? "" : rawName).trim();
          /* 数据列是否有内容（用于区分"完全空行"与"有成绩但缺学籍号/姓名"） */
          let hasAnyData = false;
          Object.keys(mapping).forEach(function (field) {
            if (field === "studentNo" || field === "name") return;
            if (cellHasValue(row, mapping[field])) hasAnyData = true;
          });
          Object.keys(genderCols).forEach(function (gk) {
            if (cellHasValue(row, genderCols[gk])) hasAnyData = true;
          });
          if (genderColIdx !== null && cellHasValue(row, genderColIdx)) hasAnyData = true;
          if (!noText && !nameText && !hasAnyData) continue; /* 完全空行跳过 */
          const rowErrors = [];
          if (!noText) rowErrors.push("缺少学籍号");
          if (!nameText) rowErrors.push("缺少姓名");

          /* 性别判定优先级：性别列 → 工作表名（单一性别标记） → 按项目推断 */
          let gender = null;
          if (genderColIdx !== null && cellHasValue(row, genderColIdx)) {
            gender = parseGenderCell(row[genderColIdx]);
            if (!gender) rowErrors.push("性别列无法识别：" + String(row[genderColIdx]).trim() + "（应填男/女）");
          }
          if (!gender && sheetGender) gender = sheetGender;
          if (!gender) {
            const hasMale = cellHasValue(row, genderCols.maleEndurance) || cellHasValue(row, genderCols.maleStrength);
            const hasFemale = cellHasValue(row, genderCols.femaleEndurance) || cellHasValue(row, genderCols.femaleStrength);
            if (hasMale && !hasFemale) gender = "male";
            else if (hasFemale && !hasMale) gender = "female";
            else if (hasMale && hasFemale) rowErrors.push("无法判断性别（男生项目和女生项目都有成绩）");
            else rowErrors.push("无法判断性别（无性别列且男女项目都无成绩）");
          }

          /* 原始成绩：耐力跑/力量按该行性别从对应列取值 */
          const raw = {};
          Object.keys(mapping).forEach(function (field) {
            if (field === "studentNo" || field === "name") return;
            const idx = mapping[field];
            const parsed = parseCell(field, row[idx]);
            if (!parsed.ok) rowErrors.push(parsed.error);
            else if (parsed.value !== null && parsed.value !== undefined) raw[field] = parsed.value;
          });
          if (gender) {
            let enduranceIdx = gender === "male" ? genderCols.maleEndurance : genderCols.femaleEndurance;
            let strengthIdx = gender === "male" ? genderCols.maleStrength : genderCols.femaleStrength;
            /* 旧版分表模板容错：本性别列缺失时回退到异性列（表名已明确性别） */
            if (enduranceIdx === null && genderMode === "sheet") {
              enduranceIdx = gender === "male" ? genderCols.femaleEndurance : genderCols.maleEndurance;
            }
            if (strengthIdx === null && genderMode === "sheet") {
              strengthIdx = gender === "male" ? genderCols.femaleStrength : genderCols.maleStrength;
            }
            if (cellHasValue(row, enduranceIdx)) {
              const parsed = parseCell("endurance", row[enduranceIdx]);
              if (!parsed.ok) rowErrors.push(parsed.error);
              else raw.endurance = parsed.value;
            }
            if (cellHasValue(row, strengthIdx)) {
              const parsed = parseCell("strength", row[strengthIdx]);
              if (!parsed.ok) rowErrors.push(parsed.error);
              else raw.strength = parsed.value;
            }
          }

          const studentNo = noText.replace(/\.0+$/, "");
          if (rowErrors.length) {
            errors.push({ rowNum: r + 1, studentNo: studentNo || "?", name: nameText || "?", errors: rowErrors });
            continue;
          }
          if (seenNos[studentNo]) {
            errors.push({ rowNum: r + 1, studentNo: studentNo, name: nameText, errors: ["学籍号与第 " + seenNos[studentNo] + " 行重复"] });
            continue;
          }
          seenNos[studentNo] = r + 1;
          rows.push({ rowNum: r + 1, studentNo: studentNo, name: nameText, gender: gender, raw: raw });
        }
        result.sheetRows.push({
          sheetName: name,
          gender: sheetGender,
          genderMode: genderMode,
          teacherGuess: teacherGuess,
          classNameGuess: classNameGuess,
          rows: rows,
          errors: errors,
        });
      });
      return result;
    });
  };

  /* 应用导入：mode 'update' 覆盖已有学生成绩 / 'skip' 保留原成绩；新学号一律追加。
     genderOverrides: {sheetName: 'male'|'female'} —— 仅对 gender 为 null 的行生效（兜底） */
  IM.applyImport = function (options) {
    const data = options.data;
    const batch = FCS.storage.findBatch(data, options.classId, options.batchId);
    if (!batch) return { ok: false, error: "找不到目标班级/批次" };
    let added = 0, updated = 0, skipped = 0;
    options.sheetRows.forEach(function (sr) {
      if (!sr.rows.length) return;
      sr.rows.forEach(function (row) {
        const gender = row.gender || (options.genderOverrides && options.genderOverrides[sr.sheetName]) || sr.gender;
        if (!gender) return; /* 性别无法判定的行由预览界面保证已处理 */
        const exist = FCS.storage.findStudent(batch, row.studentNo);
        if (exist) {
          if (options.mode === "skip") { skipped++; return; }
          exist.name = row.name;
          exist.gender = gender;
          exist.raw = row.raw;
          updated++;
        } else {
          const s = {
            id: FCS.util.uid("s"),
            studentNo: row.studentNo,
            name: row.name,
            gender: gender,
            raw: row.raw,
          };
          batch.students.push(s);
          added++;
        }
      });
    });
    FCS.storage.save(data);
    return { ok: true, added: added, updated: updated, skipped: skipped };
  };

  FCS.importer = IM;
})();
