(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const formatNumber = new Intl.NumberFormat("zh-CN");
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const normalizeSearch = (text) => text.normalize("NFKC").trim().toLowerCase();

  function composition(secondShare) {
    const second = Math.round(secondShare * 1000);
    return (1000 - second) / 10 + "∶" + second / 10;
  }

  function ageComposition(ratio) {
    return composition(1 / (1 + ratio));
  }

  function svgNode(name, attributes = {}, text = "") {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (text) element.textContent = text;
    return element;
  }

  function htmlNode(name, text = "") {
    const element = document.createElement(name);
    element.textContent = text;
    return element;
  }

  function marker(style, x, y, radius, className = "") {
    const attributes = { fill: style.color, class: className };
    if (style.shape === "circle") {
      return svgNode("circle", { ...attributes, cx: x, cy: y, r: radius });
    }
    if (style.shape === "square") {
      return svgNode("rect", { ...attributes, x: x - radius, y: y - radius, width: 2 * radius, height: 2 * radius });
    }
    const vertices = style.shape === "diamond"
      ? [[x - radius, y], [x, y - radius], [x + radius, y], [x, y + radius]]
      : [[x, y - radius], [x - radius, y + radius], [x + radius, y + radius]];
    return svgNode("polygon", { ...attributes, points: vertices.map((pair) => pair.join(",")).join(" ") });
  }

  function ticks(min, max, intervals) {
    const interval = (max - min) / intervals;
    const order = 10 ** Math.floor(Math.log10(interval));
    const step = [1, 2, 5, 10].map((n) => n * order).find((n) => n >= interval);
    const values = [];
    for (let i = Math.ceil(min / step - 1e-8); i <= max / step + 1e-8; i += 1) values.push(i * step);
    return values;
  }

  function setupChart(mount, data) {
    if (data.schema_version !== 2 || !data.points.length) throw new Error("Missing plot data");
    const find = (selector) => mount.querySelector(selector);
    const form = find("[data-chart-filters]");
    const groupOptions = find("[data-chart-groups]");
    const search = find("[data-chart-search]");
    const minGender = find("[data-min-gender]");
    const minAge = find("[data-min-age]");
    const relationshipSearch = find("[data-relationship-search]");
    const relationshipActive = find("[data-relationship-active]");
    const relationshipControls = [...form.querySelectorAll("[data-relationship]")];
    const relationshipLabels = {};
    for (const control of relationshipControls) {
      const axis = control.dataset.relationship;
      relationshipLabels[axis] = new Map();
      for (const { code, label } of data.relationship_options[axis]) {
        const option = htmlNode("option", label);
        option.value = code;
        control.append(option);
        relationshipLabels[axis].set(code, label);
      }
    }
    const status = find("[data-chart-status]");
    const plot = find("[data-chart-plot]");
    const stage = find("[data-chart-stage]");
    const tooltip = find("[data-chart-tooltip]");
    const details = find("[data-chart-detail]");
    const workButtons = find("[data-chart-works]");
    const zoomIn = find('[data-chart-zoom="in"]');
    const zoomOut = find('[data-chart-zoom="out"]');
    const resetView = find('[data-chart-zoom="reset"]');
    const groups = new Map(data.groups.map((group) => [group.id, group]));
    const points = data.points.map((point) => {
      const genderN = point.male + point.female;
      return {
        ...point,
        genderN,
        ageN: point.age_20_29 + point.age_30_39,
        x: point.age_30_39 / point.age_20_29,
        y: point.female / genderN,
        query: normalizeSearch(point.title + " " + point.kitsu_title),
        relationships: point.slugs.flatMap((slug) => (data.relationship_profiles[slug] || []).map(
          (profile) => ({ ...profile, slug, query: normalizeSearch(profile.name) }),
        )),
      };
    });
    const byId = new Map(points.map((point) => [point.id, point]));
    const marked = new Set(data.highlighted);
    const fullX = Math.max(1, Math.ceil(Math.max(...points.map((point) => point.x))));
    const initialView = { x0: 0, y0: 0, w: fullX, h: 1 };
    let view = initialView;
    let matching = points;
    let matchedRelationships = new Map();
    let selected = null;
    let layout = null;
    let visible = [];
    let frame = 0;
    let drag = null;

    for (const group of groups.values()) {
      const input = htmlNode("input");
      input.type = "checkbox";
      input.name = "basis";
      input.value = group.id;
      input.defaultChecked = true;
      const swatch = svgNode("svg", { class: "kitsu-swatch", viewBox: "0 0 16 16", "aria-hidden": "true" });
      swatch.append(marker(group, 8, 8, 6));
      const label = htmlNode("label");
      label.append(input, swatch, document.createTextNode(group.label));
      groupOptions.append(label);
    }

    const buttons = new Map();
    for (const id of marked) {
      const point = byId.get(id);
      const button = htmlNode("button", point.title);
      button.type = "button";
      button.addEventListener("click", () => select(point, true));
      workButtons.append(button);
      buttons.set(id, button);
    }

    const zoomed = () => view.w < fullX - 1e-8;
    const inView = (point) => (
      point.x >= view.x0 && point.x <= view.x0 + view.w &&
      point.y >= view.y0 && point.y <= view.y0 + view.h
    );

    function showDetails() {
      details.hidden = !selected;
      details.replaceChildren();
      for (const [id, button] of buttons) button.setAttribute("aria-pressed", String(selected?.id === id));
      if (!selected) return;
      const point = selected;
      const count = (number) => formatNumber.format(number);
      details.append(
        htmlNode("strong", point.title),
        htmlNode("p", groups.get(point.basis).label + " · 公开完播 " + count(point.public_completions) + " 条"),
        htmlNode("p", "年龄构成 " + ageComposition(point.x) + " · 30–39 岁 " + count(point.age_30_39) + " 人，20–29 岁 " + count(point.age_20_29) + " 人"),
        htmlNode("p", "男女构成 " + composition(point.y) + " · 男 " + count(point.male) + " 人，女 " + count(point.female) + " 人"),
      );
      const relations = matchedRelationships.get(point.id);
      if (relations?.length) {
        const matches = htmlNode("details");
        matches.className = "kitsu-matches";
        matches.open = true;
        matches.append(htmlNode("summary", "命中关系（" + count(relations.length) + "）"));
        const list = htmlNode("ul");
        for (const relation of relations) {
          const axes = Object.entries(relationshipLabels).map(([axis, labels]) => labels.get(relation[axis]));
          const item = htmlNode("li", relation.name + " · " + axes.join("／"));
          if (point.slugs.length > 1) {
            const link = htmlNode("a", "（档案 " + (point.slugs.indexOf(relation.slug) + 1) + "）");
            link.href = mount.dataset.worksBase + encodeURIComponent(relation.slug) + "/";
            item.append(link);
          }
          list.append(item);
        }
        matches.append(list);
        details.append(matches);
      }
      const links = htmlNode("p");
      point.slugs.forEach((slug, i) => {
        const link = htmlNode("a", point.slugs.length > 1 ? "档案 " + (i + 1) : "查看档案");
        link.href = mount.dataset.worksBase + encodeURIComponent(slug) + "/";
        links.append(link);
      });
      details.append(links);
    }

    function select(point, locate = false) {
      selected = point;
      tooltip.hidden = true;
      if (locate && point && !inView(point)) {
        setView(point.x - view.w / 2, point.y - view.h / 2, view.w, view.h);
      }
      showDetails();
      scheduleRender();
    }

    function applyFilters() {
      const active = new Set([...groupOptions.querySelectorAll("input:checked")].map((input) => input.value));
      const term = normalizeSearch(search.value);
      const threshold = (input) => Math.max(0, Math.floor(input.valueAsNumber || 0));
      const genderN = threshold(minGender);
      const ageN = threshold(minAge);
      const relationTerms = normalizeSearch(relationshipSearch.value).split(/[\s,、\/×+·・]+/u).filter(Boolean);
      const axes = relationshipControls.filter((control) => control.value)
        .map((control) => [control.dataset.relationship, control.value]);
      const useRelationships = relationTerms.length > 0 || axes.length > 0;
      relationshipActive.hidden = !useRelationships;
      matchedRelationships = new Map();
      matching = points.filter((point) => {
        if (!active.has(point.basis) || point.genderN < genderN || point.ageN < ageN || !point.query.includes(term)) {
          return false;
        }
        if (!useRelationships) return true;
        const matches = point.relationships.filter((relation) =>
          relationTerms.every((word) => relation.query.includes(word)) &&
          axes.every(([axis, code]) => relation[axis] === code));
        if (matches.length) matchedRelationships.set(point.id, matches);
        return matches.length > 0;
      });
      const ids = new Set(matching.map((point) => point.id));
      for (const [id, button] of buttons) button.disabled = !ids.has(id);
      if ((term || useRelationships) && matching.length === 1) select(matching[0], true);
      else if (selected && !ids.has(selected.id)) select(null);
      else if (selected) showDetails();
      tooltip.hidden = true;
      scheduleRender();
    }

    function setView(x0, y0, w, h) {
      view = { x0: clamp(x0, 0, fullX - w), y0: clamp(y0, 0, 1 - h), w, h };
      tooltip.hidden = true;
      scheduleRender();
    }

    function zoom(factor, anchor = selected && inView(selected) ? selected : null) {
      const w = clamp(view.w * factor, fullX / 32, fullX);
      const h = w / fullX;
      const x = anchor ? anchor.x : view.x0 + view.w / 2;
      const y = anchor ? anchor.y : view.y0 + view.h / 2;
      setView(x - (x - view.x0) * w / view.w, y - (y - view.y0) * h / view.h, w, h);
    }

    function scheduleRender() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        render();
      });
    }

    function render() {
      const { width, height } = plot.getBoundingClientRect();
      if (!width || !height) return;
      const left = width < 460 ? 57 : 69;
      const right = width - (width < 460 ? 28 : 36);
      const top = 35;
      const bottom = height - 55;
      const px = (x) => left + (x - view.x0) / view.w * (right - left);
      const py = (y) => bottom - (y - view.y0) / view.h * (bottom - top);
      layout = { width, height, left, right, top, bottom };
      plot.setAttribute("viewBox", [0, 0, width, height].join(" "));
      const axes = svgNode("g");
      axes.append(svgNode("rect", { x: left, y: top, width: right - left, height: bottom - top, class: "kitsu-axis" }));
      const xTicks = ticks(view.x0, view.x0 + view.w, Math.max(2, Math.floor((right - left) / 90)));
      if (view.x0 <= 1 && view.x0 + view.w >= 1 && !xTicks.some((x) => Math.abs(x - 1) < 1e-8)) xTicks.push(1);
      const sortedXTicks = xTicks.sort((a, b) => a - b);
      let lastX = -Infinity;
      for (const value of sortedXTicks) {
        const x = px(value);
        if (Math.abs(value - 1) > 1e-8 && (x - lastX < 43 ||
            (view.x0 <= 1 && view.x0 + view.w >= 1 && Math.abs(x - px(1)) < 43))) continue;
        lastX = x;
        axes.append(
          svgNode("line", { x1: x, y1: top, x2: x, y2: bottom, class: "kitsu-grid" }),
          svgNode("text", { x, y: bottom + 19, "text-anchor": "middle", class: "kitsu-tick" }, ageComposition(value)),
        );
      }
      for (const value of ticks(view.y0, view.y0 + view.h, 5)) {
        const y = py(value);
        axes.append(
          svgNode("line", { x1: left, y1: y, x2: right, y2: y, class: "kitsu-grid" }),
          svgNode("text", { x: left - 8, y, dy: "0.33em", "text-anchor": "end", class: "kitsu-tick" }, composition(value)),
        );
      }
      axes.append(
        svgNode("text", { x: left, y: 21, class: "kitsu-axis-label" }, "男女构成（男∶女）"),
        svgNode("text", { x: (left + right) / 2, y: height - 11, "text-anchor": "middle", class: "kitsu-axis-label" }, "年龄构成（30–39 岁∶20–29 岁）"),
      );

      const dots = svgNode("g", { class: "kitsu-markers" });
      visible = matching.filter(inView).map((point) => ({ point, x: px(point.x), y: py(point.y) }));
      for (const { point, x, y } of visible) {
        const dot = marker(groups.get(point.basis), x, y, zoomed() ? 4 : 3.2, "kitsu-marker");
        dot.dataset.plotId = point.id;
        dots.append(dot);
      }
      for (const { point, x, y } of visible) {
        if (!marked.has(point.id) && selected?.id !== point.id) continue;
        const style = groups.get(point.basis);
        dots.append(
          svgNode("circle", { cx: x, cy: y, r: 7, stroke: style.color, class: "kitsu-ring" + (selected?.id === point.id ? " is-selected" : "") }),
          marker(style, x, y, 3.4),
        );
      }
      const selectedMarker = visible.find(({ point }) => point.id === selected?.id);
      if (selectedMarker) {
        const { point, x, y } = selectedMarker;
        const onLeft = x < (left + right) / 2;
        const limit = width < 460 ? 9 : 19;
        const label = point.title.length <= limit ? point.title : point.title.slice(0, limit - 1) + "…";
        dots.append(svgNode("text", {
          x: x + (onLeft ? 11 : -11), y: clamp(y - 11, top + 12, bottom - 5),
          "text-anchor": onLeft ? "start" : "end", class: "kitsu-selected-label",
        }, label));
      }
      if (!visible.length) {
        axes.append(svgNode("text", { x: (left + right) / 2, y: (top + bottom) / 2, "text-anchor": "middle", class: "kitsu-empty" },
          matching.length ? "当前视图内没有作品" : "没有符合筛选条件的作品"));
      }
      plot.replaceChildren(axes, dots);
      plot.classList.toggle("is-zoomed", zoomed());
      const label = "匹配 " + formatNumber.format(matching.length) + "／" + formatNumber.format(points.length) + " 个条目" +
        (zoomed() ? " · 视图内 " + formatNumber.format(visible.length) + " 个" : "");
      if (status.textContent !== label) status.textContent = label;
      zoomIn.disabled = view.w <= fullX / 32 + 1e-8;
      zoomOut.disabled = resetView.disabled = !zoomed();
    }

    function pointer(event) {
      const rect = plot.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function onPlot({ x, y }) {
      return layout && x >= layout.left - 6 && x <= layout.right + 6 && y >= layout.top - 6 && y <= layout.bottom + 6;
    }

    function nearest(position) {
      if (!onPlot(position)) return null;
      let distance = 11;
      let result = null;
      for (const { point, x, y } of visible) {
        const delta = Math.hypot(x - position.x, y - position.y);
        if (delta < distance) {
          result = point;
          distance = delta;
        }
      }
      return result;
    }

    plot.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || drag || !onPlot(pointer(event))) return;
      drag = { id: event.pointerId, start: pointer(event), view, moved: false };
      plot.setPointerCapture(event.pointerId);
    });

    plot.addEventListener("pointermove", (event) => {
      const position = pointer(event);
      if (drag?.id === event.pointerId) {
        const dx = position.x - drag.start.x;
        const dy = position.y - drag.start.y;
        drag.moved ||= Math.hypot(dx, dy) > 4;
        if (drag.moved && zoomed()) {
          plot.classList.add("is-dragging");
          setView(drag.view.x0 - dx * drag.view.w / (layout.right - layout.left),
            drag.view.y0 + dy * drag.view.h / (layout.bottom - layout.top), drag.view.w, drag.view.h);
        }
        return;
      }
      const point = nearest(position);
      tooltip.hidden = !point || event.pointerType === "touch";
      if (point) tooltip.textContent = point.title + " · 年龄 " + ageComposition(point.x) + " · 男∶女 " + composition(point.y);
    });

    function endDrag(event) {
      if (drag?.id !== event.pointerId) return;
      if (!drag.moved && event.type === "pointerup") select(nearest(pointer(event)));
      drag = null;
      plot.classList.remove("is-dragging");
    }
    plot.addEventListener("pointerup", endDrag);
    plot.addEventListener("pointercancel", endDrag);
    plot.addEventListener("pointerleave", () => { tooltip.hidden = true; });

    plot.addEventListener("wheel", (event) => {
      const position = pointer(event);
      if ((!event.ctrlKey && !event.metaKey) || !onPlot(position)) return;
      event.preventDefault();
      const x = view.x0 + clamp((position.x - layout.left) / (layout.right - layout.left), 0, 1) * view.w;
      const y = view.y0 + clamp((layout.bottom - position.y) / (layout.bottom - layout.top), 0, 1) * view.h;
      zoom(event.deltaY < 0 ? 0.8 : 1.25, { x, y });
    }, { passive: false });

    plot.addEventListener("keydown", (event) => {
      if (event.key === "+" || event.key === "=") zoom(2 / 3);
      else if (event.key === "-") zoom(1.5);
      else if (event.key === "0") setView(0, 0, fullX, 1);
      else if (zoomed() && event.key.startsWith("Arrow")) {
        const dx = (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0) * view.w / 8;
        const dy = (event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0) * view.h / 8;
        setView(view.x0 + dx, view.y0 + dy, view.w, view.h);
      } else return;
      event.preventDefault();
    });

    form.addEventListener("input", applyFilters);
    form.addEventListener("submit", (event) => event.preventDefault());
    form.addEventListener("reset", () => requestAnimationFrame(applyFilters));
    zoomIn.addEventListener("click", () => zoom(2 / 3));
    zoomOut.addEventListener("click", () => zoom(1.5));
    resetView.addEventListener("click", () => setView(0, 0, fullX, 1));

    find("[data-kitsu-ui]").hidden = false;
    render();
    find("[data-kitsu-fallback]").hidden = true;
    if ("ResizeObserver" in window) new ResizeObserver(scheduleRender).observe(stage);
    else window.addEventListener("resize", scheduleRender);
  }

  for (const mount of document.querySelectorAll("[data-kitsu-chart]")) {
    fetch(mount.dataset.pointsUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Plot data could not be loaded");
        return response.json();
      })
      .then((data) => setupChart(mount, data))
      .catch(() => {
        mount.querySelector("[data-kitsu-ui]").hidden = true;
        mount.querySelector("[data-kitsu-fallback]").hidden = false;
      });
  }
})();
