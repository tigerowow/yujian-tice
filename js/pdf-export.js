/* pdf-export.js — PDF导出（html2canvas + jsPDF，完全离线）
   支持：单份导出 exportHTML(html, filename, orientation)
        多份合并 exportMulti(parts, filename)——每一项从新页开始、可各自指定横/纵向。
   渲染：等图片加载 → 测量块/行边界 → 整份报告一次渲染 → 空白自检（降缩放重试）→
         智能分页（普通块不截断；表格按画布检测的行边框线切行并重复表头）。
   兜底链：布局异常整体重试；行切分爆炸改用按页高切条；空白则降缩放重试再报错。
   表格使用flex布局div（见report.js），不受个别浏览器表格布局bug影响。 */
(function () {
  "use strict";
  const FCS = window.FCS;
  const P = {};

  /* 空白检测：统计采样像素中非白比例 */
  function blankRatio(canvas) {
    try {
      const ctx = canvas.getContext("2d");
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const total = data.length / 4;
      const step = Math.max(1, Math.floor(total / 30000));
      let nonWhite = 0, sampled = 0;
      for (let i = 0; i < total; i += step) {
        sampled++;
        if (data[i * 4] < 250 || data[i * 4 + 1] < 250 || data[i * 4 + 2] < 250) nonWhite++;
      }
      return nonWhite / sampled;
    } catch (e) {
      return 0;
    }
  }

  /* 从渲染画布检测表格行边界（投票制）：真正行边框横贯整行，12个采样列中≥7个命中才认线 */
  function detectTableRows(canvas, yStart, yEnd) {
    try {
      const ctx = canvas.getContext("2d");
      const h = Math.max(1, yEnd - yStart);
      const w = canvas.width;
      const cols = [];
      for (let i = 0; i < 12; i++) cols.push(Math.min(w - 2, Math.max(2, Math.round(w * (i + 0.5) / 12))));
      const colData = cols.map(function (x) {
        return ctx.getImageData(x, yStart, 1, h).data;
      });
      const votes = [];
      for (let y = 0; y < h; y++) {
        let cnt = 0;
        const off = y * 4;
        for (let c = 0; c < colData.length; c++) {
          const r = colData[c][off], g = colData[c][off + 1], b = colData[c][off + 2];
          if (r >= 170 && r <= 218 && g >= 195 && g <= 234 && b >= 215 && b <= 250) cnt++;
        }
        votes.push(cnt);
      }
      const lines = [];
      let inLine = false, lineStart = 0;
      for (let y = 0; y < h; y++) {
        const isLine = votes[y] >= 7;
        if (isLine && !inLine) { inLine = true; lineStart = y; }
        else if (!isLine && inLine) { inLine = false; lines.push(yStart + Math.round((lineStart + y - 1) / 2)); }
      }
      if (inLine) lines.push(yStart + Math.round((lineStart + h - 1) / 2));
      if (lines.length < 2) return null;
      const rows = [];
      for (let i = 0; i < lines.length - 1; i++) {
        rows.push({ top: lines[i], bottom: lines[i + 1] });
      }
      return rows.length ? rows : null;
    } catch (e) {
      return null;
    }
  }

  /* 渲染一份报告HTML为页面画布数组 + 统计信息。
     orientation: 'p' 纵向（内容宽734）| 'l' 横向（内容宽1038） */
  function renderToPages(html, orientation) {
    return new Promise(function (resolve, reject) {
      const isLandscape = orientation === "l";
      const W = isLandscape ? 1038 : 734;
      const SCALE = 2;
      let container = null;
      let wrapper = null;

      const buildContainer = function () {
        if (wrapper && wrapper.parentNode) document.body.removeChild(wrapper);
        wrapper = document.createElement("div");
        wrapper.style.cssText = "position:relative;height:0;overflow:hidden;";
        container = document.createElement("div");
        container.style.cssText =
          "width:" + W + "px;background:#ffffff;" +
          "font-family:'Segoe UI','微软雅黑',sans-serif;color:#1f3a57;";
        container.innerHTML = html;
        wrapper.appendChild(container);
        document.body.appendChild(wrapper);
      };
      buildContainer();

      const fail = function (e) {
        if (wrapper && wrapper.parentNode) document.body.removeChild(wrapper);
        if (e && e.message === "LAYOUT_BAD") {
          reject(new Error("页面布局测量异常，请稍后重试（若多次失败请刷新页面）"));
          return;
        }
        if (e && e.message === "PAGES_EXPLODE") {
          reject(new Error("报告分页异常（" + (e.detail || "") + "），请稍后重试一次"));
          return;
        }
        reject(e);
      };

      const waitImages = function () {
        const imgs = Array.prototype.slice.call(container.querySelectorAll("img"));
        if (!imgs.length) return Promise.resolve();
        return Promise.all(imgs.map(function (img) {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise(function (res) {
            img.onload = res;
            img.onerror = res;
            setTimeout(res, 3000);
          });
        }));
      };

      const measureUnits = function () {
        const blocks = Array.prototype.slice.call(container.querySelectorAll(".rep-block"));
        if (!blocks.length) throw new Error("报告内容为空");
        const containerTop = container.getBoundingClientRect().top;
        const units = [];
        blocks.forEach(function (blk) {
          const r = blk.getBoundingClientRect();
          const top = Math.round(r.top - containerTop);
          const bottom = Math.round(r.bottom - containerTop);
          if (blk.classList.contains("rep-table")) {
            const rows = [];
            Array.prototype.forEach.call(blk.querySelectorAll(".rep-row"), function (tr, i) {
              const rr = tr.getBoundingClientRect();
              rows.push({
                top: Math.round(rr.top - containerTop),
                bottom: Math.round(rr.bottom - containerTop),
                isHeader: i === 0,
              });
            });
            units.push({ type: "table", top: top, bottom: bottom, rows: rows });
          } else {
            units.push({ type: "simple", top: top, bottom: bottom });
          }
        });
        let prevBottom = -1;
        for (let i = 0; i < units.length; i++) {
          if (units[i].top < prevBottom - 2) throw new Error("LAYOUT_BAD");
          prevBottom = Math.max(prevBottom, units[i].bottom);
        }
        return units;
      };

      const renderAt = function (scale) {
        return html2canvas(container, { scale: scale, backgroundColor: "#ffffff", logging: false, windowWidth: 900 });
      };
      const renderWithCheck = function () {
        let usedScale = SCALE;
        if (container.scrollHeight * SCALE > 12000) {
          usedScale = Math.max(1, Math.floor(12000 / container.scrollHeight * 10) / 10);
        }
        return renderAt(usedScale).then(function (canvas) {
          if (blankRatio(canvas) < 0.005) {
            const fallback = Math.max(1, Math.round((usedScale - 0.5) * 10) / 10);
            return renderAt(fallback).then(function (canvas2) {
              if (blankRatio(canvas2) < 0.005) {
                throw new Error("报告渲染异常（内容空白），请刷新页面后重试");
              }
              return canvas2;
            });
          }
          return canvas;
        });
      };

      const runOnce = function () {
        return waitImages()
          .then(function () {
            return new Promise(function (res) { setTimeout(res, 50); });
          })
          .then(function () {
            const units = measureUnits();
            return renderWithCheck().then(function (canvas) {
              return { canvas: canvas, units: units };
            });
          });
      };

      /* 分页组装。rowMode=true 按行切表；false 兜底按页高切条 */
      const assemble = function (rowMode) {
        return runOnce().catch(function (e) {
          if (e && e.message === "LAYOUT_BAD") {
            return new Promise(function (res) { setTimeout(res, 600); }).then(function () {
              buildContainer();
              return runOnce();
            });
          }
          throw e;
        }).then(function (r) {
          const ratio = blankRatio(r.canvas);
          const scrollH = container.scrollHeight;
          document.body.removeChild(wrapper);
          wrapper = null;
          container = null;
          try {
            const k = r.canvas.width / W;
            const PAGE_W = r.canvas.width;
            const PAGE_H = Math.round(PAGE_W * (isLandscape ? 210 / 297 : 297 / 210));

            const pages = [{ items: [] }];
            let cur = 0, pageTop = 0, detectedRows = 0;
            const newPage = function () { pages.push({ items: [] }); cur++; pageTop = 0; };
            const push = function (y0, y1) {
              pages[cur].items.push({ y0: Math.round(y0 * k), y1: Math.round(y1 * k) });
              pageTop += Math.round((y1 - y0) * k);
            };
            const pushRaw = function (y0, y1) {
              pages[cur].items.push({ y0: Math.round(y0), y1: Math.round(y1) });
              pageTop += Math.round(y1 - y0);
            };

            r.units.forEach(function (u) {
              if (u.type === "simple") {
                const h = (u.bottom - u.top) * k;
                if (pageTop > 0 && pageTop + h > PAGE_H) newPage();
                push(u.top, u.bottom);
                return;
              }
              if (!rowMode) {
                let yy = Math.round(u.top * k);
                const yEnd = Math.round(u.bottom * k);
                while (yy < yEnd) {
                  const chunk = Math.min(PAGE_H, yEnd - yy);
                  if (pageTop > 0) newPage();
                  pushRaw(yy, yy + chunk);
                  yy += chunk;
                }
                return;
              }
              let rows = detectTableRows(r.canvas, Math.round(u.top * k), Math.round(u.bottom * k));
              if (rows) detectedRows += rows.length;
              if (!rows && u.rows && u.rows.length) {
                rows = u.rows.map(function (row) {
                  return { top: Math.round(row.top * k), bottom: Math.round(row.bottom * k) };
                });
              }
              if (!rows) rows = [{ top: Math.round(u.top * k), bottom: Math.round(u.bottom * k) }];
              rows.forEach(function (row) {
                const rh = row.bottom - row.top;
                if (pageTop > 0 && pageTop + rh > PAGE_H) {
                  newPage();
                  const hdr = rows[0];
                  if (hdr && row !== hdr) pushRaw(hdr.top, hdr.bottom);
                }
                pushRaw(row.top, row.bottom);
                if (pageTop >= PAGE_H) newPage();
              });
            });
            while (pages.length > 1 && !pages[pages.length - 1].items.length) pages.pop();

            if (pages.length > 80) {
              const err = new Error("PAGES_EXPLODE");
              err.detail = "页数" + pages.length + " 画布" + r.canvas.width + "x" + r.canvas.height +
                " 块数" + r.units.length + " 画布检出行" + detectedRows + " 滚动高" + scrollH;
              throw err;
            }

            const pageCanvases = pages.map(function (pg) {
              const pc = document.createElement("canvas");
              pc.width = PAGE_W;
              pc.height = PAGE_H;
              const ctx = pc.getContext("2d");
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, PAGE_W, PAGE_H);
              let py = 0;
              pg.items.forEach(function (it) {
                const h = it.y1 - it.y0;
                ctx.drawImage(r.canvas, 0, it.y0, r.canvas.width, h, 0, py, r.canvas.width, h);
                py += h;
              });
              return pc;
            });
            resolve({
              pageCanvases: pageCanvases,
              stats: {
                pages: pageCanvases.length,
                nonWhite: Math.round(ratio * 1000) / 1000,
                scale: k,
                canvas: r.canvas.width + "x" + r.canvas.height,
                units: r.units.length,
                detectedRows: detectedRows,
                scrollHeight: scrollH,
                orientation: orientation || "p",
              },
            });
          } catch (e) {
            throw e;
          }
        });
      };

      assemble(true).catch(function (e) {
        if (e && e.message === "PAGES_EXPLODE") {
          buildContainer();
          return assemble(false);
        }
        throw e;
      }).catch(fail);
    });
  }

  /* 页面画布 → 单个jsPDF文件（页面方向一致） */
  function saveSinglePdf(pageCanvases, orientation, filename) {
    const isLandscape = orientation === "l";
    const pdf = new jspdf.jsPDF({ orientation: isLandscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
    const pageW = isLandscape ? 297 : 210;
    const margin = 10;
    const imgW = pageW - margin * 2;
    pageCanvases.forEach(function (pc, i) {
      if (i > 0) pdf.addPage("a4", isLandscape ? "l" : "p");
      pdf.addImage(pc.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgW, pc.height * imgW / pc.width);
    });
    pdf.save(filename);
  }

  /* 导出单份HTML为PDF */
  P.exportHTML = function (html, filename, orientation) {
    orientation = orientation || "p";
    return renderToPages(html, orientation).then(function (r) {
      P._lastStats = r.stats;
      saveSinglePdf(r.pageCanvases, orientation, filename);
      return { pages: r.pageCanvases.length };
    });
  };

  /* 多份合并导出：parts=[{html, orientation}]，依序渲染，每份从新页开始，页方向各自生效 */
  P.exportMulti = function (parts, filename) {
    return new Promise(function (resolve, reject) {
      const allPages = [];
      let lastStats = null;
      let idx = 0;
      const next = function () {
        if (idx >= parts.length) {
          try {
            const firstOrient = parts.length ? (parts[0].orientation || "p") : "p";
            const pdf = new jspdf.jsPDF({ orientation: firstOrient === "l" ? "landscape" : "portrait", unit: "mm", format: "a4" });
            allPages.forEach(function (entry, i) {
              const isL = entry.orientation === "l";
              const pageW = isL ? 297 : 210;
              const margin = 10;
              const imgW = pageW - margin * 2;
              if (i > 0) pdf.addPage("a4", isL ? "l" : "p");
              pdf.addImage(entry.canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgW, entry.canvas.height * imgW / entry.canvas.width);
            });
            pdf.save(filename);
            P._lastStats = lastStats;
            resolve({ pages: allPages.length });
          } catch (e) {
            reject(e);
          }
          return;
        }
        const part = parts[idx++];
        renderToPages(part.html, part.orientation || "p").then(function (r) {
          r.pageCanvases.forEach(function (pc) {
            allPages.push({ canvas: pc, orientation: part.orientation || "p" });
          });
          lastStats = r.stats;
          next();
        }).catch(reject);
      };
      next();
    });
  };

  /* 导出带进度提示 */
  P.toastResult = function (promise, what) {
    FCS.util.toast("⏳ 正在生成" + what + "，请稍候…", "info");
    promise.then(function (r) {
      FCS.util.toast("📄 " + what + "已生成并开始下载（共 " + r.pages + " 页）", "success");
    }).catch(function (e) {
      console.error(e);
      FCS.util.toast(what + "生成失败：" + e.message, "error");
    });
  };

  FCS.pdfExport = P;
})();
