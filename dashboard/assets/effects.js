/*!
 * effects.js — Workbench 动效库（零依赖 / vanilla IIFE / file:// 可用）
 * 暴露：window.WBFX = { refresh() }
 * 自动初始化：DOMContentLoaded 后等一帧 rAF 再扫描 DOM；refresh() 幂等可重入。
 *
 * 能力与 data-attribute 契约：
 *  1) 粒子层     body[data-fx-particles]
 *     在 body 末尾插入 <canvas id="fx-particles">（fixed inset:0, pointer-events:none, z-index:1）。
 *     约 70 颗暗尘（灰白 alpha 0.05-0.18 漂移+闪烁）+ 约 14 颗余烬火星（#ff7a45 系，
 *     上升摇曳渐隐重生）。鼠标视差按粒子深度 0.01-0.05 偏移。页面主容器需 z-index>=2。
 *     可选萤火配置 body[data-fx-particles="firefly"]：数量减半（35 尘 + 7 火星），
 *     色板换金色系（#ffd27a / #ffb64d 为主）。无值时行为与原版完全一致。
 *  2) 流体卡     .fx-fluid[data-fluid="ember|violet|steel|moss|mono"]
 *     每卡插入首子元素 <canvas class="fx-fluid-canvas">（absolute inset:0,
 *     border-radius:inherit, z-index:0）。WebGL1 fbm+domain warp 流动色场，
 *     鼠标卡内局部坐标径向衰减扰动噪声域。整体不透明度读 CSS 变量 --fluid-alpha（默认 0.55）。
 *     WebGL 不可用降级为 2D 三团模糊径向渐变游走。全部流体卡共用一个 rAF，目标 30fps。
 *     卡内内容由页面侧保证 position:relative; z-index:1。
 *  3) 倾斜视差   [data-tilt]
 *     pointermove → perspective(900px) rotateX(±6deg) rotateY(±8deg)，rAF 节流；
 *     离开 0.5s 弹回；插入 .fx-glare 径向高光（white alpha<=0.12）跟随指针；
 *     触屏与 prefers-reduced-motion 下禁用。
 *  4) 3D 卡片弧（浅弧 coverflow） [data-ring]（子卡 .ring-card；可选 data-cruise=度/秒，默认 5）
 *     内建 .ring-stage(perspective:1400px) > .ring-rotor(静态定位容器, perspective:1400px)。
 *     连续角度 θ 与 step=360/N 保留；每帧对每卡按 δ=wrap±180(i*step+θ) 写独立 transform：
 *     translateX(sin δ*RX) translateZ((cos δ-1)*260) rotateY(clamp(-δ*0.5,±55°)) scale(0.86+0.14cos δ)。
 *     RX = 面板宽/2 - 卡宽/2 - 24（resize 防抖重算，侧卡贴近面板左右缘）。
 *     z-index 按 cos δ 排；|δ|>128° 的卡 opacity:0 + pointer-events:none 藏到弧后。
 *     自动巡航，hover/拖拽暂停；拖拽 θ+=dx*0.35 带惯性；
 *     Alt+滚轮缩放 rotor translateZ clamp(-240..160)；点击任意可见卡片都直接打开详情，
 *     不再要求侧卡先转正、再点第二次；由该卡向上冒泡派发
 *     CustomEvent('wbfx:ringactivate', {detail:{index}})，页面侧接管“放大看详情”；
 *     卡片带 tabindex=0/role=button，Enter/空格 等效点击；
 *     每帧写各卡 --away=(1-cos δ)/2 内联 CSS 变量。容器内按钮：
 *     [data-ring-action="cruise"]（切换巡航, aria-pressed）
 *     [data-ring-action="reset"]（复位 θ 与缩放）
 *     [data-ring-action="grid"]（容器切 .ring-as-grid 并停用 transform，平铺由页面侧 CSS 实现）
 *  5) 数字滚动   [data-countup="目标数"]（可选 data-decimals、data-suffix）
 *     进入视口触发一次，600ms easeOutCubic，千分位逗号格式化；
 *     prefers-reduced-motion 或 document.hidden 时直接写终值不动画。
 *  6) 入场编排   [data-reveal]
 *     进入视口加 .is-in（过渡由页面侧 CSS 写），同容器内按 DOM 顺序 60ms 级联
 *     （设置 style.transitionDelay）。
 *  7) 雷达扫描盘 [data-radar-sweep]（数据：data-radar-signals='[{"t":类型,"h":热度,"n":短标题}]'）
 *     canvas 极坐标雷达盘：四象限 = 四类型（热点橙 #ff5c33 / 方法论蓝 #5b8def /
 *     赚钱绿 #5bd69a / 共鸣紫 #9a8cff），信号点落对应象限、半径按互动热度
 *     （热度无梯度时按序均布），点带类型色光晕。扫描线约 8s/圈；扫过信号点时
 *     该点闪亮并向页面冒泡派发 CustomEvent('wbfx:radarping', {detail:{index}})；
 *     点击信号点派发 CustomEvent('wbfx:radarselect', {detail:{index}})。
 *     reduced-motion 渲染静态盘不扫描；document.hidden / 离屏暂停；refresh() 幂等清理。
 *
 * 全局守则：prefers-reduced-motion: reduce → 动画静止但渲染一张静态帧；
 * document.hidden → 暂停所有 rAF；IntersectionObserver 离屏暂停；
 * DPR 上限 1.5；流体画布分辨率再 ×0.5。
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 公共工具                                                            */
  /* ------------------------------------------------------------------ */

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function hexRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function easeOutCubic(t) { var u = 1 - t; return 1 - u * u * u; }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function prefersReduced() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  function isCoarsePointer() {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch (e) { return false; }
  }

  function dpr() {
    return Math.min(window.devicePixelRatio || 1, 1.5);
  }

  /* 共享 rAF 心跳：document.hidden 时整体暂停，可见时恢复。 */
  var ticker = (function () {
    var subs = [];
    var rafId = 0;
    var lastT = 0;
    function loop(t) {
      rafId = 0;
      if (document.hidden) { lastT = 0; return; }
      var dt = lastT ? Math.min((t - lastT) / 1000, 0.1) : 0.016;
      lastT = t;
      var list = subs.slice();
      for (var i = 0; i < list.length; i++) list[i](dt, t / 1000);
      if (subs.length) rafId = requestAnimationFrame(loop);
    }
    function kick() {
      if (!rafId && subs.length && !document.hidden) {
        lastT = 0;
        rafId = requestAnimationFrame(loop);
      }
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) kick();
    });
    return {
      add: function (fn) {
        if (subs.indexOf(fn) < 0) subs.push(fn);
        kick();
        return function () {
          var i = subs.indexOf(fn);
          if (i >= 0) subs.splice(i, 1);
        };
      }
    };
  })();

  /* 是否已跑过一次 refresh（app.js 渲染完会显式调，boot 兜底不可重复） */
  var refreshed = false;

  /* 当前 refresh 周期的清理器集合 */
  var disposers = [];
  function onDispose(fn) { disposers.push(fn); }
  function listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts || false);
    onDispose(function () { target.removeEventListener(type, fn, opts || false); });
  }

  /* ------------------------------------------------------------------ */
  /* 1) 粒子层                                                           */
  /* ------------------------------------------------------------------ */

  function initParticles(reduced) {
    if (!document.body || !document.body.hasAttribute('data-fx-particles')) return;
    /* 萤火配置：仅当属性值恰为 "firefly" 时启用；无值 = 原行为（向后兼容） */
    var firefly = document.body.getAttribute('data-fx-particles') === 'firefly';

    var canvas = document.createElement('canvas');
    canvas.id = 'fx-particles';
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:1;';
    document.body.appendChild(canvas);
    onDispose(function () {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    });

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var W = 0, H = 0;
    function resize() {
      var d = dpr();
      W = Math.max(1, Math.round(window.innerWidth * d));
      H = Math.max(1, Math.round(window.innerHeight * d));
      canvas.width = W;
      canvas.height = H;
      /* reduced 下 resize 会清空画布且无 rAF 重绘 → 补一帧静态重绘
         （初始调用时 dust 尚未创建，跳过） */
      if (reduced && dust) draw(0, 1.7);
    }
    resize();
    var resizeTimer = 0;
    listen(window, 'resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });
    onDispose(function () { clearTimeout(resizeTimer); });

    var mouse = { x: 0, y: 0 }; /* 相对屏幕中心的像素偏移 */
    listen(window, 'pointermove', function (e) {
      mouse.x = e.clientX - window.innerWidth / 2;
      mouse.y = e.clientY - window.innerHeight / 2;
    }, { passive: true });

    var dust = [];
    var embers = [];
    var i;
    /* 尘埃色板（加权）：暖白+琥珀合计约 60%，紫/青/蓝各约 13%。
       整体依旧克制：alpha 仍限 0.04-0.18。
       firefly：金色系（#ffd27a / #ffb64d 为主 + 少量暖白）。 */
    var DUST_COLORS = firefly ? [
      { rgb: '255,210,122', w: 0.46 },   /* 金 #ffd27a */
      { rgb: '255,182,77', w: 0.34 },    /* 金橙 #ffb64d */
      { rgb: '232,236,243', w: 0.2 }     /* 暖白 */
    ] : [
      { rgb: '232,236,243', w: 0.31 },   /* 暖白 */
      { rgb: '255,178,122', w: 0.29 },   /* 琥珀 #ffb27a */
      { rgb: '154,140,255', w: 0.13 },   /* 紫 #9a8cff */
      { rgb: '111,216,208', w: 0.13 },   /* 青 #6fd8d0 */
      { rgb: '127,178,255', w: 0.14 }    /* 蓝 #7fb2ff */
    ];
    function pickDustColor() {
      var r = Math.random(), acc = 0;
      for (var k = 0; k < DUST_COLORS.length; k++) {
        acc += DUST_COLORS[k].w;
        if (r < acc) return DUST_COLORS[k].rgb;
      }
      return DUST_COLORS[0].rgb;
    }
    for (i = 0; i < (firefly ? 35 : 70); i++) {
      dust.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.008,
        vy: (Math.random() - 0.5) * 0.006,
        r: 0.5 + Math.random() * 1.3,
        a: 0.04 + Math.random() * 0.14,
        rgb: pickDustColor(),
        tw: 0.4 + Math.random() * 1.4,      /* 闪烁频率 */
        ph: Math.random() * Math.PI * 2,
        depth: 0.01 + Math.random() * 0.04
      });
    }
    function spawnEmber(p, initial) {
      p.x = Math.random();
      p.y = initial ? Math.random() : (0.95 + Math.random() * 0.1);
      p.vy = 0.015 + Math.random() * 0.03;   /* 上升速度（归一化/秒） */
      p.sway = 6 + Math.random() * 14;       /* 摇曳幅度 px */
      p.sf = 0.6 + Math.random() * 1.2;      /* 摇曳频率 */
      p.ph = Math.random() * Math.PI * 2;
      p.r = 0.8 + Math.random() * 1.6;
      p.life = 0;
      p.ttl = 6 + Math.random() * 8;         /* 生命周期秒 */
      /* 火星以橙为主；约 1/5 概率生成紫或青的冷色火星（更暗、alpha 0.25-0.5）。
         firefly：全部金色火星（#ffd27a / #ffb64d 系）。 */
      var roll = firefly ? 1 : Math.random();
      if (firefly) {
        p.hue = 38 + Math.random() * 10;     /* #ffb64d~#ffd27a 附近的金 */
        p.sat = 100; p.lit = 66;
        p.amax = 0.42 + Math.random() * 0.12;
      } else if (roll < 0.1) {
        p.hue = 242 + Math.random() * 12;    /* 紫 #9a8cff 附近 */
        p.sat = 100; p.lit = 76;
        p.amax = 0.25 + Math.random() * 0.25;
      } else if (roll < 0.2) {
        p.hue = 170 + Math.random() * 10;    /* 青 #6fd8d0 附近 */
        p.sat = 58; p.lit = 64;
        p.amax = 0.25 + Math.random() * 0.25;
      } else {
        p.hue = 18 + Math.random() * 12;     /* #ff7a45 附近的橙 */
        p.sat = 100; p.lit = 63;
        p.amax = 0.55;
      }
      p.depth = 0.01 + Math.random() * 0.04;
      return p;
    }
    for (i = 0; i < (firefly ? 7 : 14); i++) embers.push(spawnEmber({}, true));

    var t0 = 0;
    function draw(dt, t) {
      t0 = t;
      var d = dpr();
      ctx.clearRect(0, 0, W, H);
      var j, p, px, py, tw;
      for (j = 0; j < dust.length; j++) {
        p = dust[j];
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -0.02) p.x = 1.02; if (p.x > 1.02) p.x = -0.02;
        if (p.y < -0.02) p.y = 1.02; if (p.y > 1.02) p.y = -0.02;
        tw = 0.6 + 0.4 * Math.sin(t * p.tw + p.ph);
        px = p.x * W + mouse.x * p.depth * d;
        py = p.y * H + mouse.y * p.depth * d;
        ctx.beginPath();
        ctx.arc(px, py, p.r * d, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + p.rgb + ',' + (p.a * tw).toFixed(3) + ')';
        ctx.fill();
      }
      for (j = 0; j < embers.length; j++) {
        p = embers[j];
        p.life += dt;
        p.y -= p.vy * dt;
        if (p.life > p.ttl || p.y < -0.05) spawnEmber(p, false);
        var fade = Math.sin(Math.PI * clamp(p.life / p.ttl, 0, 1)); /* 渐显渐隐 */
        px = p.x * W + Math.sin(t * p.sf + p.ph) * p.sway * d + mouse.x * p.depth * d;
        py = p.y * H + mouse.y * p.depth * d;
        ctx.beginPath();
        ctx.arc(px, py, p.r * d, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + p.hue.toFixed(0) + ',' + p.sat + '%,' + p.lit + '%,' +
          (p.amax * fade).toFixed(3) + ')';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, p.r * 3 * d, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + p.hue.toFixed(0) + ',' + p.sat + '%,' +
          Math.max(40, p.lit - 8) + '%,' + (0.10 * fade * (p.amax / 0.55)).toFixed(3) + ')';
        ctx.fill();
      }
    }

    if (reduced) {
      for (i = 0; i < embers.length; i++) {
        embers[i].life = 0.2 + Math.random() * embers[i].ttl * 0.6;
      }
      draw(0, 1.7);            /* 静态一帧 */
      return;
    }
    onDispose(ticker.add(function (dt, t) { draw(dt, t); }));
  }

  /* ------------------------------------------------------------------ */
  /* 2) 流体卡                                                           */
  /* ------------------------------------------------------------------ */

  var PALETTES = {
    ember:  ['#ff5c38', '#ff9e5e', '#2a0e14'],
    violet: ['#7c5cff', '#ff5c9e', '#160e2a'],
    steel:  ['#4f7dff', '#7fc8ff', '#0c1524'],
    moss:   ['#2fd98a', '#a8ff8f', '#0c2016'],
    gold:   ['#ffb64d', '#ff8a3d', '#241505'],
    teal:   ['#4fd6c8', '#7fb2ff', '#0a1f1e'],
    mono:   ['#dfe5ee', '#7c8598', '#12161f']
  };

  var FRAG_SRC = [
    'precision mediump float;',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform vec2 uMouse;',
    'uniform float uMouseStr;',
    'uniform vec3 uC1;',
    'uniform vec3 uC2;',
    'uniform vec3 uC3;',
    'float hash(vec2 p){',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
    '}',
    'float noise(vec2 p){',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 p){',                     /* 3 octaves */
    '  float v = 0.0; float a = 0.5;',
    '  for (int k = 0; k < 3; k++) {',
    '    v += a * noise(p);',
    '    p = p * 2.03 + vec2(11.3, 7.7);',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  float aspect = uRes.x / max(uRes.y, 1.0);',
    '  vec2 p = uv * 3.0; p.x *= aspect;',
    '  float t = uTime * 0.07;',
    '  vec2 duv = uv - uMouse; duv.x *= aspect;',
    '  float md = length(duv);',
    '  float infl = uMouseStr * exp(-md * md * 9.0);',   /* 径向衰减 */
    '  p += duv * infl * 2.8;',                          /* 鼠标扰动噪声域 */
    '  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t * 0.8));',
    '  vec2 r = vec2(fbm(p + 3.2 * q + vec2(1.7, 9.2) + t * 0.45),',
    '                fbm(p + 3.2 * q + vec2(8.3, 2.8) - t * 0.3));',
    '  float f = fbm(p + 3.0 * r + infl * 1.5);',
    '  vec3 col = mix(uC3, uC1, clamp(f * 1.7 - 0.1, 0.0, 1.0));',
    '  col = mix(col, uC2, clamp(q.y * q.x * 2.0, 0.0, 1.0) * 0.65);',
    '  col += uC2 * infl * 0.25;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var VERT_SRC = [
    'attribute vec2 aP;',
    'void main(){ gl_Position = vec4(aP, 0.0, 1.0); }'
  ].join('\n');

  function makeGL(canvas) {
    var gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false }) ||
           canvas.getContext('experimental-webgl', { alpha: false, antialias: false });
    } catch (e) { gl = null; }
    if (!gl) return null;
    /* shader 编译/link 失败时释放已占用的 webgl context 再返回 null */
    function fail() {
      try {
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      } catch (e) { /* ignore */ }
      return null;
    }
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VERT_SRC);
    var fs = sh(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return fail();
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return fail();
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aP');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return {
      gl: gl,
      u: {
        res: gl.getUniformLocation(prog, 'uRes'),
        time: gl.getUniformLocation(prog, 'uTime'),
        mouse: gl.getUniformLocation(prog, 'uMouse'),
        mstr: gl.getUniformLocation(prog, 'uMouseStr'),
        c1: gl.getUniformLocation(prog, 'uC1'),
        c2: gl.getUniformLocation(prog, 'uC2'),
        c3: gl.getUniformLocation(prog, 'uC3')
      }
    };
  }

  function initFluid(reduced) {
    var cards = document.querySelectorAll('.fx-fluid[data-fluid]');
    if (!cards.length) return;

    var units = [];
    var io = ('IntersectionObserver' in window) ?
      new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          for (var j = 0; j < units.length; j++) {
            if (units[j].card === entries[i].target) {
              units[j].visible = entries[i].isIntersecting;
            }
          }
        }
      }, { rootMargin: '80px' }) : null;
    if (io) onDispose(function () { io.disconnect(); });

    Array.prototype.forEach.call(cards, function (card) {
      var pal = PALETTES[card.getAttribute('data-fluid')] || PALETTES.mono;
      var canvas = document.createElement('canvas');
      canvas.className = 'fx-fluid-canvas';
      var alpha = parseFloat(
        getComputedStyle(card).getPropertyValue('--fluid-alpha'));
      if (!(alpha >= 0)) alpha = 0.55;
      canvas.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;' +
        'border-radius:inherit;z-index:0;pointer-events:none;opacity:' + alpha + ';';
      card.insertBefore(canvas, card.firstChild);

      var unit = {
        card: card, canvas: canvas, pal: pal,
        glctx: null, ctx2d: null, visible: true,
        mx: 0.5, my: 0.5, mstr: 0, tmx: 0.5, tmy: 0.5, tmstr: 0,
        seed: Math.random() * 100
      };

      /* 初始尺寸（resize 统一由所有 units 共用的防抖监听处理） */
      var rect0 = card.getBoundingClientRect();
      var scale0 = dpr() * 0.5;           /* 流体画布分辨率再 ×0.5 */
      canvas.width = Math.max(2, Math.round(rect0.width * scale0));
      canvas.height = Math.max(2, Math.round(rect0.height * scale0));

      unit.glctx = makeGL(canvas);
      if (!unit.glctx) {
        unit.ctx2d = canvas.getContext('2d');
        if (!unit.ctx2d) {
          /* canvas 已被失败的 webgl context 占用 → 克隆新 canvas 替换再取 2d */
          var fresh = canvas.cloneNode(false);
          if (canvas.parentNode) canvas.parentNode.replaceChild(fresh, canvas);
          canvas = fresh;
          unit.canvas = fresh;
          unit.ctx2d = fresh.getContext('2d');
        }
      }

      onDispose(function () {
        if (unit.glctx) {
          try {
            var lose = unit.glctx.gl.getExtension('WEBGL_lose_context');
            if (lose) lose.loseContext();
          } catch (e) { /* ignore */ }
        }
        if (unit.canvas.parentNode) {
          unit.canvas.parentNode.removeChild(unit.canvas);
        }
      });

      if (!reduced) {
        listen(card, 'pointermove', function (e) {
          var rect = card.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) return;
          unit.tmx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
          unit.tmy = 1 - clamp((e.clientY - rect.top) / rect.height, 0, 1);
          unit.tmstr = 1;
        }, { passive: true });
        listen(card, 'pointerleave', function () { unit.tmstr = 0; });
      }
      if (io) io.observe(card);
      units.push(unit);
    });

    /* 全部 units 共用一个防抖 resize：先纯读全部 rect，再纯写 canvas 尺寸 */
    function resizeAll() {
      var scale = dpr() * 0.5;
      var rects = [];
      var i;
      for (i = 0; i < units.length; i++) {
        rects.push(units[i].card.getBoundingClientRect());
      }
      for (i = 0; i < units.length; i++) {
        units[i].canvas.width = Math.max(2, Math.round(rects[i].width * scale));
        units[i].canvas.height = Math.max(2, Math.round(rects[i].height * scale));
      }
      /* reduced 下无 rAF 重绘 → 每张卡补一帧静态重绘 */
      if (reduced) {
        for (i = 0; i < units.length; i++) renderUnit(units[i], 12.0);
      }
    }
    var fluidResizeTimer = 0;
    listen(window, 'resize', function () {
      clearTimeout(fluidResizeTimer);
      fluidResizeTimer = setTimeout(resizeAll, 150);
    });
    onDispose(function () { clearTimeout(fluidResizeTimer); });

    function renderUnit(unit, t) {
      var w = unit.canvas.width, h = unit.canvas.height;
      var time = t + unit.seed;
      if (unit.glctx) {
        var g = unit.glctx.gl, u = unit.glctx.u;
        g.viewport(0, 0, w, h);
        g.uniform2f(u.res, w, h);
        g.uniform1f(u.time, time);
        g.uniform2f(u.mouse, unit.mx, unit.my);
        g.uniform1f(u.mstr, unit.mstr);
        var c1 = hexRgb(unit.pal[0]), c2 = hexRgb(unit.pal[1]), c3 = hexRgb(unit.pal[2]);
        g.uniform3f(u.c1, c1[0], c1[1], c1[2]);
        g.uniform3f(u.c2, c2[0], c2[1], c2[2]);
        g.uniform3f(u.c3, c3[0], c3[1], c3[2]);
        g.drawArrays(g.TRIANGLES, 0, 3);
      } else if (unit.ctx2d) {
        var ctx = unit.ctx2d;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = unit.pal[2];
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        var blobs = [
          [unit.pal[0], 0.9, 0.31, 0.55],
          [unit.pal[1], 1.3, 0.27, 0.35],
          [unit.pal[0], 0.6, 0.36, 0.45]
        ];
        for (var b = 0; b < blobs.length; b++) {
          var sp = blobs[b][1], amp = blobs[b][2];
          var bx = w * (0.5 + amp * Math.sin(time * 0.22 * sp + b * 2.1));
          var by = h * (0.5 + amp * Math.cos(time * 0.17 * sp + b * 1.7));
          var rad = Math.max(w, h) * blobs[b][3];
          var grd = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
          grd.addColorStop(0, blobs[b][0]);
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(bx, by, rad, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    if (reduced) {
      for (var i = 0; i < units.length; i++) renderUnit(units[i], 12.0);
      return;
    }

    var frame = 0;
    onDispose(ticker.add(function (dt, t) {
      frame++;
      if (frame % 2) return;                 /* 隔帧渲染 → 目标 30fps */
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        /* 鼠标状态缓动，离屏也保持轻量更新但不渲染 */
        u.mx += (u.tmx - u.mx) * 0.12;
        u.my += (u.tmy - u.my) * 0.12;
        u.mstr += (u.tmstr - u.mstr) * 0.08;
        if (!u.visible) continue;
        renderUnit(u, t);
      }
    }));
  }

  /* ------------------------------------------------------------------ */
  /* 3) 倾斜视差                                                         */
  /* ------------------------------------------------------------------ */

  function initTilt(reduced) {
    if (reduced || isCoarsePointer()) return;
    var els = document.querySelectorAll('[data-tilt]');
    Array.prototype.forEach.call(els, function (el) {
      var prevStyle = el.getAttribute('style');
      if (getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }
      var glare = document.createElement('div');
      glare.className = 'fx-glare';
      glare.style.cssText =
        'position:absolute;inset:0;border-radius:inherit;pointer-events:none;' +
        'z-index:3;opacity:0;transition:opacity .3s ease;';
      el.appendChild(glare);

      var raf = 0, px = 0.5, py = 0.5, inside = false;

      function apply() {
        raf = 0;
        if (!inside) return;
        var rx = (0.5 - py) * 12;   /* ±6deg */
        var ry = (px - 0.5) * 16;   /* ±8deg */
        el.style.transition = 'none';
        el.style.transform =
          'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' +
          ry.toFixed(2) + 'deg)';
        glare.style.background =
          'radial-gradient(circle at ' + (px * 100).toFixed(1) + '% ' +
          (py * 100).toFixed(1) + '%, rgba(255,255,255,0.12), rgba(255,255,255,0) 60%)';
        glare.style.opacity = '1';
      }

      listen(el, 'pointerenter', function () { inside = true; });
      listen(el, 'pointermove', function (e) {
        var rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;
        px = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        py = clamp((e.clientY - rect.top) / rect.height, 0, 1);
        inside = true;
        if (!raf) raf = requestAnimationFrame(apply);
      }, { passive: true });
      listen(el, 'pointerleave', function () {
        inside = false;
        el.style.transition = 'transform .5s cubic-bezier(.2,.9,.3,1.15)';
        el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
        glare.style.opacity = '0';
      });

      onDispose(function () {
        if (raf) cancelAnimationFrame(raf);
        if (glare.parentNode) glare.parentNode.removeChild(glare);
        if (prevStyle === null) el.removeAttribute('style');
        else el.setAttribute('style', prevStyle);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 4) 3D 卡片环                                                        */
  /* ------------------------------------------------------------------ */

  function initRing(reduced) {
    var rings = document.querySelectorAll('[data-ring]');
    Array.prototype.forEach.call(rings, function (container) {
      var cards = Array.prototype.slice.call(
        container.querySelectorAll('.ring-card'));
      var N = cards.length;
      if (!N) return;

      var savedStyles = cards.map(function (c) { return c.getAttribute('style'); });
      var step = 360 / N;

      /* 键盘可达：卡片可聚焦、语义为按钮（dispose 时移除） */
      cards.forEach(function (c) {
        c.setAttribute('tabindex', '0');
        c.setAttribute('role', 'button');
      });

      /* stage/rotor 的环模式内联样式基线：applyGrid(false) 时整体重建，
         applyGrid(true) 时整体清空（让 .ring-as-grid 的 CSS 完整接管），
         两个方向都幂等。 */
      var STAGE_CSS =
        'position:relative;width:100%;height:100%;perspective:1400px;' +
        'touch-action:pan-y;';
      /* rotor 不再整体 rotateY：退化为静态居中定位容器。自身带 perspective
         给各卡独立 transform 用（flat 上下文，卡片 z-index 层叠可控），
         zoom 时 rotor translateZ 借 stage 的 perspective 生效。 */
      var ROTOR_CSS =
        'position:absolute;left:50%;top:50%;width:0;height:0;' +
        'perspective:1400px;';

      var stage = document.createElement('div');
      stage.className = 'ring-stage';
      stage.style.cssText = STAGE_CSS;
      var rotor = document.createElement('div');
      rotor.className = 'ring-rotor';
      rotor.style.cssText = ROTOR_CSS;
      stage.appendChild(rotor);
      container.appendChild(stage);
      cards.forEach(function (c) { rotor.appendChild(c); });

      var state = {
        /* 初始 θ=0：第 0 张卡 δ=0 正对正面 */
        theta: 0, vel: 0, zoom: 0,
        cruise: parseFloat(container.getAttribute('data-cruise')),
        cruising: !reduced,
        hover: false, pressing: false, dragging: false, grid: false, detailOpen: false,
        spin: null,           /* {from,to,start,dur} 点击转正面动画 */
        RX: 300               /* 浅弧横向半径：侧卡中心到面板中心的水平距离 */
      };
      if (!(state.cruise > 0)) state.cruise = 5;

      function layout() {
        /* 浅弧 coverflow 几何随面板宽度自适应：RX = 宽/2 - 卡宽/2 - 24，
           |δ|=90° 的侧卡贴近面板左右边缘，宽度用满。resize 防抖时重算。 */
        var cw = 0;
        if (cards[0]) {
          var rect = cards[0].getBoundingClientRect();
          cw = rect.width;
        }
        if (!(cw > 10)) cw = 320;                 /* 卡片 CSS 定宽的兜底 */
        var W = stage.getBoundingClientRect().width;
        if (!(W > 10)) W = container.getBoundingClientRect().width;
        if (!(W > 10)) W = 1200;
        /* ×(1400+260)/1400：补偿侧卡 translateZ(-260) 的透视收缩，让投影后贴近面板边缘 */
        state.RX = Math.max(60, (W / 2 - cw / 2 - 24) * ((1400 + 260) / 1400));
        for (var i = 0; i < N; i++) {
          cards[i].style.position = 'absolute';
          cards[i].style.left = '50%';
          cards[i].style.top = '50%';
        }
      }

      function render() {
        if (state.grid) return;
        rotor.style.transform = 'translateZ(' + state.zoom.toFixed(1) + 'px)';
        for (var i = 0; i < N; i++) {
          /* δ = wrapTo±180(i*step + θ)，每卡独立 transform（rotor 不再整体旋转） */
          var d = ((i * step + state.theta) % 360 + 540) % 360 - 180;
          var rad = d * Math.PI / 180;
          var cosd = Math.cos(rad);
          var card = cards[i];
          card.style.transform =
            'translate(-50%,-50%) translateX(' +
            (Math.sin(rad) * state.RX).toFixed(1) + 'px) translateZ(' +
            ((cosd - 1) * 260).toFixed(1) + 'px) rotateY(' +
            clamp(-d * 0.5, -55, 55).toFixed(2) + 'deg) scale(' +
            (0.86 + 0.14 * cosd).toFixed(4) + ')';
          /* 越靠前（cos δ 越大）层级越高 */
          card.style.zIndex = String(Math.round((cosd + 1) * 500));
          /* |δ|>110° 藏到弧后；其余交给 CSS 按 --away 压暗（内联 opacity 清空放行） */
          var hidden = Math.abs(d) > 128;
          card.style.opacity = hidden ? '0' : '';
          card.style.pointerEvents = hidden ? 'none' : '';
          card.style.setProperty('--away', ((1 - cosd) / 2).toFixed(3));
        }
      }

      /* 初次布局：卡片刚移入 rotor，等样式生效后量宽 */
      cards.forEach(function (c) {
        c.style.position = 'absolute';
        c.style.left = '50%';
        c.style.top = '50%';
      });
      layout();
      render();
      var ringResizeTimer = 0;
      listen(window, 'resize', function () {
        clearTimeout(ringResizeTimer);
        ringResizeTimer = setTimeout(function () {
          if (!state.grid) { layout(); render(); }
        }, 150);
      });
      onDispose(function () { clearTimeout(ringResizeTimer); });

      /* 悬停暂停巡航 */
      listen(container, 'pointerenter', function () { state.hover = true; });
      listen(container, 'pointerleave', function () { state.hover = false; });

      /* 拖拽 */
      var DRAG_THRESHOLD = 10;
      var drag = {
        on: false, lastX: 0, moved: 0, id: 0,
        cardIndex: -1, captured: false
      };
      listen(stage, 'pointerdown', function (e) {
        if (state.grid) return;
        var pressedCard = e.target.closest ? e.target.closest('.ring-card') : null;
        drag.on = true;
        drag.lastX = e.clientX;
        drag.moved = 0;
        drag.id = e.pointerId;
        drag.cardIndex = pressedCard ? cards.indexOf(pressedCard) : -1;
        drag.captured = false;
        state.pressing = true;
        state.dragging = false;
        state.vel = 0;
        state.spin = null;
      });
      listen(stage, 'pointermove', function (e) {
        if (!drag.on || state.grid) return;
        var dx = e.clientX - drag.lastX;
        drag.lastX = e.clientX;
        drag.moved += Math.abs(dx);
        /* 真实鼠标/触控板点击会有 1-8px 抖动。超过阈值后才进入拖拽并捕获指针，
           否则 pointerup 仍按 pointerdown 时保存的卡片目标执行点击。 */
        if (!state.dragging) {
          if (drag.moved < DRAG_THRESHOLD) return;
          state.dragging = true;
          try {
            stage.setPointerCapture(e.pointerId);
            drag.captured = true;
          } catch (err) {}
        }
        state.theta += dx * 0.35;
        state.vel = dx * 0.35 * 60;    /* 换算为 度/秒 */
        if (reduced) render();
      });
      /* 激活 = “放大看详情”：由该卡向上冒泡派发，页面侧监听接管 */
      function activateCard(idx) {
        state.detailOpen = true;
        cards.forEach(function (card, cardIndex) {
          card.classList.toggle('is-detail-source', cardIndex === idx);
          card.setAttribute('aria-expanded', cardIndex === idx ? 'true' : 'false');
        });
        try {
          cards[idx].dispatchEvent(new CustomEvent('wbfx:ringactivate',
            { bubbles: true, detail: { index: idx } }));
        } catch (err) { /* 老引擎无 CustomEvent 构造器时静默 */ }
      }

      /* 两种模式统一为一次点击直接打开；卡片的当前视觉位置交给页面侧做 FLIP。 */
      function tapCard(idx) {
        activateCard(idx);
      }

      /* 详情关闭后再恢复巡航。打开期间冻结弧环，确保关闭动画能滑回原卡位置。 */
      listen(document, 'wbfx:ringclose', function () {
        state.detailOpen = false;
        cards.forEach(function (card) {
          card.classList.remove('is-detail-source');
          card.setAttribute('aria-expanded', 'false');
        });
      });

      function endDrag(e) {
        if (!drag.on) return;
        var wasDragging = state.dragging || drag.moved >= DRAG_THRESHOLD;
        var pressedIndex = drag.cardIndex;
        drag.on = false;
        state.pressing = false;
        state.dragging = false;
        if (drag.captured) {
          try { stage.releasePointerCapture(drag.id); } catch (err) {}
        }
        drag.captured = false;
        /* 不再依赖 pointerup.target：pointer capture 在不同浏览器里可能把它改成 stage。 */
        if (!wasDragging && pressedIndex >= 0) tapCard(pressedIndex);
      }
      listen(stage, 'pointerup', endDrag);
      listen(stage, 'pointercancel', function () {
        drag.on = false;
        drag.captured = false;
        state.pressing = false;
        state.dragging = false;
      });

      /* 平铺模式点击：pointerdown 在 grid 下早退不走拖拽通道，
         这里用原生 click 委托，点任意卡直接激活（环模式交给 endDrag，避免双发） */
      listen(container, 'click', function (e) {
        if (!state.grid) return;
        var card = e.target.closest ? e.target.closest('.ring-card') : null;
        if (!card) return;
        var idx = cards.indexOf(card);
        if (idx >= 0) activateCard(idx);
      });

      /* 键盘可达：Enter/空格在两种模式下都一次打开详情。 */
      listen(container, 'keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
        var card = e.target && e.target.closest ?
          e.target.closest('.ring-card') : null;
        if (!card) return;
        var idx = cards.indexOf(card);
        if (idx < 0) return;
        e.preventDefault();
        activateCard(idx);
      });

      /* 滚轮缩放：仅 Alt+滚轮生效，普通滚动直接放行不劫持整页 */
      listen(container, 'wheel', function (e) {
        if (!e.altKey) return;
        if (state.grid) return;
        e.preventDefault();
        state.zoom = clamp(state.zoom - e.deltaY * 0.25, -240, 160);
        if (reduced) render();
      }, { passive: false });

      /* 控制按钮 */
      var btnCruise = container.querySelector('[data-ring-action="cruise"]');
      var btnReset = container.querySelector('[data-ring-action="reset"]');
      var btnGrid = container.querySelector('[data-ring-action="grid"]');
      if (btnCruise) {
        btnCruise.setAttribute('aria-pressed', state.cruising ? 'true' : 'false');
        listen(btnCruise, 'click', function () {
          state.cruising = !state.cruising;
          btnCruise.setAttribute('aria-pressed', state.cruising ? 'true' : 'false');
        });
      }
      if (btnReset) {
        listen(btnReset, 'click', function () {
          state.zoom = 0;
          var back = -(((state.theta % 360) + 360) % 360);
          if (back < -180) back += 360;
          if (reduced) { state.theta = 0; render(); return; }
          state.spin = { from: state.theta, to: state.theta + back, t: 0, dur: 0.5 };
          state.vel = 0;
        });
      }
      function applyGrid(on) {
        state.grid = on;
        state.spin = null;
        state.vel = 0;
        container.classList.toggle('ring-as-grid', on);
        if (on) {
          /* 巡航停在 state.grid 检查；这里把 stage/rotor/卡片的全部环模式
             内联样式清干净，让 .ring-as-grid 的 CSS 完整接管平铺布局。
             注意不能 removeAttribute('style')：卡片上有页面写入的 --c 等变量。 */
          stage.style.cssText = '';
          rotor.style.cssText = '';
          for (var i = 0; i < N; i++) {
            cards[i].style.transform = '';
            cards[i].style.position = '';
            cards[i].style.left = '';
            cards[i].style.top = '';
            cards[i].style.width = '';
            cards[i].style.height = '';
            cards[i].style.zIndex = '';
            cards[i].style.opacity = '';
            cards[i].style.pointerEvents = '';
            cards[i].style.removeProperty('--away');
          }
        } else {
          /* 回环模式：重建 stage/rotor 内联基线，再重算几何。幂等。 */
          stage.style.cssText = STAGE_CSS;
          rotor.style.cssText = ROTOR_CSS;
          layout();
          render();
        }
      }
      if (btnGrid) {
        listen(btnGrid, 'click', function () {
          applyGrid(!state.grid);
          try {
            localStorage.setItem('wbfx-ring-mode', state.grid ? 'grid' : 'ring');
          } catch (e) { /* file:// 隐私模式等场景忽略 */ }
        });
      }
      /* 恢复持久化的网格模式（localStorage 在 file:// 下可用，仍 try/catch 兜底）；
         开发钩子：#grid 本次强制平铺（不写 localStorage），用于无头验证。
         两条路径都走同一 applyGrid(true)，此时不依赖任何已建几何。 */
      var wantGrid = false;
      try { wantGrid = location.hash === '#grid'; } catch (e) { /* ignore */ }
      if (!wantGrid) {
        try {
          wantGrid = localStorage.getItem('wbfx-ring-mode') === 'grid';
        } catch (e) { /* ignore */ }
      }
      if (wantGrid) applyGrid(true);

      /* 离屏暂停 */
      var visible = true;
      var io = ('IntersectionObserver' in window) ?
        new IntersectionObserver(function (entries) {
          visible = entries[entries.length - 1].isIntersecting;
        }, { rootMargin: '60px' }) : null;
      if (io) {
        io.observe(container);
        onDispose(function () { io.disconnect(); });
      }

      if (!reduced) {
        onDispose(ticker.add(function (dt) {
          if (state.grid || state.detailOpen || !visible) return;
          if (state.spin) {
            state.spin.t += dt;
            var k = clamp(state.spin.t / state.spin.dur, 0, 1);
            state.theta = state.spin.from +
              (state.spin.to - state.spin.from) * easeInOutCubic(k);
            if (k >= 1) state.spin = null;
          } else if (state.dragging || state.pressing) {
            /* θ 已在 pointermove 中更新 */
          } else {
            if (Math.abs(state.vel) > 0.5) {
              state.theta += state.vel * dt;
              state.vel *= Math.pow(0.06, dt);   /* 惯性衰减 */
            } else {
              state.vel = 0;
              if (state.cruising && !state.hover) {
                state.theta += state.cruise * dt;
              }
            }
          }
          render();
        }));
      }

      onDispose(function () {
        for (var i = 0; i < N; i++) {
          container.appendChild(cards[i]);
          if (savedStyles[i] === null) cards[i].removeAttribute('style');
          else cards[i].setAttribute('style', savedStyles[i]);
          cards[i].classList.remove('is-front');
          cards[i].classList.remove('is-detail-source');
          cards[i].removeAttribute('tabindex');
          cards[i].removeAttribute('role');
          cards[i].removeAttribute('aria-expanded');
        }
        container.classList.remove('ring-as-grid');
        if (stage.parentNode) stage.parentNode.removeChild(stage);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 5) 数字滚动                                                         */
  /* ------------------------------------------------------------------ */

  function formatNum(n, decimals) {
    var s = Math.abs(n).toFixed(decimals);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '-' : '') + parts.join('.');
  }

  function initCountup(reduced) {
    var els = document.querySelectorAll('[data-countup]');
    if (!els.length) return;

    function run(el) {
      if (el.getAttribute('data-fx-counted')) return;
      el.setAttribute('data-fx-counted', '1');
      var target = parseFloat(el.getAttribute('data-countup'));
      if (!isFinite(target)) return;
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10) || 0;
      var suffix = el.getAttribute('data-suffix') || '';
      if (reduced || document.hidden) {
        el.textContent = formatNum(target, decimals) + suffix;
        return;
      }
      var t = 0, dur = 0.6;
      var un = ticker.add(function (dt) {
        t += dt;
        var k = clamp(t / dur, 0, 1);
        el.textContent = formatNum(target * easeOutCubic(k), decimals) + suffix;
        if (k >= 1) un();
      });
      onDispose(un);
    }

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, run);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          run(entries[i].target);
          io.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.2 });
    Array.prototype.forEach.call(els, function (el) {
      el.removeAttribute('data-fx-counted');
      io.observe(el);
    });
    onDispose(function () { io.disconnect(); });
  }

  /* ------------------------------------------------------------------ */
  /* 6) 入场编排                                                         */
  /* ------------------------------------------------------------------ */

  function initReveal(reduced) {
    var els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;

    if (reduced || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, function (el) {
        el.style.transitionDelay = '0ms';
        el.classList.add('is-in');
      });
      onDispose(function () {
        Array.prototype.forEach.call(els, function (el) {
          el.classList.remove('is-in');
          el.style.transitionDelay = '';
        });
      });
      return;
    }

    /* 同容器（同 parentElement）内按 DOM 顺序编级联序号 */
    var groups = [];
    Array.prototype.forEach.call(els, function (el) {
      var parent = el.parentElement;
      var g = null;
      for (var i = 0; i < groups.length; i++) {
        if (groups[i].parent === parent) { g = groups[i]; break; }
      }
      if (!g) { g = { parent: parent, count: 0 }; groups.push(g); }
      el.style.transitionDelay = (g.count * 60) + 'ms';
      g.count++;
    });

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('is-in');
          io.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    Array.prototype.forEach.call(els, function (el) {
      el.classList.remove('is-in');
      io.observe(el);
    });
    onDispose(function () {
      io.disconnect();
      Array.prototype.forEach.call(els, function (el) {
        el.classList.remove('is-in');
        el.style.transitionDelay = '';
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 7) 雷达扫描盘                                                       */
  /* ------------------------------------------------------------------ */

  var RADAR_QUADS = [
    { key: '热点', label: '热点', color: '#ff5c33' },
    { key: '方法论', label: '方法论', color: '#5b8def' },
    { key: 'AI赚钱方式', label: '赚钱', color: '#5bd69a' },
    { key: '共鸣类', label: '共鸣', color: '#9a8cff' }
  ];

  function colorA(hex, a) {
    var c = hexRgb(hex);
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' +
      Math.round(c[2] * 255) + ',' + a.toFixed(3) + ')';
  }

  function initRadarSweep(reduced) {
    var hosts = document.querySelectorAll('[data-radar-sweep]');
    if (!hosts.length) return;

    function quadOf(type, fallback) {
      for (var i = 0; i < RADAR_QUADS.length; i++) {
        if (RADAR_QUADS[i].key === type) return i;
      }
      return fallback % 4;
    }

    function fire(target, name, index) {
      try {
        target.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { index: index } }));
      } catch (e) { /* 老引擎无 CustomEvent 构造器时静默 */ }
    }

    Array.prototype.forEach.call(hosts, function (host) {
      var list = [];
      try {
        list = JSON.parse(host.getAttribute('data-radar-signals') || '[]') || [];
      } catch (e) { list = []; }
      if (!Array.isArray(list)) list = [];

      var canvas = document.createElement('canvas');
      canvas.className = 'fx-radar-canvas';
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      host.appendChild(canvas);
      onDispose(function () {
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      });
      var ctx = canvas.getContext('2d');
      if (!ctx) return;

      /* 象限内均分角度；半径按热度（热度越高越靠中心），热度无梯度按序均布 */
      var groups = [[], [], [], []];
      list.forEach(function (item, i) { groups[quadOf(item.t, i)].push(i); });
      var heats = list.map(function (item) { return Number(item.h) || 0; });
      var maxH = heats.length ? Math.max.apply(null, heats) : 0;
      var minH = heats.length ? Math.min.apply(null, heats) : 0;
      var flat = !(maxH > minH);
      var pts = list.map(function (item, i) {
        var q = quadOf(item.t, i);
        var slot = groups[q].indexOf(i);
        var n = groups[q].length || 1;
        /* 角度：-90°=12 点方向，顺时针；象限 q 覆盖 [q*90-90, q*90] */
        var angle = (q * 90 - 90) + 90 * ((slot + 1) / (n + 1));
        var rf;
        if (flat) {
          rf = n > 1 ? 0.38 + 0.44 * (slot / (n - 1)) : 0.58;
        } else {
          rf = 0.8 - 0.46 * ((Number(item.h) - minH) / (maxH - minH));
        }
        return { color: RADAR_QUADS[q].color, angle: angle, rf: rf, flash: 0, title: item.n || '' };
      });

      var W = 0, H = 0, CX = 0, CY = 0, R = 0;
      var sweepDeg = -90;               /* 从 12 点开始 */
      var SPEED = 360 / 8;              /* 约 8s/圈 */

      function ptXY(p) {
        var rad = p.angle * Math.PI / 180;
        return [CX + Math.cos(rad) * R * p.rf, CY + Math.sin(rad) * R * p.rf];
      }

      function draw(deg) {
        var d = dpr();
        ctx.clearRect(0, 0, W, H);

        /* 盘底 */
        var bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(R, 1));
        bg.addColorStop(0, 'rgba(24,29,36,0.92)');
        bg.addColorStop(1, 'rgba(10,13,17,0.96)');
        ctx.beginPath();
        ctx.arc(CX, CY, R, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        /* 同心环 + 象限十字 */
        ctx.lineWidth = 1 * d;
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        var fr = [0.33, 0.66, 1];
        for (var r0 = 0; r0 < fr.length; r0++) {
          ctx.beginPath();
          ctx.arc(CX, CY, R * fr[r0], 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(CX - R, CY); ctx.lineTo(CX + R, CY);
        ctx.moveTo(CX, CY - R); ctx.lineTo(CX, CY + R);
        ctx.strokeStyle = 'rgba(255,255,255,0.09)';
        ctx.stroke();

        /* 象限标签 */
        ctx.font = (10 * d) + 'px "Sora","Noto Sans SC",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (var q = 0; q < 4; q++) {
          var la = (q * 90 - 45) * Math.PI / 180;
          ctx.fillStyle = colorA(RADAR_QUADS[q].color, 0.72);
          ctx.fillText(RADAR_QUADS[q].label,
            CX + Math.cos(la) * R * 0.86, CY + Math.sin(la) * R * 0.86);
        }

        /* 扫描线 + 拖尾（reduced 静态盘跳过） */
        if (!reduced) {
          var rad = deg * Math.PI / 180;
          var trail = 80 * Math.PI / 180;
          ctx.beginPath();
          ctx.moveTo(CX, CY);
          ctx.arc(CX, CY, R, rad - trail, rad);
          ctx.closePath();
          if (typeof ctx.createConicGradient === 'function') {
            var grad = ctx.createConicGradient(rad - trail, CX, CY);
            var tStop = trail / (Math.PI * 2);
            grad.addColorStop(0, 'rgba(255,92,51,0)');
            grad.addColorStop(tStop, 'rgba(255,92,51,0.22)');
            grad.addColorStop(Math.min(1, tStop + 0.002), 'rgba(255,92,51,0)');
            grad.addColorStop(1, 'rgba(255,92,51,0)');
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = 'rgba(255,92,51,0.08)';
          }
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(CX, CY);
          ctx.lineTo(CX + Math.cos(rad) * R, CY + Math.sin(rad) * R);
          ctx.strokeStyle = 'rgba(255,122,69,0.85)';
          ctx.lineWidth = 1.6 * d;
          ctx.stroke();
        }

        /* 信号点：类型色光晕 + 扫到闪亮涟漪 */
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          var xy = ptXY(p);
          var glowR = (9 + p.flash * 7) * d;
          var g2 = ctx.createRadialGradient(xy[0], xy[1], 0, xy[0], xy[1], glowR);
          g2.addColorStop(0, colorA(p.color, 0.3 + p.flash * 0.45));
          g2.addColorStop(1, colorA(p.color, 0));
          ctx.beginPath();
          ctx.arc(xy[0], xy[1], glowR, 0, Math.PI * 2);
          ctx.fillStyle = g2;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(xy[0], xy[1], (3 + p.flash * 1.6) * d, 0, Math.PI * 2);
          ctx.fillStyle = colorA(p.color, 0.92);
          ctx.fill();
          if (p.flash > 0) {
            ctx.beginPath();
            ctx.arc(xy[0], xy[1], (6 + (1 - p.flash) * 16) * d, 0, Math.PI * 2);
            ctx.strokeStyle = colorA(p.color, 0.5 * p.flash);
            ctx.lineWidth = 1.2 * d;
            ctx.stroke();
          }
        }

        /* 中心点 */
        ctx.beginPath();
        ctx.arc(CX, CY, 2.6 * d, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,122,69,0.9)';
        ctx.fill();
      }

      function resize() {
        var rect = host.getBoundingClientRect();
        var d = dpr();
        W = Math.max(2, Math.round(rect.width * d));
        H = Math.max(2, Math.round(rect.height * d));
        canvas.width = W;
        canvas.height = H;
        CX = W / 2;
        CY = H / 2;
        R = Math.max(10, Math.min(W, H) / 2 - 6 * d);
        if (reduced) draw(sweepDeg);   /* reduced 无 rAF：resize 后补一帧静态重绘 */
      }
      resize();
      var rsTimer = 0;
      listen(window, 'resize', function () {
        clearTimeout(rsTimer);
        rsTimer = setTimeout(resize, 150);
      });
      onDispose(function () { clearTimeout(rsTimer); });

      /* 点命中（点击选中 / 悬停手型 + title） */
      function hitIndex(e) {
        var rect = canvas.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return -1;
        var mx = (e.clientX - rect.left) * (W / rect.width);
        var my = (e.clientY - rect.top) * (H / rect.height);
        var best = -1;
        var bd = 20 * dpr();
        for (var i = 0; i < pts.length; i++) {
          var xy = ptXY(pts[i]);
          var dx = xy[0] - mx, dy = xy[1] - my;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bd) { bd = dist; best = i; }
        }
        return best;
      }
      listen(canvas, 'click', function (e) {
        var i = hitIndex(e);
        if (i >= 0) fire(host, 'wbfx:radarselect', i);
      });
      listen(canvas, 'pointermove', function (e) {
        var i = hitIndex(e);
        canvas.style.cursor = i >= 0 ? 'pointer' : '';
        if (i >= 0) canvas.title = pts[i].title || '';
        else canvas.removeAttribute('title');
      }, { passive: true });

      /* 离屏暂停 */
      var vis = true;
      var io = ('IntersectionObserver' in window) ?
        new IntersectionObserver(function (entries) {
          vis = entries[entries.length - 1].isIntersecting;
        }, { rootMargin: '60px' }) : null;
      if (io) {
        io.observe(host);
        onDispose(function () { io.disconnect(); });
      }

      if (reduced) {
        draw(sweepDeg);
        return;
      }

      onDispose(ticker.add(function (dt) {
        if (!vis) return;
        var prev = sweepDeg;
        sweepDeg = (sweepDeg + SPEED * dt) % 360;
        var advanced = ((sweepDeg - prev) % 360 + 360) % 360;
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          var delta = ((p.angle - prev) % 360 + 360) % 360;
          if (advanced > 0 && delta <= advanced) {
            p.flash = 1;
            fire(host, 'wbfx:radarping', i);
          } else {
            p.flash = Math.max(0, p.flash - dt / 1.2);
          }
        }
        draw(sweepDeg);
      }));
    });
  }

  /* ------------------------------------------------------------------ */
  /* refresh / 自动初始化                                                */
  /* ------------------------------------------------------------------ */

  function refresh() {
    refreshed = true;
    /* 先清理上一轮的所有实例与监听 */
    var old = disposers;
    disposers = [];
    for (var i = old.length - 1; i >= 0; i--) {
      try { old[i](); } catch (e) { /* 保证清理不中断 */ }
    }
    var reduced = prefersReduced();
    initParticles(reduced);
    initFluid(reduced);
    initTilt(reduced);
    initRing(reduced);
    initCountup(reduced);
    initReveal(reduced);
    initRadarSweep(reduced);
    /* reveal 安全网：1200ms 后把仍未 .is-in 的 [data-reveal] 全部补上，
       防 IntersectionObserver 未触发导致内容永久隐形（对所有页面命名空间生效） */
    var revealGuard = setTimeout(function () {
      var pend = document.querySelectorAll('[data-reveal]:not(.is-in)');
      for (var k = 0; k < pend.length; k++) pend[k].classList.add('is-in');
    }, 1200);
    onDispose(function () { clearTimeout(revealGuard); });
  }

  window.WBFX = { refresh: refresh };

  function boot() {
    /* app.js 同步渲染完成后再扫描：等一帧 rAF；若 app.js 已显式调过 refresh 则不重复 */
    requestAnimationFrame(function () { if (!refreshed) refresh(); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
