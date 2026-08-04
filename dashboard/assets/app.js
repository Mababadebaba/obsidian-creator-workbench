(() => {
  const TYPE_ORDER = ["共鸣类", "AI教程向", "AI赚钱方式", "方法论", "热点"];
  const $ = (selector, root = document) => root.querySelector(selector);

  function dashboardData() {
    const node = $("#dashboard-data");
    if (!node) return {};
    try {
      return JSON.parse(node.textContent || "{}");
    } catch (error) {
      console.error("Cannot parse dashboard data", error);
      return {};
    }
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function formatNumber(value, zero = "0") {
    const number = numberOrNull(value);
    if (number === null) return "—";
    if (number === 0) return zero;
    if (Math.abs(number) >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万`;
    if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}k`;
    return String(Math.round(number));
  }

  function formatPercent(value) {
    const number = numberOrNull(value);
    return number === null ? "—" : `${number.toFixed(1)}%`;
  }

  function shortText(value, max = 150) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function stableId(prefix, value) {
    const text = String(value || prefix);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${(hash >>> 0).toString(36)}`;
  }

  function signalAnchor(signal = {}) {
    return stableId("signal", `${signal.title || ""}|${signal.url || ""}|${signal.source || ""}`);
  }

  function metricsText(metrics = {}, fallbackLikes = null) {
    const parts = [];
    const likes = numberOrNull(metrics.likes ?? fallbackLikes);
    const retweets = numberOrNull(metrics.retweets);
    const replies = numberOrNull(metrics.replies);
    const score = numberOrNull(metrics.score);
    if (likes !== null && likes > 0) parts.push(`${formatNumber(likes)} likes`);
    if (retweets !== null && retweets > 0) parts.push(`${formatNumber(retweets)} RT`);
    if (replies !== null && replies > 0) parts.push(`${formatNumber(replies)} replies`);
    if (!parts.length && score !== null) parts.push(`score ${Math.round(score)}`);
    return parts.join(" · ");
  }

  function priorityScore(item = {}) {
    const metrics = item.metrics || {};
    const score = numberOrNull(metrics.score);
    if (score !== null) return score;
    const likes = numberOrNull(metrics.likes);
    if (likes !== null) return Math.min(100, Math.log10(likes + 1) * 24);
    return 0;
  }

  function isBuilderSource(item = {}) {
    return /follow-builders/i.test(`${item.group || ""} ${item.source || ""}`);
  }

  function builderDigest(text) {
    const raw = String(text || "");
    const lower = raw.toLowerCase();
    if (lower.includes("doubled") && lower.includes("cowork")) return "Claude Cowork 未来一个月把使用额度翻倍，适合把更大、更复杂、跨多账号的任务交给 Claude。";
    if (lower.includes("better memory")) return "更好的记忆意味着更短提示词和更高 token 利用率，适合讲 AI 工具从“会答题”走向“懂上下文”。";
    if (lower.includes("codex papercuts")) return "Codex 的小摩擦减少，采用率就会上升；这是 AI 编程工具竞争的关键细节。";
    if (lower.includes("bad stories about vcs")) return "VC 和创始人互相都有糟糕故事，可转成创业融资关系里的反常识吐槽。";
    if (lower.includes("skills api")) return "Skills API 像 agent 能力的 npm 仓库，让不同 agent 和平台复用同一套能力。";
    if (lower.includes("designing in code")) return "代码里做设计正在变成点选、聊天、多选修改的交互，适合讲设计和开发边界消失。";
    if (lower.includes("coding is basically")) return "即使编程最适合被 AI 自动化，仍需要工程师监督 agent；这是反焦虑、讲人机协作的强角度。";
    if (lower.includes("filesystem state")) return "Agent 的文件系统状态可以独立读写和挂载，说明云端 agent 正在补齐长期工作记忆和项目状态。";
    if (lower.includes("build ai skills")) return "Peter Yang 给出构建自校验 AI skill 的步骤：给上下文、明确触发、加 evals、持续改进。";
    if (lower.includes("cowork is at its best")) return "Claude Cowork 最适合聊天框装不下的大任务：调研、周期报告、收件箱分诊和草拟回复。";
    if (lower.includes("always frame your task as a question")) return "把任务写成问题，AI 更容易质疑方案、补洞和给替代路径，而不是盲目执行。";
    if (lower.includes("speed is just impatience")) return "“速度有时只是伪装成野心的急躁”，适合做创作者和创业者的反思型共鸣。";
    if (lower.includes("no cs degree")) return "没有 CS 学位也能持续交付开源项目，核心是工程计划和复合型执行力。";
    if (lower.includes("replit x shopify")) return "Replit × Shopify 是一句话建店/卖货的商业化信号，适合补 AI 赚钱案例。";
    if (lower.includes("you can just ship things")) return "创始人被点名表扬“直接发货”，可转成少讨论、多上线的执行力选题。";
    if (lower.includes("big projects")) return "一个帮助用户学习更快构建软件的大项目开放试用，可作为 AI 教程产品化趋势。";
    if (lower.includes("drone war")) return "未来无人机战争的必需能力被 builder 点名，偏硬科技和国防 AI 方向。";
    if (lower.includes("without founders")) return "“没有创始人就没有 VC”，可转成融资市场里谁真正创造价值的共鸣话题。";
    if (lower.includes("enterprise ai teams")) return "企业 AI 团队常犯错：只按今天模型能力搭系统，应该按未来 6 个月更强更便宜的趋势设计。";
    if (lower.includes("full workflow") || lower.includes("prompts")) return "这条提供工作流和提示词线索，适合作为方法论素材追踪。";
    if (lower.includes("watch on youtube")) return "这是视频链接型素材，优先级较低，适合作为后续补充来源。";
    if (lower.includes("go knicks")) return "非 AI 核心信号，当前只保留为全量原始返回。";
    if (/https?:\/\/t\.co\/\S+$/i.test(raw.trim())) return "原文主体只有链接，建议低优先级处理，除非链接内容后续补抓。";
    return "英文 builder 原文已保留；当前先给出中文导读入口，优先展开高互动条目。";
  }

  function localizedFetchTitle(item = {}) {
    if (!isBuilderSource(item)) return item.text || "未命名条目";
    return shortText(builderDigest(item.excerpt || item.text), 58);
  }

  function localizedFetchExcerpt(item = {}) {
    if (!isBuilderSource(item)) return item.excerpt || item.text || "—";
    return builderDigest(item.excerpt || item.text);
  }

  function typeColor(type) {
    if (type === "热点") return "var(--hot, var(--amber))";
    if (type === "方法论") return "var(--method, var(--amber2))";
    if (type === "AI赚钱方式") return "var(--money, var(--amber2))";
    if (type === "共鸣类") return "var(--resonate, var(--amber2))";
    if (type === "AI教程向") return "var(--tutorial, var(--amber2))";
    return "var(--amber)";
  }

  function typeShort(type) {
    if (type === "AI赚钱方式") return "赚钱";
    if (type === "AI教程向") return "教程";
    if (type === "共鸣类") return "共鸣";
    return type || "未类";
  }

  function setCorner(data, page) {
    const chip = $("#corner-chip");
    if (!chip) return;
    const generated = data.global?.generated_at ? data.global.generated_at.replace("T", " ").slice(0, 16) : "—";
    chip.textContent = `Generated from Obsidian · ${page.toUpperCase()} · 数据源 · Obsidian Vault · ${generated}`;
  }

  function heroHTML(data, page, title, subtitle) {
    const global = data.global || {};
    const sources = Array.isArray(global.signal_sources) ? global.signal_sources.length : 0;
    const alert = global.alert?.level === "critical"
      ? `<div class="alert-inline">⚠ ${esc(global.alert?.text || "buffer = 0")}</div>`
      : "";
    return `
      <div class="eyebrow">Content Workbench · ${esc(global.stage || "—")}</div>
      <h1>${esc(title)}</h1>
      <p>${esc(subtitle)}</p>
      <div class="chip hero-chip">${esc(global.today || "—")} · <span style="color:var(--amber2)">${sources} 源在线</span></div>
      ${page === "index" ? alert : ""}
    `;
  }

  function kpiHTML(items, fluid = "") {
    const fluidBits = fluid ? ` fx-fluid" data-fluid="${esc(fluid)}" data-reveal` : `"`;
    return items.map(item => `
      <article class="glass kpi${fluidBits}>
        <div class="label">${esc(item.label)}</div>
        <div class="value ${item.hot ? "hot" : ""}">${esc(item.value)}</div>
        <div class="note">${esc(item.note || "")}</div>
      </article>
    `).join("");
  }

  /* 动效激活：effects.js 就绪时给 body 加 fx-on 并触发一轮扫描（幂等） */
  function activateFx() {
    if (window.WBFX && typeof window.WBFX.refresh === "function") {
      document.body.classList.add("fx-on");
      window.WBFX.refresh();
    }
  }

  function statHTML(items) {
    return `<div class="stat-row">${items.map(item => `
      <div class="stat"><div class="n ${item.hot ? "hot" : ""}">${esc(item.value)}</div><div class="l">${esc(item.label)}</div></div>
    `).join("")}</div>`;
  }

  function emptyState(title, note = "") {
    return `<div class="empty-state"><div><b>${esc(title)}</b>${esc(note)}</div></div>`;
  }

  function scorePill(score) {
    const value = numberOrNull(score);
    if (value === null) return `<span class="score-pill unrated">未评</span>`;
    const cls = value >= 7 ? "good" : value >= 6 ? "mid" : "low";
    return `<span class="score-pill ${cls}">${value.toFixed(1)}</span>`;
  }

  function svgEmptyChart(title, note = "", options = {}) {
    const width = options.width || 680;
    const height = options.height || 260;
    const left = 42;
    const right = 26;
    const top = 28;
    const bottom = 34;
    const grid = [0, 0.33, 0.66, 1].map(ratio => {
      const y = top + ratio * (height - top - bottom);
      return `<line class="grid-line" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/>`;
    }).join("");
    return `
      <svg class="svg-chart svg-empty" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
        ${grid}
        <rect x="${left}" y="${top}" width="${width - left - right}" height="${height - top - bottom}" rx="12" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.14)" stroke-dasharray="4 5"/>
        <path d="M${left + 30} ${height - bottom - 30} C ${left + 145} ${top + 40}, ${width - 220} ${height - bottom - 72}, ${width - right - 34} ${top + 76}" fill="none" stroke="rgba(255,122,69,.42)" stroke-width="3" stroke-linecap="round" class="glow-line"/>
        <text x="${width / 2}" y="${height / 2 - 8}" text-anchor="middle" fill="#fff" font-family="var(--disp)" font-size="18" font-weight="800">${esc(title)}</text>
        <text x="${width / 2}" y="${height / 2 + 20}" text-anchor="middle" class="axis-label">${esc(note)}</text>
      </svg>
    `;
  }

  function typeDot(type) {
    return `<span class="type-dot"></span>${esc(type || "—")}`;
  }

  function asRanking(counts) {
    return Object.entries(counts || {})
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .sort((a, b) => b.value - a.value);
  }

  function polar(cx, cy, r, angleDeg) {
    const angle = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polar(cx, cy, r, endAngle);
    const end = polar(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  function sparkline(values, options = {}) {
    const nums = (values || []).map(Number).filter(Number.isFinite);
    if (!nums.length) return svgEmptyChart(options.emptyTitle || "示意", options.emptyNote || "数据回填后生成趋势", { width: options.width || 360, height: options.height || 120 });
    const width = options.width || 360;
    const height = options.height || 120;
    const pad = 12;
    const max = Math.max(...nums, 1);
    const min = Math.min(...nums, 0);
    const spread = Math.max(max - min, 1);
    const pts = nums.map((value, index) => {
      const x = pad + index * (width - pad * 2) / Math.max(nums.length - 1, 1);
      const y = height - pad - ((value - min) / spread) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `
      <svg class="svg-chart svg-compact" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="sparkArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,122,69,.34)"/><stop offset="1" stop-color="rgba(255,122,69,0)"/></linearGradient></defs>
        <polyline points="${pts}" fill="none" stroke="var(--amber)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="glow-line"/>
        <line class="axis-line" x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}"/>
      </svg>
    `;
  }

  function gauge(value, options = {}) {
    const raw = numberOrNull(value);
    const percent = Math.max(0, Math.min(100, raw ?? 0));
    const r = 46;
    const c = 2 * Math.PI * r;
    return `
      <svg class="svg-chart svg-compact" viewBox="0 0 120 120" aria-label="${esc(options.label || "gauge")}">
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="12"/>
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--amber2)" stroke-width="12" stroke-linecap="round"
          stroke-dasharray="${(percent / 100 * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)" class="glow-line"/>
        <text x="60" y="58" text-anchor="middle" fill="#fff" font-family="var(--disp)" font-size="21" font-weight="800">${raw === null ? "—" : `${Math.round(percent)}%`}</text>
        <text x="60" y="76" text-anchor="middle" class="axis-label">${esc(options.center || "")}</text>
      </svg>
    `;
  }

  function donut(segments, options = {}) {
    const filtered = (segments || []).filter(item => Number(item.value) > 0);
    if (!filtered.length) return emptyState("暂无分布", "有数据后自动绘制");
    const total = filtered.reduce((sum, item) => sum + Number(item.value), 0);
    const cx = 112;
    const cy = 112;
    const r = 70;
    let angle = -90;
    const paths = filtered.map((item, index) => {
      const delta = Number(item.value) / total * 360;
      const path = describeArc(cx, cy, r, angle, angle + delta);
      const opacity = 1 - index * 0.12;
      angle += delta;
      return `<path d="${path}" fill="none" stroke="rgba(255,122,69,${Math.max(0.36, opacity)})" stroke-width="18" stroke-linecap="butt" class="glow-line"/>`;
    }).join("");
    const legend = filtered.map((item, index) => `
      <g transform="translate(235 ${40 + index * 25})">
        <circle r="4" fill="var(--amber)" opacity="${Math.max(0.38, 1 - index * 0.12)}"></circle>
        <text x="12" y="4" class="axis-label">${esc(item.name)} · ${esc(item.value)}</text>
      </g>
    `).join("");
    return `
      <svg class="svg-chart" viewBox="0 0 410 224" role="img" aria-label="${esc(options.label || "donut")}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="18"/>
        ${paths}
        <text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="#fff" font-family="var(--disp)" font-size="31" font-weight="800">${formatNumber(total)}</text>
        <text x="${cx}" y="${cy + 20}" text-anchor="middle" class="axis-label">${esc(options.center || "TOTAL")}</text>
        ${legend}
      </svg>
    `;
  }

  function barRanking(items, options = {}) {
    const rows = (items || [])
      .map(item => ({ name: item.name || item.type, value: Number(item.value ?? item.median_views ?? 0) || 0 }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
    if (!rows.length) return svgEmptyChart(options.emptyTitle || "示意", options.emptyNote || "数据积累后排序", { width: options.width || 520, height: options.height || 220 });
    const max = Math.max(...rows.map(item => item.value), 1);
    const width = options.width || 560;
    const rowHeight = 34;
    const left = 118;
    const right = 84;
    const top = 24;
    const height = Math.max(160, top + rows.length * rowHeight + 28);
    const barWidth = width - left - right;
    const bars = rows.map((item, index) => {
      const y = top + index * rowHeight;
      const w = Math.max(8, item.value / max * barWidth);
      const alpha = Math.max(0.38, 1 - index * 0.1);
      return `
        <text class="axis-label" x="${left - 10}" y="${y + 18}" text-anchor="end">${esc(item.name)}</text>
        <rect x="${left}" y="${y + 5}" width="${barWidth}" height="13" rx="7" fill="rgba(255,255,255,.075)"/>
        <rect x="${left}" y="${y + 5}" width="${w.toFixed(1)}" height="13" rx="7" fill="rgba(255,122,69,${alpha})" class="glow-line"/>
        <text class="axis-label" x="${left + barWidth + 12}" y="${y + 18}">${esc(options.format ? options.format(item.value) : formatNumber(item.value))}</text>
      `;
    }).join("");
    return `<svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(options.label || "bar ranking")}">${bars}</svg>`;
  }

  function lineChart(series, options = {}) {
    const usable = (series || []).filter(item => (item.points || []).some(point => Number(point.value) > 0));
    if (!usable.length) return svgEmptyChart(options.emptyTitle || "示意", options.emptyNote || "发布后生成类型折线", { width: options.width || 680, height: options.height || 300 });
    const width = 680;
    const height = 300;
    const left = 48;
    const right = 108;
    const top = 28;
    const bottom = 42;
    const values = usable.flatMap(item => item.points.map(point => Number(point.value) || 0));
    const max = Math.max(...values, 1);
    const labels = usable[0].points.map(point => point.label);
    const xFor = index => left + index * (width - left - right) / Math.max(labels.length - 1, 1);
    const yFor = value => height - bottom - Number(value) / max * (height - top - bottom);
    const grid = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
      const y = height - bottom - ratio * (height - top - bottom);
      return `<line class="grid-line" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/><text class="axis-label" x="${left - 8}" y="${y + 4}" text-anchor="end">${formatNumber(max * ratio)}</text>`;
    }).join("");
    const xLabels = labels.map((label, index) => `<text class="axis-label" x="${xFor(index)}" y="${height - 12}" text-anchor="middle">${esc(label)}</text>`).join("");
    const paths = usable.map((item, index) => {
      const points = item.points.map((point, pointIndex) => `${xFor(pointIndex).toFixed(1)},${yFor(point.value).toFixed(1)}`).join(" ");
      const last = item.points[item.points.length - 1];
      const lx = xFor(item.points.length - 1);
      const ly = yFor(last.value);
      const alpha = Math.max(0.45, 1 - index * 0.12);
      return `
        <polyline points="${points}" fill="none" stroke="rgba(255,122,69,${alpha})" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" class="glow-line"/>
        <circle cx="${lx}" cy="${ly}" r="4" fill="var(--amber2)" opacity="${alpha}"/>
        <text class="end-label" x="${lx + 10}" y="${ly + 4}" fill="var(--amber2)" opacity="${alpha}">${esc(item.name)}</text>
      `;
    }).join("");
    return `<svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(options.label || "line chart")}">${grid}${xLabels}${paths}</svg>`;
  }

  const VIDEO_METRICS = [
    { key: "views", label: "播放量", unit: "次", format: formatNumber },
    { key: "completion_rate", label: "完播率", unit: "%", format: formatPercent },
    { key: "drop_rate", label: "跳出率", unit: "%", format: formatPercent },
    { key: "like_rate", label: "赞播比", unit: "%", format: formatPercent }
  ];

  function videoMetricValue(item, key) {
    if (key === "like_rate" && numberOrNull(item.like_rate) === null) {
      const likes = numberOrNull(item.likes);
      const views = numberOrNull(item.views);
      return likes !== null && views ? likes / views * 100 : null;
    }
    return numberOrNull(item[key]);
  }

  // 真实数据为空时用的模拟序列（带「模拟数据」标），发布后自动被真实 items 替换
  const VIDEO_MOCK = {
    views: [3200, 5500, 4400, 7800, 6200, 9000, 8000],
    completion_rate: [42, 55, 48, 63, 58, 71, 66],
    drop_rate: [58, 45, 52, 37, 42, 29, 34],
    like_rate: [3.2, 4.1, 3.6, 5.4, 4.8, 6.2, 5.6]
  };

  function videoSeriesChart(items, metricKey, options = {}) {
    const metric = VIDEO_METRICS.find(item => item.key === metricKey) || VIDEO_METRICS[0];
    const large = Boolean(options.large);
    let rows = (items || [])
      .map((item, index) => ({ item, index, value: videoMetricValue(item, metric.key) }))
      .filter(row => row.value !== null);
    let mocked = false;
    if (!rows.length) {
      mocked = true;
      rows = (VIDEO_MOCK[metric.key] || VIDEO_MOCK.views)
        .map((value, index) => ({ item: null, index, value }));
    }
    const width = options.width || 520;
    const height = options.height || 180;
    const left = large ? 76 : 34;
    const right = large ? 34 : 18;
    const top = large ? 42 : 22;
    const bottom = large ? 62 : 38;
    const max = Math.max(...rows.map(row => row.value), 1);
    const min = Math.min(...rows.map(row => row.value), 0);
    const spread = Math.max(max - min, 1);
    const xFor = i => left + i * (width - left - right) / Math.max(rows.length - 1, 1);
    const yFor = value => height - bottom - ((value - min) / spread) * (height - top - bottom);
    const points = rows.map((row, index) => `${xFor(index).toFixed(1)},${yFor(row.value).toFixed(1)}`).join(" ");
    const fillPath = rows.length > 1
      ? `M${points.replace(/ /g, " L")} L${xFor(rows.length - 1).toFixed(1)},${height - bottom} L${left},${height - bottom} Z`
      : "";
    const tickRatios = large ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1];
    const grid = tickRatios.map(ratio => {
      const y = top + ratio * (height - top - bottom);
      const value = max - ratio * spread;
      return `<g><line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="rgba(255,255,255,.08)"/>${large ? `<text x="${left - 12}" y="${y + 4}" text-anchor="end" class="axis-label">${esc(metric.format(value))}</text>` : ""}</g>`;
    }).join("");
    const circles = rows.map((row, index) => {
      const x = xFor(index);
      const y = yFor(row.value);
      const date = row.item?.publish_date || row.item?.published_at || "";
      return `<g><circle cx="${x}" cy="${y}" r="${large ? 5.5 : 4}" fill="var(--amber)" class="glow-line"/><text x="${x}" y="${y - (large ? 13 : 9)}" text-anchor="middle" fill="var(--ink)" font-family="var(--disp)" font-size="${large ? 12 : 10}">${esc(metric.format(row.value))}</text><text x="${x}" y="${height - (large ? 32 : 12)}" text-anchor="middle" class="axis-label">#${row.index + 1}</text>${large && date ? `<text x="${x}" y="${height - 14}" text-anchor="middle" class="axis-label small">${esc(String(date).slice(5, 10))}</text>` : ""}</g>`;
    }).join("");
    return `
      <svg class="video-line ${large ? "video-line-large" : ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(metric.label)}逐条趋势">
        <defs><linearGradient id="videoArea-${metric.key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,122,69,.34)"/><stop offset="1" stop-color="rgba(255,122,69,0)"/></linearGradient></defs>
        ${large ? `<text x="${left}" y="22" fill="var(--ink2)" font-family="var(--disp)" font-size="12" letter-spacing=".12em">${esc(metric.label)} · ${esc(metric.unit)}</text><line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="rgba(255,255,255,.12)"/><line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" stroke="rgba(255,255,255,.12)"/>` : ""}
        ${grid}
        ${fillPath ? `<path d="${fillPath}" fill="url(#videoArea-${metric.key})"/>` : ""}
        <polyline points="${points}" pathLength="1" fill="none" stroke="var(--amber)" stroke-width="${large ? 3.6 : 2.5}" stroke-linecap="round" stroke-linejoin="round" class="glow-line"/>
        ${circles}
        <text x="${left}" y="${height - 2}" fill="var(--faint)" font-size="${large ? 11 : 9.5}" font-family="var(--han)">${mocked ? "示意走势 · 发布后自动换真实数据" : "按发布顺序 · 每个点 = 一条视频"}</text>
        ${mocked ? `<g transform="translate(${width - right - (large ? 90 : 64)}, ${top - (large ? 28 : 14)})"><rect x="0" y="0" rx="8" ry="8" width="${large ? 90 : 64}" height="${large ? 24 : 17}" fill="rgba(255,122,69,.14)" stroke="rgba(255,122,69,.4)"/><text x="${large ? 45 : 32}" y="${large ? 16 : 12}" text-anchor="middle" fill="var(--amber2)" font-size="${large ? 12 : 10}" font-family="var(--han)">模拟数据</text></g>` : ""}
      </svg>
    `;
  }

  function setupVideoTabs(containerSelector, chartSelector, items, options = {}) {
    const tabs = $(containerSelector);
    const chart = $(chartSelector);
    if (!tabs || !chart) return;
    const chartOptions = { width: 520, height: 178, ...options };
    const render = key => {
      tabs.innerHTML = VIDEO_METRICS.map(metric => `<button class="tab ${metric.key === key ? "on" : ""}" type="button" data-metric="${metric.key}">${esc(metric.label)}</button>`).join("");
      chart.innerHTML = videoSeriesChart(items, key, chartOptions);
      tabs.querySelectorAll("[data-metric]").forEach(button => {
        button.addEventListener("click", () => render(button.dataset.metric));
      });
    };
    render(VIDEO_METRICS[0].key);
  }

  function radarScope(signals, options = {}) {
    const list = signals || [];
    if (!list.length) return emptyState("今日暂无信号", "刷新热点后出现雷达点");
    const size = options.size || 430;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * 0.42;
    const rings = [0.27, 0.51, 0.75, 1].map(ratio => `<circle cx="${cx}" cy="${cy}" r="${(maxR * ratio).toFixed(1)}" fill="none" stroke="rgba(255,255,255,.11)"/>`).join("");
    const spokes = TYPE_ORDER.map((type, index) => {
      const p = polar(cx, cy, maxR + 14, index * 72);
      return `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="rgba(255,255,255,.08)"/><text x="${p.x}" y="${p.y}" class="radar-axis-label" text-anchor="middle">${esc(typeShort(type))}</text>`;
    }).join("");
    const dots = list.map((signal, index) => {
      const typeIndex = Math.max(0, TYPE_ORDER.indexOf(signal.type));
      const angle = typeIndex * 72 + ((index % 3) - 1) * 12;
      const rank = Number(signal.tier_rank || 3);
      const radius = rank === 1 ? maxR * 0.32 + index % 2 * 6 : rank === 2 ? maxR * 0.62 + index % 2 * 8 : maxR * 0.84;
      const p = polar(cx, cy, radius, angle);
      return `<g><circle cx="${p.x}" cy="${p.y}" r="${14 - Math.min(rank, 4)}" fill="rgba(255,122,69,.14)"/><circle cx="${p.x}" cy="${p.y}" r="${6 - Math.min(rank, 3) * .7}" fill="var(--amber2)" class="glow-line"/><text x="${p.x + 10}" y="${p.y - 8}" class="axis-label">${esc(signal.tier || "")}</text></g>`;
    }).join("");
    return `
      <div class="radar-scope-wrap">
        <svg class="svg-chart" viewBox="0 0 ${size} ${size}" role="img" aria-label="热点雷达扫描盘">
          ${rings}${spokes}
          <g class="sweep" style="transform-origin:${cx}px ${cy}px;animation:spin 5s linear infinite"><path d="M${cx} ${cy} L${cx} ${cy - maxR} A${maxR} ${maxR} 0 0 1 ${cx + maxR * 0.75} ${cy - maxR * 0.66} Z" fill="rgba(255,122,69,.18)"/></g>
          <circle cx="${cx}" cy="${cy}" r="4" fill="var(--amber)"/>
          ${dots}
        </svg>
        <div class="radar-legend">
          <span>轴 = 内容类型</span>
          <span>越靠中心 = tier 越高</span>
          <span>亮点 = 今日精选</span>
        </div>
      </div>
    `;
  }

  function radarDistribution(signals, fullFetch) {
    const rows = TYPE_ORDER
      .map(type => {
        const selected = (signals || []).filter(item => item.type === type);
        const tier1 = selected.filter(item => item.tier_rank === 1).length;
        const tier2 = selected.filter(item => item.tier_rank === 2).length;
        return { type, selected: selected.length, tier1, tier2 };
      })
      .filter(item => item.selected > 0);
    const max = Math.max(...rows.map(item => item.selected), 1);
    const sourceRows = Object.entries(groupedBy(fullFetch || [], "group"))
      .map(([name, items]) => ({ name, count: items.length }))
      .sort((a, b) => b.count - a.count);
    return `
      <div class="radar-dist">
        <div class="dist-note">
          <b>怎么看</b>
          <span>条长 = 今日精选数量；亮色段 = tier1；下方是本次全量来源规模。这个面板只回答“今天该优先看哪类”。</span>
        </div>
        <div class="dist-list">
          ${rows.map(row => `
            <div class="dist-row">
              <div class="dist-head"><strong>${esc(row.type)}</strong><span>${row.selected} 条 · tier1 ${row.tier1}</span></div>
              <div class="dist-track"><i style="width:${Math.max(7, row.selected / max * 100)}%;--c:${typeColor(row.type)}"></i><em style="width:${Math.max(0, row.tier1 / Math.max(row.selected, 1) * 100)}%"></em></div>
            </div>
          `).join("")}
        </div>
        <div class="source-rank">
          <h3>全量来源</h3>
          ${sourceRows.map(row => `<div><span>${esc(row.name.replace(/（.*?）/g, ""))}</span><b>${row.count}</b></div>`).join("")}
        </div>
      </div>
    `;
  }

  function currentWeekRows(schedule) {
    const rows = schedule || [];
    const firstWeek = rows[0]?.week;
    return rows.filter(row => row.week === firstWeek).slice(0, 3);
  }

  function confidenceText(samples) {
    const count = Number(samples || 0);
    if (count <= 0) return "占星级 · 纯纪律训练";
    if (count < 5) return "低置信 · 先收样本";
    if (count < 15) return "校准中 · 只看方向";
    return "可参考 · 继续复盘";
  }

  function disciplineHTML(data) {
    const global = data.global || {};
    const state = global.state || {};
    const buffer = Number(global.buffer_count || 0);
    const targetBuffer = Number(state.buffer_target || state.target_buffer || 3);
    const needShoot = Math.max(0, targetBuffer - buffer);
    const pendingRetros = Array.isArray(state.pending_retros) ? state.pending_retros.length : 0;
    const action = pendingRetros > 0
      ? `${pendingRetros} 篇到 T+3d 该复盘`
      : needShoot > 0
        ? `今天拍 ≥${needShoot} 条`
        : "保持排期，补脚本细节";
    return `
      <div class="discipline-bar">
        <div>
          <div class="eyebrow">Content Workbench · ${esc(global.stage || "—")}</div>
          <h1>今日纪律</h1>
        </div>
        <div class="discipline-grid">
          <div class="discipline-cell ${buffer <= 0 ? "danger" : ""}"><span>Buffer</span><b>${buffer}</b><em>${buffer <= 0 ? "下个发布日可能断更" : "库存可覆盖发布"}</em></div>
          <div class="discipline-cell"><span>今日待办</span><b>${esc(action)}</b><em>先补闭环，再看预测</em></div>
          <div class="discipline-cell"><span>置信度</span><b>${esc(confidenceText(global.calibration_samples))}</b><em>${esc(global.calibration_samples || 0)} 个校准样本</em></div>
        </div>
      </div>
    `;
  }

  /* 空值判定：空串 / 纯空白 / 光杆「—」「-」都算没内容，不给它留占位行 */
  function hasContent(value) {
    const text = String(value ?? "").trim();
    return text !== "" && text !== "—" && text !== "-" && text !== "–";
  }

  function ideaCardHTML(item, compact = false, floatIndex = null) {
    const angleCandidates = [item.angle, item.hook, item.excerpt, item.note].filter(hasContent);
    const angle = angleCandidates[0] || "";
    const likes = numberOrNull(item.likes);
    /* 来源只认真实来源字段：旧的 source_label 兜底会把徽章上的「随手记」再抄一遍，
       等于把空行伪装成有内容，正是要收敛掉的无意义占位。 */
    const source = hasContent(item.source) ? item.source : "";
    const url = item.url || "";
    /* 星火便签：按卡序错开浮沉相位（负延迟 = 各卡从周期中段开始，幅度由 CSS 限 ≤4px） */
    const floatStyle = floatIndex === null
      ? ""
      : ` style="--fl-t:${(4 + (floatIndex % 5) * 0.5).toFixed(1)}s;--fl-d:-${((floatIndex % 7) * 0.9).toFixed(1)}s"`;
    const tier1 = item.tier === "tier1" || Number(item.tier_rank) === 1;
    const detail = compact ? "" : ideaDetailHTML(item, source, url);
    /* 四字段全空的随手记卡：解除方卡 aspect-ratio，高度贴内容走，不为对齐留空白 */
    const thin = !compact && !angle && detail.includes("idea-thin");
    return `
      <article class="idea-card ${compact ? "compact" : ""} ${tier1 ? "tier1" : ""} ${thin ? "is-thin" : ""}"${floatStyle}>
        <div class="signal-meta">
          <span class="pill hot">${esc(item.type || "未分类")}</span>
          <span class="pill">${esc(item.tier || "—")}</span>
          <span class="pill">${esc(item.source_label || "来源")}</span>
          ${likes ? `<span class="pill">❤ ${formatNumber(likes)}</span>` : ""}
          ${scorePill(item.score)}
        </div>
        <h3>${esc(item.title || "未命名选题")}</h3>
        ${angle ? `<p class="idea-angle">${esc(angle)}</p>` : ""}
        ${detail}
      </article>
    `;
  }

  /* 角度/钩子/摘要/来源/备注：只渲染真有内容的行。
     全空时不摆一排孤零零的「—」，改一行灰色小字，卡片高度自适应。 */
  function ideaDetailHTML(item, source, url) {
    const sourceValue = hasContent(source) || url
      ? `${esc(source)}${url ? `${hasContent(source) ? " · " : ""}<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">原文链接 ↗</a>` : ""}`
      : "";
    const rows = [
      ["角度", hasContent(item.angle) ? esc(item.angle) : ""],
      ["钩子", hasContent(item.hook) ? esc(item.hook) : ""],
      ["摘要", hasContent(item.excerpt) ? esc(item.excerpt) : ""],
      ["来源", sourceValue],
      ["备注", hasContent(item.note) ? esc(item.note) : ""]
    ].filter(row => row[1]);
    if (!rows.length) return `<p class="idea-thin">待补角度与钩子</p>`;
    return `<dl class="idea-detail">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
  }

  function sourceOptions(items, key, defaults = []) {
    const values = Array.from(new Set((items || []).map(item => item[key]).filter(Boolean)));
    return ["全部", ...defaults, ...values.filter(value => !defaults.includes(value))];
  }

  function renderIdeaGrid(items) {
    const grid = $("#ideas-grid");
    if (!grid) return;
    const type = $("#idea-type-filter")?.value || "全部";
    const tier = $("#idea-tier-filter")?.value || "全部";
    const source = $("#idea-source-filter")?.value || "全部";
    const rows = (items || [])
      .filter(item => type === "全部" || item.type === type)
      .filter(item => tier === "全部" || item.tier === tier)
      .filter(item => source === "全部" || item.source_label === source)
      .sort((a, b) => {
        const aScore = numberOrNull(a.score);
        const bScore = numberOrNull(b.score);
        if (aScore !== null || bScore !== null) return (bScore ?? -1) - (aScore ?? -1);
        return (a.tier_rank || 9) - (b.tier_rank || 9);
      });
    if (!rows.length) {
      grid.innerHTML = emptyState("没有匹配灵感", "换一个筛选条件");
      return;
    }
    const order = ["我的灵感", "自动化热点", "随手记"];
    const groups = groupedBy(rows, "source_label");
    const orderedGroups = [
      ...order.filter(key => groups[key]),
      ...Object.keys(groups).filter(key => !order.includes(key)).sort()
    ];
    let floatIndex = 0;
    grid.innerHTML = orderedGroups.map(group => `
      <section class="idea-section">
        <div class="idea-section-head"><h3>${esc(group)}</h3><span>${groups[group].length} 条</span></div>
        <div class="idea-section-grid">${groups[group].map(item => ideaCardHTML(item, false, floatIndex++)).join("")}</div>
      </section>
    `).join("");
  }

  function setupIdeaFilters(items) {
    const filterMap = [
      ["#idea-type-filter", sourceOptions(items, "type", TYPE_ORDER)],
      ["#idea-tier-filter", sourceOptions(items, "tier", ["tier1", "tier2", "tier3", "待筛选"])],
      ["#idea-source-filter", sourceOptions(items, "source_label", ["我的灵感", "随手记"])]
    ];
    filterMap.forEach(([selector, values]) => {
      const node = $(selector);
      if (!node) return;
      node.innerHTML = values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
      node.addEventListener("change", () => renderIdeaGrid(items));
    });
    renderIdeaGrid(items);
  }

  function renderIndex(data) {
    const global = data.global || {};
    const state = global.state || {};
    const cheat = data.cheat || {};
    const analytics = data.analytics || {};
    const summary = analytics.summary || {};
    const radar = data.radar || {};
    const signals = (radar.signals || []).slice(0, 8);
    const schedule = data.pipeline?.schedule || [];
    const ideas = data.ideas?.items || [];

    const buffer = Number(global.buffer_count || 0);
    const sources = Array.isArray(global.signal_sources) ? global.signal_sources.length : 0;
    const samples = Number(global.calibration_samples ?? state.calibration_samples ?? 0);
    const publishedCount = Number(summary.published_count || 0);
    const published = publishedCount > 0;
    const libraryTotal = Number(global.library_count ?? data.library?.summary?.total ?? 0);
    const methodTotal = Number(global.methodology_count ?? data.methodology?.summary?.total ?? 0);
    const ammoCount = libraryTotal + methodTotal;
    const filled = Number(global.scheduled_filled_count || 0);
    const slots = Number(global.scheduled_count || schedule.length || 0);
    const hitCount = Number(radar.hit_count || signals.length || 0);
    const rubric = state.rubric_version || cheat.rubric_version || "v0";
    const pendingRetros = Array.isArray(state.pending_retros) ? state.pending_retros.length : 0;
    const baseline = numberOrNull(cheat.baseline_plays ?? state.baseline_plays);
    const totalViews = numberOrNull(summary.total_views) || 0;
    const mount = (selector, html) => { const node = $(selector); if (node) node.innerHTML = html; };

    mount("#v6-topbar", `
      <div class="v6-brand">内容工作台 <span>/ CONTENT WORKBENCH</span></div>
      <div class="v6-topmeta">${esc(global.today || "—")} · ${esc(global.stage || "—")}</div>
      <div class="v6-topspacer"></div>
      <span class="v6-chip ${buffer <= 0 ? "v6-chip-alert" : ""}">BUFFER ${buffer}${buffer <= 0 ? " · 可能断更" : " · 库存正常"}</span>
      <span class="v6-chip">RUBRIC ${esc(rubric)}</span>
      <span class="v6-chip"><i class="v6-dot"></i>${sources} 源在线</span>
    `);

    const roCard = (card) => `
      <article class="v6-ro fx-fluid ${card.alert ? "v6-ro-alert" : ""}" data-fluid="${card.palette}" data-tilt>
        <div class="v6-ro-k">${esc(card.label)}</div>
        <div class="v6-ro-v">${card.valueHTML}</div>
        <div class="v6-ro-n">${esc(card.note)}</div>
      </article>`;
    mount("#v6-kpis", [
      {
        label: "BUFFER 库存", palette: "ember", alert: buffer <= 0,
        valueHTML: `<span data-countup="${buffer}">${buffer}</span>`,
        note: buffer <= 0 ? "下个发布日可能断更" : "库存可覆盖发布"
      },
      {
        label: "校准样本", palette: "violet",
        valueHTML: `<span data-countup="${samples}">${samples}</span><small> / 5</small>`,
        note: "置信度极低 · 占星级训练"
      },
      {
        label: "今日信号", palette: "steel",
        valueHTML: `<span data-countup="${hitCount}">${hitCount}</span>`,
        note: `全部过方向三问 · 待入池 ${Number(global.candidate_count || 0)}`
      },
      {
        label: "排期已填", palette: "moss",
        valueHTML: `<span data-countup="${filled}">${filled}</span><small> / ${slots}</small>`,
        note: slots === 0 ? "暂无排期" : (slots > filled ? `${slots - filled} 个空位待补` : "排期满档")
      },
      {
        label: "弹药库", palette: "gold",
        valueHTML: `<span data-countup="${ammoCount}">${ammoCount}</span>`,
        note: `方法论 ${methodTotal} · 素材 ${libraryTotal}`
      },
      {
        label: "累计播放", palette: "teal",
        valueHTML: published
          ? (totalViews < 10000
            ? `<span data-countup="${totalViews}">${formatNumber(totalViews)}</span>`
            : `<span>${formatNumber(totalViews)}</span>`)
          : `<span class="v6-ro-dash">—</span>`,
        note: published
          ? `${publishedCount} 条已发`
          : `对标基线 中位 ${formatNumber(baseline)} 播放`
      }
    ].map(roCard).join(""));

    const typeCounts = radar.type_counts || {};
    const mixEntries = TYPE_ORDER.filter(type => typeCounts[type]).map(type => `${typeShort(type)} ${typeCounts[type]}`);
    const sigTypeClass = (type) => {
      if (type === "热点") return "v6-sig--hot";
      if (type === "方法论") return "v6-sig--method";
      if (type === "AI赚钱方式") return "v6-sig--money";
      if (type === "共鸣类") return "v6-sig--vibe";
      return "";
    };
    const ringCards = signals.map((signal, index) => {
      const angle = shortText(String(signal.angle || signal.hook || "").replace(/^你要讲的角度[:：]\s*/, ""), 62) || "—";
      const source = shortText(String(signal.source || "信号").split("；")[0], 22);
      const likes = numberOrNull(signal.likes);
      return `
        <article class="ring-card v6-sig ${sigTypeClass(signal.type)}" style="--c:${typeColor(signal.type)}">
          <div class="v6-sig-top"><span class="v6-sig-k">${esc(typeShort(signal.type))} ${String(index + 1).padStart(2, "0")}</span>${signal.tier ? `<span class="v6-sig-tier">${esc(signal.tier)}</span>` : ""}</div>
          <div class="v6-sig-t">${esc(signal.title || "未命名信号")}</div>
          <div class="v6-sig-a">${esc(angle)}</div>
          <div class="v6-sig-s"><span>${esc(source)}</span><span>${likes ? `❤ ${formatNumber(likes)}` : "雷达在线"}</span></div>
        </article>`;
    }).join("");
    mount("#v6-signals", `
      <div class="v6-ph">
        <span class="v6-bar" style="background:var(--amber)"></span>
        <span class="v6-ph-t">今日信号</span>
        <span class="v6-ph-n">${signals.length} 条 · 命中 ${hitCount}</span>
        <a class="v6-go" href="radar.html">全部 →</a>
      </div>
      <div class="v6-ring-wrap">
        ${signals.length ? `
          <div class="v6-ring" id="v6-ring" data-ring data-cruise="5">
            ${ringCards}
            <div class="v6-ring-ctl">
              <button type="button" data-ring-action="cruise" aria-pressed="true">自动巡航</button>
              <button type="button" data-ring-action="reset">复位</button>
              <button type="button" data-ring-action="grid">平铺</button>
              <span class="v6-ring-hint">拖拽旋转 · Alt+滚轮缩放 · 点卡聚焦 · 再点放大</span>
            </div>
          </div>
          <aside class="v6-float-stat" aria-hidden="true">
            <div class="v6-fs-k">SIGNAL MIX</div>
            <div class="v6-fs-v">入选 ${signals.length}</div>
            <div class="v6-fs-rows">${mixEntries.length ? mixEntries.map(entry => `<span>${esc(entry)}</span>`).join("") : "<span>类型分布待更新</span>"}</div>
          </aside>
        ` : `<div class="v6-empty">暂无信号 · 跑一次 cheat-trends 刷新雷达</div>`}
      </div>
    `);

    const doneStatus = (status) => /^已/.test(String(status || ""));
    const statusShort = (status) => {
      const text = String(status || "待剪");
      if (/待发/.test(text)) return "待发";
      return text.length > 4 ? shortText(text, 5) : text;
    };
    let nowIndex = schedule.findIndex(row => !doneStatus(row.status));
    if (nowIndex < 0) nowIndex = -1;
    let weekCursor = "";
    const scheduleRows = schedule.map((row, index) => {
      const weekHead = row.week !== weekCursor ? (weekCursor = row.week, `<div class="v6-qwk">${esc(shortText(row.week || "未分周", 30))}</div>`) : "";
      const done = doneStatus(row.status);
      const now = index === nowIndex;
      const sub = now && String(row.status || "").length > 4
        ? `<span class="v6-q-sub">${esc(shortText(row.status, 44))}</span>`
        : "";
      return `${weekHead}
        <div class="v6-q ${done ? "done" : ""} ${now ? "now" : ""}">
          <span class="v6-q-d">${esc(row.publish_day || "—")}</span>
          <span class="v6-q-tp" style="--c:${typeColor(row.type)}">${esc(typeShort(row.type))}</span>
          <span class="v6-q-t">${esc(shortText(row.topic || "—", 40))}</span>
          <span class="v6-q-s">${done ? "✓ " : ""}${esc(statusShort(row.status))}</span>
          ${sub}
        </div>`;
    }).join("");
    mount("#v6-schedule", `
      <div class="v6-ph">
        <span class="v6-bar" style="background:var(--pred)"></span>
        <span class="v6-ph-t">排期 · 在印</span>
        <span class="v6-ph-n">${filled}/${slots} 已填 · 类型轮播</span>
        <a class="v6-go" href="pipeline.html">全部 →</a>
      </div>
      <div class="v6-qlist">${scheduleRows || `<div class="v6-empty">暂无排期 · 去选题排期页补位</div>`}</div>
    `);

    const calDots = Array.from({ length: 5 }, (_, i) => `<span class="v6-dotp ${i < samples ? "on" : ""}"></span>`).join("");
    mount("#v6-calib", `
      <div class="v6-ph">
        <span class="v6-bar" style="background:var(--real)"></span>
        <span class="v6-ph-t">校准 · 预测 vs 实绩</span>
        <span class="v6-ph-n">RUBRIC ${esc(rubric)}</span>
        <a class="v6-go" href="cheat.html">详情 →</a>
      </div>
      <div class="v6-cal">
        <div class="v6-cal-row"><span>校准样本</span><span class="v6-cal-dots">${calDots}<b>${samples} / 5</b></span></div>
        <div class="v6-cal-row"><span>置信度</span><b>${esc(cheat.confidence || confidenceText(samples))}</b></div>
        <div class="v6-cal-row"><span>对标组</span><b>${esc(shortText(cheat.benchmark_name || "未设置", 22))}</b></div>
        <div class="v6-cal-row"><span>基线中位</span><b>${formatNumber(baseline)} 播放</b></div>
        <div class="v6-cal-row"><span>待复盘</span><b>${pendingRetros} 篇</b></div>
        <div class="v6-cal-bench">
          <div class="v6-cal-bench-k">对标基线</div>
          <div class="v6-cal-bench-t">${esc(shortText(cheat.benchmark_name || "未设置", 26))}</div>
          <div class="v6-cal-bench-rows">
            <span>中位 <b>${formatNumber(baseline)}</b> 播放</span>
            <span>样本 <b>${Number(cheat.benchmark_sample_count || 0)}</b> 条</span>
          </div>
        </div>
        ${published ? `
          <div class="v6-cal-wait"><b>实绩通道已接入</b>已发 ${publishedCount} 条 · 累计 ${formatNumber(totalViews)} 播放 · 预测准度 ${esc(summary.prediction_accuracy || "待复盘")}</div>
        ` : `
          <div class="v6-cal-wait"><b>首个盲测样本待复盘</b>下一条发布走 cheat-predict 落盘盲预测，T+3 复盘后实绩通道点亮。</div>
        `}
      </div>
    `);

    mount("#v6-ideas", `
      <div class="v6-ph">
        <span class="v6-bar" style="background:var(--amber2)"></span>
        <span class="v6-ph-t">灵感库速览</span>
        <span class="v6-ph-n">共 ${ideas.length} 条 · 按 7 维综合分排</span>
        <a class="v6-go" href="ideas.html">全部 →</a>
      </div>
      <div class="v6-idea-strip">
        ${ideas.length ? `${ideas.slice(0, Math.max(5, Math.min(8, ideas.length))).map(item => `
          <a class="v6-idea" href="ideas.html" data-reveal style="--c:${typeColor(item.type)}">
            <div class="v6-idea-top"><span class="v6-idea-k">${esc(typeShort(item.type))}</span><span class="v6-idea-tier">${esc(item.tier || "待筛选")}</span>${scorePill(item.score)}</div>
            <div class="v6-idea-t">${esc(item.title || "未命名选题")}</div>
            <div class="v6-idea-a">${esc(shortText(item.angle || item.excerpt || item.note || "—", 56))}</div>
          </a>
        `).join("")}
          <a class="v6-idea v6-idea-end" href="ideas.html" data-reveal>
            <span class="v6-idea-end-arrow">全部 →</span>
            <small>共 ${ideas.length} 条</small>
          </a>` : `<div class="v6-empty">暂无灵感 · 候选池和热点为空</div>`}
      </div>
    `);

    /* ── 信号详情 modal（“放大”）──
       effects.js 环卡在“正面卡再点一下”或平铺模式下点任意卡时，
       冒泡派发 wbfx:ringactivate{index}；这里按 index 取 radar.signals 渲染。
       复用全局 .doc-modal 骨架与 openModalShell/closeModalShell（240ms 开合），
       不碰 cheat/library 页各自的 modal。 */
    const openSigModal = (signal, index) => {
      const modal = $("#sig-modal");
      if (!modal || !signal) return;
      const angle = String(signal.angle || "").replace(/^你要讲的角度[:：]\s*/, "").trim();
      const excerpt = String(signal.excerpt || signal.text || "").trim();
      const metric = metricsText(signal.metrics, signal.likes);
      $("#sig-modal-meta").innerHTML = [
        `<span class="sig-modal-type" style="--c:${typeColor(signal.type)}">${esc(typeShort(signal.type))} ${String(index + 1).padStart(2, "0")}</span>`,
        signal.tier ? `<span>${esc(signal.tier)}</span>` : "",
        `<span>${esc(shortText(String(signal.source || "信号").split("；")[0], 40))}</span>`,
        metric ? `<span>${esc(metric)}</span>` : ""
      ].filter(Boolean).join("");
      $("#sig-modal-title").textContent = signal.title || "未命名信号";
      $("#sig-modal-body").innerHTML = `
        ${excerpt ? `<section class="doc-card"><h3>原文 / 摘要</h3><p class="sig-modal-p">${esc(excerpt)}</p></section>` : ""}
        <section class="doc-card"><h3>你要讲的角度</h3><p class="sig-modal-p">${esc(angle || "—")}</p></section>
        ${signal.hook ? `<section class="doc-card"><h3>钩子</h3><p class="sig-modal-p">${esc(signal.hook)}</p></section>` : ""}
        <div class="sig-modal-actions">
          <a class="sig-modal-link" href="radar.html#${signalAnchor(signal)}">在雷达页查看 →</a>
          ${signal.url ? `<a class="sig-modal-link" href="${esc(signal.url)}" target="_blank" rel="noopener noreferrer">原文链接 ↗</a>` : ""}
        </div>`;
      openModalShell("#sig-modal");
      const body = modal.querySelector(".doc-modal-body");
      if (body) body.scrollTop = 0;
    };
    document.addEventListener("wbfx:ringactivate", event => {
      const index = Number(event.detail?.index);
      if (Number.isInteger(index) && signals[index]) openSigModal(signals[index], index);
    });
    document.addEventListener("click", event => {
      if (event.target.closest?.("[data-close-sig]")) closeModalShell("#sig-modal");
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeModalShell("#sig-modal");
    });

    if (window.WBFX && typeof window.WBFX.refresh === "function") {
      document.body.classList.add("fx-on");
      window.WBFX.refresh();
    } else {
      const ring = $("#v6-ring");
      if (ring) ring.classList.add("v6-grid-fallback");
    }
  }

  function renderIdeas(data) {
    const ideas = data.ideas || {};
    const items = ideas.items || [];
    const summary = ideas.summary || {};
    $("#page-hero").innerHTML = heroHTML(data, "ideas", "我的灵感库", "这里只放手工沉淀的选题和随手记；自动化热点已独立到自动化热点库。星火便签缓慢浮沉，hover 点亮。");
    $("#ideas-kpis").innerHTML = kpiHTML([
      { label: "总灵感", value: summary.total || items.length || 0, note: "手工 + 随手记", hot: true },
      { label: "Tier1", value: summary.tier1_count || 0, note: "优先处理", hot: true },
      { label: "我的灵感", value: summary.source_counts?.["我的灵感"] || 0, note: "手工候选" },
      { label: "随手记", value: summary.source_counts?.["随手记"] || 0, note: "收集箱" }
    ], "violet");
    setupIdeaFilters(items);
    activateFx();
  }

  function renderAutoHotspots(data) {
    const history = data.auto_hotspots || {};
    const items = history.items || [];
    const summary = history.summary || {};
    $("#page-hero").innerHTML = heroHTML(data, "auto-hotspots", "自动化热点库", "横向时间河：一天一列，最新一天靠右高亮。左缘色条 = 热度色温，hover 轻抬看详情。");
    $("#auto-hotspots-kpis").innerHTML = kpiHTML([
      { label: "历史精选", value: summary.total || items.length || 0, note: "自动化积累", hot: true },
      { label: "覆盖天数", value: summary.day_count || 0, note: "trends-history" },
      { label: "最新日期", value: summary.latest_date || "—", note: "最近刷新", hot: true },
      { label: "今日雷达", value: data.radar?.hit_count || 0, note: "当前精选" }
    ], "ember");
    setupAutoHotspotFilters(items);
    activateFx();
  }

  /* ── 时间河流（auto-hotspots 签名视图）──
     热度分级：全库 priorityScore 按 33% / 66% 分位切三档，
     对应卡片左缘 3px 色温条（高=ember 橙 / 中=gold / 低=三级灰）。 */
  function autoHeatLevels(items) {
    const scores = (items || []).map(priorityScore).filter(value => value > 0).sort((a, b) => a - b);
    if (!scores.length) return { hi: Infinity, mid: Infinity };
    const at = ratio => scores[Math.min(scores.length - 1, Math.floor(ratio * scores.length))];
    return { hi: at(0.66), mid: at(0.33) };
  }

  function autoHeatClass(score, levels) {
    if (score > 0 && score >= levels.hi) return "heat-hi";
    if (score > 0 && score >= levels.mid) return "heat-mid";
    return "heat-lo";
  }

  const WEEKDAYS_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  function weekdayZh(dateText) {
    const date = new Date(`${dateText}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "" : WEEKDAYS_ZH[date.getDay()];
  }

  function autoHotspotCardHTML(item, levels) {
    const url = item.url || "";
    const summary = item.summary || item.excerpt || "—";
    const score = priorityScore(item);
    const metric = metricsText(item.metrics, item.likes) || "—";
    return `
      <article class="hs-card ${autoHeatClass(score, levels)}" data-tilt title="${esc(shortText(item.angle || "", 120))}">
        <div class="hs-top"><span class="hs-type" style="--c:${typeColor(item.type)}">${esc(typeShort(item.type))}</span><span class="hs-heat">${esc(metric)}</span></div>
        <h3>${esc(item.title || "未命名热点")}</h3>
        <p>${esc(shortText(summary, 68))}</p>
        <div class="hs-foot"><span>${esc(shortText(String(item.source || "—").replace(/（.*?）/g, ""), 18))}</span>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">原文 ↗</a>` : ""}</div>
      </article>`;
  }

  function renderAutoHotspotRiver(items) {
    const river = $("#auto-hotspots-river");
    if (!river) return;
    const date = $("#auto-date-filter")?.value || "全部";
    const type = $("#auto-type-filter")?.value || "全部";
    const rows = (items || [])
      .filter(item => date === "全部" || item.date === date)
      .filter(item => type === "全部" || item.type === type);
    if (!rows.length) {
      river.innerHTML = emptyState("没有匹配热点", "换一个筛选条件");
      return;
    }
    const levels = autoHeatLevels(items);
    const groups = groupedBy(rows, "date");
    const dates = Object.keys(groups).sort();            /* 旧 → 新，最新一天在最右 */
    const latest = dates[dates.length - 1];
    river.innerHTML = dates.map(day => `
      <section class="hs-day ${day === latest ? "is-latest" : ""}" data-reveal>
        <header class="hs-day-head">
          <b>${esc(String(day).slice(5) || day)}</b>
          <span>${esc(weekdayZh(day))}</span>
          <em>${groups[day].length} 条${day === latest ? " · 最新" : ""}</em>
        </header>
        <div class="hs-day-list">${groups[day].map(item => autoHotspotCardHTML(item, levels)).join("")}</div>
      </section>
    `).join("");
    river.scrollLeft = river.scrollWidth;                /* 最新一天默认滚入视野 */
    activateFx();                                        /* 筛选重绘后重绑 tilt / reveal（refresh 幂等） */
  }

  function setupAutoHotspotFilters(items) {
    const dateValues = ["全部", ...Array.from(new Set((items || []).map(item => item.date).filter(Boolean))).sort().reverse()];
    const typeValues = sourceOptions(items, "type", TYPE_ORDER);
    [
      ["#auto-date-filter", dateValues],
      ["#auto-type-filter", typeValues]
    ].forEach(([selector, values]) => {
      const node = $(selector);
      if (!node) return;
      node.innerHTML = values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
      node.addEventListener("change", () => renderAutoHotspotRiver(items));
    });
    renderAutoHotspotRiver(items);
  }

  function renderRadar(data) {
    const radar = data.radar || {};
    const sortedSignals = (radar.signals || [])
      .slice()
      .sort((a, b) => (a.tier_rank || 9) - (b.tier_rank || 9));
    $("#page-hero").innerHTML = heroHTML(data, "radar", "热点雷达", `雷达只做点缀，主角是精选热点与全量抓取文本。今日命中 ${radar.hit_count || 0} 条。`);
    $("#radar-kpis").innerHTML = kpiHTML([
      { label: "今日命中", value: radar.hit_count || 0, note: "今日值得做", hot: true },
      { label: "文档筛出", value: radar.reported_hit_count || "—", note: "已归档" },
      { label: "Tier1", value: sortedSignals.filter(item => item.tier_rank === 1).length, note: "优先级最高", hot: true },
      { label: "全量备查", value: radar.full_fetch?.length || 0, note: "全部抓取源" }
    ], "steel");
    /* 签名动效：canvas 雷达扫描盘（effects.js 能力 7），数据经 data-* 传入 */
    const discData = sortedSignals.map(signal => ({
      t: signal.type,
      h: Math.round(priorityScore(signal) * 10) / 10,
      n: shortText(signal.title || "", 24)
    }));
    $("#radar-scope").innerHTML = `
      <div class="rsweep-wrap" data-reveal>
        <div class="rsweep" data-radar-sweep data-radar-signals="${esc(JSON.stringify(discData))}" aria-label="雷达扫描盘：四象限对应四类型，半径代表互动热度" role="img"></div>
        <div class="rsweep-legend"><span>四象限 = 四类型</span><span>越靠中心 = 越热</span><span>扫过 · 对应卡片亮起</span></div>
      </div>
      ${radarDistribution(sortedSignals, radar.full_fetch || [])}`;
    $("#radar-count").textContent = `${radar.hit_count || 0} selected`;
    $("#signal-list").innerHTML = sortedSignals
      .map(signal => {
        const metric = metricsText(signal.metrics, signal.likes);
        const url = signal.url || "";
        const builder = isBuilderSource(signal);
        const excerpt = builder ? localizedFetchExcerpt(signal) : (signal.excerpt || signal.source || "—");
        const anchor = signalAnchor(signal);
        return `
        <article id="${anchor}" class="signal-card radar-signal ${signal.tier_rank === 1 ? "tier1" : ""}" tabindex="-1" data-signal-anchor="${anchor}" data-reveal>
          <div class="signal-meta"><span class="pill hot">${esc(signal.type)}</span><span class="pill">${esc(signal.tier || "—")}</span>${metric ? `<span class="pill">${esc(metric)}</span>` : ""}</div>
          <h3>${esc(signal.title)}</h3>
          <details class="excerpt-box">
            <summary>${esc(shortText(excerpt, 150))}</summary>
            <p>${esc(excerpt)}</p>
            ${builder ? `<p class="origin-text">英文原文：${esc(signal.excerpt || signal.text || "—")}</p>` : ""}
          </details>
          <dl class="idea-detail">
            <div><dt>角度</dt><dd>${esc(signal.angle || "—")}</dd></div>
            <div><dt>钩子</dt><dd>${esc(signal.hook || "—")}</dd></div>
            <div><dt>来源</dt><dd>${esc(signal.source || "—")}</dd></div>
          </dl>
          <div class="signal-foot">
            <span>${esc(signal.source || "—")}</span>
            ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">原文链接 ↗</a>` : `<span>无链接</span>`}
          </div>
        </article>
      `;
      }).join("") || emptyState("今日暂无信号", "刷新热点后出现精选卡片");
    $("#radar-type-bars").innerHTML = `<div class="dist-foot">全量列表已按 score / 互动热度降序展示，优先读上方。</div>`;
    $("#full-fetch").innerHTML = renderFullFetch(radar.full_fetch || []);
    /* 扫描盘 → 信号卡联动：radarping 闪亮 1.2s；radarselect 滚动定位并高亮 */
    const anchors = sortedSignals.map(signalAnchor);
    const cardOf = event => {
      const index = Number(event.detail?.index);
      return Number.isInteger(index) ? document.getElementById(anchors[index] || "") : null;
    };
    document.addEventListener("wbfx:radarping", event => {
      const card = cardOf(event);
      if (!card) return;
      card.classList.add("is-ping");
      window.setTimeout(() => card.classList.remove("is-ping"), 1200);
    });
    document.addEventListener("wbfx:radarselect", event => {
      const card = cardOf(event);
      if (!card) return;
      document.querySelectorAll(".radar-signal.is-target").forEach(node => node.classList.remove("is-target"));
      card.classList.add("is-target");
      const details = card.querySelector("details");
      if (details) details.open = true;
      card.scrollIntoView({ block: "center", behavior: "smooth" });
      card.focus({ preventScroll: true });
    });
    expandSignalFromHash();
    activateFx();
  }

  function expandSignalFromHash() {
    const id = decodeURIComponent((window.location.hash || "").replace(/^#/, ""));
    if (!id || !id.startsWith("signal-")) return;
    const target = document.getElementById(id);
    if (!target) return;
    document.querySelectorAll(".radar-signal.is-target").forEach(node => node.classList.remove("is-target"));
    target.classList.add("is-target");
    const details = target.querySelector("details");
    if (details) details.open = true;
    window.setTimeout(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.focus({ preventScroll: true });
    }, 80);
  }

  function renderFullFetch(items) {
    if (!items.length) return emptyState("暂无全量区");
    const sorted = (items || []).slice().sort((a, b) => priorityScore(b) - priorityScore(a));
    return Object.entries(groupedBy(sorted, "group")).map(([group, rows]) => `
      <section class="fetch-group"><h3>${esc(group || "source")} <span>${rows.length} 条</span></h3>
        ${rows.map(item => {
          const metric = metricsText(item.metrics);
          const url = item.url || "";
          const title = localizedFetchTitle(item);
          const excerpt = localizedFetchExcerpt(item);
          const isBuilder = isBuilderSource(item);
          return `<details class="fetch-item ${isBuilder ? "builder" : ""}"><summary><strong>${esc(title || "未命名条目")}</strong><span>${esc(metric || item.source || "—")}</span></summary><p>${esc(excerpt || "—")}</p>${isBuilder ? `<p class="origin-text">英文原文：${esc(item.excerpt || item.text || "—")}</p>` : ""}<div class="fetch-meta"><span>${esc(item.source || item.created_at || "—")}</span>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">链接 ↗</a>` : ""}</div></details>`;
        }).join("")}
      </section>
    `).join("");
  }

  function groupedBy(items, key) {
    return (items || []).reduce((groups, item) => {
      const value = item[key] || "未分组";
      groups[value] ||= [];
      groups[value].push(item);
      return groups;
    }, {});
  }

  /* ── 生产线轨道：日期解析（"周五 7-31" → 731，跨月可比较） ── */
  function pipelineDayValue(text) {
    const match = /(\d{1,2})\s*-\s*(\d{1,2})/.exec(String(text || ""));
    return match ? Number(match[1]) * 100 + Number(match[2]) : null;
  }

  function pipelineCarHTML(row, options = {}) {
    const done = /^已/.test(String(row.status || ""));
    const ghost = Boolean(row.is_placeholder);
    const warn = ghost && options.gapTypes?.has(row.type);
    const cls = ["pl-car", done ? "done" : "", options.current ? "current" : "", ghost ? "ghost" : "", warn ? "warn" : ""]
      .filter(Boolean).join(" ");
    const status = done
      ? `✓ ${row.status}`
      : warn
        ? `⚠ ${row.status} · ${typeShort(row.type)}库存 0`
        : (options.current ? `▶ ${row.status} · 当前待办` : row.status);
    return `
      <article class="${cls}" style="--c:${typeColor(row.type)}" title="${esc(row.topic || "")}">
        <div class="pl-car-top"><span class="pl-car-day">${esc(row.publish_day || "—")}</span><span class="pl-car-type">${esc(typeShort(row.type))}</span></div>
        <div class="pl-car-title">${esc(shortText(row.topic || "—", 42))}</div>
        <div class="pl-car-status">${esc(shortText(status || "—", 30))}</div>
      </article>`;
  }

  function pipelineGapCarHTML(gap) {
    return `
      <article class="pl-car ghost warn" style="--c:${typeColor(gap.type)}" title="${esc(gap.topics || "")}">
        <div class="pl-car-top"><span class="pl-car-day">待补位</span><span class="pl-car-type">${esc(typeShort(gap.type))}</span></div>
        <div class="pl-car-title">缺 ${esc(gap.type)} · 库存 ${esc(gap.raw_remaining || "0")}</div>
        <div class="pl-car-status">⚠ ${esc(shortText(gap.topics || "先补库存", 26))}</div>
      </article>`;
  }

  function renderPipeline(data) {
    const pipeline = data.pipeline || {};
    const counts = asRanking(pipeline.type_counts);
    const schedule = pipeline.schedule || [];
    const next = schedule.find(item => item.status === "待剪" || item.status === "待补") || schedule[0];
    const conclusionCount = Math.min(12, Number(data.analytics?.summary?.published_count || 0));
    $("#page-hero").innerHTML = heroHTML(data, "pipeline", "选题排期", `本轮 ${typeShort(next?.type || "—")} · 距结论 ${conclusionCount}/12。周一 / 周三 / 周五，一周三条，5 类型轮播保持变量干净。`);
    $("#pipeline-kpis").innerHTML = kpiHTML([
      { label: "候选池", value: pipeline.candidates?.length || 0, note: "active entries", hot: true },
      { label: "已排期", value: schedule.filter(item => !item.is_placeholder).length, note: `${schedule.length || 0} 个槽位` },
      { label: "缺口", value: pipeline.gaps?.length || 0, note: "库存为 0 的类型", hot: (pipeline.gaps?.length || 0) > 0 },
      { label: "类型数", value: counts.filter(item => item.value > 0).length, note: "轮播池" }
    ], "moss");

    /* ── 签名视图：周泳道轨道（全 CSS 动效，无 canvas / 无 JS 循环） ── */
    const doneStatus = status => /^已/.test(String(status || ""));
    const currentIndex = schedule.findIndex(row => !doneStatus(row.status) && !row.is_placeholder);
    const gapTypes = new Set((pipeline.gaps || []).map(item => item.type));
    const todayValue = pipelineDayValue(String(data.global?.today || "").slice(5));
    let nowAt = -1;
    if (todayValue !== null) {
      nowAt = schedule.findIndex(row => {
        const value = pipelineDayValue(row.publish_day);
        return value !== null && value >= todayValue;
      });
    }
    const lanes = [];
    schedule.forEach((row, index) => {
      const last = lanes[lanes.length - 1];
      if (!last || last.week !== row.week) lanes.push({ week: row.week, rows: [] });
      lanes[lanes.length - 1].rows.push({ row, index });
    });
    const placeholderTypes = new Set(schedule.filter(row => row.is_placeholder).map(row => row.type));
    const leftoverGaps = (pipeline.gaps || []).filter(gap => !placeholderTypes.has(gap.type));
    const nowHTML = `<div class="pl-now" aria-label="今天"><span class="pl-now-tag">NOW</span></div>`;
    $("#calendar").innerHTML = lanes.map((lane, laneIndex) => {
      const cells = [];
      lane.rows.forEach(({ row, index }) => {
        if (index === nowAt) cells.push(nowHTML);
        cells.push(pipelineCarHTML(row, { current: index === currentIndex, gapTypes }));
      });
      if (laneIndex === lanes.length - 1) {
        if (nowAt === -1 && todayValue !== null) cells.push(nowHTML);
        leftoverGaps.forEach(gap => cells.push(pipelineGapCarHTML(gap)));
      }
      return `
        <section class="pl-week" data-reveal>
          <div class="pl-week-head"><span class="pl-week-bar"></span><span class="pl-week-title">${esc(shortText(lane.week || "未分周", 42))}</span><span class="pl-week-note">${lane.rows.length} 节车厢</span></div>
          <div class="pl-lane">${cells.join("")}</div>
        </section>`;
    }).join("") || `<div class="pl-inline-empty">暂无排期 · 去 02-选题排期.md 补位。</div>`;

    /* ── 下方模块：轮播 / 候选池分布 / 类型表现 + 库存缺口 ── */
    $("#rotation-ring").innerHTML = gauge(20 * Math.max(1, TYPE_ORDER.indexOf(next?.type || "共鸣类") + 1), { center: next?.type || "轮播" });
    $("#pipeline-donut").innerHTML = donut(counts, { center: "候选" });
    $("#pipeline-bars").innerHTML = barRanking(counts, { format: v => `${v} 条` });
    const perf = pipeline.performance_rows || [];
    $("#pipeline-perf").innerHTML = perf.length ? `
      <div class="pl-perf">
        <div class="pl-perf-row head"><span>类型</span><span>已发</span><span>播放中位</span><span>赞播比</span><span>备注</span></div>
        ${perf.map(row => `
          <div class="pl-perf-row" style="--c:${typeColor(row["类型"])}">
            <span class="pl-perf-type">${esc(typeShort(row["类型"]))}</span>
            <b>${esc(row["已发篇数"] || "—")}</b>
            <b>${esc(row["播放中位数"] || "—")}</b>
            <b>${esc(row["赞播比"] || "—")}</b>
            <span class="pl-perf-note" title="${esc(row["备注"] || "")}">${esc(row["备注"] || "—")}</span>
          </div>`).join("")}
      </div>` : `<div class="pl-inline-empty">发布回填后自动出现类型表现追踪。</div>`;
    $("#gap-list").innerHTML = (pipeline.gaps || []).length
      ? pipeline.gaps.map(item => `<div class="signal-card pl-gap-row" style="--c:${typeColor(item.type)}"><span class="pill hot">${esc(item.type)}</span><div class="sub">剩余 ${esc(item.raw_remaining)} · ${esc(item.topics)}</div></div>`).join("")
      : `<div class="pl-inline-empty">库存正常 · 当前排期表没有标红缺口。</div>`;
    activateFx();
  }

  /* ── 空数据期仪表间：对标基线半圆 gauge（SVG 描线 1s + 指针缓摆到基线位，
     纯 CSS/SVG 一次性动画）+ 等待首个样本状态板（口径同总台校准卡） ── */
  function renderAnalyticsGauge(data, published) {
    const host = $("#analytics-gauge");
    if (!host) return;
    if (published) {                       /* 有真实数据后仪表间退场，版面交还真实图表 */
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    const cheat = data.cheat || {};
    const global = data.global || {};
    const baseline = numberOrNull(cheat.baseline_plays) || 0;
    /* 量程：基线向上取整到 5 万粒度，至少 10 万，保证指针落在盘面中段 */
    const scale = Math.max(100000, Math.ceil((baseline * 1.5) / 50000) * 50000 || 100000);
    const frac = Math.max(0, Math.min(1, baseline / scale));
    const samples = Number(cheat.calibration_samples ?? global.calibration_samples ?? 0);
    host.hidden = false;
    host.innerHTML = `
      <div class="glass panel an-gauge-panel" data-reveal>
        <div class="panel-head"><h2>对标基线仪表</h2><span class="chip">发布后换真实播放</span></div>
        <div class="an-gauge" style="--ng:${(frac * 180).toFixed(1)}deg">
          <svg viewBox="0 0 240 152" role="img" aria-label="对标基线半圆仪表：指针指向基线播放中位">
            <defs><linearGradient id="anGaugeGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4fd6c8"/><stop offset="1" stop-color="#7fb2ff"/></linearGradient></defs>
            <path d="M 28 120 A 92 92 0 0 1 212 120" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="13" stroke-linecap="round"/>
            <path class="an-arc-fg" d="M 28 120 A 92 92 0 0 1 212 120" pathLength="1" fill="none" stroke="url(#anGaugeGrad)" stroke-width="13" stroke-linecap="round" style="--frac:${frac.toFixed(3)}"/>
            <g class="an-needle-g"><line x1="120" y1="120" x2="46" y2="120" stroke="var(--amber2)" stroke-width="3" stroke-linecap="round"/></g>
            <circle cx="120" cy="120" r="5" fill="var(--amber2)"/>
            <text x="26" y="144" class="an-tick">0</text>
            <text x="120" y="18" text-anchor="middle" class="an-tick">${formatNumber(scale / 2)}</text>
            <text x="214" y="144" text-anchor="end" class="an-tick">${formatNumber(scale)}</text>
          </svg>
          <div class="an-gauge-read">
            <b>${formatNumber(baseline)}</b>
            <span>对标基线 · 播放中位</span>
            <em>${esc(shortText(cheat.benchmark_name || "未设置对标组", 26))} · ${Number(cheat.benchmark_sample_count || 0)} 样本</em>
          </div>
        </div>
      </div>
      <div class="glass panel an-wait-panel" data-reveal>
        <div class="panel-head"><h2>等待首个样本</h2><span class="chip">0 发布</span></div>
        <div class="an-wait">
          <b>首个盲测样本待复盘</b>
          <p>下一条发布走 cheat-predict 落盘盲预测，T+3 复盘后实绩通道点亮，这块仪表自动换成真实播放。</p>
          <div class="an-wait-rows">
            <span>校准样本 <b>${samples} / 5</b></span>
            <span>Rubric <b>${esc(cheat.rubric_version || "v0")}</b></span>
            <span>Buffer <b>${Number(cheat.buffer_count ?? global.buffer_count ?? 0)}</b></span>
          </div>
        </div>
      </div>`;
  }

  function renderAnalytics(data) {
    const analytics = data.analytics || {};
    const summary = analytics.summary || {};
    const published = Number(summary.published_count || 0) > 0;
    $("#page-hero").innerHTML = heroHTML(data, "analytics", "视频数据", "播放量、完播率、跳出率、赞播比会在发布归档后自动接管。发布前这里是对标基线仪表间。");
    $("#analytics-kpis").innerHTML = kpiHTML([
      { label: "累计发布", value: published ? summary.published_count : "—", note: "03-已发布内容" },
      { label: "累计播放", value: published ? formatNumber(summary.total_views) : "—", note: "views" },
      { label: "平均完播率", value: published ? formatPercent(summary.avg_completion_rate) : "—", note: "completion", hot: published },
      { label: "平均跳出率", value: published ? formatPercent(summary.avg_drop_rate) : "—", note: "drop" },
      { label: "赞播比", value: published ? formatPercent(summary.average_like_rate) : "—", note: "likes / views" },
      { label: "领跑类型", value: published ? (summary.leading_type || "—") : "—", note: "按播放中位数", hot: Boolean(summary.leading_type) }
    ], "teal");
    renderAnalyticsGauge(data, published);
    $("#analytics-bars").innerHTML = typeCompareChart(analytics.type_medians || []);
    setupVideoTabs("#analytics-video-tabs", "#analytics-video-chart", analytics.items || [], { width: 960, height: 360, large: true });
    $("#analytics-empty-chip").textContent = published ? `${summary.published_count} published` : "0 发布 · 待回填";
    const items = analytics.items || [];
    $("#published-body").innerHTML = items.length ? items.map(item => `
      <tr><td><strong>${esc(item.title)}</strong></td><td>${esc(item.platform || "—")}</td><td>${typeDot(item.type)}</td><td>${esc(item.publish_date || item.published_at || "—")}</td><td>${formatNumber(item.views)}</td><td>${formatPercent(item.completion_rate)}</td><td>${formatPercent(item.drop_rate)}</td><td>${formatNumber(item.likes)}</td><td>${formatPercent(item.like_rate)}</td><td>${esc(item.predicted_tier || "—")} / ${esc(item.actual_tier || "—")}</td></tr>
    `).join("") : `<tr class="skeleton-row"><td><strong>还没开始发 · 待回填</strong></td><td>—</td><td>${typeDot("—")}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>— / —</td></tr>`;
    activateFx();
  }

  function typeCompareChart(items) {
    const rows = (items || [])
      .map(item => ({
        name: item.type || item.name || "—",
        views: Number(item.median_views ?? item.value ?? 0) || 0,
        completion: numberOrNull(item.median_completion),
        drop: numberOrNull(item.median_drop),
        likeRate: numberOrNull(item.like_rate),
        count: Number(item.count || 0)
      }))
      .filter(item => item.views > 0 || item.completion !== null || item.drop !== null);
    if (!rows.length) return emptyState("暂无类型对比", "发布后按轮播类型排序");
    const max = Math.max(...rows.map(item => item.views), 1);
    const width = 680;
    const rowHeight = 46;
    const left = 116;
    const right = 220;
    const top = 28;
    const height = top + rows.length * rowHeight + 28;
    const barWidth = width - left - right;
    const content = rows.map((item, index) => {
      const y = top + index * rowHeight;
      const w = Math.max(8, item.views / max * barWidth);
      return `
        <text class="axis-label" x="${left - 12}" y="${y + 20}" text-anchor="end">${esc(item.name)}</text>
        <rect x="${left}" y="${y + 7}" width="${barWidth}" height="14" rx="7" fill="rgba(255,255,255,.07)"/>
        <rect x="${left}" y="${y + 7}" width="${w.toFixed(1)}" height="14" rx="7" fill="rgba(255,122,69,${Math.max(0.42, 1 - index * 0.1)})" class="glow-line"/>
        <text class="axis-label" x="${left + barWidth + 12}" y="${y + 17}">${formatNumber(item.views)} · ${item.count}条</text>
        <text class="axis-label" x="${left + barWidth + 12}" y="${y + 34}">完播 ${formatPercent(item.completion)} / 跳出 ${formatPercent(item.drop)} / 赞播 ${formatPercent(item.likeRate)}</text>
      `;
    }).join("");
    return `<svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="类型轮播对比">${content}</svg>`;
  }

  function methodTags(tags = []) {
    return tags.length ? tags.slice(0, 4).map(tag => `<span>#${esc(tag)}</span>`).join("") : `<span>未标注</span>`;
  }

  function methodBadgeClass(category) {
    if (category === "运营·商业") return "biz";
    if (category === "赚钱方法") return "money";
    if (category === "低粉爆款") return "low-hit";
    return "creative";
  }

  function methodCardHTML(item, reveal = false) {
    return `
      <article class="method-card" ${reveal ? "data-reveal " : ""}data-method-index="${item.__index}">
        <div class="method-card-top">
          <span class="method-badge ${methodBadgeClass(item.category)}">${esc(item.category || "方法论")}</span>
          <span class="method-updated">更新 ${esc(item.updated || "—")}</span>
        </div>
        <h3>${esc(item.title || "未命名方法论")}</h3>
        <p>${esc(item.summary || "暂无摘要，点开阅读全文。")}</p>
        <div class="method-tags">${methodTags(item.tags || [])}</div>
        <button class="method-open" type="button" data-method-index="${item.__index}">查看全文 →</button>
      </article>
    `;
  }

  function renderMethodGrid(items, category = "全部", reveal = false) {
    /* reveal 只给首屏初次渲染；筛选重绘直接可见，避免二次入场闪烁 */
    const rows = category === "全部" ? items : items.filter(item => item.category === category);
    $("#method-grid").innerHTML = rows.length ? rows.map(item => methodCardHTML(item, reveal)).join("") : emptyState("没有这个分类的方法论");
  }

  /* ── modal 开合通用实现（弹药库方法论 modal 与 cheat 稿件履历 modal 共用）──
     240ms 缩放 + 淡入（CSS transition），关闭反向后再置 hidden。
     双 rAF：先应用初态（scale .92 / opacity 0），下一帧再进入 .is-open 触发过渡。 */
  const modalCloseTimers = {};

  function openModalShell(selector) {
    const modal = $(selector);
    if (!modal) return null;
    window.clearTimeout(modalCloseTimers[selector]);
    modal.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add("is-open")));
    document.body.classList.add("modal-open");
    return modal;
  }

  function closeModalShell(selector) {
    const modal = $(selector);
    if (!modal || modal.hidden) return false;
    modal.classList.remove("is-open");
    window.clearTimeout(modalCloseTimers[selector]);
    modalCloseTimers[selector] = window.setTimeout(() => { modal.hidden = true; }, 240);
    document.body.classList.remove("modal-open");
    return true;
  }

  function openMethodModal(item) {
    const modal = $("#method-modal");
    if (!modal || !item) return;
    $("#method-modal-category").textContent = item.category || "方法论";
    $("#method-modal-category").className = `method-badge ${methodBadgeClass(item.category)}`;
    $("#method-modal-updated").textContent = `更新 ${item.updated || "—"}`;
    $("#method-modal-title").textContent = item.title || "未命名方法论";
    $("#method-modal-body").innerHTML = item.body_html || "<p>暂无正文。</p>";
    const source = $("#method-modal-source");
    const path = item.source_path || item.path || "";
    source.href = path ? `obsidian://open?path=${encodeURIComponent(path)}` : "#";
    source.hidden = !path;
    openModalShell("#method-modal");
  }

  function closeMethodModal() {
    closeModalShell("#method-modal");
  }

  function setupMethodLibrary(items) {
    const categories = ["全部", ...Array.from(new Set(items.map(item => item.category || "方法论")))];
    const filter = $("#method-filter");
    filter.innerHTML = categories.map((category, index) => `<button class="filter ${index === 0 ? "on" : ""}" type="button" data-method-filter="${esc(category)}" aria-pressed="${index === 0 ? "true" : "false"}">${esc(category)}</button>`).join("");
    renderMethodGrid(items, "全部", true);
    filter.addEventListener("click", event => {
      const button = event.target.closest("[data-method-filter]");
      if (!button) return;
      filter.querySelectorAll("button").forEach(node => {
        const active = node === button;
        node.classList.toggle("on", active);
        node.setAttribute("aria-pressed", active ? "true" : "false");
      });
      renderMethodGrid(items, button.dataset.methodFilter || "全部");
    });
    $("#method-grid").addEventListener("click", event => {
      const trigger = event.target.closest("[data-method-index]");
      if (!trigger) return;
      openMethodModal(items[Number(trigger.dataset.methodIndex)]);
    });
    $("#method-modal")?.addEventListener("click", event => {
      if (event.target.closest("[data-close-method]")) closeMethodModal();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMethodModal();
    });
    const hashMatch = window.location.hash.match(/^#method-(\d+)$/);
    if (hashMatch) openMethodModal(items[Number(hashMatch[1])]);
  }

  function ammoIcon(category) {
    return { "概念": "◎", "金句": "❝", "案例": "▣", "爆款": "◆", "研究": "⌁" }[category] || "·";
  }

  /* 素材分类 → 磁贴内嵌流体条带的色板（低配小面积，--fluid-alpha 页内降档） */
  function ammoFluid(category) {
    return { "概念": "steel", "金句": "violet", "案例": "moss", "爆款": "ember", "研究": "teal" }[category] || "mono";
  }

  function renderAmmoTiles(library) {
    const categories = library.categories || [];
    $("#ammo-grid").innerHTML = categories.length ? categories.map(category => `
      <article class="ammo-tile" data-reveal>
        <div class="ammo-fluid fx-fluid" data-fluid="${esc(ammoFluid(category.name))}" aria-hidden="true"></div>
        <div class="ammo-top"><span class="ammo-icon">${esc(ammoIcon(category.name))}</span><div><h3>${esc(category.name)}</h3><b>${esc(category.count || 0)} 条</b></div></div>
        <p>${esc(category.usage || "用于补充内容生产弹药。")}</p>
        <div class="ammo-items">
          ${(category.items || []).slice(0, 4).map(item => `<div><span>${esc(item.title)}</span><em>${esc(item.status || item.created || "—")}</em></div>`).join("")}
        </div>
      </article>
    `).join("") : emptyState("素材库为空", "往 02-素材库 添加 Markdown 后自动出现");
  }

  function renderLibrary(data) {
    const library = data.library || {};
    const methods = data.methodology || {};
    const summary = methods.summary || {};
    const methodItems = (methods.items || []).map((item, index) => ({ ...item, __index: index }));
    $("#page-hero").innerHTML = heroHTML(data, "library", "弹药库", "方法论是主角：选题、文案、运营判断都能点开读全文；素材只负责补证据和套结构。");
    $("#library-kpis").innerHTML = kpiHTML([
      { label: "方法论", value: summary.total || 0, note: "主库 · 可点开全文", hot: true },
      { label: "创作", value: summary.creative_count || 0, note: "选题/标题/SOP" },
      { label: "运营商业", value: summary.business_count || 0, note: "商业/流量经验" },
      { label: "赚钱方法", value: summary.money_count || 0, note: "外部案例原文" },
      { label: "低粉爆款", value: summary.low_follower_hit_count || 0, note: "选题/文案样本" },
      { label: "素材", value: library.summary?.total || 0, note: "次要弹药" }
    ], "gold");
    setupMethodLibrary(methodItems);
    renderAmmoTiles(library);
    activateFx();
  }

  /* ── 剪贴板：navigator.clipboard 优先，失败退回临时 textarea + execCommand ── */
  function copyTextFallback(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (error) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  function markCopied(button) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.classList.add("copied");
    button.textContent = "已复制";
    window.setTimeout(() => {
      button.classList.remove("copied");
      button.textContent = button.dataset.label;
    }, 1400);
  }

  function setupCopyButtons() {
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-copy]");
      if (!button) return;
      event.preventDefault();
      const text = button.dataset.copy || "";
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => markCopied(button)).catch(() => {
          if (copyTextFallback(text)) markCopied(button);
        });
      } else if (copyTextFallback(text)) {
        markCopied(button);
      }
    });
  }

  function copyBtnHTML(label, command, primary = false) {
    return `<button type="button" class="copy-btn ${primary ? "primary" : ""}" data-copy="${esc(command)}" title="复制指令：${esc(command)}">${esc(label)}</button>`;
  }

  /* ── 稿件阶段徽章（对应 build.py workbench_stage 状态机） ── */
  const STAGE_META = {
    draft: { label: "草稿", cls: "st-draft" },
    reviewed: { label: "已诊断", cls: "st-reviewed" },
    predicted: { label: "已盲测", cls: "st-predicted" },
    published: { label: "已发布", cls: "st-published" },
    retro_pending: { label: "待复盘", cls: "st-pending" },
    retro_done: { label: "已复盘", cls: "st-done" }
  };

  function stageBadge(stage) {
    const meta = STAGE_META[stage] || { label: stage || "—", cls: "" };
    return `<span class="stage-badge ${meta.cls}">${esc(meta.label)}</span>`;
  }

  const DIM_ORDER = ["ER", "SR", "HP", "QL", "NA", "AB", "SAT"];
  /* SAT = Satire Depth 讽刺深度（rubric_notes.md v0 真源）。CLAUDE.md 写的「满足感」是文档层错误，见 rubric 面板告警条。 */
  const DIM_LABELS = { ER: "情绪", SR: "社会", HP: "钩子", QL: "金句", NA: "叙事", AB: "广度", SAT: "讽刺" };

  /* ── 7 维柱（v0 等权 · 每维 0–5）──
     公式顺序即显示顺序：(ER + HP + QL + NA + AB + SR + SAT) / 7 × 2.0 */
  const DIM7_ORDER = ["ER", "HP", "QL", "NA", "AB", "SR", "SAT"];
  const DIM7_CN = { ER: "情感共鸣", HP: "钩子强度", QL: "金句密度", NA: "叙事性", AB: "受众广度", SR: "社会共振", SAT: "讽刺深度" };
  const DIM7_EN = {
    ER: "Emotional Resonance", HP: "Hook Potential", QL: "Quotable Lines", NA: "Narrativity",
    AB: "Audience Breadth", SR: "Social Resonance", SAT: "Satire Depth"
  };
  const DIM_SCALE_MAX = 5;

  /* 从 predictions header 的 `User Override` 原文里抽出「SAT 1→3」这类裁定 */
  function parseDimOverrides(text) {
    const map = {};
    if (!text || /^无/.test(String(text).trim())) return map;
    const re = /\b(ER|HP|QL|NA|AB|SR|SAT)\s*(\d)\s*(?:→|->|➜)\s*(\d)/g;
    let match = re.exec(String(text));
    while (match) {
      map[match[1]] = { from: Number(match[2]), to: Number(match[3]) };
      match = re.exec(String(text));
    }
    return map;
  }

  function dimScoreOf(entry) {
    if (entry && typeof entry === "object") return Number(entry.score ?? 0);
    return Number(entry ?? 0);
  }

  const DIM_TIP_STYLE = "position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);"
    + "width:210px;max-width:60vw;padding:8px 10px;text-align:left;z-index:6;"
    + "background:#0d1013;border:1px solid #272e38;border-radius:9px;box-shadow:0 10px 28px rgba(0,0,0,.55);"
    + "font-size:12px;line-height:1.7;color:var(--ink2)";
  const DIM_OVR_STYLE = "position:absolute;top:-6px;right:-4px;z-index:3;padding:1px 5px;border-radius:4px;"
    + "font-family:var(--disp);font-size:11px;line-height:1.3;font-weight:600;"
    + "color:var(--real);border:1px solid rgba(232,163,61,.55);background:rgba(232,163,61,.12);white-space:nowrap";
  /* 被用户裁定覆写的维度：柱身加 45° 斜纹，与盲评原分区分开 */
  const DIM_STRIPE = "repeating-linear-gradient(45deg,rgba(0,0,0,0) 0 4px,rgba(255,255,255,.28) 4px 7px)";

  /* dims 可以是 {DIM: score} 或 {DIM: {score, confidence, reason}} 两种形态 */
  function dimBarsHTML(dims = {}, options = {}) {
    const detail = dims || {};
    if (!Object.keys(detail).length) return "";
    const overrides = options.override || {};
    return `<div class="dims">${DIM7_ORDER.map(dim => {
      const entry = detail[dim];
      const score = dimScoreOf(entry);
      const meta = entry && typeof entry === "object" ? entry : {};
      const cn = meta.name_cn || DIM7_CN[dim] || dim;
      const ovr = overrides[dim];
      const tipBits = [];
      if (meta.confidence) tipBits.push(`<b style="color:var(--ink)">confidence ${esc(meta.confidence)}</b>`);
      if (meta.reason) tipBits.push(esc(meta.reason));
      if (ovr) tipBits.push(`<b style="color:var(--real)">用户裁定 ${ovr.from}→${ovr.to}${meta.source_version ? `（${esc(meta.source_version)}）` : ""}</b>`);
      const tip = tipBits.length
        ? `<div class="dim-tip" hidden style="${DIM_TIP_STYLE}">${tipBits.join("<br>")}</div>`
        : "";
      const plain = `${dim} ${cn} ${score}/5${meta.confidence ? ` · confidence ${meta.confidence}` : ""}${meta.reason ? ` · ${meta.reason}` : ""}`;
      return `<div class="dim" style="position:relative"${tip ? ` data-dim-tip tabindex="0"` : ""} title="${esc(plain)}">
        <div class="dim-track">
          <div class="dim-fill ${score >= 4 ? "hi" : score <= 2 ? "lo" : ""}" style="height:${score / DIM_SCALE_MAX * 100}%${ovr ? `;background-image:${DIM_STRIPE}` : ""}"></div>
          ${ovr ? `<span style="${DIM_OVR_STYLE}">override ${ovr.from}→${ovr.to}</span>` : ""}
        </div>
        <div class="dim-v">${score}</div>
        <div class="dim-k">${esc(dim)}<i>${esc(cn)}</i></div>
        ${tip}
      </div>`;
    }).join("")}</div>`;
  }

  /* hover / 键盘聚焦 / 点击 三路展开维度的 confidence + reason（无额外 CSS，靠内联样式） */
  function setupDimTips() {
    const toggle = (node, show) => {
      const tip = node.querySelector(".dim-tip");
      if (tip) tip.hidden = !show;
    };
    document.addEventListener("mouseover", event => {
      const node = event.target.closest?.("[data-dim-tip]");
      if (node) toggle(node, true);
    });
    document.addEventListener("mouseout", event => {
      const node = event.target.closest?.("[data-dim-tip]");
      if (node && !node.contains(event.relatedTarget)) toggle(node, false);
    });
    document.addEventListener("focusin", event => {
      const node = event.target.closest?.("[data-dim-tip]");
      if (node) toggle(node, true);
    });
    document.addEventListener("focusout", event => {
      const node = event.target.closest?.("[data-dim-tip]");
      if (node) toggle(node, false);
    });
    document.addEventListener("click", event => {
      const node = event.target.closest?.("[data-dim-tip]");
      if (!node) return;
      const tip = node.querySelector(".dim-tip");
      if (tip) tip.hidden = !tip.hidden;
    });
  }

  function bucketChartHTML(buckets = []) {
    if (!buckets.length) return emptyState("暂无押注分布");
    const max = Math.max(...buckets.map(bucket => bucket.prob), 1);
    return `<div class="bkts">${buckets.map(bucket => `
      <div class="bkt ${bucket.prob === max ? "on" : ""}">
        <div class="bkt-track"><div class="bkt-fill" style="height:${bucket.prob / max * 100}%"></div></div>
        <div class="bkt-p">${bucket.prob}%</div>
        <div class="bkt-r">${esc(bucket.ratio)}</div>
        <div class="bkt-n">${esc(bucket.plays)}</div>
      </div>
    `).join("")}</div>`;
  }

  function radarChartHTML(disagreement = []) {
    if (disagreement.length < 3) return "";
    const cx = 150;
    const cy = 128;
    const radius = 92;
    const count = disagreement.length;
    const point = (index, value) => {
      const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
      const r = radius * Math.max(0, Math.min(5, value)) / 5;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    };
    const ringPath = level => disagreement.map((_, index) => {
      const [x, y] = point(index, level);
      return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ") + " Z";
    const poly = key => disagreement.map((row, index) => {
      const [x, y] = point(index, Number(row[key] ?? 0));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const spokes = disagreement.map((row, index) => {
      const [x, y] = point(index, 5);
      const [lx, ly] = point(index, 6.15);
      return `
        <line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line2)" stroke-width="1"/>
        <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle"
          class="radar-lab">${esc(row.dim)}<tspan x="${lx.toFixed(1)}" dy="11" class="radar-sub">${esc(DIM_LABELS[row.dim] || "")}</tspan></text>`;
    }).join("");
    const dots = key => disagreement.map((row, index) => {
      const [x, y] = point(index, Number(row[key] ?? 0));
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" class="radar-dot ${key}"/>`;
    }).join("");
    return `
      <svg viewBox="0 0 300 268" class="radar" role="img" aria-label="盲评 vs 主评 7 维雷达">
        ${[1, 2, 3, 4, 5].map(level => `<path d="${ringPath(level)}" fill="none" stroke="var(--line2)" stroke-width="${level === 5 ? 1.2 : 0.7}"/>`).join("")}
        ${spokes}
        <polygon points="${poly("self")}" fill="rgba(232,163,61,.14)" stroke="var(--real)" stroke-width="1.6"/>
        <polygon points="${poly("blind")}" fill="rgba(91,141,239,.16)" stroke="var(--pred)" stroke-width="1.8"/>
        ${dots("self")}${dots("blind")}
      </svg>`;
  }

  function disagreementHTML(disagreement = []) {
    if (!disagreement.length) return "";
    const worst = [...disagreement].sort((a, b) =>
      Math.abs((b.blind ?? 0) - (b.self ?? 0)) - Math.abs((a.blind ?? 0) - (a.self ?? 0)))[0];
    const worstDelta = Math.abs((worst.blind ?? 0) - (worst.self ?? 0));
    const deltaChips = disagreement.map(row => {
      const delta = Math.abs(Number(row.blind ?? 0) - Number(row.self ?? 0));
      return `<span class="dis-chip ${delta >= 2 ? "hot" : delta ? "" : "eq"}">${esc(row.dim)} ${delta ? `Δ${delta}` : "="}</span>`;
    }).join("");
    return `
      <div class="dis-legend"><span><i class="blind"></i>盲评（隔离子 agent）</span><span><i class="self"></i>主 Claude 自估</span></div>
      ${radarChartHTML(disagreement)}
      <div class="dis-chips">${deltaChips}</div>
      ${worstDelta >= 2 ? `<div class="bet-note">最大分歧 <b>${esc(worst.dim)}（Δ${worstDelta}）</b>——${esc(worst.decided_as ? `裁定 ${worst.decided_as}` : "已按盲评采纳")}。分歧本身就是校准数据：哪边更准，等实绩来判。</div>` : ""}`;
  }

  /* ── 校准循环状态条：五站横排，第一个卡点标红 ── */
  function renderLoopbar(data) {
    const cheat = data.cheat || {};
    const wb = cheat.workbench || [];
    const preds = cheat.predictions || [];
    const scored = wb.filter(item => (item.scores?.self ?? null) !== null || (item.scores?.blind ?? null) !== null).length;
    const blindTested = preds.filter(item => !item.retro_only).length;
    const published = wb.filter(item => item.published).length;
    const pending = preds.filter(item => item.retro_pending).length + (cheat.pending_retros || []).length;
    const samples = cheat.calibration_samples || 0;
    const stations = [
      { name: "评分", count: scored, note: "已评分稿件", blocked: scored === 0, hint: "说「打分这篇」起步" },
      { name: "盲测", count: blindTested, note: "已盲测预测", blocked: blindTested === 0, hint: "说「盲测」写预测日志" },
      { name: "发布", count: published, note: "已发布", blocked: published === 0, hint: "说「已发布 [url]」登记" },
      { name: "复盘", count: pending, note: "待复盘 T+3d", blocked: pending > 0, hint: "说「复盘 [path]」回收数据" },
      { name: "迭代", count: cheat.rubric_version || "v0", note: `${samples} 个校准样本`, blocked: samples === 0, hint: "满 5 个配对才可信" }
    ];
    const blockedIndex = stations.findIndex(station => station.blocked);
    $("#cheat-loop-chip").textContent = blockedIndex >= 0 ? `当前卡点：${stations[blockedIndex].name}` : "循环畅通";
    $("#cheat-loopbar").innerHTML = stations.map((station, index) => `
      ${index ? `<span class="loop-arrow">→</span>` : ""}
      <div class="loop-station ${index === blockedIndex ? "blocked" : ""}">
        ${index === blockedIndex ? `<span class="ls-dot"></span>` : ""}
        <div class="ls-name">${esc(station.name)}</div>
        <div class="ls-count">${esc(String(station.count))}</div>
        <div class="ls-note">${esc(station.note)}</div>
        ${index === blockedIndex ? `<div class="ls-hint">${esc(station.hint)}</div>` : ""}
      </div>`).join("");
  }

  /* ── 稿件档案：workbench 行 + 展开详情 ── */
  function reviewDetailHTML(review) {
    const issues = (review.issues || []).map(issue => `
      <div class="iss-line">
        <span class="iss-id ${priorityClass(issue.priority)}">${esc(issue.id)}</span>
        <span class="iss-prob">${esc(issue.problem)}</span>
        <span class="iss-st ${/待/.test(issue.status) ? "open" : "done"}">${esc(issue.status)}</span>
      </div>`).join("");
    const strip = (review.pacing || []).length ? `
      <div class="strip12">${review.pacing.map(cell => `<div class="s12 ${cell.level}" title="刻度${cell.idx} ${esc(cell.time)} · ${esc(cell.content)} · ${esc(cell.verdict)}"><span>${cell.idx}</span></div>`).join("")}</div>
      <div class="strip-cap">12 刻度节奏审计 · <i class="lg ok"></i>有效 <i class="lg warn"></i>体感慢预警 <i class="lg cold"></i>冷区</div>` : "";
    return `
      <div class="rev-detail">
        <div class="pred-meta"><span>${esc(review.created || "—")}</span><span>${esc(review.status || "")}</span><span>${esc(review.file)}</span>${review.issue_total ? `<span>${review.issue_open}/${review.issue_total} 待修</span>` : ""}</div>
        ${strip}
        ${issues ? `<div class="iss-list">${issues}</div>` : ""}
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════════════════
     稿件履历 Dossier（§3）
     8 站：① 草稿 ② 诊断 ③ 盲评 v1 ④ 重判 v2 ⑤ 拍摄 ⑥ 发布 ⑦ T+3 复盘 ⑧ rubric 去向
     四态（+n/a）进度条吸顶；逐站字段按 §3.2 全渲染；④/⑤ 之间插发布后分界带。
     盲评隔离（§6.1）：指令按钮只出现在 status==="current" 的站；③④ 的押注表
     不渲染实绩落点（那属于发布后信息，只在 ⑦ 站出现）。
     ══════════════════════════════════════════════════════════════════════ */
  const DSR_STATES = ["done", "current", "pending", "skipped", "na"];
  const DOC_DIVIDER_HTML = `<div class="doc-divider">以下为发布后信息 · 盲评通道不可见</div>`;

  function dsrState(status) {
    return DSR_STATES.includes(status) ? status : "pending";
  }

  function mono(value) {
    return `<span style="font-family:var(--disp)">${esc(value)}</span>`;
  }

  function exactNumber(value, dash = "—") {
    const number = numberOrNull(value);
    if (number === null) return dash;
    return Number.isInteger(number) ? number.toLocaleString("en-US") : String(number);
  }

  /* rows: [label, htmlValue]；值已是 HTML，调用方负责 esc */
  function kvHTML(rows = []) {
    const body = rows
      .filter(row => row && row[1] !== null && row[1] !== undefined && row[1] !== "")
      .map(row => `<dt>${esc(row[0])}</dt><dd>${row[1]}</dd>`)
      .join("");
    /* 复用 .pat-field 的排版，但标签列放宽到 96px：content_form / BlindScored By 这类长键名不换行 */
    return body ? `<dl class="pat-field" style="grid-template-columns:96px minmax(0,1fr);gap:5px 14px">${body}</dl>` : "";
  }

  /* §7.5 空态：一行紧凑「现状 · 下一步指令」，不放按钮（§6.1 禁令 2） */
  function emptyLineHTML(hint) {
    const raw = String(hint || "").trim();
    if (!raw) return `<div class="empty-line"><b>未到达</b> · 这一站还没有数据</div>`;
    const cut = raw.indexOf(" · ");
    const head = cut > 0 ? raw.slice(0, cut) : raw;
    let tail = cut > 0 ? raw.slice(cut + 3) : "";
    const isCommand = /^\[复制\]\s*/.test(tail);
    tail = tail.replace(/^\[复制\]\s*/, "");
    const tailHTML = isCommand ? `下一步指令 <code>${esc(tail)}</code>` : esc(tail);
    return `<div class="empty-line"><b>${esc(head)}</b>${tail ? ` · ${tailHTML}` : ""}</div>`;
  }

  function bulletsHTML(items = [], marker = "") {
    const rows = (items || []).filter(Boolean);
    if (!rows.length) return "";
    return `<ul>${rows.map(text => `<li>${marker ? `${marker} ` : ""}${esc(text)}</li>`).join("")}</ul>`;
  }

  function dossierRailHTML(dossier = [], options = {}) {
    if (!(dossier || []).length) return "";
    const mini = options.mini === true;
    const clickable = options.clickable === true;
    const nodes = dossier.map(station => {
      const state = dsrState(station.status);
      const sup = state === "skipped" ? `<sup>跳过</sup>` : state === "na" ? `<sup>n/a</sup>` : "";
      const tips = [station.label || station.stage, station.at, station.empty_hint].filter(Boolean).join(" · ");
      return `<div class="dsr-node ${state}"${clickable ? ` data-goto-stage="${esc(station.stage)}" style="cursor:pointer"` : ""} title="${esc(tips)}">
        <span class="dsr-dot"></span>
        <span class="dsr-label">${esc(station.label || station.stage)}${sup}</span>
      </div>`;
    }).join("");
    return `<div class="dossier-rail${mini ? " mini" : ""}">${nodes}</div>`;
  }

  function dossierNowChipHTML(dossier = []) {
    const current = (dossier || []).find(station => station.status === "current");
    if (current) return `<span class="dsr-now">当前：${esc(current.label)} 待处理</span>`;
    const done = (dossier || []).filter(station => station.status === "done");
    const last = done[done.length - 1];
    return last ? `<span class="dsr-now">当前：${esc(last.label)}已完成</span>` : "";
  }

  /* ── ① 草稿 ─────────────────────────────────────────────── */
  function stageDraftHTML(f) {
    const platform = Array.isArray(f.platform) ? f.platform.join(" / ") : f.platform;
    const changelog = (f.changelog || []).length
      ? `<div class="wb-cap" style="margin-top:10px">稿内 changelog</div>
         <table><thead><tr><th>版本</th><th>日期</th><th>改动</th></tr></thead><tbody>
         ${f.changelog.map(row => `<tr><td style="font-family:var(--disp);color:var(--ink)">${esc(row.version)}</td><td style="font-family:var(--disp)">${esc(row.date || "—")}</td><td>${row.label ? `<b style="color:var(--ink)">${esc(row.label)}</b><br>` : ""}${esc(row.change || "")}</td></tr>`).join("")}
         </tbody></table>`
      : `<div class="note-bar">无版本记录</div>`;
    return `
      ${kvHTML([
        ["稿件标题", esc(f.title)],
        ["文件名", mono(f.file)],
        ["created", esc(f.created || "—")],
        ["status", esc(f.status || "—")],
        ["stage", esc(f.stage || "—")],
        ["source", esc(f.source || "—")],
        ["内容类型", esc(f.content_type || "—")],
        ["时长", esc(f.duration || "—")],
        ["content_form", mono(f.content_form || "—")],
        ["平台", esc(platform || "—")],
        ["字数 / 段数", `${exactNumber(f.word_count)} 字 · ${exactNumber(f.section_count)} 段`]
      ])}
      ${f.topic_card ? `<div class="note-bar">选题卡 <b>${esc(f.topic_card)}</b> · <a href="obsidian://open?file=${encodeURIComponent(f.topic_card)}">在 Obsidian 打开 →</a></div>` : ""}
      ${changelog}`;
  }

  /* ── ② 诊断 ─────────────────────────────────────────────── */
  function stageReviewHTML(f, station) {
    if (!f || !Object.keys(f).length) return emptyLineHTML(station.empty_hint);
    const flow = String(f.analysis_flow || "").split(/\s*(?:->|→)\s*/).filter(Boolean);
    const byPriority = f.issue_by_priority || {};
    const priorityBits = Object.keys(byPriority).map(key => `<span class="chip">${esc(key)} ${byPriority[key]}</span>`).join("");
    const issues = (f.issues || []).map(issue => `
      <div class="iss-line">
        <span class="iss-id ${priorityClass(issue.priority)}">${esc(issue.id)}</span>
        <span class="iss-prob">${esc(issue.problem)}</span>
        <span class="iss-st ${/待/.test(issue.status || "") ? "open" : "done"}">${esc(issue.status || "—")}</span>
      </div>`).join("");
    const strip = (f.pacing || []).length ? `
      <div class="wb-cap" style="margin-top:10px">12 刻度节奏审计</div>
      <div class="strip12">${f.pacing.map(cell => `<div class="s12 ${esc(cell.level || "")}" title="刻度${cell.idx} ${esc(cell.time)} · ${esc(cell.content)} · ${esc(cell.verdict)}"><span>${cell.idx}</span></div>`).join("")}</div>
      <div class="strip-cap">冷区 ${f.cold_zones ?? 0} 处 · <i class="lg ok"></i>有效 <i class="lg warn"></i>体感慢预警 <i class="lg cold"></i>冷区</div>` : "";
    return `
      ${kvHTML([
        ["review 文件", (f.files || []).map(file => mono(file)).join("<br>")],
        ["轮次", f.count ? `${f.count} 轮` : ""],
        ["baseline", f.baseline_score !== null && f.baseline_score !== undefined
          ? `<b style="color:var(--ink);font-family:var(--disp)">${esc(f.baseline_score)}</b> <span class="bench-tag">${esc(f.baseline_source || "dbs 诊断")} · ${esc(station.at || "—")}</span>` : ""],
        ["analysis_flow", flow.length ? flow.map(step => `<span class="sig-chip">${esc(step)}</span>`).join(" ") : ""],
        ["完成检查", `${f.checklist_done ?? 0}/${f.checklist_total ?? 0} 已勾`]
      ])}
      <div class="note-bar">baseline_score 与盲评 composite 是<b>同稿不同时点、不同流程</b>（cheat-score 探索 vs blind 预测），并列时各自挂来源标签，不可读成掉分。</div>
      <div class="wb-cap" style="margin-top:10px">问题清单 · ${f.issue_open ?? 0}/${f.issue_total ?? 0} 待修 ${priorityBits}</div>
      ${issues ? `<div class="iss-list">${issues}</div>` : `<div class="empty-line"><b>无问题条目</b></div>`}
      ${strip}`;
  }

  /* ── 通道审计子卡（③④ 共用） ───────────────────────────── */
  function channelAuditHTML(f) {
    const blindOk = /^confirmed_no_data_seen/.test(String(f.blind_status || ""));
    return `
      <div class="icard" style="margin-top:10px">
        <div class="icard-head">
          <span class="icard-title" style="font-size:14px">通道审计</span>
          <span class="ch-tag ch-a">A 主对话</span>
          <span class="ch-tag ch-b">B 盲评 sub-agent</span>
        </div>
        ${kvHTML([
          ["Scored By", mono(f.scored_by || "—")],
          ["BlindScored By", mono(f.blind_scored_by || "—")],
          ["Blind Status", `${blindOk ? `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#5cb874;margin-right:6px"></i>` : ""}${esc(f.blind_status || "—")}`],
          ["User Override", esc(f.user_override || "—")]
        ])}
      </div>`;
  }

  function dimTableHTML(dimsDetail = {}) {
    const rows = DIM7_ORDER.filter(dim => dimsDetail[dim]).map(dim => {
      const entry = dimsDetail[dim] || {};
      return `<tr>
        <td style="font-family:var(--disp);color:var(--ink);font-weight:700">${esc(dim)}<br><span style="font-family:var(--han);font-size:12px;font-weight:400;color:var(--ink3)">${esc(entry.name_cn || DIM7_CN[dim] || "")}</span></td>
        <td style="font-family:var(--disp);font-size:15px;font-weight:700;color:var(--ink)">${dimScoreOf(entry)}<span style="font-size:12px;color:var(--ink3)"> /5</span></td>
        <td>${esc(entry.confidence || "—")}</td>
        <td>${esc(entry.reason || "—")}</td>
      </tr>`;
    }).join("");
    return rows ? `<table><thead><tr><th>维度</th><th>分数</th><th>confidence</th><th>理由</th></tr></thead><tbody>${rows}</tbody></table>` : "";
  }

  function disagreementChipsHTML(list = []) {
    if (!(list || []).length) return "";
    const chips = list.map(row => {
      const delta = Math.abs(Number(row.blind ?? 0) - Number(row.self ?? 0));
      const title = `盲评 ${row.blind} · 主 Claude ${row.self} · Δ${delta}${row.decided_as ? ` · 裁定 ${row.decided_as}` : ""}`;
      return `<span class="dis-chip ${delta >= 2 ? "hot" : delta ? "" : "eq"}" title="${esc(title)}">${esc(row.dim)} 盲${row.blind}/主${row.self} ${delta ? `Δ${delta}` : "="}</span>`;
    }).join("");
    return `<div class="wb-cap" style="margin-top:10px">BlindScore Disagreement</div><div class="dis-chips">${chips}</div>`;
  }

  function bucketTableHTML(buckets = [], options = {}) {
    if (!(buckets || []).length) return "";
    const showHit = options.showHit === true;
    const rows = buckets.map(bucket => {
      const hit = showHit && bucket.hit === true;
      return `<tr${hit ? ` style="background:rgba(232,163,61,.12)"` : ""}>
        <td style="font-family:var(--disp);font-weight:700;color:${hit ? "var(--real)" : "var(--ink)"}">${esc(bucket.label)}</td>
        <td style="font-family:var(--disp)">${esc(bucket.plays || bucket.range || "—")}</td>
        <td style="font-family:var(--disp)">${bucket.prob === null || bucket.prob === undefined ? "—" : `${bucket.prob}%`}</td>
        ${showHit ? `<td>${hit ? `<b style="color:var(--real)">实绩落此档</b>` : "—"}</td>` : ""}
      </tr>`;
    }).join("");
    return `<table><thead><tr><th>档</th><th>范围</th><th>先验概率</th>${showHit ? "<th>落点</th>" : ""}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function counterfactualsHTML(list = []) {
    if (!(list || []).length) return "";
    return `<div class="wb-cap" style="margin-top:10px">反事实场景</div>
      <ul>${list.map(row => `<li><b style="color:var(--ink)">${esc(row.bucket)}</b> → ${esc(row.implication)}</li>`).join("")}</ul>`;
  }

  function assumptionsHTML(list = []) {
    if (!(list || []).length) return "";
    return `<div class="wb-cap" style="margin-top:10px">关键校准假设</div>
      ${list.map(row => `
        <div class="icard" style="margin:8px 0">
          <div class="icard-head"><span class="rubric-code">假设 ${esc(row.n)}</span>${row.verdict ? `<span class="bench-tag">${esc(row.verdict)}</span>` : ""}</div>
          <p class="rubric-desc">${esc(row.claim)}</p>
          ${kvHTML([
            ["阈值", row.threshold ? mono(row.threshold) : ""],
            ["对照样本", row.anchor ? esc(row.anchor) : ""],
            ["防污染", row.anti_contamination ? esc(row.anti_contamination) : ""]
          ])}
        </div>`).join("")}`;
  }

  /* ── ③ 盲评 v1 / ④ 重判 v2 ──────────────────────────────── */
  function stagePredictHTML(f, station, version) {
    if (!f || !Object.keys(f).length) return emptyLineHTML(station.empty_hint);
    const overrides = parseDimOverrides(f.user_override);
    const isV2 = version === "v2";
    const head = kvHTML([
      ["Predicted At", esc(f.predicted_at || "—")],
      ["Rubric Version", esc(f.rubric_version || "—")],
      ["Prediction Basis", mono(f.basis || "—")],
      ["Calibration", `${esc(f.calibration_samples ?? "—")} <span class="bench-tag">${esc(f.calibration_note || "写预测时")}</span>`],
      ["Confidence", esc(f.confidence || "—")],
      ["Script Path", mono(f.script_path || "—")],
      ["Script Hash", isV2 && f.v1_script_hash
        ? `${mono(f.script_hash || "—")} <span style="color:var(--ink3)">（v2）</span> · ${mono(f.v1_script_hash)} <span style="color:var(--ink3)">（v1）</span>`
        : mono(f.script_hash || "—")]
    ]);
    const v2Only = !isV2 ? "" : `
      ${kvHTML([
        ["重判触发", esc(f.trigger || "—")],
        ["composite", `<b style="font-family:var(--disp);color:var(--ink)">${esc(f.v1_composite || "—")}</b> → <b style="font-family:var(--disp);color:var(--ink)">${esc(f.composite || "—")}</b>`]
      ])}
      ${f.composite_note ? `<blockquote>${esc(f.composite_note)}</blockquote>` : ""}
      ${(f.diff_rows || []).length ? `
        <div class="wb-cap" style="margin-top:10px">Diff vs v1</div>
        ${f.diff_note ? `<div class="note-bar">${esc(f.diff_note)}</div>` : ""}
        <table><thead><tr><th>稿内版本</th><th>日期</th><th>改动</th><th>影响维度</th></tr></thead><tbody>
        ${f.diff_rows.map(row => `<tr><td style="font-family:var(--disp);color:var(--ink)">${esc(row.ver)}</td><td style="font-family:var(--disp)">${esc(row.date)}</td><td>${esc(row.change)}</td><td>${esc(row.dims || "—")}</td></tr>`).join("")}
        </tbody></table>` : ""}
      ${f.archive_gap ? `<div class="alert-bar">scripts/archive 缺口：${esc(f.archive_gap)}</div>` : ""}
      <div class="wb-cap" style="margin-top:10px">v1 → v2 维度变化</div>
      ${(f.dim_deltas || []).length
        ? `<div class="dis-chips">${f.dim_deltas.map(row => {
            const up = Number(row.delta) > 0;
            return `<span class="dis-chip" style="color:${up ? "#5cb874" : "var(--amber)"};border-color:${up ? "rgba(92,184,116,.5)" : "rgba(232,163,61,.5)"}">${esc(row.dim)} ${row.v1} ${up ? "↑" : "↓"} ${row.v2}</span>`;
          }).join("")}</div>`
        : `<div class="empty-line"><b>7 维无变化</b></div>`}
      ${f.frame ? `<div class="wb-cap" style="margin-top:10px">押注框架切换</div>
        <div class="note-bar">${esc(f.frame === "ratio" ? "绝对桶 → 比率桶" : "绝对桶")}${f.baseline ? `（baseline = ${exactNumber(f.baseline)}）` : ""}</div>` : ""}
      ${f.v1_void_reason ? `<blockquote>${esc(f.v1_void_reason)}</blockquote>` : ""}
      ${f.contamination_notice ? `<div class="wb-cap" style="margin-top:10px">⚠️ 主 Claude 通道污染声明</div><blockquote class="warn">${esc(f.contamination_notice)}</blockquote>` : ""}
      ${f.shoot_notice ? `<div class="wb-cap" style="margin-top:10px">拍摄变量声明</div><blockquote class="warn">${esc(f.shoot_notice)}</blockquote>` : ""}`;
    return `
      ${head}
      ${channelAuditHTML(f)}
      <div class="wb-cap" style="margin-top:10px">7 维分数 · 量程 0–5 · 等权</div>
      ${dimBarsHTML(f.dims_detail || {}, { override: overrides })}
      ${dimTableHTML(f.dims_detail || {})}
      ${f.composite_expr ? `<div class="wb-cap" style="margin-top:10px">composite 代入式（文件原文）</div><pre><code>${esc(f.composite_expr)}</code></pre>` : ""}
      ${disagreementChipsHTML(f.disagreement || [])}
      ${v2Only}
      <div class="wb-cap" style="margin-top:10px">押注 bucket ${esc(version)}</div>
      ${kvHTML([
        ["Headline", esc(f.headline || "—")],
        ["中枢", f.midpoint === null || f.midpoint === undefined ? "" : `<b style="font-family:var(--disp);color:var(--ink)">${exactNumber(f.midpoint)}</b>`],
        ["baseline", f.baseline === null || f.baseline === undefined ? "" : `<b style="font-family:var(--disp);color:var(--ink)">${exactNumber(f.baseline)}</b>`],
        ["框架", mono(f.frame === "ratio" ? "ratio（比率桶）" : "absolute（绝对桶）")]
      ])}
      ${bucketTableHTML(f.buckets || [], { showHit: false })}
      <div class="note-bar">押注表在预测站不标实绩落点——落点属发布后信息，只在 ⑦ T+3 复盘站渲染。</div>
      ${counterfactualsHTML(f.counterfactuals || [])}
      ${assumptionsHTML(f.assumptions || [])}`;
  }

  /* ── ⑤ 拍摄 ─────────────────────────────────────────────── */
  function stageShootHTML(f, station) {
    const hasData = f && (f.shot_at || f.script_consistency || f.shoot_script_exists);
    const note = f && f.v2_trigger_threshold
      ? `<div class="note-bar">diff 判定：V2_TRIGGER_THRESHOLD = <b>${esc(f.v2_trigger_threshold)}</b> · DIFF_METRIC = <b>${esc(f.diff_metric || "—")}</b></div>`
      : "";
    if (!hasData) {
      return `${emptyLineHTML(station.empty_hint)}
        ${f && f.video_folder ? kvHTML([["Video Folder", `<a href="obsidian://open?path=${encodeURIComponent(f.video_folder)}">${esc(f.video_folder)}</a>`]]) : ""}
        ${f && f.shoot_script_exists === false ? `<div class="note-bar">实拍稿 <b>videos/&lt;id&gt;/script.md 不存在</b> · 无实拍稿快照，写作 Pattern 无法 diff</div>` : ""}
        ${note}`;
    }
    return `
      ${kvHTML([
        ["shot_at", esc(f.shot_at || "—")],
        ["script_consistency", esc(f.script_consistency || "—")],
        ["script_diff_pct", f.script_diff_pct === null || f.script_diff_pct === undefined ? "—" : `${esc(f.script_diff_pct)}%`],
        ["v2_prediction_written", f.v2_prediction_written === null || f.v2_prediction_written === undefined ? "—" : esc(String(f.v2_prediction_written))],
        ["实拍稿", f.shoot_script_exists ? "videos/&lt;id&gt;/script.md 存在" : "videos/&lt;id&gt;/script.md <b>不存在</b>"],
        ["Video Folder", f.video_folder ? `<a href="obsidian://open?path=${encodeURIComponent(f.video_folder)}">${esc(f.video_folder)}</a>` : ""]
      ])}
      ${note}`;
  }

  /* ── ⑥ 发布 ─────────────────────────────────────────────── */
  function stagePublishHTML(f, station) {
    if (!f || !Object.keys(f).length) return emptyLineHTML(station.empty_hint || "未发布 · 等 cheat-publish 登记");
    const pendingText = value => (String(value || "").toLowerCase() === "pending"
      ? `<span style="color:var(--amber)">链接未回填（pending）</span>`
      : esc(value || "—"));
    return `
      ${kvHTML([
        ["Published at", mono(f.published_at || "未发布")],
        ["Platform", esc(f.platform || "—")],
        ["URL", pendingText(f.url)],
        ["Aweme ID", pendingText(f.aweme_id)],
        ["Video Folder", f.video_folder ? `<a href="obsidian://open?path=${encodeURIComponent(f.video_folder)}">${esc(f.video_folder)}</a>` : ""],
        ["Ad Hoc Publish", f.ad_hoc_publish ? `<span class="bench-tag" style="color:var(--real)">ad-hoc · 未走 shoot</span>` : "false"]
      ])}
      ${f.id_pending ? `<div class="note-bar">${esc(f.id_pending_note || "平台 ID 未 resolve · 无法回抓与去重")}</div>` : ""}`;
  }

  /* ── ⑦ T+3 复盘 ─────────────────────────────────────────── */
  const RETRO_METRICS = [
    ["views", "播放", ""], ["likes", "点赞", ""], ["favs", "收藏", ""], ["comments", "评论", ""],
    ["shares", "分享", ""], ["danmu", "弹幕", ""], ["duration_s", "成片", "s"], ["avg_play_s", "均播", "s"],
    ["depth_pct", "播放深度", "%"], ["completion_pct", "完播率", "%"], ["drop2s_pct", "2s 跳出", "%"],
    ["pass5s_pct", "5s 完播", "%"], ["ctr_pct", "封面 CTR", "%"]
  ];
  const RATIO_LABELS = [["like", "赞播比"], ["fav", "藏播比"], ["comment", "评播比"], ["share", "分播比"]];

  function stageRetroHTML(f, station) {
    if (!f || !Object.keys(f).length) return emptyLineHTML(station.empty_hint);
    const metrics = f.metrics || {};
    const metricRow = RETRO_METRICS.map(([key, label, unit]) => {
      const value = metrics[key];
      const shown = value === null || value === undefined ? "—" : `${exactNumber(value)}${unit}`;
      return `<span>${esc(label)}<i>${shown}</i></span>`;
    }).join("");
    const ratios = f.ratios || {};
    const ratioRow = RATIO_LABELS.map(([key, label]) => {
      const value = ratios[key];
      return `<span>${esc(label)}<i>${value === null || value === undefined ? "—" : `${value}%`}</i></span>`;
    }).join("");
    const funnelSteps = (f.funnel || []).filter(step => step.pct !== null && step.pct !== undefined);
    const bet = f.bet_detail || {};
    const hitBucket = (f.buckets || []).find(bucket => bucket.hit === true);
    const views = numberOrNull(metrics.views);
    const readBits = [];
    if (views !== null) readBits.push(`实播 <b style="color:var(--real)">${exactNumber(views)}</b>`);
    if (hitBucket) readBits.push(`落 <b>${esc(hitBucket.label)}</b> 桶`);
    if (views !== null && bet.baseline) readBits.push(`baseline 的 <b>${(views / bet.baseline).toFixed(3)}×</b>`);
    if (views !== null && bet.midpoint) readBits.push(`相对中枢 <b>${Math.round((views / bet.midpoint - 1) * 100)}%</b>`);
    const confoundChips = (f.state_confounds || []).map(tag => `<span class="sig-chip is-missing">${esc(tag)}</span>`).join(" ");
    return `
      ${kvHTML([
        ["复盘时间", esc(f.retro_at || "—")],
        ["抓取时间", mono(f.collected_at || "—")],
        ["数据来源", mono(f.source || "—")],
        ["评论状态", esc(f.comments_status || "—")]
      ])}
      <div class="wb-cap" style="margin-top:10px">实绩数据（缺项显示 —，不隐藏）</div>
      <div class="funnel-nums" style="flex-wrap:wrap;gap:10px 16px;justify-content:flex-start">${metricRow}</div>
      <div class="wb-cap" style="margin-top:12px">派生比率</div>
      <div class="funnel-nums" style="flex-wrap:wrap;gap:10px 16px;justify-content:flex-start">${ratioRow}</div>
      ${funnelSteps.length ? `
        <div class="wb-cap" style="margin-top:12px">留存漏斗 · ${esc(f.funnel_source || "复盘段自算")}</div>
        <div class="funnel-nums">${funnelSteps.map(step => `<span>${esc(step.label)}<i>${step.pct}%${step.note ? `<br><span style="font-size:12px;font-weight:400;color:var(--ink3)">${esc(step.note)}</span>` : ""}</i></span>`).join("")}</div>`
        : `<div class="empty-line" style="margin-top:12px"><b>留存漏斗无数据</b> · 源文件未记录 2s/5s/完播</div>`}
      <div class="wb-cap" style="margin-top:12px">押注落点</div>
      ${bucketTableHTML(f.buckets || [], { showHit: true })}
      ${readBits.length ? `<div class="bet-note">${readBits.join(" · ")}</div>` : ""}
      ${(f.confounds || []).length || confoundChips ? `
        <div class="wb-cap" style="margin-top:10px">混淆变量（紧贴押注落点，解释落差）</div>
        ${bulletsHTML(f.confounds || [])}
        ${confoundChips ? `<div class="bump-confounds">${confoundChips}</div>` : ""}` : ""}
      ${(f.credibility || []).length ? `<div class="wb-cap" style="margin-top:10px">数据可信度声明</div>${bulletsHTML(f.credibility)}` : ""}
      ${(f.verified || []).length ? `<div class="wb-cap" style="margin-top:10px">被验证 ✅</div>${bulletsHTML(f.verified, "✅")}` : ""}
      ${(f.refuted || []).length ? `<div class="wb-cap" style="margin-top:10px">被推翻 ❌</div>${bulletsHTML(f.refuted, "❌")}` : ""}
      ${(f.observations || []).length ? `<div class="wb-cap" style="margin-top:10px">新观察</div>${bulletsHTML(f.observations)}` : ""}
      <div class="wb-cap" style="margin-top:10px">Top 评论关键词</div>
      <div class="note-bar">${esc(f.top_comments || "未采集")}</div>`;
  }

  /* ── ⑧ rubric 去向 ──────────────────────────────────────── */
  function stageBumpHTML(f, station) {
    if (!f || !Object.keys(f).length) return emptyLineHTML(station.empty_hint || "未产生 rubric 动作");
    const deviation = f.deviation || {};
    return `
      ${(f.rubric_actions || []).length ? `<div class="wb-cap">本稿对 rubric 的贡献</div>${bulletsHTML(f.rubric_actions)}` : `<div class="empty-line"><b>未产生 rubric 动作</b></div>`}
      ${kvHTML([
        ["同向偏差队列", f.eligible_for_directional_streak
          ? `进入连续同向偏差队列`
          : `<span style="color:var(--amber)">判为 ${esc(deviation.confound_type || "confounded")} 混淆样本 · 不进同向偏差队列</span>`],
        ["偏差读数", deviation.predicted_midpoint
          ? `中枢 ${exactNumber(deviation.predicted_midpoint)} vs 实绩 ${exactNumber(deviation.actual)} · ${esc(String(deviation.actual_to_midpoint_ratio ?? "—"))}×`
          : ""],
        ["retro_mode", f.retro_mode ? mono(f.retro_mode) : ""],
        ["上次 bump", f.last_bump_at ? esc(f.last_bump_at) : "从未 bump"]
      ])}
      ${f.memo_ref ? `<div class="memo-foot"><button type="button" class="copy-btn" data-goto-memo="${esc(f.memo_ref)}">跳到复盘观察卡 →</button></div>` : ""}`;
  }

  function stageBodyHTML(station) {
    const f = station.fields || {};
    switch (station.stage) {
      case "draft": return stageDraftHTML(f);
      case "review": return stageReviewHTML(f, station);
      case "predict_v1": return stagePredictHTML(f, station, "v1");
      case "predict_v2": return stagePredictHTML(f, station, "v2");
      case "shoot": return stageShootHTML(f, station);
      case "publish": return stagePublishHTML(f, station);
      case "retro": return stageRetroHTML(f, station);
      case "bump": return stageBumpHTML(f, station);
      default: return emptyLineHTML(station.empty_hint);
    }
  }

  const STAGE_STATUS_TAG = {
    current: `<span class="ch-tag ch-a">当前站</span>`,
    pending: `<span class="dsr-label">未到达</span>`,
    skipped: `<span class="dsr-label">跳过</span>`,
    na: `<span class="dsr-label">n/a</span>`
  };

  function dossierBodyHTML(item, data) {
    const dossier = item.dossier || [];
    if (!dossier.length) return `<div class="empty-line"><b>暂无履历</b> · build.py 未产出 dossier</div>`;
    const pred = (data.cheat?.predictions || []).find(entry =>
      entry.file === item.prediction_file || entry.article_id === item.article_id);
    const cards = dossier.map(station => {
      /* §6.1 禁令 2：指令按钮只出现在 current 站 */
      const actions = station.status === "current" && (station.actions || []).length
        ? `<div class="wb-actions">${station.actions.map((action, index) => copyBtnHTML(action.label, action.command, index === 0)).join("")}</div>`
        : "";
      const inner = `${stageBodyHTML(station)}${actions}`;
      const card = `
        <section class="doc-card" id="doc-stage-${esc(station.stage)}">
          <div class="icard-head">
            <h3 class="doc-stage-title">${esc(station.label || station.stage)}</h3>
            ${station.at ? `<span class="doc-stage-at">${esc(station.at)}</span>` : ""}
            <span style="margin-left:auto">${STAGE_STATUS_TAG[station.status] || ""}</span>
          </div>
          ${inner}
        </section>`;
      /* §6.3 发布后分界带：④ 重判 v2 与 ⑤ 拍摄之间 */
      return station.stage === "shoot" ? `${DOC_DIVIDER_HTML}${card}` : card;
    }).join("");
    const raw = pred && pred.body_html
      ? `<details class="doc-raw"><summary>预测日志原文（Markdown 渲染）· ${esc(pred.file || "")}</summary><div class="doc-body">${pred.body_html}</div></details>`
      : "";
    return `${cards}${raw}`;
  }

  /* ── doc-modal：单稿全链路 ───────────────────────────────── */
  let docModalItem = null;

  function openDocModal(item, anchorStage) {
    if (!item) return;
    const modal = $("#doc-modal");
    if (!modal) return;
    const data = dashboardData();
    docModalItem = item;
    $("#doc-modal-title").textContent = item.title || "未命名稿件";
    const badges = [];
    if (item.retro_only) badges.push(`<span class="doc-modal-badge">Reconstructed · 不计入校准</span>`);
    badges.push(`<span>${esc(item.date || "—")}</span>`);
    badges.push(`<span>${esc(item.file || "")}</span>`);
    badges.push(`<span>article_id ${esc(item.article_id || "—")}</span>`);
    $("#doc-modal-meta").innerHTML = badges.join("");
    $("#doc-modal-rail").innerHTML = `${dossierNowChipHTML(item.dossier || [])}${dossierRailHTML(item.dossier || [], { clickable: true })}`;
    $("#doc-modal-stages").innerHTML = dossierBodyHTML(item, data);
    const source = $("#doc-modal-source");
    if (source) {
      const path = item.file ? `scripts/${item.file}` : "";
      source.href = path ? `obsidian://open?path=${encodeURIComponent(path)}` : "#";
      source.hidden = !path;
    }
    openModalShell("#doc-modal");
    const body = modal.querySelector(".doc-modal-body");
    if (body) body.scrollTop = 0;
    if (anchorStage) {
      window.setTimeout(() => {
        const target = document.getElementById(`doc-stage-${anchorStage}`);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 90);
    }
    try {
      window.history.replaceState(null, "", `#script-${item.article_id}${anchorStage ? `-${anchorStage}` : ""}`);
    } catch (error) { /* file:// 下 replaceState 可能被拒，忽略 */ }
  }

  function closeDocModal() {
    if (!closeModalShell("#doc-modal")) return;
    docModalItem = null;
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (error) { /* 同上 */ }
  }

  function setupDocModal(data) {
    const wb = data.cheat?.workbench || [];
    const findItem = id => wb.find(entry => entry.article_id === id);
    document.addEventListener("click", event => {
      const opener = event.target.closest?.("[data-open-doc]");
      if (opener) {
        event.preventDefault();
        event.stopPropagation();
        openDocModal(findItem(opener.dataset.openDoc), opener.dataset.docStage || "");
        return;
      }
      const memoJump = event.target.closest?.("[data-goto-memo]");
      if (memoJump) {
        event.preventDefault();
        closeDocModal();
        const card = document.getElementById(`memo-card-${memoJump.dataset.gotoMemo}`);
        if (card) window.setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "center" }), 260);
        return;
      }
      const stageJump = event.target.closest?.("[data-goto-stage]");
      if (stageJump) {
        const target = document.getElementById(`doc-stage-${stageJump.dataset.gotoStage}`);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (event.target.closest?.("[data-close-doc]")) closeDocModal();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeDocModal();
    });
    const match = String(window.location.hash || "").match(/^#script-([0-9a-zA-Z]{4,24})(?:-(\w+))?$/);
    if (match) {
      const item = findItem(match[1]);
      if (item) openDocModal(item, match[2] || "");
    }
  }

  /* ── L1 摘要抽屉（§2.2）：只放扫读所需，不得再变长 ────────── */
  function workbenchDetailHTML(item, data) {
    const pred = (data.cheat?.predictions || []).find(entry =>
      entry.file === item.prediction_file || entry.article_id === item.article_id);
    const dimsDetail = item.dims_detail && Object.keys(item.dims_detail).length
      ? item.dims_detail
      : (pred?.dims_detail || pred?.dims || {});
    const overrides = {};
    (pred?.versions_detail || []).forEach(version => {
      Object.assign(overrides, parseDimOverrides(version.user_override));
    });
    const bet = item.bet_detail || {};
    const review = item.review || {};
    const scores = item.scores || {};
    const composite = scores.composite ?? scores.blind ?? scores.self;
    const nums = [
      ["composite", composite === null || composite === undefined ? "—" : String(composite)],
      ["押注", bet.headline ? shortText(bet.headline, 22) : (scores.bet || "—")],
      ["实播", item.views ? exactNumber(item.views) : "—"],
      ["问题", review.issue_total === null || review.issue_total === undefined ? "—" : `${review.issue_open}/${review.issue_total}`]
    ];
    const funnelSteps = (item.funnel || []).filter(step => step.pct !== null && step.pct !== undefined);
    return `
      ${dossierRailHTML(item.dossier || [], { mini: true })}
      ${Object.keys(dimsDetail).length ? dimBarsHTML(dimsDetail, { override: overrides }) : ""}
      <div class="funnel-nums" style="flex-wrap:wrap;gap:8px 18px;justify-content:flex-start;margin-top:10px">
        ${nums.map(row => `<span>${esc(row[0])}<i>${esc(row[1])}</i></span>`).join("")}
      </div>
      ${funnelSteps.length ? `<div class="funnel-nums" style="margin-top:10px">${funnelSteps.map(step => `<span>${esc(step.label)}<i>${step.pct}%</i></span>`).join("")}</div>` : ""}
      <div class="wb-actions">
        <button type="button" class="copy-btn primary" data-open-doc="${esc(item.article_id)}">看完整履历 →</button>
      </div>`;
  }

  function workbenchRowHTML(item, data) {
    const scores = item.scores || {};
    const composite = scores.composite ?? scores.blind ?? scores.self;
    const actions = (item.next_actions || [])
      .map((action, index) => copyBtnHTML(action.label, action.command, index === 0)).join("");
    const review = item.review || {};
    const reviewBits = [];
    if (review.issue_total !== null && review.issue_total !== undefined) reviewBits.push(`问题 ${review.issue_open}/${review.issue_total} 待修`);
    if (review.cold_zones !== null && review.cold_zones !== undefined) reviewBits.push(review.cold_zones ? `${review.cold_zones} 个冷区` : "无冷区");
    return `
      <article class="wb-row expandable" data-file="${esc(item.file)}">
        <div class="wb-top">
          <span class="wb-title">${esc(item.title)}</span>
          ${stageBadge(item.stage)}
          <span class="wb-score">${composite !== null && composite !== undefined ? `${esc(String(composite))}<small> /10</small>` : "—"}</span>
          <span class="chev">▾</span>
        </div>
        <div class="wb-meta">
          <span>${esc(item.date || "—")}</span>
          ${scores.bet ? `<span>押 <b>${esc(scores.bet)}</b></span>` : ""}
          ${item.views ? `<span>实播 <b style="color:var(--real)">${formatNumber(item.views)}</b></span>` : ""}
          ${reviewBits.length ? `<span>${esc(reviewBits.join(" · "))}</span>` : ""}
          <span class="wb-file">${esc(item.file)}</span>
        </div>
        ${actions ? `<div class="wb-actions">${actions}</div>` : ""}
        <div class="x-detail" hidden>${workbenchDetailHTML(item, data)}</div>
      </article>`;
  }

  /* ══════════════════════════════════════════════════════════════
     §1.3 Rubric 定义 panel（CH-B 盲评白名单）
     铁律：本 panel 内不得出现任何实绩语句（播放/点赞/复盘结论）。
     ══════════════════════════════════════════════════════════════ */
  function renderRubricAlerts(rubric, cheat) {
    const bars = [];
    const conflicts = (rubric.doc_conflicts && rubric.doc_conflicts.length ? rubric.doc_conflicts : cheat.doc_conflicts) || [];
    if (conflicts.length) {
      const source = conflicts[0].source || "CLAUDE.md";
      bars.push(`<div class="alert-bar">
        <b>文档不一致</b>：CLAUDE.md 写的是 v2 加权公式 / 0-10 量程 / SAT=满足感，与生效的
        <b>v0 等权 · 每维 0-5 · SAT=讽刺深度</b> 冲突 ${conflicts.length} 处 → 建议修 <code>${esc(source)}</code>
        <ul>${conflicts.map(row => `<li><b>${esc(row.kind)}</b>：文档写 <code>${esc(row.found)}</code> · 生效值 <code>${esc(row.expected)}</code>${row.note ? ` — ${esc(row.note)}` : ""}</li>`).join("")}</ul>
        <span style="color:var(--ink3)">看板只读只报，绝不改写 CLAUDE.md。</span>
      </div>`);
    }
    if (cheat.rubric_form_mismatch) {
      bars.push(`<div class="alert-bar">
        <b>形态不匹配</b>：content_form = <code>${esc(cheat.content_form || "mixed")}</code>，却在跑为 opinion-video 拟合的 rubric
        （<code>state.rubric_form_mismatch = true</code>）· 前几篇预测会系统性偏差，下次 bump 应调权重。
      </div>`);
    }
    return bars.slice(0, 2).join("");
  }

  function renderCheatRubric(data) {
    const host = $("#cheat-rubric");
    if (!host) return;
    const cheat = data.cheat || {};
    const rubric = cheat.rubric || {};
    const dims = rubric.dims || [];
    const chip = $("#cheat-rubric-chip");
    if (chip) chip.textContent = `${rubric.version || cheat.rubric_version || "v0"} · ${rubric.dim_count || dims.length} 维等权 · 每维 ${rubric.scale || "0-5"}`;
    const cards = dims.map(dim => {
      const anchors = dim.anchors || {};
      return `<article class="icard rubric-card">
        <div class="icard-title"><span class="rubric-code">${esc(dim.code)}</span>${esc(dim.name_cn || "")}<span class="rubric-en">${esc(dim.name_en || DIM7_EN[dim.code] || "")}</span></div>
        <p class="rubric-desc">${esc(dim.desc || "—")}</p>
        <div class="rubric-anchor">
          ${["0", "3", "5"].filter(key => anchors[key]).map(key => `<span><b style="font-family:var(--disp);color:var(--ink2)">${key}</b> ${esc(anchors[key])}</span>`).join("")}
        </div>
        ${dim.note ? `<div class="note-bar">ⓘ ${esc(dim.note)}（rubric_notes.md 原文授权）</div>` : ""}
      </article>`;
    }).join("");
    const ghosts = (rubric.candidate_dims || []).map(dim =>
      `<span class="ghost-chip">${esc(dim.code)} ${esc(dim.name_cn || "")} · ${esc(dim.status || "未生效")}</span>`).join("");
    const bucketTable = (list, caption) => (list || []).length ? `
      <div class="wb-cap" style="margin-top:10px">${esc(caption)}</div>
      <table><thead><tr><th>Bucket</th><th>范围</th><th>含义</th><th>先验</th></tr></thead><tbody>
      ${list.map(row => `<tr><td style="font-family:var(--disp);color:var(--ink);font-weight:700">${esc(row.label)}</td><td style="font-family:var(--disp)">${esc(row.range || "—")}</td><td>${esc(row.meaning || "—")}</td><td style="font-family:var(--disp)">${esc(row.prior || "—")}</td></tr>`).join("")}
      </tbody></table>` : "";
    const trust = (rubric.coldstart_trust_table || []).length ? `
      <div class="wb-cap" style="margin-top:10px">冷启动信任表</div>
      <table><thead><tr><th>样本数</th><th>可以相信什么</th></tr></thead><tbody>
      ${rubric.coldstart_trust_table.map(row => `<tr><td style="font-family:var(--disp);color:var(--ink)">${esc(row.samples)}</td><td>${esc(row.trust)}</td></tr>`).join("")}
      </tbody></table>` : "";
    const contamination = (rubric.contamination_hits || []).length ? `
      <div class="alert-bar" style="margin-top:12px">
        <b>rubric_notes.md 检出 ${rubric.contamination_hits.length} 处实绩语句</b> · 盲评白名单可能已污染 ·
        行号：<code>${esc(rubric.contamination_hits.map(hit => hit.line).join(", "))}</code>
        <span style="color:var(--ink3)">命中行不进维度定义；看板只读只报，绝不修改文件。</span>
      </div>` : "";
    host.innerHTML = `
      ${renderRubricAlerts(rubric, cheat)}
      <div class="icard">
        <div class="icard-head">
          <span class="icard-title" style="font-size:14px">生效公式（唯一权威）</span>
          <span class="chip">${esc(rubric.version || "v0")} · 等权占位</span>
          <span class="bench-tag">每维 ${esc(rubric.scale || "0-5")} · composite 0–10</span>
        </div>
        <code class="rubric-formula">${esc(rubric.formula || "(ER + HP + QL + NA + AB + SR + SAT) / 7 × 2.0")}</code>
        <div class="icard-sub">真源 ${esc(rubric.source_path || "rubric_notes.md")} · ${rubric.dim_count || dims.length} 维等权，无加权项</div>
      </div>
      <div class="wb-cap" style="margin-top:12px">${rubric.dim_count || dims.length} 个生效维度（英文码 + 中文名）</div>
      <div class="rubric-grid">${cards || `<div class="empty-line"><b>未解析到维度定义</b> · 检查 rubric_notes.md</div>`}</div>
      <div class="rubric-ghosts">v2.1 候选维度（未生效）：${ghosts || "—"}</div>
      ${rubric.candidate_note ? `<div class="note-bar">${esc(rubric.candidate_note)}</div>` : ""}
      ${bucketTable(rubric.buckets_absolute, "Bucket 定义 · 绝对桶")}
      ${bucketTable(rubric.buckets_ratio, "Bucket 定义 · 比率桶")}
      ${trust}
      ${contamination}`;
  }

  /* ══════════════════════════════════════════════════════════════
     §4 对标派生 panel（CH-A · 含实绩）
     ══════════════════════════════════════════════════════════════ */
  function renderCheatBenchmark(data) {
    const host = $("#cheat-benchmark");
    if (!host) return;
    const cheat = data.cheat || {};
    const bench = cheat.benchmark || {};
    const patterns = cheat.patterns || {};
    const samples = bench.samples || [];
    const chip = $("#cheat-benchmark-chip");
    if (chip) chip.textContent = `${bench.sample_count || samples.length} 样本 · ${bench.platform || "—"}`;
    const sampleRows = samples.map(row => `
      <tr>
        <td style="width:24px">${row.n}</td>
        <td class="bt-title" style="width:22%">${esc(row.account)}</td>
        <td class="bt-title">${esc(row.title)}</td>
        <td class="bt-plays" style="width:15%">${formatNumber(row.plays)}</td>
        <td style="width:13%">${formatNumber(row.likes)}</td>
        <td style="width:15%"><span class="bench-tag" style="white-space:normal">${esc(row.impression || "—")}</span>${row.truncated ? `<br><span class="bench-tag" style="color:var(--amber);white-space:normal">转录截断<br>半样本</span>` : ""}</td>
      </tr>`).join("");
    const signals = bench.signals || {};
    const detail = signals.detail || {};
    const notInRubric = new Set(signals.not_in_rubric || []);
    const sigGroup = (list, caption) => `
      <div class="wb-cap" style="margin-top:10px">${esc(caption)}</div>
      ${(list || []).map(code => `
        <div>
          <span class="sig-chip ${notInRubric.has(code) ? "is-missing" : ""}" title="${esc(notInRubric.has(code) ? `${code} — 当前 7 维 rubric 无此维度，打分时无处可打` : `${code} 在当前 rubric 内`)}">${esc(code)}${notInRubric.has(code) ? " ❗" : ""}</span>
          <div class="sig-note">${esc((detail[code] || {}).label ? `${detail[code].label} — ${detail[code].text}` : "—")}</div>
        </div>`).join("")}`;
    const patternRows = (patterns.imported || []).map(row => `
      <details class="pat-item">
        <summary>${row.n}. ${esc(row.title)}<span class="pat-badge">Imported · untested</span>${row.partial ? `<span class="pat-badge" style="color:var(--amber)">partial transcript</span>` : ""}</summary>
        <dl class="pat-field">
          <dt>适用</dt><dd>${esc(row.applies || "—")}</dd>
          <dt>结构</dt><dd>${esc(row.structure || "—")}</dd>
          <dt>样本依据</dt><dd>${esc(row.evidence || "—")}</dd>
          <dt>可迁移句式</dt><dd>${esc(row.transferable || "—")}</dd>
          ${row.note ? `<dt>备注</dt><dd>${esc(row.note)}</dd>` : ""}
        </dl>
      </details>`).join("");
    host.innerHTML = `
      <div class="bench-grid">
        <article class="icard">
          <div class="icard-head"><span class="icard-title">${esc(bench.name || "对标组")}</span></div>
          <div class="icard-sub">${esc(bench.platform || "—")} · 导入 ${esc(bench.imported_at || "—")} · ${bench.sample_count || 0} 样本（${bench.complete_count || 0} 完整 + ${bench.truncated_count || 0} 截断）</div>
          <table class="bench-table"><thead><tr><th>#</th><th>账号</th><th>标题</th><th>播放</th><th>赞</th><th>印象</th></tr></thead><tbody>${sampleRows}</tbody></table>
          <div class="note-bar">对标仅有 <b>${esc((bench.metric_coverage || []).join(" / ") || "—")}</b> ${(bench.metric_coverage || []).length} 项指标 · 无 <b>${esc((bench.missing_metrics || []).join(" / ") || "—")}</b> → 无法与本账号最强的留存数据同轴对比</div>
        </article>
        <article class="icard">
          <div class="icard-head"><span class="icard-title">派生 rubric 信号</span></div>
          <div class="icard-sub">❗ = 该维度不在当前 ${(cheat.rubric || {}).dim_count || 7} 维 rubric 中，打分时无处可打</div>
          ${sigGroup(signals.important, "高表现共有")}
          ${sigGroup(signals.unstable, "相对不稳定")}
          ${(cheat.rubric || {}).benchmark_signals_section_present === false ? `
            <div class="alert-bar" style="margin-top:10px">
              <b>对标派生从未回写 rubric_notes.md</b> — cheat-learn-from Phase 6d 规定的
              <code>## Benchmark-derived initial signals</code> 段不存在（rubric_notes.md 与出厂模板 opinion-video-zero.md 逐字节相同）。
              对标认定最重要的 <b>${esc((signals.not_in_rubric || []).join(" / "))}</b> 目前无法进入打分。
            </div>` : ""}
          <div class="note-bar">淡出条件：${esc(bench.fade_condition || "calibration_samples ≥ 10")} 或出现 ≥3 条与 benchmark 不一致的强样本 → 转 sanity check（当前 ${cheat.calibration_samples || 0}/10）</div>
        </article>
        <article class="icard">
          <div class="icard-head"><span class="icard-title">写作 Pattern</span><span class="bench-tag">${esc(patterns.source_path || "script_patterns.md")}</span></div>
          <div class="icard-sub">${(patterns.imported || []).length} 条对标借鉴 · ${(patterns.own_verified || []).length} 条自有已验证</div>
          ${patternRows || `<div class="empty-line"><b>暂无 Imported Pattern</b></div>`}
          <div class="empty-line" style="margin-top:10px">
            <b>自有 Pattern ${(patterns.own_verified || []).length} 条</b> · 用户改稿观察 ${(patterns.placeholders || {}).edit_history_rows || 0} 行 — 需 ≥2 次实拍 diff 才能升正式；当前 videos/ 下无 script.md，无实拍稿可 diff
          </div>
        </article>
      </div>
      <div class="bench-footline">受众画像 audience.md · v0 空骨架 · 0 篇复盘 / 0 条评论 · <span class="ch-tag ch-block">CH-B 禁读（blocked_audience）</span></div>`;
  }

  /* ══════════════════════════════════════════════════════════════
     §5 复盘观察 panel（CH-A · 含实绩）：左时间轴 6 组件 + 右 bump 仪表
     ══════════════════════════════════════════════════════════════ */
  function renderBumpGauge(data) {
    const cheat = data.cheat || {};
    const progress = cheat.bump_progress || {};
    const deviation = cheat.deviation || {};
    const confounds = cheat.confounds || [];
    const samples = progress.samples ?? cheat.calibration_samples ?? 0;
    const need = progress.need ?? 5;
    const directional = progress.directional ?? 0;
    const directionalNeed = progress.directional_need ?? 3;
    const pct = Math.max(0, Math.min(100, Math.round(samples / (need || 1) * 100)));
    const dots = Array.from({ length: directionalNeed }, (_, index) =>
      `<i class="${index < directional ? "on" : ""}"></i>`).join("");
    const gap = Math.max(0, need - samples);
    return `
      <article class="icard bump-gauge">
        <div class="icard-head"><span class="icard-title">bump 仪表</span></div>
        <div class="bump-read">
          <div class="bump-ring" style="--pct:${pct}%"><b>${samples}/${need}</b></div>
          <div class="bump-read-l">校准配对<br><span style="color:var(--ink2)">state.calibration_samples</span></div>
        </div>
        <div class="bump-read">
          <div class="bump-dots">${dots}</div>
          <div class="bump-read-l">连续同向偏差 ${directional}/${directionalNeed}<br><span style="color:var(--ink2)">consecutive_directional_errors</span></div>
        </div>
        <div class="note-bar">
          最近一条表观 ${deviation.actual_to_midpoint_ratio ? `${Math.round(1 / (deviation.actual_to_midpoint_ratio || 1))}×` : "—"} ${esc(deviation.direction === "high" ? "高估" : "偏差")}
          （中枢 ${exactNumber(deviation.predicted_midpoint)} vs 实绩 ${exactNumber(deviation.actual)}），但被判 confounded 排除 →
          <code>eligible_for_directional_streak: ${String(deviation.eligible_for_directional_streak === true)}</code>
        </div>
        ${confounds.length ? `<div class="bump-confounds">${confounds.map(tag => `<span class="sig-chip is-missing">${esc(tag)}</span>`).join("")}</div>` : ""}
        <div class="bump-read">
          <div class="bump-read-v" style="font-size:18px">${cheat.last_bump_at ? esc(cheat.last_bump_at) : "从未"}</div>
          <div class="bump-read-l">上次 bump<br><span style="color:var(--ink2)">state.last_bump_at</span></div>
        </div>
        <div class="bump-read">
          <span class="chip">${esc(cheat.rubric_version || "v0")} · 等权占位</span>
          <div class="bump-read-l">rubric 版本</div>
        </div>
        <div class="bump-conclusion">距离首次 bump 还差 ${gap} 个干净校准样本</div>
        <div class="note-bar">bump 触发不是死门槛：1 次 ≥10× 极端偏差、或 2 次同向 + 评论区一致反向证据也可提前提议（须标 <code>[judgment-driven]</code>）</div>
      </article>`;
  }

  function memoCardHTML(obs) {
    const cross = obs.cross_sample_tag
      ? `<span class="memo-cross ${/3\s*\/\s*3/.test(obs.cross_sample_tag) ? "is-hot" : ""}">${esc(obs.cross_sample_tag)}</span>`
      : "";
    const judgments = (obs.judgments || []).length
      ? `<ol style="margin:0;padding-left:18px">${obs.judgments.map(text => `<li style="font-size:13px;line-height:1.7;color:var(--ink2)">${esc(text)}</li>`).join("")}</ol>`
      : "—";
    const extras = [
      ["可信度", obs.credibility],
      ["流程缺口", obs.process_gap],
      ["平台观察", obs.platform_note]
    ].filter(row => row[1]);
    return `
      <article class="icard memo-card" id="memo-card-${esc(obs.id || "")}">
        <div class="memo-head">
          <span class="ch-tag ch-block">CH-B 禁读</span>
          <span class="memo-date">${esc(obs.date || "—")}</span>
          <span class="memo-title">${esc(obs.title || "未命名")}</span>
          ${cross}
        </div>
        <p class="memo-verdict">${esc(obs.verdict || "—")}</p>
        <dl class="memo-rows" style="grid-template-columns:58px minmax(0,1fr)">
          <dt>预测</dt><dd class="is-mono">${esc(obs.predicted || "—")}</dd>
          <dt>实绩</dt><dd class="is-mono">${esc(obs.actual || "—")}</dd>
          <dt>评论</dt><dd class="is-faded">${esc(obs.top_comments || "未采集")}</dd>
          <dt>判断</dt><dd>${judgments}</dd>
          <dt>调整</dt><dd>${esc(obs.rubric_action || "—")}</dd>
          ${extras.map(row => `<dt>${esc(row[0])}</dt><dd>${esc(row[1])}</dd>`).join("")}
        </dl>
        <div class="memo-foot">
          <button type="button" class="copy-btn" data-open-doc="${esc(obs.id || "")}" data-doc-stage="retro">详见 → 打开该稿履历</button>
          <span class="memo-date">${esc(obs.ref_file || "")}</span>
        </div>
      </article>`;
  }

  function renderCheatMemo(data) {
    const host = $("#cheat-memo");
    if (!host) return;
    const cheat = data.cheat || {};
    const observations = cheat.memo_observations || [];
    const chip = $("#cheat-memo-chip");
    if (chip) chip.textContent = `${observations.length} 条观察 · rubric-memo.md`;
    host.innerHTML = `
      <div class="memo-grid">
        <div class="memo-list">
          ${observations.map(memoCardHTML).join("") || `<div class="empty-line"><b>还没有复盘观察</b> · 下一步指令 <code>复盘 [path]</code></div>`}
        </div>
        ${renderBumpGauge(data)}
      </div>`;
  }

  /* ── 折叠抽屉内容（只剩「选题输入」「常用指令」） ── */
  function renderCheatDrawers(data) {
    const cheat = data.cheat || {};
    const candidates = cheat.candidates || [];
    const trendsAge = daysAgo(cheat.last_trends_run_at);
    const stale = trendsAge !== null && trendsAge > 3;
    $("#cheat-candidates-count").textContent = `${candidates.length} 条手工候选`;
    $("#cheat-candidates-body").innerHTML = `
      <div class="cand-list">
        ${candidates.map(cand => `
          <div class="cand-row">
            <span class="pill" style="color:${typeColor(cand.type)}">${esc(typeShort(cand.type))}</span>
            <span class="cand-t">${esc(cand.title)}</span>
            <span class="cand-tier">${esc(cand.tier)}</span>
          </div>`).join("") || emptyState("候选池为空", "说「找选题」或「抓热点」补充")}
      </div>
      <div class="bet-note ${stale ? "warn" : ""}" style="margin-top:12px">
        上次抓热点 <b>${trendsAge === null ? "—" : `${trendsAge} 天前`}</b>${stale ? "（已过期，说「抓热点」刷新）" : ""} ·
        候选未按 rubric 排序——说「推荐选题」跑 cheat-recommend 出 top N。
      </div>`;
    const cmds = [
      ["状态", "看完整校准看板（无副作用）"],
      ["找选题", "cheat-seed 一次一个深挖选题"],
      ["抓热点", "cheat-trends 拉热点源进候选池"],
      ["推荐选题", "cheat-recommend 按 rubric 排序 top N"],
      ["拍了 X", "cheat-shoot 登记拍摄，buffer +1"],
      ["复盘 [path]", "cheat-retro 回收 T+3d 数据"]
    ];
    $("#cheat-cmds-count").textContent = `${cmds.length} 条`;
    $("#cheat-cmds-body").innerHTML = cmds.map(([cmd, desc]) => `
      <div class="cmd"><code>${esc(cmd)}</code><span>${esc(desc)}</span>${copyBtnHTML("复制", cmd)}</div>`).join("");
  }

  /* ── 套准仪（cheat 签名视图）：蓝环=预测通道 / 橙环=实绩通道。
     偏移映射（写死在这里）：offset = MAX_OFFSET × (1 − calibration_samples/5)，
     0/5 → 26px 最大错位；样本每 +1 收拢 5.2px；5/5 → 0px 完全套准，
     实绩环虚线转实线并触发一次短暂发光（.is-locked）。入场时两环从
     更大偏移（CSS 里 ×2.2 + 14px）1.2s 一次性收拢到当前偏移位。 ── */
  function renderCheatRegister(data) {
    const host = $("#cheat-register");
    if (!host) return;
    const cheat = data.cheat || {};
    const samples = Math.max(0, Math.min(5, Number(cheat.calibration_samples || 0)));
    const deviation = cheat.deviation || {};
    const progress = samples / 5;
    const MAX_OFFSET = 26;
    const offset = Number((MAX_OFFSET * (1 - progress)).toFixed(1));
    const locked = samples >= 5;
    host.innerHTML = `
      <div class="glass panel ch-reg-panel" data-reveal>
        <div class="panel-head"><h2>套准仪 · 预测 vs 实绩</h2><span class="chip">${locked ? "两环套准" : `当前偏移 ${offset}px`}</span><span class="ch-tag ch-a">CH-A · 含实绩</span></div>
        <div class="ch-reg ${locked ? "is-locked" : ""}" style="--reg-off:${offset}px">
          <svg viewBox="0 0 240 240" role="img" aria-label="套准仪：蓝环为预测通道，橙色虚线环为实绩通道，校准样本越多两环越接近套准">
            <circle cx="120" cy="120" r="86" fill="none" stroke="var(--pred)" stroke-width="3.5" opacity="0.9"/>
            <circle cx="120" cy="120" r="68" fill="none" stroke="var(--pred)" stroke-width="1.4" opacity="0.42"/>
            <g class="ch-reg-real">
              <circle cx="120" cy="120" r="86" fill="none" stroke="var(--real)" stroke-width="3.5" stroke-dasharray="7 6" opacity="0.92"/>
              <circle cx="120" cy="120" r="68" fill="none" stroke="var(--real)" stroke-width="1.4" stroke-dasharray="4 6" opacity="0.5"/>
            </g>
            <line x1="102" y1="120" x2="138" y2="120" stroke="rgba(255,255,255,0.28)" stroke-width="1"/>
            <line x1="120" y1="102" x2="120" y2="138" stroke="rgba(255,255,255,0.28)" stroke-width="1"/>
          </svg>
          <div class="ch-reg-center">
            <b>校准 ${samples}/5</b>
            <span>${locked ? "两环套准 · 预测通道可信" : "置信度建立中"}</span>
          </div>
        </div>
        <div class="ch-reg-legend">
          <span><i class="lg-pred"></i>预测通道</span>
          <span><i class="lg-real"></i>实绩通道（虚线 = 尚未对齐）</span>
          <span class="lg-rule">偏移 = 26px × (1 − 样本/5)</span>
        </div>
        ${deviation.predicted_midpoint ? `<div class="note-bar">最近一对：预测中枢 <b>${exactNumber(deviation.predicted_midpoint)}</b> → 实绩 <b>${exactNumber(deviation.actual)}</b> · <b>${esc(String(deviation.actual_to_midpoint_ratio ?? "—"))}×</b>${deviation.confounded ? ` <span class="bench-tag" style="color:var(--amber)">confounded · 不进同向偏差队列</span>` : ""}</div>` : ""}
      </div>
      <div class="glass panel ch-conf-panel" data-reveal>
        <div class="panel-head"><h2>置信度表盘</h2><span class="chip">${esc(shortText(cheat.confidence || "—", 22))}</span></div>
        <div class="ch-conf" style="--ng:${(progress * 180).toFixed(1)}deg">
          <svg viewBox="0 0 240 152" role="img" aria-label="置信度半圆表盘：指针位置代表校准进度">
            <path d="M 28 120 A 92 92 0 0 1 212 120" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="13" stroke-linecap="round"/>
            <path class="ch-conf-arc" d="M 28 120 A 92 92 0 0 1 212 120" pathLength="1" fill="none" stroke="var(--pred)" stroke-width="13" stroke-linecap="round" style="--frac:${progress.toFixed(3)}"/>
            <g class="ch-conf-needle"><line x1="120" y1="120" x2="46" y2="120" stroke="var(--real)" stroke-width="3" stroke-linecap="round"/></g>
            <circle cx="120" cy="120" r="5" fill="var(--real)"/>
            <text x="26" y="144" class="ch-tick">0</text>
            <text x="214" y="144" text-anchor="end" class="ch-tick">5 样本</text>
          </svg>
          <div class="ch-conf-read">
            <b>${samples} / 5</b>
            <span>校准配对进度</span>
            <em>${esc(confidenceText(samples))}</em>
          </div>
        </div>
      </div>`;
  }

  function renderCheat(data) {
    const cheat = data.cheat || {};
    const wb = cheat.workbench || [];
    const samples = Number(cheat.calibration_samples || 0);
    const buffer = Number(cheat.buffer_count ?? data.global?.buffer_count ?? 0);
    const pending = (cheat.pending_retros || []).length;
    $("#page-hero").innerHTML = heroHTML(data, "cheat", "cheat 校准", "评分 → 盲测预测 → 发布 → T+3d 复盘 → rubric 迭代。预测落盘后不可改；不复盘的预测等于占星。");
    const kpis = $("#cheat-kpis");
    if (kpis) kpis.innerHTML = kpiHTML([
      { label: "校准样本", value: `${samples} / 5`, note: "预测 ↔ 实绩配对", hot: true },
      { label: "Rubric", value: cheat.rubric_version || "v0", note: "评分公式版本" },
      { label: "Buffer", value: buffer, note: buffer <= 0 ? "下个发布日可能断更" : "库存可覆盖发布", hot: buffer <= 0 },
      { label: "基线中位", value: formatNumber(cheat.baseline_plays), note: `对标 ${Number(cheat.benchmark_sample_count || 0)} 样本` },
      { label: "待复盘", value: pending, note: "T+3d 数据回收" }
    ], "violet");
    renderCheatRegister(data);
    renderLoopbar(data);
    $("#cheat-wb-chip").textContent = `${wb.length} 篇稿件 · 点行展开摘要，再点「看完整履历」`;
    $("#cheat-workbench").innerHTML = wb.length
      ? wb.map(item => workbenchRowHTML(item, data)).join("")
      : emptyState("scripts/ 目录为空", "写完第一稿放进 scripts/ 即入档");
    setupExpandables("#cheat-workbench", ".wb-row");
    renderCheatRubric(data);
    renderCheatBenchmark(data);
    renderCheatMemo(data);
    renderCheatDrawers(data);
    setupDimTips();
    setupDocModal(data);
    activateFx();
  }

  function daysAgo(iso) {
    if (!iso) return null;
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return null;
    return Math.floor((Date.now() - then.getTime()) / 86400000);
  }

  function setupExpandables(rootSelector, itemSelector) {
    const root = $(rootSelector);
    if (!root) return;
    root.addEventListener("click", event => {
      /* [data-open-doc] / [data-dim-tip] 有各自的处理器，点它们不应连带折叠整行 */
      if (event.target.closest("[data-copy], [data-open-doc], [data-dim-tip], a, details, summary")) return;
      const item = event.target.closest(itemSelector);
      if (!item || !root.contains(item)) return;
      const detail = item.querySelector(".x-detail");
      if (!detail) return;
      const open = !detail.hidden;
      detail.hidden = open;
      item.classList.toggle("open", !open);
    });
  }

  function priorityClass(priority) {
    if (/必改/.test(priority)) return "p0";
    if (/高/.test(priority)) return "p1";
    return "p2";
  }

  /* ── dbs 诊断台：任务入口制 ── */
  function dbsScriptRowHTML(item, data) {
    const review = item.review || {};
    const matched = (data.dbs?.reviews || []).filter(entry => (item.review_files || []).includes(entry.file));
    const summary = matched.length
      ? `已诊断 ${matched.length} 轮 · 问题 ${review.issue_open}/${review.issue_total} 待修 · ${review.cold_zones ? `${review.cold_zones} 个冷区` : "无冷区"}`
      : "未诊断";
    return `
      <article class="wb-row ${matched.length ? "expandable" : ""}" data-file="${esc(item.file)}">
        <div class="wb-top">
          <span class="wb-title">${esc(item.title)}</span>
          ${stageBadge(item.stage)}
          ${matched.length ? `<span class="chev">▾</span>` : ""}
        </div>
        <div class="wb-meta">
          <span>${esc(item.date || "—")}</span>
          <span>${esc(summary)}</span>
          <span class="wb-file">${esc(item.file)}</span>
        </div>
        <div class="wb-actions">${copyBtnHTML("复制诊断指令", `分析最新稿 scripts/${item.file}`, true)}</div>
        ${matched.length ? `<div class="x-detail" hidden>${matched.map(reviewDetailHTML).join("")}</div>` : ""}
      </article>`;
  }

  function archiveStatusZh(status) {
    if (/resolved|done|closed|结论/i.test(status)) return { label: "已结论", cls: "st-done" };
    if (/abandon|drop|放弃/i.test(status)) return { label: "已放弃", cls: "st-draft" };
    return { label: "进行中", cls: "st-pending" };
  }

  function archiveCardHTML(archive) {
    const status = archiveStatusZh(archive.status || "");
    const date = String(archive.timestamp || "").slice(0, 10);
    const conclusions = (archive.conclusions || []).map(text => `<li>${esc(text)}</li>`).join("");
    return `
      <article class="arch-card ${conclusions ? "expandable" : ""}">
        <div class="wb-top">
          <span class="arch-date">${esc(date || "—")}</span>
          <span class="wb-title">${esc(archive.title)}</span>
          <span class="stage-badge ${status.cls}">${status.label}</span>
          ${conclusions ? `<span class="chev">▾</span>` : ""}
        </div>
        ${archive.complaint ? `<div class="arch-complaint">「${esc(shortText(archive.complaint, 120))}」</div>` : ""}
        <div class="wb-meta">
          <span>来自 ${esc(archive.source_skill || "—")}</span>
          ${archive.next_skill ? `<span>下一步 <b>/${esc(archive.next_skill)}</b></span>` : ""}
          ${(archive.conclusions || []).length ? `<span>${archive.conclusions.length} 条结论</span>` : ""}
        </div>
        ${conclusions ? `<div class="x-detail" hidden><div class="wb-cap">已得出的结论</div><ul class="arch-conclusions">${conclusions}</ul></div>` : ""}
      </article>`;
  }

  function renderDbs(data) {
    const dbs = data.dbs || {};
    const cheat = data.cheat || {};
    const wb = cheat.workbench || [];
    const archives = dbs.archives || [];
    const reviews = dbs.reviews || [];
    const openIssues = reviews.reduce((sum, review) => sum + (review.issue_open || 0), 0);
    $("#page-hero").innerHTML = heroHTML(data, "dbs", "dbs 诊断台", "三个任务入口：诊断一篇稿子、诊断商业方向、找对标。完整工具索引收在页面底部抽屉。");
    const kpis = $("#dbs-kpis");
    if (kpis) kpis.innerHTML = kpiHTML([
      { label: "工具箱", value: dbs.total || 0, note: `${dbs.local_count || 0} 个本地已装`, hot: true },
      { label: "稿件在档", value: wb.length, note: "scripts/ 目录" },
      { label: "诊断存档", value: archives.length, note: "~/.dbs/sessions/" },
      { label: "问题待修", value: openIssues, note: openIssues ? "诊断清单未清零" : "清单已清零", hot: openIssues > 0 }
    ], "steel");
    const latest = archives[0];
    const entries = [
      { target: "#dbs-sec-script", icon: "◉", title: "诊断一篇稿子", note: `${wb.length} 篇稿件在档${openIssues ? ` · ${openIssues} 个问题待修` : ""}`, hint: "dbs-resonate → dbs-content → 时钟理论 → 传播 → 打分" },
      { target: "#dbs-sec-biz", icon: "◈", title: "商业 / 方向诊断", note: archives.length ? `${archives.length} 份存档 · 最近：${shortText(latest.title, 16)}` : "还没有诊断存档", hint: "/dbs-diagnosis 问诊或体检 · dbs-save 落档续用" },
      { target: "#dbs-sec-benchmark", icon: "◎", title: "找对标", note: cheat.benchmark_name ? `${shortText(cheat.benchmark_name, 20)} · ${cheat.benchmark_sample_count || 0} 样本` : "还没有对标组", hint: "dbs-benchmark 五重过滤，排除关于「我」的噪音" }
    ];
    $("#dbs-entries").innerHTML = entries.map(entry => `
      <article class="entry-card" data-target="${esc(entry.target)}" data-reveal>
        <div class="entry-icon">${entry.icon}</div>
        <h2>${esc(entry.title)}</h2>
        <div class="entry-note">${esc(entry.note)}</div>
        <div class="entry-hint">${esc(entry.hint)}</div>
      </article>`).join("");
    $("#dbs-entries").addEventListener("click", event => {
      const card = event.target.closest(".entry-card");
      if (!card) return;
      $(card.dataset.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#dbs-script-chip").textContent = `${wb.length} 篇 · 复制指令贴给 AI 助手`;
    $("#dbs-script-list").innerHTML = wb.length
      ? wb.map(item => dbsScriptRowHTML(item, data)).join("")
      : emptyState("scripts/ 目录为空", "写完第一稿放进 scripts/ 即入档");
    setupExpandables("#dbs-script-list", ".wb-row");
    $("#dbs-arch-chip").textContent = `${archives.length} 份存档 · ~/.dbs/sessions/`;
    $("#dbs-archives").innerHTML = archives.length
      ? archives.map(archiveCardHTML).join("")
      : emptyState("还没有商业诊断存档", "说「帮我看看商业模式」跑 /dbs-diagnosis，dbs-save 落档");
    setupExpandables("#dbs-archives", ".arch-card");
    $("#dbs-benchmark").innerHTML = `
      <div class="bet-note">还没想清楚该模仿谁？五重过滤法只看对方的数据结构，不看「我觉得」。</div>
      ${cheat.benchmark_name ? `<div class="cmd"><code>${esc(cheat.benchmark_name)}</code><span>${cheat.benchmark_sample_count || 0} 个对标样本已入库（benchmark.md）</span></div>` : ""}
      <div class="wb-actions">${copyBtnHTML("复制指令：帮我找对标", "帮我找对标", true)}</div>`;
    const groups = dbs.groups || [];
    $("#dbs-tools-count").textContent = `${dbs.total || 0} 个 · ${dbs.local_count || 0} 本地已装`;
    $("#dbs-groups").innerHTML = groups.map(group => `
      <section class="dbs-cat">
        <div class="dbs-cat-head"><span class="bar4"></span><h2>${esc(group.cat)}</h2><span class="n">${group.skills.length} 个工具</span></div>
        <div class="skill-grid">
          ${group.skills.map(skill => `
            <article class="skill-card">
              <div class="skill-name">${esc(skill.name)}${skill.local ? `<span class="skill-local">本地已装</span>` : ""}</div>
              <div class="skill-desc">${esc(skill.desc)}</div>
              <div class="skill-trig">${esc(skill.trigger)}</div>
            </article>
          `).join("")}
        </div>
      </section>
    `).join("") || emptyState("暂无工具目录");
    activateFx();
  }

  function renderSideStatus(data) {
    const container = $("#side-status");
    if (!container) return;
    const global = data.global || {};
    const alert = global.alert || {};
    const sources = Array.isArray(global.signal_sources) ? global.signal_sources.length : 0;
    container.innerHTML = `
      <div class="sf-alert ${alert.level === "critical" ? "crit" : ""}">${esc(alert.text || "状态正常")}</div>
      <div class="sf-row"><span>阶段</span><b>${esc(global.stage || "—")}</b></div>
      <div class="sf-row"><span>校准</span><b>${esc(String(global.calibration_samples ?? 0))} / 5</b></div>
      <div class="sf-row"><span>信号源</span><b>${sources} 在线</b></div>
      <div class="sf-date">${esc(global.today || "")}</div>`;
  }

  /* ── 数据过期告警横幅（9 页共享）──
     定时任务 每晚 20:00 抓热点；抓失败时看板会静默显示旧信号。
     freshness 为 stale/critical 时在各页 main 顶部插一条横幅，其余情况完全不渲染。
     宿主选 main 而不是 .app：.app 是 216px + 1fr 两列 grid，直接塞子元素会串格。 */
  const STALE_BANNER_KEY = "wb-stale-banner-dismissed";

  function staleBannerDismissed(key) {
    try {
      return window.sessionStorage.getItem(STALE_BANNER_KEY) === key;
    } catch (error) {
      return false;                       /* file:// 下 sessionStorage 可能被禁用 */
    }
  }

  function rememberStaleBannerDismissed(key) {
    try {
      window.sessionStorage.setItem(STALE_BANNER_KEY, key);
    } catch (error) {
      /* 忽略：关闭只在本次会话生效，存不下就下次刷新再出现 */
    }
  }

  function renderStaleBanner(data) {
    const global = data.global || {};
    const level = global.data_freshness;
    if (level !== "stale" && level !== "critical") return;
    const host = document.querySelector("main");
    if (!host || host.querySelector(".wb-stale-banner")) return;
    const lastDate = global.radar_last_date || "未知";
    const days = numberOrNull(global.radar_stale_days);
    const key = `${level}:${lastDate}`;
    if (staleBannerDismissed(key)) return;
    const banner = document.createElement("div");
    banner.className = `wb-stale-banner ${level === "critical" ? "is-critical" : "is-stale"}`;
    banner.setAttribute("role", "status");
    banner.innerHTML = `
      <span class="wb-stale-mark">⚠</span>
      <b class="wb-stale-main">雷达数据已过期 ${days === null ? "—" : esc(String(days))} 天 · 最后成功刷新 ${esc(lastDate)}</b>
      <span class="wb-stale-hint">每日 20:00 自动刷新未成功 · 检查热点刷新任务</span>
      <button type="button" class="wb-stale-close" aria-label="关闭数据过期提示">✕</button>`;
    const close = banner.querySelector(".wb-stale-close");
    if (close) {
      close.addEventListener("click", () => {
        banner.remove();
        rememberStaleBannerDismissed(key);
      });
    }
    host.insertBefore(banner, host.firstChild);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const data = dashboardData();
    const page = document.body.dataset.page || "index";
    setCorner(data, page);
    renderSideStatus(data);
    renderStaleBanner(data);
    setupCopyButtons();
    if (page === "index") renderIndex(data);
    if (page === "ideas") renderIdeas(data);
    if (page === "auto-hotspots") renderAutoHotspots(data);
    if (page === "radar") renderRadar(data);
    if (page === "pipeline") renderPipeline(data);
    if (page === "analytics") renderAnalytics(data);
    if (page === "library") renderLibrary(data);
    if (page === "cheat") renderCheat(data);
    if (page === "dbs") renderDbs(data);
    if (page === "radar") window.addEventListener("hashchange", expandSignalFromHash);
  });
})();
