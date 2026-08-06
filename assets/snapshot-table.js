(() => {
  "use strict";

  const controls = {
    query: "snapshot-search",
    explicitness: "snapshot-explicitness",
    relationship: "snapshot-relationship",
    romance: "snapshot-romance",
    maleRomance: "snapshot-male-romance",
  };
  const downloads = {
    csv: "snapshot-download-csv",
    xlsx: "snapshot-download-xlsx",
  };

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase("zh-CN");
  }

  function currentState(documentRef = document) {
    return {
      query: normalize(documentRef.getElementById(controls.query)?.value),
      explicitness:
        documentRef.getElementById(controls.explicitness)?.value || "",
      relationship:
        documentRef.getElementById(controls.relationship)?.value || "",
      romance: documentRef.getElementById(controls.romance)?.value || "",
      maleRomance:
        documentRef.getElementById(controls.maleRomance)?.value || "",
    };
  }

  function matches(item, state) {
    if (state.query && !normalize(item.title).includes(state.query)) return false;
    if (
      state.explicitness &&
      item.explicitness?.code !== state.explicitness
    ) return false;
    if (
      state.relationship &&
      item.female_relationship_position !== state.relationship
    ) return false;
    if (state.romance && item.romance_position !== state.romance) return false;
    if (
      state.maleRomance &&
      item.male_romance_line !== state.maleRomance
    ) return false;
    return true;
  }

  globalThis.YuriSnapshotFilterLogic = { normalize, currentState, matches };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function setupSnapshotTable() {
    const host = document.getElementById("snapshot-table");
    if (!host || typeof Tabulator === "undefined") return;

    let payload;
    try {
      const response = await fetch(host.dataset.source, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
    } catch (_error) {
      host.innerHTML =
        '<p class="snapshot-error">固定快照加载失败，请稍后刷新页面。</p>';
      return;
    }

    const count = document.getElementById("snapshot-count");
    const total = payload.item_count;
    const table = new Tabulator(host, {
      data: payload.items,
      index: "row_number",
      layout: "fitDataStretch",
      pagination: true,
      paginationMode: "local",
      paginationSize: 25,
      paginationSizeSelector: [25, 50, 100, total],
      placeholder: "没有作品符合当前筛选条件",
      columnDefaults: { download: true },
      columns: [
        {
          title: "slug",
          field: "slug",
          visible: false,
          download: true,
        },
        {
          title: "作品",
          field: "title",
          minWidth: 230,
          formatter(cell) {
            const item = cell.getRow().getData();
            return (
              `<a href="${escapeHtml(item.bangumi_url)}" target="_blank" ` +
              `rel="noopener noreferrer">《${escapeHtml(item.title)}》</a>`
            );
          },
        },
        {
          title: "年份／媒介",
          field: "year_medium",
          minWidth: 130,
        },
        {
          title: "最高明确度",
          field: "explicitness.label",
          minWidth: 190,
        },
        {
          title: "女女关系位置",
          field: "female_relationship_position",
          minWidth: 140,
        },
        {
          title: "恋爱位置",
          field: "romance_position",
          minWidth: 120,
        },
        {
          title: "适合的查询",
          field: "queries",
          minWidth: 260,
          formatter(cell) {
            const values = cell.getValue();
            return values?.length ? escapeHtml(values.join("、")) : "—";
          },
          accessorDownload(value) {
            return Array.isArray(value) ? value.join("、") : "";
          },
        },
        {
          title: "男性恋爱线",
          field: "male_romance_line",
          minWidth: 130,
        },
        {
          title: "Bangumi 条目",
          field: "bangumi_url",
          visible: false,
          download: true,
        },
      ],
    });

    function updateCount(rows = table.getRows("active")) {
      if (count) count.textContent = `当前显示 ${rows.length} / ${total}`;
    }

    function applyFilters() {
      const state = currentState();
      table.setFilter((item) => matches(item, state));
    }

    table.on("dataFiltered", (_filters, rows) => updateCount(rows));
    table.on("tableBuilt", () => updateCount());

    for (const id of Object.values(controls)) {
      const control = document.getElementById(id);
      const eventName = control?.type === "search" ? "input" : "change";
      control?.addEventListener(eventName, applyFilters);
    }

    document.getElementById("snapshot-reset")?.addEventListener("click", () => {
      for (const id of Object.values(controls)) {
        const control = document.getElementById(id);
        if (control) control.value = "";
      }
      table.clearFilter();
    });

    document.getElementById(downloads.csv)?.addEventListener("click", () => {
      table.download(
        "csv",
        "yuri-classification-lookup-filtered.csv",
        { bom: true },
        "active",
      );
    });
    document.getElementById(downloads.xlsx)?.addEventListener("click", () => {
      table.download(
        "xlsx",
        "yuri-classification-lookup-filtered.xlsx",
        { sheetName: "作品查找表" },
        "active",
      );
    });
  }

  document.addEventListener("DOMContentLoaded", setupSnapshotTable);
})();
