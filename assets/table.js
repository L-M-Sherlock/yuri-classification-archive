const YuriCatalogFilterLogic = (() => {
  "use strict";

  const scalarFields = [
    "medium",
    "archive_basis",
    "official_literal_yuri_gl",
    "official_female_romance_wording",
    "male_romance_line",
    "confidence",
  ];
  const relationshipFields = {
    relationship_position: "position",
    relationship_explicitness: "explicitness",
    relationship_mutuality: "mutuality",
  };
  const relationshipOptionOrders = {
    position: ["main", "important_secondary", "local"],
    explicitness: [
      "explicit_relationship",
      "explicit_desire",
      "potential_or_strongly_coded",
      "non_romantic",
      "unknown",
    ],
    mutuality: [
      "mutual",
      "one_sided",
      "ambiguous",
      "not_applicable",
      "unknown",
    ],
  };
  const relationshipCountBands = ["zero", "one", "two_three", "four_plus"];
  const relationScopedQuickQueries = new Set([
    "main_explicit_relationship",
    "explicit_relationship",
    "main_explicit_desire",
    "explicit_desire",
    "accepts_unconfirmed",
    "female_relationship_main",
    "main_relationship_no_male_romance",
    "main_non_romantic_no_male_romance",
    "mutual_relationship",
  ]);
  const quickQuestionLabels = {
    main_non_romantic_no_male_romance: "全部已确认女女关系均为非恋爱",
    official_literal_yuri_gl: "官方材料直接写‘百合’或‘GL’",
    official_female_romance_wording: "官方材料把女女关系写成恋爱",
  };
  const filterFieldLabels = {
    medium: "媒介",
    archive_basis: "百合归档结论",
    official_literal_yuri_gl: "官方字面百合／GL",
    official_female_romance_wording: "官方女女恋爱表述",
    confidence: "结论置信度",
    official_source_scopes: "官方来源层级",
    official_source_surfaces: "官方材料位置",
  };
  const publicLabels = {
    position: {
      main: "主线",
      important_secondary: "重要副线",
      local: "局部",
      absent: "缺席",
      unknown: "未知",
    },
    explicitness: {
      explicit_relationship: "明确交往",
      explicit_desire: "明确欲望",
      potential_or_strongly_coded: "潜在恋爱",
      non_romantic: "非恋爱",
      unknown: "未知",
    },
    mutuality: {
      mutual: "双向",
      one_sided: "单向",
      ambiguous: "相互性未确认",
      not_applicable: "不适用",
      unknown: "未知",
    },
    relationship_count: {
      zero: "0 条",
      one: "1 条",
      two_three: "2–3 条",
      four_plus: "4 条以上",
    },
    male_romance_line: {
      none: "无",
      secondary: "副线",
      parallel: "并列",
      dominant: "主导",
      unknown: "未知",
    },
  };
  const scalarOptionOrders = {
    archive_basis: [
      "work_classification",
      "reader_interpretation",
      "non_yuri",
      "insufficient_evidence",
    ],
    male_romance_line: ["none", "secondary", "parallel", "dominant", "unknown"],
  };
  const tableColumnOrders = {
    female_relationship_centrality: [
      "main",
      "important_secondary",
      "local",
      "absent",
      "unknown",
    ],
    archive_basis: scalarOptionOrders.archive_basis,
    romance_centrality: [
      "main",
      "important_secondary",
      "local",
      "absent",
      "unknown",
    ],
    highest_romance_explicitness: relationshipOptionOrders.explicitness,
    official_literal_yuri_gl: ["yes", "reviewed_no_match", "unknown"],
    official_female_romance_wording: ["yes", "reviewed_no_match", "unknown"],
    identity_evidence_basis: [
      "explicit_identity_self_statement",
      "official_identity_profile",
      "explicit_relationship_only",
      "inferred_relationship_only",
      "no_in_scope_evidence",
      "unknown",
    ],
    male_romance_line: scalarOptionOrders.male_romance_line,
    confidence: ["high", "medium", "low", "unknown"],
  };
  const multiFields = {
    official_source_scopes: "official_scope",
    official_source_surfaces: "official_surface",
  };
  const filterValueAliases = {
    medium: {
      // V5 keeps historical medium spellings in the catalog.  These values
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

  function sortRelationshipOptions(options, nestedField) {
    const order = relationshipOptionOrders[nestedField] || [];
    const rank = new Map(order.map((code, index) => [code, index]));
    return Array.from(options).sort((a, b) => {
      const aRank = rank.has(a[0]) ? rank.get(a[0]) : order.length;
      const bRank = rank.has(b[0]) ? rank.get(b[0]) : order.length;
      return aRank - bRank || a[1].localeCompare(b[1], "zh-CN");
    });
  }

  function sortScalarOptions(options, field) {
    const order = scalarOptionOrders[field] || [];
    const rank = new Map(order.map((code, index) => [code, index]));
    return Array.from(options).sort((a, b) => {
      const aRank = rank.has(a[0]) ? rank.get(a[0]) : order.length;
      const bRank = rank.has(b[0]) ? rank.get(b[0]) : order.length;
      return aRank - bRank || a[1].localeCompare(b[1], "zh-CN");
    });
  }

  function compareCategoricalValues(a, b, order = []) {
    const rank = new Map(order.map((code, index) => [code, index]));
    const aCode = a?.code || "";
    const bCode = b?.code || "";
    const aRank = rank.has(aCode) ? rank.get(aCode) : order.length;
    const bRank = rank.has(bCode) ? rank.get(bCode) : order.length;
    return (
      aRank - bRank ||
      String(a?.label || aCode).localeCompare(
        String(b?.label || bCode),
        "zh-CN",
      )
    );
  }

  function parseState(search) {
    const params = new URLSearchParams(search || "");
    const scalar = {};
    for (const field of scalarFields) {
      scalar[field] = canonicalFilterValue(field, params.get(field) || "");
    }
    const relationship = {};
    for (const field of Object.keys(relationshipFields)) {
      relationship[field] = params.get(field) || "";
    }
    // Upgrade links created before relationship-level orthogonal filters.
    relationship.relationship_position ||= params.get("female_relationship_centrality") || "";
    relationship.relationship_explicitness ||= params.get("highest_romance_explicitness") || "";
    const multi = {};
    for (const [field, urlKey] of Object.entries(multiFields)) {
      multi[field] = selectedCodes(
        params.getAll(urlKey).map((value) => canonicalFilterValue(field, value)),
      );
    }
    return {
      query: params.get("q") || "",
      scalar,
      relationship,
      relationship_count: relationshipCountBands.includes(
        params.get("relationship_count"),
      )
        ? params.get("relationship_count")
        : "",
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
    for (const field of Object.keys(relationshipFields)) {
      const value = state.relationship?.[field] || "";
      if (value) params.set(field, value);
    }
    if (relationshipCountBands.includes(state.relationship_count)) {
      params.set("relationship_count", state.relationship_count);
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

  function intersectAllowed(current, values) {
    const next = new Set(values);
    if (current === null) return next;
    return new Set(Array.from(current).filter((value) => next.has(value)));
  }

  function effectiveRelationshipConstraint(state) {
    let position = null;
    let explicitness = null;
    let mutuality = null;
    let active = false;
    const direct = state.relationship || {};
    if (direct.relationship_position) {
      position = intersectAllowed(position, [direct.relationship_position]);
      active = true;
    }
    if (direct.relationship_explicitness) {
      explicitness = intersectAllowed(explicitness, [direct.relationship_explicitness]);
      active = true;
    }
    if (direct.relationship_mutuality) {
      mutuality = intersectAllowed(mutuality, [direct.relationship_mutuality]);
      active = true;
    }

    for (const queryKey of state.quick || []) {
      if (!relationScopedQuickQueries.has(queryKey)) continue;
      active = true;
      if ([
        "main_explicit_relationship",
        "main_explicit_desire",
        "female_relationship_main",
        "main_relationship_no_male_romance",
        "main_non_romantic_no_male_romance",
      ].includes(queryKey)) {
        position = intersectAllowed(position, ["main"]);
      }
      if (queryKey === "main_non_romantic_no_male_romance") {
        explicitness = intersectAllowed(explicitness, ["non_romantic"]);
      }
      if (["main_explicit_relationship", "explicit_relationship"].includes(queryKey)) {
        explicitness = intersectAllowed(explicitness, ["explicit_relationship"]);
      }
      if (["main_explicit_desire", "explicit_desire"].includes(queryKey)) {
        explicitness = intersectAllowed(explicitness, [
          "explicit_relationship",
          "explicit_desire",
        ]);
      }
      if (queryKey === "accepts_unconfirmed") {
        explicitness = intersectAllowed(explicitness, [
          "explicit_relationship",
          "explicit_desire",
          "potential_or_strongly_coded",
        ]);
      }
      if (queryKey === "mutual_relationship") {
        mutuality = intersectAllowed(mutuality, ["mutual"]);
      }
    }
    return { active, position, explicitness, mutuality };
  }

  function hasRelationshipPredicate(state) {
    return effectiveRelationshipConstraint(state).active;
  }

  function profileMatchesConstraint(profile, constraint) {
    for (const [field, allowed] of [
      ["position", constraint.position],
      ["explicitness", constraint.explicitness],
      ["mutuality", constraint.mutuality],
    ]) {
      if (allowed !== null && !allowed.has(profile?.[field]?.code || "")) {
        return false;
      }
    }
    return true;
  }

  function matchingRelationshipProfiles(item, state) {
    const constraint = effectiveRelationshipConstraint(state);
    if (!constraint.active) return [];
    const profiles = Array.isArray(item.relationship_profiles)
      ? item.relationship_profiles
      : [];
    return profiles.filter((profile) =>
      profileMatchesConstraint(profile, constraint),
    );
  }

  function relationshipCountMatches(count, band) {
    if (!band) return true;
    if (!Number.isInteger(count) || count < 0) return false;
    const value = count;
    if (band === "zero") return value === 0;
    if (band === "one") return value === 1;
    if (band === "two_three") return value >= 2 && value <= 3;
    if (band === "four_plus") return value >= 4;
    return true;
  }

  function itemMatchesRelationshipCount(item, state) {
    const count = item.female_female_relationship_count;
    if (!relationshipCountMatches(count, state.relationship_count || "")) {
      return false;
    }
    if ((state.quick || []).includes("four_plus_female_relationships")) {
      return relationshipCountMatches(count, "four_plus");
    }
    return true;
  }

  function itemMatchesWorkQuickConditions(item, state) {
    for (const queryKey of state.quick || []) {
      if (relationScopedQuickQueries.has(queryKey)) {
        if (
          [
            "main_relationship_no_male_romance",
            "main_non_romantic_no_male_romance",
          ].includes(queryKey) &&
          item.male_romance_line?.code !== "none"
        ) {
          return false;
        }
        if (
          queryKey === "main_non_romantic_no_male_romance" &&
          (!Array.isArray(item.relationship_profiles) ||
            item.relationship_profiles.length === 0 ||
            !item.relationship_profiles.every(
              (profile) => profile?.explicitness?.code === "non_romantic",
            ))
        ) {
          return false;
        }
        continue;
      }
      if (queryKey === "four_plus_female_relationships") continue;
      if (item.quick_queries?.[queryKey] !== true) return false;
    }
    return true;
  }

  function allowedLabels(values, field) {
    if (values === null) return "";
    if (values.size === 0) return "互相冲突";
    return Array.from(values)
      .map((value) => publicLabels[field]?.[value] || value)
      .join("或");
  }

  function displayStateLabel(field, value, labelOverrides) {
    return (
      labelOverrides?.[field]?.[value] ||
      publicLabels[field]?.[value] ||
      value
    );
  }

  function describeState(state, labelOverrides = {}) {
    const clauses = [];
    const query = (state.query || "").trim();
    if (query) clauses.push(`标题包含“${query}”`);

    const constraint = effectiveRelationshipConstraint(state);
    const relationshipConflict = [
      constraint.position,
      constraint.explicitness,
      constraint.mutuality,
    ].some((allowed) => allowed !== null && allowed.size === 0);
    const zeroRelationshipConflict =
      constraint.active && state.relationship_count === "zero";
    const fourPlusConflict =
      (state.quick || []).includes("four_plus_female_relationships") &&
      ["zero", "one", "two_three"].includes(state.relationship_count);
    const noMaleRomanceQuick = (state.quick || []).some((queryKey) =>
      [
        "main_relationship_no_male_romance",
        "main_non_romantic_no_male_romance",
      ].includes(queryKey),
    );
    const maleRomanceConflict =
      noMaleRomanceQuick &&
      Boolean(state.scalar?.male_romance_line) &&
      state.scalar.male_romance_line !== "none";
    if (
      relationshipConflict ||
      zeroRelationshipConflict ||
      fourPlusConflict ||
      maleRomanceConflict
    ) {
      return "当前问题：所选条件不能同时成立，因此不会有作品命中。";
    }
    if (constraint.active) {
      const parts = [];
      if (constraint.position !== null) {
        parts.push(`叙事位置为${allowedLabels(constraint.position, "position")}`);
      }
      if (constraint.explicitness !== null) {
        parts.push(
          `恋爱明确度为${allowedLabels(constraint.explicitness, "explicitness")}`,
        );
      }
      if (constraint.mutuality !== null) {
        parts.push(`相互性为${allowedLabels(constraint.mutuality, "mutuality")}`);
      }
      clauses.push(`至少一条已确认女女关系同时满足：${parts.join("、")}`);
    }

    if (state.relationship_count) {
      clauses.push(
        `全作共有 ${publicLabels.relationship_count[state.relationship_count]}已确认女女关系记录`,
      );
    }
    if ((state.quick || []).includes("four_plus_female_relationships")) {
      clauses.push("全作有 4 条以上已确认女女关系记录");
    }

    const selectedMale = state.scalar?.male_romance_line || "";
    if (selectedMale) {
      clauses.push(
        `男性恋爱线为${displayStateLabel("male_romance_line", selectedMale, labelOverrides)}`,
      );
    }
    if (
      noMaleRomanceQuick &&
      selectedMale !== "none"
    ) {
      clauses.push("男性恋爱线为无");
    }

    for (const queryKey of state.quick || []) {
      if (quickQuestionLabels[queryKey]) clauses.push(quickQuestionLabels[queryKey]);
    }
    for (const [field, value] of Object.entries(state.scalar || {})) {
      if (!value || field === "male_romance_line") continue;
      clauses.push(
        `${filterFieldLabels[field] || field}为${displayStateLabel(field, value, labelOverrides)}`,
      );
    }
    for (const [field, values] of Object.entries(state.multi || {})) {
      if (values?.length) {
        clauses.push(
          `${filterFieldLabels[field] || field}包含${values
            .map((value) => displayStateLabel(field, value, labelOverrides))
            .join("或")}`,
        );
      }
    }
    return clauses.length
      ? `当前问题：找出${clauses.join("，并且")}的作品。`
      : "当前问题：显示所有作品。";
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
    if (
      hasRelationshipPredicate(state) &&
      matchingRelationshipProfiles(item, state).length === 0
    ) {
      return false;
    }
    if (!itemMatchesRelationshipCount(item, state)) return false;
    for (const field of Object.keys(multiFields)) {
      if (!itemMatchesMulti(item, field, state.multi?.[field] || [])) {
        return false;
      }
    }
    return itemMatchesWorkQuickConditions(item, state);
  }

  function bangumiMetricValue(item, value) {
    if (typeof value === "number") return value;
    const status = item?.bangumi_entry_status;
    if (status?.code === "no_exact_entry") return "无可对应条目";
    if (status?.code === "unknown") return "未核实";
    return "字段缺失";
  }

  return Object.freeze({
    scalarFields,
    relationshipFields,
    relationshipOptionOrders,
    scalarOptionOrders,
    tableColumnOrders,
    multiFields,
    canonicalFilterValue,
    sortRelationshipOptions,
    sortScalarOptions,
    compareCategoricalValues,
    parseState,
    serializeState,
    effectiveRelationshipConstraint,
    hasRelationshipPredicate,
    matchingRelationshipProfiles,
    relationshipCountMatches,
    describeState,
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
  const copyQueryButton = document.getElementById("copy-query-link");
  const copyQueryStatus = document.getElementById("copy-query-status");
  const activeQuerySummary = document.getElementById("active-query-summary");
  const searchInput = document.getElementById("title-search");
  const quickButtons = Array.from(
    document.querySelectorAll("#quick-filters [data-query]"),
  );
  const scalarFilterElements = {
    medium: document.getElementById("medium-filter"),
    archive_basis: document.getElementById("basis-filter"),
    official_literal_yuri_gl: document.getElementById("official-literal-filter"),
    official_female_romance_wording: document.getElementById("official-romance-filter"),
    male_romance_line: document.getElementById("male-filter"),
    confidence: document.getElementById("confidence-filter"),
  };
  const relationshipFilterElements = {
    relationship_position: document.getElementById("relationship-filter"),
    relationship_explicitness: document.getElementById("explicitness-filter"),
    relationship_mutuality: document.getElementById("mutuality-filter"),
  };
  const relationshipCountElement = document.getElementById(
    "relationship-count-filter",
  );
  const multiFilterElements = {
    official_source_scopes: document.getElementById("official-scope-filter"),
    official_source_surfaces: document.getElementById("official-surface-filter"),
  };
  const allControls = [
    searchInput,
    ...Object.values(scalarFilterElements),
    ...Object.values(relationshipFilterElements),
    ...Object.values(multiFilterElements),
    relationshipCountElement,
    clearButton,
    copyQueryButton,
    copyQueryStatus,
    activeQuerySummary,
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
    return YuriCatalogFilterLogic.sortScalarOptions(map.entries(), field);
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

  function uniqueRelationshipOptions(items, nestedField) {
    const map = new Map();
    for (const item of items) {
      const profiles = Array.isArray(item.relationship_profiles)
        ? item.relationship_profiles
        : [];
      for (const profile of profiles) {
        const value = profile?.[nestedField];
        if (value?.code && !map.has(value.code)) map.set(value.code, value.label);
      }
    }
    return YuriCatalogFilterLogic.sortRelationshipOptions(
      map.entries(),
      nestedField,
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
    const relationship = {};
    for (const [field, element] of Object.entries(relationshipFilterElements)) {
      relationship[field] = element.value || "";
    }
    return {
      query: searchInput.value,
      scalar,
      relationship,
      relationship_count: relationshipCountElement.value || "",
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
    for (const [field, element] of Object.entries(relationshipFilterElements)) {
      element.value = state.relationship?.[field] || "";
    }
    relationshipCountElement.value = state.relationship_count || "";
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

  function stateToUrl(state = readUiState()) {
    const suffix = YuriCatalogFilterLogic.serializeState(state);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${suffix ? `?${suffix}` : ""}`,
    );
  }

  function selectLabelMap(elements) {
    const result = {};
    for (const [field, element] of Object.entries(elements)) {
      result[field] = Object.fromEntries(
        Array.from(element.options, (option) => [option.value, option.textContent]),
      );
    }
    return result;
  }

  function currentLabelOverrides() {
    const labels = {
      ...selectLabelMap(scalarFilterElements),
      ...selectLabelMap(relationshipFilterElements),
    };
    for (const [field, container] of Object.entries(multiFilterElements)) {
      labels[field] = Object.fromEntries(
        Array.from(
          container.querySelectorAll('input[type="checkbox"]'),
          (input) => [
            input.value,
            input.parentElement?.querySelector(".multi-choice-label")?.textContent ||
              input.value,
          ],
        ),
      );
    }
    return labels;
  }

  function fallbackCopyText(value) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy command failed");
  }

  async function copyCurrentQueryLink() {
    const value = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        fallbackCopyText(value);
      }
      copyQueryStatus.textContent = "当前问题链接已复制。";
    } catch (_error) {
      try {
        fallbackCopyText(value);
        copyQueryStatus.textContent = "当前问题链接已复制。";
      } catch (_fallbackError) {
        copyQueryStatus.textContent = "浏览器未允许自动复制，请复制地址栏中的链接。";
      }
    }
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

  function categoricalSorter(field) {
    const order = YuriCatalogFilterLogic.tableColumnOrders[field] || [];
    return (a, b) =>
      YuriCatalogFilterLogic.compareCategoricalValues(a, b, order);
  }

  function labelsText(value) {
    return Array.isArray(value)
      ? value.map((entry) => entry?.label).filter(Boolean).join("、")
      : "";
  }

  function labelsFormatter(cell) {
    return labelsText(cell.getValue()) || "—";
  }

  function relationshipProfileText(profile) {
    const labels = [
      profile?.position?.label,
      profile?.explicitness?.label,
      profile?.mutuality?.label,
    ].filter(Boolean);
    return `${profile?.name || "未命名关系"}（${labels.join("／")}）`;
  }

  function matchingRelationshipsText(item, state) {
    return YuriCatalogFilterLogic.matchingRelationshipProfiles(item, state)
      .map(relationshipProfileText)
      .join("；");
  }

  function matchingRelationshipsFormatter(cell) {
    const element = document.createElement("div");
    element.className = "matching-relationship-list";
    element.textContent =
      matchingRelationshipsText(cell.getRow().getData(), readUiState()) || "—";
    return element;
  }

  const distributionProfileFields = {
    narrative_centrality: "position",
    romance_explicitness: "explicitness",
    mutuality: "mutuality",
  };

  function relationshipDistributionText(value, item, axis) {
    if (!value || typeof value !== "object") return "";
    const profileField = distributionProfileFields[axis];
    const labels = new Map(
      (Array.isArray(item.relationship_profiles) ? item.relationship_profiles : [])
        .map((profile) => profile?.[profileField])
        .filter((entry) => entry?.code)
        .map((entry) => [entry.code, entry.label]),
    );
    return Object.entries(value)
      .filter(([, count]) => Number.isInteger(count) && count > 0)
      .map(([code, count]) => `${labels.get(code) || code} ${count}`)
      .join("、");
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
    const catalogVersion = config.catalogVersion
      ? `?v=${encodeURIComponent(config.catalogVersion)}`
      : "";
    const response = await fetch(
      `${config.basePath}/data/catalog.json${catalogVersion}`,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (
      !payload ||
      payload.schema_version !== 5 ||
      !Array.isArray(payload.items)
    ) {
      throw new Error("公开总表格式不受支持");
    }
    const items = payload.items;

    for (const field of Object.keys(scalarFilterElements)) {
      populateSelect(scalarFilterElements[field], uniqueOptions(items, field));
    }
    for (const [field, nestedField] of Object.entries(
      YuriCatalogFilterLogic.relationshipFields,
    )) {
      populateSelect(
        relationshipFilterElements[field],
        uniqueRelationshipOptions(items, nestedField),
      );
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
          sorter: categoricalSorter("medium"),
          width: 105,
          accessorDownload: (value) => value.label,
        },
        {
          title: "关系位置",
          titleDownload: "女女关系位置",
          headerTooltip: "女女关系位置",
          field: "female_relationship_centrality",
          formatter: labelFormatter,
          sorter: categoricalSorter("female_relationship_centrality"),
          width: 96,
          accessorDownload: (value) => value.label,
        },
        {
          title: "恋爱位置",
          titleDownload: "女女恋爱位置",
          headerTooltip: "女女恋爱位置",
          field: "romance_centrality",
          formatter: labelFormatter,
          sorter: categoricalSorter("romance_centrality"),
          width: 96,
          accessorDownload: (value) => value.label,
        },
        {
          title: "最高明确度",
          titleDownload: "女女关系最高明确度",
          headerTooltip: "女女关系最高明确度",
          field: "highest_romance_explicitness",
          formatter: labelFormatter,
          sorter: categoricalSorter("highest_romance_explicitness"),
          width: 106,
          accessorDownload: (value) => value.label,
        },
        {
          title: "关系数",
          titleDownload: "已确认女女关系数",
          headerTooltip: "逐条确认的女女关系记录数，不是程度评分",
          field: "female_female_relationship_count",
          sorter: "number",
          width: 82,
        },
        {
          title: "bgm 排名",
          field: "bangumi_rank",
          formatter: bangumiRankFormatter,
          sorter: (a, b) => (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER),
          width: 150,
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
          title: "官方字面百合／GL",
          field: "official_literal_yuri_gl",
          formatter: labelFormatter,
          sorter: categoricalSorter("official_literal_yuri_gl"),
          width: 132,
          accessorDownload: (value) => value.label,
        },
        {
          title: "官方女女恋爱表述",
          field: "official_female_romance_wording",
          formatter: labelFormatter,
          sorter: categoricalSorter("official_female_romance_wording"),
          width: 142,
          accessorDownload: (value) => value.label,
        },
        {
          title: "身份依据",
          field: "identity_evidence_basis",
          formatter: labelFormatter,
          sorter: categoricalSorter("identity_evidence_basis"),
          width: 145,
          accessorDownload: (value) => value.label,
        },
        {
          title: "男性恋爱线",
          field: "male_romance_line",
          formatter: labelFormatter,
          sorter: categoricalSorter("male_romance_line"),
          width: 112,
          accessorDownload: (value) => value.label,
        },
        {
          title: "百合归档",
          titleDownload: "百合归档结论",
          headerTooltip: "百合归档结论",
          field: "archive_basis",
          formatter: labelFormatter,
          sorter: categoricalSorter("archive_basis"),
          width: 108,
          accessorDownload: (value) => value.label,
        },
        {
          title: "结论置信度",
          field: "confidence",
          formatter: labelFormatter,
          sorter: categoricalSorter("confidence"),
          headerTooltip:
            "表示当前锁定范围内，现有证据对本报告主要分类结论的支持稳定度；它不是百合程度、作品质量、社群共识或统计概率。",
          width: 112,
          accessorDownload: (value) => value.label,
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
          title: "关系叙事位置分布",
          field: "relationship_distribution.narrative_centrality",
          visible: false,
          download: true,
          accessorDownload: (value, item) =>
            relationshipDistributionText(value, item, "narrative_centrality"),
        },
        {
          title: "关系恋爱明确度分布",
          field: "relationship_distribution.romance_explicitness",
          visible: false,
          download: true,
          accessorDownload: (value, item) =>
            relationshipDistributionText(value, item, "romance_explicitness"),
        },
        {
          title: "关系相互性分布",
          field: "relationship_distribution.mutuality",
          visible: false,
          download: true,
          accessorDownload: (value, item) =>
            relationshipDistributionText(value, item, "mutuality"),
        },
        {
          title: "分类日期",
          field: "classification_date",
          sorter: "date",
          width: 112,
        },
        {
          title: "命中关系",
          field: "relationship_profiles",
          responsive: 0,
          formatter: matchingRelationshipsFormatter,
          visible: false,
          download: true,
          width: 260,
          accessorDownload: (_value, item) =>
            matchingRelationshipsText(item, readUiState()),
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

    function applyFilters() {
      const state = readUiState();
      table.setFilter((item) => YuriCatalogFilterLogic.matchesItem(item, state));
      if (YuriCatalogFilterLogic.hasRelationshipPredicate(state)) {
        table.showColumn("relationship_profiles");
      } else {
        table.hideColumn("relationship_profiles");
      }
      activeQuerySummary.textContent = YuriCatalogFilterLogic.describeState(
        state,
        currentLabelOverrides(),
      );
      copyQueryStatus.textContent = "";
      stateToUrl(state);
      table.redraw(true);
    }

    table.on("dataFiltered", (_filters, rows) => {
      resultCount.textContent = `当前显示 ${rows.length}／${items.length} 份报告`;
    });
    table.on("tableBuilt", applyFilters);

    searchInput.addEventListener("input", applyFilters);
    for (const element of [
      ...Object.values(scalarFilterElements),
      ...Object.values(relationshipFilterElements),
      ...Object.values(multiFilterElements),
      relationshipCountElement,
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
      writeUiState({
        query: "",
        scalar: {},
        relationship: {},
        relationship_count: "",
        multi: {},
        quick: [],
      });
      table.clearHeaderFilter();
      applyFilters();
    });
    copyQueryButton.addEventListener("click", copyCurrentQueryLink);
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
