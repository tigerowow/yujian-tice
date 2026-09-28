/* storage.js — 数据层：localStorage 持久化 + JSON 备份/恢复 + 版本迁移 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const ST = {};

  ST.KEY = "fcs_data_v1";
  ST.VERSION = 1;

  /* 空数据结构 */
  ST.emptyData = function () {
    return {
      version: ST.VERSION,
      createdAt: new Date().toISOString(),
      lastBackupAt: null,
      ui: { lastClassId: null, lastBatchId: null },
      classes: [],
      plans: {},
    };
  };

  /* 读取：损坏时返回空数据并提示 */
  ST.load = function () {
    try {
      const raw = localStorage.getItem(ST.KEY);
      if (!raw) return ST.emptyData();
      const parsed = JSON.parse(raw);
      return ST.migrate(parsed);
    } catch (e) {
      console.error("数据读取失败", e);
      FCS.util.toast("本地数据读取失败，已重置为空数据", "error");
      return ST.emptyData();
    }
  };

  /* 版本迁移链：v0(无version) → v1 ... */
  ST.migrate = function (data) {
    if (!data || typeof data !== "object") return ST.emptyData();
    let v = data.version || 0;
    if (v < 1) {
      // v0 无版本字段，补齐结构
      data.version = 1;
      if (!data.createdAt) data.createdAt = new Date().toISOString();
      if (!data.lastBackupAt) data.lastBackupAt = null;
      if (!data.ui) data.ui = { lastClassId: null, lastBatchId: null };
      if (!Array.isArray(data.classes)) data.classes = [];
      if (!data.plans) data.plans = {};
      v = 1;
    }
    return data;
  };

  /* 保存：try/catch 捕获容量超限 */
  ST.save = function (data) {
    try {
      localStorage.setItem(ST.KEY, JSON.stringify(data));
      return { ok: true };
    } catch (e) {
      console.error("数据保存失败", e);
      FCS.util.toast("保存失败：存储空间不足。请立即点击右上角「设置」导出数据备份！", "error");
      return { ok: false, error: e };
    }
  };

  /* 存储占用估算（UTF-16 字符 × 2 字节） */
  ST.estimateSize = function (data) {
    try {
      return JSON.stringify(data).length * 2;
    } catch (e) { return 0; }
  };
  ST.formatSize = function (bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  };

  /* JSON 备份导出 */
  ST.exportBackup = function (data) {
    const payload = JSON.stringify(data, null, 2);
    const d = new Date();
    const name = "体测数据备份_" + d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + ".json";
    FCS.util.downloadText(name, payload);
    data.lastBackupAt = new Date().toISOString();
    ST.save(data);
    return name;
  };

  /* JSON 备份导入：校验结构 → 返回 {ok, data, error}（由调用方预览确认后替换） */
  ST.importBackup = function (file) {
    return new Promise(function (resolve) {
      const reader = new FileReader();
      reader.onerror = function () { resolve({ ok: false, error: "文件读取失败" }); };
      reader.onload = function () {
        try {
          const parsed = JSON.parse(String(reader.result));
          const data = ST.migrate(parsed);
          if (!Array.isArray(data.classes)) {
            resolve({ ok: false, error: "这不是有效的体测数据备份文件" });
            return;
          }
          let studentCount = 0, batchCount = 0;
          data.classes.forEach(function (c) {
            if (!Array.isArray(c.batches)) { c.batches = []; }
            c.batches.forEach(function (b) {
              batchCount++;
              if (Array.isArray(b.students)) studentCount += b.students.length;
            });
          });
          data._preview = { classCount: data.classes.length, batchCount: batchCount, studentCount: studentCount };
          resolve({ ok: true, data: data });
        } catch (e) {
          resolve({ ok: false, error: "文件内容不是有效的 JSON 格式" });
        }
      };
      reader.readAsText(file);
    });
  };

  /* 距上次备份天数（从未备份返回 null） */
  ST.backupDays = function (data) {
    if (!data.lastBackupAt) return null;
    const ms = Date.now() - new Date(data.lastBackupAt).getTime();
    if (isNaN(ms)) return null;
    return Math.floor(ms / 86400000);
  };

  /* 班级/批次查询辅助 */
  ST.findClass = function (data, classId) {
    return data.classes.find(function (c) { return c.id === classId; }) || null;
  };
  ST.findBatch = function (data, classId, batchId) {
    const c = ST.findClass(data, classId);
    if (!c) return null;
    return c.batches.find(function (b) { return b.id === batchId; }) || null;
  };
  /* 按学籍号查学生 */
  ST.findStudent = function (batch, studentNo) {
    return batch.students.find(function (s) { return s.studentNo === studentNo; }) || null;
  };

  /* 新建班级 */
  ST.createClass = function (data, info) {
    const c = {
      id: FCS.util.uid("c"),
      name: info.name || "未命名班级",
      teacher: info.teacher || "",
      semester: info.semester || "",
      createdAt: new Date().toISOString(),
      batches: [],
    };
    data.classes.push(c);
    ST.save(data);
    return c;
  };

  /* 新建批次：opts.copyFromBatchId 指定则只复制名单（学籍号/姓名/性别，不带成绩） */
  ST.createBatch = function (data, classId, info) {
    const c = ST.findClass(data, classId);
    if (!c) return null;
    const b = {
      id: FCS.util.uid("b"),
      name: info.name || "测试批次",
      testDate: info.testDate || FCS.util.today(),
      note: info.note || "",
      createdAt: new Date().toISOString(),
      students: [],
    };
    if (info.copyFromBatchId) {
      const src = c.batches.find(function (x) { return x.id === info.copyFromBatchId; });
      if (src) {
        b.students = src.students.map(function (s) {
          return { id: FCS.util.uid("s"), studentNo: s.studentNo, name: s.name, gender: s.gender, raw: {} };
        });
      }
    }
    c.batches.push(b);
    ST.save(data);
    return b;
  };

  /* 新建学生（查重学籍号） */
  ST.createStudent = function (batch, info) {
    const s = {
      id: FCS.util.uid("s"),
      studentNo: String(info.studentNo || ""),
      name: info.name || "",
      gender: info.gender === "female" ? "female" : "male",
      raw: {},
    };
    batch.students.push(s);
    return s;
  };

  /* 删除学生 */
  ST.removeStudent = function (batch, studentId) {
    const i = batch.students.findIndex(function (s) { return s.id === studentId; });
    if (i >= 0) batch.students.splice(i, 1);
  };

  FCS.storage = ST;
})();
