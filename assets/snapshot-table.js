(() => {
  "use strict";

  const controls = {
    query: "snapshot-search",
    position: "snapshot-relationship-position",
    explicitness: "snapshot-relationship-explicitness",
    mutuality: "snapshot-relationship-mutuality",
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
      position: documentRef.getElementById(controls.position)?.value || "",
      explicitness:
        documentRef.getElementById(controls.explicitness)?.value || "",
      mutuality:
        documentRef.getElementById(controls.mutuality)?.value || "",
      maleRomance:
        documentRef.getElementById(controls.maleRomance)?.value || "",
    };
  }

  function hasRelationshipPredicate(state) {
    return Boolean(state.position || state.explicitness || state.mutuality);
  }

  function profileMatches(profile, state) {
    for (const [field, selected] of [
      ["position", state.position],
      ["explicitness", state.explicitness],
      ["mutuality", state.mutuality],
    ]) {
      if (selected && profile?.[field]?.code !== selected) return false;
    }
    return true;
  }

  function matchingRelationshipProfiles(item, state) {
    if (!hasRelationshipPredicate(state)) return [];
    const profiles = Array.isArray(item.relationship_profiles)
      ? item.relationship_profiles
      : [];
    return profiles.filter((profile) => profileMatches(profile, state));
  }

  function relationshipProfileText(profile) {
    const labels = [
      profile?.position?.label,
      profile?.explicitness?.label,
      profile?.mutuality?.label,
    ].filter(Boolean);
    return `${profile?.name || "未命名关系"}（${labels.join("／")}）`;
  }

  function relationshipProfilesText(profiles) {
    return Array.isArray(profiles)
      ? profiles.map(relationshipProfileText).join("；")
      : "";
  }

  function matchingRelationshipsText(item, state) {
    return relationshipProfilesText(matchingRelationshipProfiles(item, state));
  }

  function matches(item, state) {
    if (state.query && !normalize(item.title).includes(state.query)) return false;
    if (
      hasRelationshipPredicate(state) &&
      matchingRelationshipProfiles(item, state).length === 0
    ) return false;
    if (
      state.maleRomance &&
      item.male_romance_line !== state.maleRomance
    ) return false;
    return true;
  }

  globalThis.YuriSnapshotFilterLogic = {
    normalize,
    currentState,
    hasRelationshipPredicate,
    profileMatches,
    matchingRelationshipProfiles,
    matchingRelationshipsText,
    matches,
  };

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
            const title = `《${escapeHtml(item.title)}》`;
            if (!item.bangumi_url) {
              const reportUrl = `../../works/${encodeURIComponent(item.slug)}/`;
              return `<a href="${reportUrl}">${title}</a>`;
            }
            return (
              `<a href="${escapeHtml(item.bangumi_url)}" target="_blank" ` +
              `rel="noopener noreferrer">${title}</a>`
            );
          },
        },
        {
          title: "年份／媒介",
          field: "year_medium",
          minWidth: 130,
        },
        {
          title: "全作最高明确度",
          field: "explicitness.label",
          minWidth: 190,
        },
        {
          title: "全作关系位置",
          field: "female_relationship_position",
          minWidth: 140,
        },
        {
          title: "全作恋爱位置",
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
          title: "女女关系明细",
          field: "relationship_profiles",
          visible: false,
          download: true,
          accessorDownload: (value) => relationshipProfilesText(value),
        },
        {
          title: "命中关系",
          field: "matched_relationships",
          visible: false,
          download: true,
          accessorDownload: (_value, item) =>
            matchingRelationshipsText(item, currentState()),
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
