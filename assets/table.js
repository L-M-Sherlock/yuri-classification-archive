(async function () {
  "use strict";

  const config = window.SITE_CONFIG || { basePath: "" };
  const tableElement = document.getElementById("classification-table");
  if (!tableElement) return;

  const resultCount = document.getElementById("result-count");
  const errorPanel = document.getElementById("table-error");
  const clearButton = document.getElementById("clear-filters");
  const searchInput = document.getElementById("title-search");
  const quickButtons = Array.from(
    document.querySelectorAll("#quick-filters [data-query]"),
  );
  const filterElements = {
    medium: document.getElementById("medium-filter"),
    female_relationship_centrality: document.getElementById("relationship-filter"),
    archive_basis: document.getElementById("basis-filter"),
    highest_romance_explicitness: document.getElementById("explicitness-filter"),
    official_label: document.getElementById("official-filter"),
    male_romance_line: document.getElementById("male-filter"),
    confidence: document.getElementById("confidence-filter"),
  };

  function showError(message) {
    errorPanel.hidden = false;
    errorPanel.textContent = message;
    resultCount.textContent = "总表读取失败";
  }

  function uniqueOptions(items, field) {
    const map = new Map();
    for (const item of items) {
      const value = item[field];
      if (value && value.code && !map.has(value.code)) {
        map.set(value.code, value.label);
      }
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "zh-CN"),
    );
  }

  function populateSelect(select, options) {
    for (const [value, label] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    searchInput.value = params.get("q") || "";
    for (const [field, element] of Object.entries(filterElements)) {
      element.value = params.get(field) || "";
    }
    const activeQuick = new Set(params.getAll("quick"));
    for (const button of quickButtons) {
      button.setAttribute(
        "aria-pressed",
        activeQuick.has(button.dataset.query) ? "true" : "false",
      );
    }
  }

  function stateToUrl() {
    const params = new URLSearchParams();
    const query = searchInput.value.trim();
    if (query) params.set("q", query);
    for (const [field, element] of Object.entries(filterElements)) {
      if (element.value) params.set(field, element.value);
    }
    for (const button of quickButtons) {
      if (button.getAttribute("aria-pressed") === "true") {
        params.append("quick", button.dataset.query);
      }
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${suffix}`);
  }

  function titleFormatter(cell) {
    const item = cell.getRow().getData();
    const link = document.createElement("a");
    link.href = item.report_url;
    link.textContent = `《${item.title}》`;
    link.className = "table-title-link";
    return link;
  }

  function labelFormatter(cell) {
    const value = cell.getValue();
    return value && value.label ? value.label : "—";
  }

  function ratioFormatter(cell) {
    const value = cell.getValue();
    return typeof value === "number" ? `${(value * 100).toFixed(2)}%` : "—";
  }

  function searchableTitle(item) {
    return [
      item.title,
      item.title_original,
      item.title_romaji,
      item.title_english,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("zh-CN");
  }

  try {
    const response = await fetch(`${config.basePath}/data/catalog.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload || payload.schema_version !== 1 || !Array.isArray(payload.items)) {
      throw new Error("公开总表格式不受支持");
    }
    const items = payload.items;

    for (const field of Object.keys(filterElements)) {
      populateSelect(filterElements[field], uniqueOptions(items, field));
    }
    readStateFromUrl();

    const table = new Tabulator(tableElement, {
      data: items,
      index: "slug",
      layout: "fitDataStretch",
      responsiveLayout: "collapse",
      pagination: "local",
      paginationSize: 25,
      paginationSizeSelector: [25, 50, 100, true],
      paginationCounter: "rows",
      movableColumns: true,
      initialSort: [
        { column: "bangumi_rank", dir: "asc" },
        { column: "title", dir: "asc" },
      ],
      placeholder: "没有作品符合当前筛选条件",
      langs: {
        "zh-cn": {
          pagination: {
            page_size: "每页",
            first: "首页",
            first_title: "第一页",
            last: "末页",
            last_title: "最后一页",
            prev: "上一页",
            prev_title: "上一页",
            next: "下一页",
            next_title: "下一页",
            all: "全部",
            counter: {
              showing: "显示",
              of: "／",
              rows: "项",
              pages: "页",
            },
          },
        },
      },
      locale: "zh-cn",
      columns: [
        {
          title: "作品",
          field: "title",
          formatter: titleFormatter,
          width: 220,
          frozen: true,
          headerFilter: "input",
          headerFilterPlaceholder: "列内搜索",
        },
        { title: "年份", field: "release_year", sorter: "number", width: 78 },
        {
          title: "媒介",
          field: "medium",
          formatter: labelFormatter,
          width: 105,
          accessorDownload: (value) => value.label,
        },
        {
          title: "女女关系位置",
          field: "female_relationship_centrality",
          formatter: labelFormatter,
          width: 120,
          accessorDownload: (value) => value.label,
        },
        {
          title: "归档依据",
          field: "archive_basis",
          formatter: labelFormatter,
          width: 112,
          accessorDownload: (value) => value.label,
        },
        {
          title: "恋爱位置",
          field: "romance_centrality",
          formatter: labelFormatter,
          width: 105,
          accessorDownload: (value) => value.label,
        },
        {
          title: "最高明确度",
          field: "highest_romance_explicitness",
          formatter: labelFormatter,
          width: 128,
          accessorDownload: (value) => value.label,
        },
        {
          title: "官方",
          field: "official_label",
          formatter: labelFormatter,
          width: 105,
          accessorDownload: (value) => value.label,
        },
        {
          title: "身份依据",
          field: "identity_evidence_basis",
          formatter: labelFormatter,
          width: 145,
          accessorDownload: (value) => value.label,
        },
        {
          title: "男性恋爱线",
          field: "male_romance_line",
          formatter: labelFormatter,
          width: 112,
          accessorDownload: (value) => value.label,
        },
        {
          title: "置信度",
          field: "confidence",
          formatter: labelFormatter,
          width: 90,
          accessorDownload: (value) => value.label,
        },
        {
          title: "Bangumi Rank",
          field: "bangumi_rank",
          sorter: (a, b) => (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER),
          width: 118,
        },
        {
          title: "百合标签比例",
          field: "bangumi_yuri_tag_ratio",
          formatter: ratioFormatter,
          sorter: "number",
          width: 118,
          accessorDownload: (value) =>
            typeof value === "number" ? value : "",
        },
        {
          title: "分类日期",
          field: "classification_date",
          sorter: "date",
          width: 112,
        },
        {
          title: "范围",
          field: "scope_summary",
          visible: false,
          download: true,
        },
        {
          title: "内容提示标识",
          field: "content_warnings_text",
          visible: false,
          download: true,
        },
        {
          title: "报告地址",
          field: "report_url",
          visible: false,
          download: true,
        },
      ],
    });

    function applyFilters() {
      const filters = [];
      const query = searchInput.value.trim().toLocaleLowerCase("zh-CN");
      if (query) {
        filters.push((item) => searchableTitle(item).includes(query));
      }
      for (const [field, element] of Object.entries(filterElements)) {
        if (element.value) {
          filters.push((item) => item[field] && item[field].code === element.value);
        }
      }
      for (const button of quickButtons) {
        if (button.getAttribute("aria-pressed") === "true") {
          const key = button.dataset.query;
          filters.push((item) => Boolean(item.quick_queries[key]));
        }
      }
      table.setFilter(filters);
      stateToUrl();
      resultCount.textContent = `当前显示 ${table.getDataCount("active")}／${items.length} 份报告`;
    }

    for (const element of [searchInput, ...Object.values(filterElements)]) {
      element.addEventListener(element === searchInput ? "input" : "change", applyFilters);
    }
    for (const button of quickButtons) {
      button.addEventListener("click", () => {
        const active = button.getAttribute("aria-pressed") === "true";
        button.setAttribute("aria-pressed", active ? "false" : "true");
        applyFilters();
      });
    }
    clearButton.addEventListener("click", () => {
      searchInput.value = "";
      for (const element of Object.values(filterElements)) element.value = "";
      for (const button of quickButtons) button.setAttribute("aria-pressed", "false");
      applyFilters();
    });
    document.getElementById("download-csv").addEventListener("click", () => {
      table.download(
        "csv",
        "yuri-classification-filtered.csv",
        { bom: true },
        "active",
      );
    });
    document.getElementById("download-xlsx").addEventListener("click", () => {
      table.download(
        "xlsx",
        "yuri-classification-filtered.xlsx",
        { sheetName: "作品分类" },
        "active",
      );
    });

    applyFilters();
  } catch (error) {
    showError(`无法读取公开总表：${error.message}`);
  }
})();
