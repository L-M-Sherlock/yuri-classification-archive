const YuriCatalogFilterLogic = (() => {
  "use strict";

  const scalarFields = [
    "medium",
    "female_relationship_centrality",
    "archive_basis",
    "highest_romance_explicitness",
    "official_literal_yuri_gl",
    "official_female_romance_wording",
    "male_romance_line",
    "confidence",
  ];
  const multiFields = {
    official_source_scopes: "official_scope",
    official_source_surfaces: "official_surface",
  };
  const filterValueAliases = {
    medium: {
      // V4 keeps historical medium spellings in the catalog.  These values
      // share one reader-facing category and must therefore produce one
      // option and one filter result set.
      anime_tv: "tv_anime",
      tv: "tv_anime",
      tv_animation: "tv_anime",
      "TV animation": "tv_anime",
      "TV ANIME": "tv_anime",
      "TV series": "tv_anime",
      tv_short: "tv_short_anime",
      web_animation: "web_anime",
      WEB: "web_anime",
      "WEB YouTube": "web_anime",
      anime_film: "theatrical_movie",
      theatrical_animation: "theatrical_movie",
      "剧场版": "theatrical_movie",
      anime_ova: "ova",
    },
  };

  function canonicalFilterValue(field, value) {
    return filterValueAliases[field]?.[value] || value;
  }

  function selectedCodes(values) {
    return Array.from(new Set((values || []).filter(Boolean))).sort();
  }

  function parseState(search) {
    const params = new URLSearchParams(search || "");
    const scalar = {};
    for (const field of scalarFields) {
      scalar[field] = canonicalFilterValue(field, params.get(field) || "");
    }
    const multi = {};
    for (const [field, urlKey] of Object.entries(multiFields)) {
      multi[field] = selectedCodes(
        params.getAll(urlKey).map((value) => canonicalFilterValue(field, value)),
      );
    }
    return {
      query: params.get("q") || "",
      scalar,
      multi,
      quick: selectedCodes(params.getAll("quick")),
    };
  }

  function serializeState(state) {
    const params = new URLSearchParams();
    const query = (state.query || "").trim();
    if (query) params.set("q", query);
    for (const field of scalarFields) {
      const value = state.scalar?.[field] || "";
      if (value) params.set(field, value);
    }
    for (const [field, urlKey] of Object.entries(multiFields)) {
      for (const value of selectedCodes(state.multi?.[field])) {
        params.append(urlKey, value);
      }
    }
    for (const value of selectedCodes(state.quick)) {
      params.append("quick", value);
    }
    return params.toString();
  }

  function itemMatchesScalar(item, field, expected) {
    if (!expected) return true;
    const value = item[field];
    return canonicalFilterValue(field, value?.code) === expected;
  }

  function itemMatchesMulti(item, field, selected) {
    if (!selected?.length) return true;
    const codes = new Set(
      (Array.isArray(item[field]) ? item[field] : [])
        .map((value) => canonicalFilterValue(field, value?.code))
        .filter(Boolean),
    );
    return selected.some((value) => codes.has(value));
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

  function matchesItem(item, state) {
    const query = (state.query || "").trim().toLocaleLowerCase("zh-CN");
    if (query && !searchableTitle(item).includes(query)) return false;
    for (const field of scalarFields) {
      if (!itemMatchesScalar(item, field, state.scalar?.[field] || "")) {
        return false;
      }
    }
    for (const field of Object.keys(multiFields)) {
      if (!itemMatchesMulti(item, field, state.multi?.[field] || [])) {
        return false;
      }
    }
    for (const queryKey of state.quick || []) {
      if (item.quick_queries?.[queryKey] !== true) return false;
    }
    return true;
  }

  function bangumiMetricValue(item, value) {
    if (typeof value === "number") return value;
    const status = item?.bangumi_entry_status;
    if (status?.code === "no_exact_entry") return "无精确条目";
    if (status?.code === "unknown") return "未核实";
    return "字段缺失";
  }

  return Object.freeze({
    scalarFields,
    multiFields,
    canonicalFilterValue,
    parseState,
    serializeState,
    matchesItem,
    bangumiMetricValue,
  });
})();

if (typeof globalThis !== "undefined") {
  globalThis.YuriCatalogFilterLogic = YuriCatalogFilterLogic;
}

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
  const scalarFilterElements = {
    medium: document.getElementById("medium-filter"),
    female_relationship_centrality: document.getElementById("relationship-filter"),
    archive_basis: document.getElementById("basis-filter"),
    highest_romance_explicitness: document.getElementById("explicitness-filter"),
    official_literal_yuri_gl: document.getElementById("official-literal-filter"),
    official_female_romance_wording: document.getElementById("official-romance-filter"),
    male_romance_line: document.getElementById("male-filter"),
    confidence: document.getElementById("confidence-filter"),
  };
  const multiFilterElements = {
    official_source_scopes: document.getElementById("official-scope-filter"),
    official_source_surfaces: document.getElementById("official-surface-filter"),
  };
  const allControls = [
    searchInput,
    ...Object.values(scalarFilterElements),
    ...Object.values(multiFilterElements),
    clearButton,
  ];

  function showError(message) {
    errorPanel.hidden = false;
    errorPanel.textContent = message;
    resultCount.textContent = "总表读取失败";
  }

  if (allControls.some((element) => !element)) {
    showError("总表筛选控件不完整，请重新生成公开站点。");
    return;
  }

  function uniqueOptions(items, field) {
    const map = new Map();
    for (const item of items) {
      const value = item[field];
      if (!value || !value.code) continue;
      const code = YuriCatalogFilterLogic.canonicalFilterValue(field, value.code);
      if (!map.has(code)) map.set(code, value.label);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "zh-CN"),
    );
  }

  function uniqueListOptions(items, field) {
    const map = new Map();
    for (const item of items) {
      const values = Array.isArray(item[field]) ? item[field] : [];
      for (const value of values) {
        if (!value || !value.code) continue;
        const code = YuriCatalogFilterLogic.canonicalFilterValue(field, value.code);
        if (!map.has(code)) map.set(code, value.label);
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

  function populateMultiChoices(container, field, options) {
    const inputName = YuriCatalogFilterLogic.multiFields[field];
    for (const [value, text] of options) {
      const label = document.createElement("label");
      label.className = "multi-choice";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = inputName;
      input.value = value;
      input.id = `${container.id}-${value}`;

      const labelText = document.createElement("span");
      labelText.className = "multi-choice-label";
      labelText.textContent = text;

      label.append(input, labelText);
      container.appendChild(label);
    }
  }

  function selectedMultiValues(container) {
    return Array.from(
      container.querySelectorAll('input[type="checkbox"]:checked'),
      (input) => input.value,
    );
  }

  function setSelectedMultiValues(container, values) {
    const selected = new Set(values || []);
    for (const input of container.querySelectorAll('input[type="checkbox"]')) {
      input.checked = selected.has(input.value);
    }
  }

  function readUiState() {
    const scalar = {};
    for (const [field, element] of Object.entries(scalarFilterElements)) {
      scalar[field] = YuriCatalogFilterLogic.canonicalFilterValue(
        field,
        element.value || "",
      );
    }
    const multi = {};
    for (const [field, element] of Object.entries(multiFilterElements)) {
      multi[field] = selectedMultiValues(element).map((value) =>
        YuriCatalogFilterLogic.canonicalFilterValue(field, value),
      );
    }
    return {
      query: searchInput.value,
      scalar,
      multi,
      quick: quickButtons
        .filter((button) => button.getAttribute("aria-pressed") === "true")
        .map((button) => button.dataset.query),
    };
  }

  function writeUiState(state) {
    searchInput.value = state.query || "";
    for (const [field, element] of Object.entries(scalarFilterElements)) {
      element.value = state.scalar?.[field] || "";
    }
    for (const [field, element] of Object.entries(multiFilterElements)) {
      setSelectedMultiValues(element, state.multi?.[field] || []);
    }
    const activeQuick = new Set(state.quick || []);
    for (const button of quickButtons) {
      button.setAttribute(
        "aria-pressed",
        activeQuick.has(button.dataset.query) ? "true" : "false",
      );
    }
  }

  function stateToUrl() {
    const suffix = YuriCatalogFilterLogic.serializeState(readUiState());
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${suffix ? `?${suffix}` : ""}`,
    );
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

  function labelsText(value) {
    return Array.isArray(value)
      ? value.map((entry) => entry?.label).filter(Boolean).join("、")
      : "";
  }

  function labelsFormatter(cell) {
    return labelsText(cell.getValue()) || "—";
  }

  function ratioFormatter(cell) {
    const value = cell.getValue();
    return typeof value === "number"
      ? `${(value * 100).toFixed(2)}%`
      : bangumiMetricFallback(cell.getRow().getData());
  }

  function bangumiMetricFallback(item) {
    return YuriCatalogFilterLogic.bangumiMetricValue(item, null);
  }

  function bangumiRankFormatter(cell) {
    const value = cell.getValue();
    return typeof value === "number"
      ? value
      : bangumiMetricFallback(cell.getRow().getData());
  }

  function bangumiMetricDownload(value, item) {
    return YuriCatalogFilterLogic.bangumiMetricValue(item, value);
  }

  try {
    const response = await fetch(`${config.basePath}/data/catalog.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (
      !payload ||
      payload.schema_version !== 4 ||
      !Array.isArray(payload.items)
    ) {
      throw new Error("公开总表格式不受支持");
    }
    const items = payload.items;

    for (const field of Object.keys(scalarFilterElements)) {
      populateSelect(scalarFilterElements[field], uniqueOptions(items, field));
    }
    for (const field of Object.keys(multiFilterElements)) {
      populateMultiChoices(
        multiFilterElements[field],
        field,
        uniqueListOptions(items, field),
      );
    }
    writeUiState(YuriCatalogFilterLogic.parseState(window.location.search));

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
      columnDefaults: { download: true },
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
          title: "女女恋爱位置",
          field: "romance_centrality",
          formatter: labelFormatter,
          width: 105,
          accessorDownload: (value) => value.label,
        },
        {
          title: "女女关系最高明确度",
          field: "highest_romance_explicitness",
          formatter: labelFormatter,
          width: 128,
          accessorDownload: (value) => value.label,
        },
        {
          title: "官方字面百合／GL",
          field: "official_literal_yuri_gl",
          formatter: labelFormatter,
          width: 132,
          accessorDownload: (value) => value.label,
        },
        {
          title: "官方女女恋爱表述",
          field: "official_female_romance_wording",
          formatter: labelFormatter,
          width: 142,
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
          title: "结论置信度",
          field: "confidence",
          formatter: labelFormatter,
          headerTooltip:
            "表示当前锁定范围内，现有证据对本报告主要分类结论的支持稳定度；它不是百合程度、作品质量、社群共识或统计概率。",
          width: 112,
          accessorDownload: (value) => value.label,
        },
        {
          title: "Bangumi 条目状态",
          field: "bangumi_entry_status",
          formatter: labelFormatter,
          width: 132,
          accessorDownload: (value) => value.label,
        },
        {
          title: "Bangumi Rank",
          field: "bangumi_rank",
          formatter: bangumiRankFormatter,
          sorter: (a, b) => (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER),
          width: 118,
          accessorDownload: bangumiMetricDownload,
        },
        {
          title: "百合标签比例",
          field: "bangumi_yuri_tag_ratio",
          formatter: ratioFormatter,
          sorter: "number",
          width: 118,
          accessorDownload: bangumiMetricDownload,
        },
        {
          title: "官方来源层级",
          field: "official_source_scopes",
          formatter: labelsFormatter,
          visible: false,
          download: true,
          accessorDownload: labelsText,
        },
        {
          title: "官方材料位置",
          field: "official_source_surfaces",
          formatter: labelsFormatter,
          visible: false,
          download: true,
          accessorDownload: labelsText,
        },
        {
          title: "分类日期",
          field: "classification_date",
          sorter: "date",
          width: 112,
        },
        { title: "范围", field: "scope_summary", visible: false, download: true },
        {
          title: "内容提示标识",
          field: "content_warnings_text",
          visible: false,
          download: true,
        },
        {
          title: "报告地址",
          field: "report_url_absolute",
          visible: false,
          download: true,
        },
      ],
    });

    function matchesConfiguredFilters(item) {
      return YuriCatalogFilterLogic.matchesItem(item, readUiState());
    }

    function applyFilters() {
      table.setFilter(matchesConfiguredFilters);
      stateToUrl();
    }

    table.on("dataFiltered", (_filters, rows) => {
      resultCount.textContent = `当前显示 ${rows.length}／${items.length} 份报告`;
    });
    table.on("tableBuilt", applyFilters);

    searchInput.addEventListener("input", applyFilters);
    for (const element of [
      ...Object.values(scalarFilterElements),
      ...Object.values(multiFilterElements),
    ]) {
      element.addEventListener("change", applyFilters);
    }
    for (const button of quickButtons) {
      button.addEventListener("click", () => {
        const active = button.getAttribute("aria-pressed") === "true";
        button.setAttribute("aria-pressed", active ? "false" : "true");
        applyFilters();
      });
    }
    clearButton.addEventListener("click", () => {
      writeUiState({ query: "", scalar: {}, multi: {}, quick: [] });
      table.clearHeaderFilter();
      applyFilters();
    });
    window.addEventListener("popstate", () => {
      writeUiState(YuriCatalogFilterLogic.parseState(window.location.search));
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
  } catch (error) {
    showError(`无法读取公开总表：${error.message}`);
  }
})();
