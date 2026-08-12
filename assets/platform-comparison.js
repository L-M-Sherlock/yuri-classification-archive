(() => {
  "use strict";

  const platformIds = {
    bangumi: "platform-bangumi",
    anime_planet: "platform-anime-planet",
    anilist: "platform-anilist",
    myanimelist: "platform-myanimelist",
  };
  const stateLabels = {
    tagged: "命中",
    untagged: "未命中",
    no_corresponding_entry: "无可对应页面",
  };

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase("zh-CN");
  }

  function matchesPlatform(platform, selected) {
    if (!selected) return true;
    if (selected === "has_entry") {
      return platform?.state === "tagged" || platform?.state === "untagged";
    }
    return platform?.state === selected;
  }

  function matches(item, state) {
    if (state.query && !normalize(item.title).includes(state.query)) return false;
    return Object.keys(platformIds).every((key) =>
      matchesPlatform(item.platforms?.[key], state[key]),
    );
  }

  function numericMissingLast(a, b, _aRow, _bRow, _column, direction) {
    const aMissing = a === null || a === undefined || a === "";
    const bMissing = b === null || b === undefined || b === "";
    if (aMissing && bMissing) return 0;
    if (aMissing) return direction === "asc" ? 1 : -1;
    if (bMissing) return direction === "asc" ? -1 : 1;
    return Number(a) - Number(b);
  }

  globalThis.YuriPlatformComparisonLogic = {
    normalize,
    matchesPlatform,
    matches,
    numericMissingLast,
  };

  function makePlatformCell(platform, metric, labels = stateLabels) {
    const wrapper = document.createElement("span");
    wrapper.className = `platform-state ${platform.state}`;
    const metricText = metric === null || metric === undefined ? "" : ` ${metric}`;
    wrapper.append(`${labels[platform.state]}${metricText}`);
    platform.urls.forEach((url, index) => {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = platform.urls.length === 1 ? "条目 ↗" : `条目 ${index + 1} ↗`;
      wrapper.append(" ", link);
    });
    return wrapper;
  }

  async function setup() {
    const host = document.getElementById("platform-comparison-table");
    if (!host || typeof Tabulator === "undefined") return;
    let payload;
    try {
      const response = await fetch(host.dataset.source, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
    } catch (_error) {
      const panel = document.getElementById("platform-comparison-error");
      if (panel) {
        panel.hidden = false;
        panel.textContent = "平台组合数据加载失败，请稍后刷新页面。";
      }
      return;
    }

    const rows = payload.items.map((item) => ({
      ...item,
      bangumi_state: stateLabels[item.platforms.bangumi.state],
      anime_planet_state: stateLabels[item.platforms.anime_planet.state],
      anilist_state: stateLabels[item.platforms.anilist.state],
      myanimelist_state: stateLabels[item.platforms.myanimelist.state],
    }));
    const basePath = globalThis.SITE_CONFIG?.basePath || "";
    const table = new Tabulator(host, {
      data: rows,
      index: "slug",
      layout: "fitDataStretch",
      pagination: true,
      paginationMode: "local",
      paginationSize: 50,
      paginationSizeSelector: [25, 50, 100, payload.item_count],
      placeholder: "没有作品符合当前筛选条件",
      initialSort: [{ column: "platforms.bangumi.rank", dir: "asc" }],
      columns: [
        { title: "slug", field: "slug", visible: false, download: true },
        {
          title: "作品",
          field: "title",
          minWidth: 240,
          formatter(cell) {
            const item = cell.getRow().getData();
            const link = document.createElement("a");
            link.href = `${basePath}/works/${encodeURIComponent(item.slug)}/`;
            link.textContent = `《${item.title}》`;
            return link;
          },
        },
        { title: "年份／媒介", field: "year_medium", minWidth: 130 },
        { title: "bgm 排名", field: "platforms.bangumi.rank", sorter: numericMissingLast, minWidth: 110 },
        {
          title: "Bangumi 维基标签",
          field: "bangumi_state",
          minWidth: 190,
          formatter: (cell) => makePlatformCell(
            cell.getRow().getData().platforms.bangumi,
            null,
            {
              tagged: "含“百合”",
              untagged: "不含“百合”",
              no_corresponding_entry: "无可对应页面",
            },
          ),
        },
        {
          title: "百合标签比例",
          field: "platforms.bangumi.yuri_tag_ratio",
          sorter: numericMissingLast,
          minWidth: 150,
          formatter(cell) {
            const value = cell.getValue();
            return value === null || value === undefined
              ? "—"
              : `${(Number(value) * 100).toFixed(2)}%`;
          },
        },
        {
          title: "Anime-Planet GL",
          field: "anime_planet_state",
          minWidth: 205,
          formatter: (cell) => makePlatformCell(cell.getRow().getData().platforms.anime_planet),
        },
        {
          title: "AniList Yuri 相关性",
          field: "platforms.anilist.yuri_relevance",
          sorter: numericMissingLast,
          minWidth: 220,
          formatter(cell) {
            const item = cell.getRow().getData();
            return makePlatformCell(item.platforms.anilist, cell.getValue());
          },
        },
        {
          title: "MAL Girls Love",
          field: "myanimelist_state",
          minWidth: 205,
          formatter: (cell) => makePlatformCell(cell.getRow().getData().platforms.myanimelist),
        },
      ],
    });

    const count = document.getElementById("platform-result-count");
    function currentState() {
      const state = { query: normalize(document.getElementById("platform-search")?.value) };
      Object.entries(platformIds).forEach(([key, id]) => {
        state[key] = document.getElementById(id)?.value || "";
      });
      return state;
    }
    function updateCount(activeRows = table.getRows("active")) {
      if (count) count.textContent = `当前显示 ${activeRows.length} / ${payload.item_count}`;
    }
    function applyFilters() {
      const state = currentState();
      table.setFilter((item) => matches(item, state));
    }
    table.on("dataFiltered", (_filters, activeRows) => updateCount(activeRows));
    table.on("tableBuilt", () => updateCount());
    document.getElementById("platform-search")?.addEventListener("input", applyFilters);
    Object.values(platformIds).forEach((id) =>
      document.getElementById(id)?.addEventListener("change", applyFilters),
    );
    document.getElementById("platform-reset")?.addEventListener("click", () => {
      const search = document.getElementById("platform-search");
      if (search) search.value = "";
      Object.values(platformIds).forEach((id) => {
        const control = document.getElementById(id);
        if (control) control.value = "";
      });
      table.clearFilter();
    });
    document.getElementById("platform-download-csv")?.addEventListener("click", () =>
      table.download("csv", "yuri-platform-comparison-filtered.csv", { bom: true }, "active"),
    );
    document.getElementById("platform-download-xlsx")?.addEventListener("click", () =>
      table.download("xlsx", "yuri-platform-comparison-filtered.xlsx", { sheetName: "平台组合" }, "active"),
    );
  }

  document.addEventListener("DOMContentLoaded", setup);
})();
