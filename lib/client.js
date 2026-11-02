/* ============================================================================
 * dsh-hippocampus — 浏览器半侧（球体版）
 * ----------------------------------------------------------------------------
 * 左侧栏入口 + 主面板：把 /dsh-hippocampus/graph 画成一个可以转动的地球仪。
 * 文件在球面上、条目贴着文件散开、主题沉在球心；拖动旋转、点节点看完整内容。
 * 手写 ModuleLoader bundle，不用构建。
 * ========================================================================== */

window.__ModuleLoader__.load({
  id: 'dsh-hippo',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement
    var useEffect = react.useEffect
    var useRef = react.useRef
    var useState = react.useState
    var useCallback = react.useCallback

    var API = '/dsh-hippocampus'

    /* ── 样式 ────────────────────────────────────────────────────────────── */
    var CSS = [
      '.hp-root{position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;background:#04060c;color:#cfe0f5;overflow:hidden;font-size:12px}',
      '.hp-bar{flex:none;display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(120,180,255,.12);background:linear-gradient(180deg,rgba(12,20,34,.9),rgba(6,10,18,.6))}',
      '.hp-title{font-size:13px;font-weight:600;letter-spacing:.16em;color:#dceaff;display:flex;align-items:center;gap:8px}',
      '.hp-dot{width:6px;height:6px;border-radius:50%;background:#59d6ff;box-shadow:0 0 10px #59d6ff,0 0 20px rgba(89,214,255,.6);animation:hp-pulse 2.4s ease-in-out infinite}',
      '@keyframes hp-pulse{0%,100%{opacity:.55;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}',
      '.hp-stat{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:#6f8ab0;letter-spacing:.04em}',
      '.hp-search{margin-left:auto;display:flex;align-items:center;gap:6px}',
      '.hp-input{width:150px;background:rgba(255,255,255,.04);border:1px solid rgba(120,180,255,.18);border-radius:999px;color:#dceaff;padding:4px 10px;font-size:11px;outline:none}',
      '.hp-input:focus{border-color:rgba(89,214,255,.5);box-shadow:0 0 0 3px rgba(89,214,255,.08)}',
      '.hp-btn{background:rgba(255,255,255,.04);border:1px solid rgba(120,180,255,.18);color:#9dbbdd;border-radius:999px;padding:4px 11px;font-size:11px;cursor:pointer;transition:.15s}',
      '.hp-btn:hover{color:#dceaff;border-color:rgba(89,214,255,.45);background:rgba(89,214,255,.08)}',
      '.hp-stage{position:relative;flex:1;min-height:0}',
      '.hp-canvas{display:block;width:100%;height:100%;cursor:grab;touch-action:none}',
      '.hp-canvas.dragging{cursor:grabbing}',
      '.hp-info{position:absolute;right:14px;top:14px;width:300px;max-height:calc(100% - 28px);overflow:auto;background:rgba(8,14,24,.94);border:1px solid rgba(120,180,255,.2);border-radius:12px;padding:12px 14px;backdrop-filter:blur(14px);box-shadow:0 18px 50px rgba(0,0,0,.55)}',
      '.hp-info-k{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#5f7a9e;margin-bottom:4px}',
      '.hp-info-t{font-size:13px;line-height:1.5;color:#eaf2ff;margin-bottom:8px;word-break:break-word;padding-right:18px}',
      '.hp-info-f{font-size:10px;color:#5f7a9e;margin-bottom:10px;word-break:break-all}',
      '.hp-info-p{font-size:11px;line-height:1.75;color:#93aecd;white-space:pre-wrap;word-break:break-word}',
      '.hp-nb{margin-top:12px;border-top:1px solid rgba(120,180,255,.14);padding-top:10px}',
      '.hp-nb-h{font-size:10px;letter-spacing:.12em;color:#5f7a9e;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}',
      '.hp-nb-h em{font-style:normal;color:#415467}',
      '.hp-nb-i{display:block;width:100%;text-align:left;background:rgba(255,255,255,.03);border:1px solid rgba(120,180,255,.14);border-radius:7px;padding:5px 8px;margin-bottom:4px;color:#9dbbdd;font-size:11px;line-height:1.45;cursor:pointer;transition:.12s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:inherit}',
      '.hp-nb-i:hover{color:#dff0ff;border-color:rgba(89,214,255,.5);background:rgba(89,214,255,.1)}',
      '.hp-nb-i b{color:#59d6ff;font-weight:400;margin-right:4px}',
      '.hp-info-x{position:absolute;right:8px;top:6px;width:20px;height:20px;border-radius:50%;border:0;background:transparent;color:#6f8ab0;cursor:pointer;font-size:14px;line-height:1}',
      '.hp-info-x:hover{color:#ff7ab8}',
      '.hp-legend{flex:none;display:flex;flex-wrap:wrap;gap:12px;padding:8px 14px;border-top:1px solid rgba(120,180,255,.1);background:rgba(4,8,14,.7)}',
      '.hp-lg{display:flex;align-items:center;gap:5px;font-size:10px;color:#6f8ab0;letter-spacing:.05em}',
      '.hp-lg i{width:6px;height:6px;border-radius:50%;display:block}',
      '.hp-hint{position:absolute;left:14px;bottom:12px;font-size:10px;color:#4d637f;letter-spacing:.05em;pointer-events:none}',
      '.hp-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#5f7a9e;font-size:12px}',
      '.hp-zoom{position:absolute;right:14px;bottom:14px;display:flex;flex-direction:column;gap:6px;z-index:3}',
      '.hp-zbtn{width:32px;height:32px;border-radius:50%;border:1px solid rgba(120,180,255,.24);background:rgba(8,16,28,.82);color:#9dbbdd;font-size:17px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);transition:.15s;user-select:none;padding:0}',
      '.hp-zbtn:hover{color:#dff0ff;border-color:rgba(89,214,255,.6);background:rgba(89,214,255,.14);box-shadow:0 0 16px rgba(89,214,255,.25)}',
      '.hp-zbtn:active{transform:scale(.93)}',
      '.hp-zbtn.sm{width:26px;height:26px;font-size:13px;opacity:.8}',
      '.hp-vol{position:absolute;right:54px;bottom:26px;display:flex;align-items:center;gap:7px;z-index:3;opacity:.5;transition:opacity .2s}',
      '.hp-vol:hover{opacity:1}',
      '.hp-vol-r{-webkit-appearance:none;appearance:none;width:86px;height:3px;border-radius:2px;background:rgba(120,180,255,.25);outline:none;cursor:pointer}',
      '.hp-vol-r::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;border-radius:50%;background:#59d6ff;box-shadow:0 0 8px rgba(89,214,255,.75);cursor:pointer}',
      '.hp-vol-n{font-size:9px;color:#6d88a8;width:20px;text-align:right}'
    ].join('')

    if (typeof document !== 'undefined' && !document.querySelector('style[data-hp="1"]')) {
      var tag = document.createElement('style')
      tag.dataset.hp = '1'
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ── 图标 ────────────────────────────────────────────────────────────── */
    function Icon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
        h('circle', { cx: 12, cy: 12, r: 8.4, stroke: 'currentColor', strokeWidth: 1.1, opacity: .5 }),
        h('ellipse', { cx: 12, cy: 12, rx: 3.6, ry: 8.4, stroke: 'currentColor', strokeWidth: 1, opacity: .38 }),
        h('path', { d: 'M3.8 12h16.4', stroke: 'currentColor', strokeWidth: 1, opacity: .38 }),
        h('circle', { cx: 12, cy: 12, r: 2.4, fill: 'currentColor', opacity: .95 })
      )
    }


    /* 名字翻译：后端给的 label 正常情况下已经是中文，这里再兜一层，
       万一拿到的是路径就当场翻掉，不改真实文件。 */
    var ZH = {
      readme: '说明', agents: '工作区说明', skill: '技能', work: '工作', persona: '人设',
      memory: '记忆', notes: '笔记', note: '笔记', diary: '日记', idea: '想法', ideas: '想法',
      index: '索引', config: '配置', handoff: '交接', sample: '样例', architecture: '架构',
      visibility: '可见性', history: '记录', group: '群聊', session: '会话', init: '初始化',
      target: '对象', c2c: '私聊', scan: '扫描', digest: '摘要', main: '主程序', server: '服务',
      colleagues: '同事', docs: '文档', doc: '文档', knowledge: '资料', workspace: '工作区',
      tools: '工具', projects: '项目', project: '项目', src: '源码', lib: '库', todo: '待办',
      tasks: '任务', task: '任务', log: '日志', logs: '日志', plan: '计划'
    }
    function zhWord(w) {
      var s = String(w || '')
      var k = s.toLowerCase()
      if (ZH[k]) return ZH[k]
      var segs = s.split(/[_-]+/).filter(Boolean)
      if (segs.length > 1) {
        var changed = false
        var out = segs.map(function (x) {
          var v = ZH[x.toLowerCase()]
          if (v) changed = true
          return v || x
        })
        if (changed) return out.join(' ')
      }
      return s
    }
    function prettyName(label, file) {
      var src = String(label || file || '')
      if (src.indexOf('/') < 0) return src
      var noExt = src.replace(/\.(md|markdown|txt)$/i, '')
      var parts = noExt.split('/').filter(Boolean)
      if (!parts.length) return src
      var raw = parts[parts.length - 1]
      var base = zhWord(raw)
      var dm = /^([A-Za-z_-]+?)[-_](\d{4}-\d{2}-\d{2})/.exec(raw)
      if (dm) base = zhWord(dm[1]) + ' ' + dm[2]
      if (parts.length === 1) return base
      var parent = zhWord(parts[parts.length - 2])
      if (base.indexOf(parent) === 0) return base
      return parent + ' · ' + base
    }

    /* ── 球体引擎 ────────────────────────────────────────────────────────── */
    function createEngine(canvas, cb) {
      var ctx = canvas.getContext('2d')
      var dpr = Math.min(2, window.devicePixelRatio || 1)
      var nodes = []
      var links = []
      var adj = {}
      var nodesById = {}
      var rot = { x: -0.22, y: 0.45 }
      var spin = { x: 0, y: 0.0016 }
      var zoom = 1
      var intro = { active: false, t0: 0, dur: 2600 }
      var introK = 1
      var fly = null
      var autoSpin = true
      var drag = null
      var hover = null
      var selected = null
      var focusFile = null
      var query = ''
      var raf = 0
      var alive = true
      var w = 0, hh = 0
      var t0 = performance.now()
      var proj = {}

      function resize() {
        var rect = canvas.parentElement.getBoundingClientRect()
        w = Math.max(120, rect.width)
        hh = Math.max(120, rect.height)
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(hh * dpr)
        canvas.style.width = w + 'px'
        canvas.style.height = hh + 'px'
      }

      /* 球面斐波那契分布：n 个点尽量均匀铺满球面 */
      function fib(i, n) {
        var ga = Math.PI * (3 - Math.sqrt(5))
        var y = 1 - (i / Math.max(1, n - 1)) * 2
        var r = Math.sqrt(Math.max(0, 1 - y * y))
        var th = ga * i
        return { x: Math.cos(th) * r, y: y, z: Math.sin(th) * r }
      }

      function norm(v) {
        var l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1
        return { x: v.x / l, y: v.y / l, z: v.z / l }
      }

      /* 布局：文件铺球面，条目绕着各自的文件散开，主题沉到球心附近 */
      function layout() {
        var files = [], topics = [], byId = {}
        for (var i = 0; i < nodes.length; i++) {
          byId[nodes[i].id] = nodes[i]
          if (nodes[i].kind === 'file') files.push(nodes[i])
          else if (nodes[i].kind === 'topic') topics.push(nodes[i])
        }
        // 主题：内层小球
        for (var t = 0; t < topics.length; t++) {
          var u = fib(t, topics.length)
          topics[t].ux = u.x; topics[t].uy = u.y; topics[t].uz = u.z
          topics[t].rr = 0.46
        }
        // 文件：外层球面
        for (var f = 0; f < files.length; f++) {
          var fu = fib(f + 0.37, files.length + 1.4)
          files[f].ux = fu.x; files[f].uy = fu.y; files[f].uz = fu.z
          files[f].rr = 1.0
        }
        // 条目：绕文件节点的切平面小偏移
        var counters = {}
        for (var k = 0; k < nodes.length; k++) {
          var n = nodes[k]
          if (n.kind !== 'entry') continue
          var host = null
          for (var e = 0; e < links.length; e++) {
            if (links[e].t === n.id) { host = byId[links[e].s]; break }
          }
          if (!host || !host.ux) { n.ux = 0; n.uy = 1; n.uz = 0; n.rr = 1.1; continue }
          var ci = counters[host.id] = (counters[host.id] || 0) + 1
          var a = ci * 2.399
          var spread = 0.10 + Math.min(0.16, ci * 0.012)
          // 切平面基
          var up = Math.abs(host.uy) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
          var t1 = norm({
            x: host.uy * up.z - host.uz * up.y,
            y: host.uz * up.x - host.ux * up.z,
            z: host.ux * up.y - host.uy * up.x
          })
          var t2 = {
            x: host.uy * t1.z - host.uz * t1.y,
            y: host.uz * t1.x - host.ux * t1.z,
            z: host.ux * t1.y - host.uy * t1.x
          }
          var off = {
            x: host.ux + (t1.x * Math.cos(a) + t2.x * Math.sin(a)) * spread,
            y: host.uy + (t1.y * Math.cos(a) + t2.y * Math.sin(a)) * spread,
            z: host.uz + (t1.z * Math.cos(a) + t2.z * Math.sin(a)) * spread
          }
          var uu = norm(off)
          n.ux = uu.x; n.uy = uu.y; n.uz = uu.z
          n.rr = 1.03
        }
      }

      function indexAdj() {
        adj = {}
        for (var i = 0; i < links.length; i++) {
          var s = links[i].s, t = links[i].t
          ;(adj[s] || (adj[s] = [])).push(t)
          ;(adj[t] || (adj[t] = [])).push(s)
        }
      }

      /* 旋转 + 透视投影 */
      function projectAll() {
        var cy = Math.cos(rot.y), sy = Math.sin(rot.y)
        var cx = Math.cos(rot.x), sx = Math.sin(rot.x)
        var scale = Math.min(w, hh) * 0.40 * zoom
        var fov = 2.5
        proj = {}
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i]
          if (n.ux === undefined) continue
          var x1 = n.ux * cy + n.uz * sy
          var z1 = -n.ux * sy + n.uz * cy
          var y1 = n.uy * cx - z1 * sx
          var z2 = n.uy * sx + z1 * cx
          var rr = n.rr
          if (intro.active && n._rr0 !== undefined) rr = n._rr0 + (n.rr - n._rr0) * introK
          var X = x1 * rr, Y = y1 * rr, Z = z2 * rr
          var p = fov / (fov + Z)
          proj[n.id] = {
            n: n,
            x: w / 2 + X * p * scale,
            y: hh / 2 + Y * p * scale,
            z: Z,
            p: p,
            s: scale
          }
        }
        return scale
      }

      function depthAlpha(z) {
        // z 越小越靠近镜头：z=-1 最近，z=+1 最远
        var d = (z + 1) / 2
        return 1 - d * 0.5
      }

      function nearestAngle(cur, target) {
        return target + Math.round((cur - target) / (Math.PI * 2)) * Math.PI * 2
      }

      /* 让某个节点转到正对镜头，同时缓缓放大、停住自转 */
      function flyTo(node) {
        if (!node || node.ux === undefined) return
        var ry = Math.atan2(-node.ux, node.uz)
        var z1 = -node.ux * Math.sin(ry) + node.uz * Math.cos(ry)
        // 用 (-uy, -z1)：正号会把它转到球背面，只有负号才落在镜头正中心
        var rx = Math.atan2(-node.uy, -z1)
        ry = nearestAngle(rot.y, ry)
        rx = nearestAngle(rot.x, rx)
        fly = {
          t0: performance.now(), dur: 1000,
          rx0: rot.x, ry0: rot.y, rx1: rx, ry1: ry,
          z0: zoom, z1: Math.max(1.85, Math.min(2.4, zoom))
        }
        spin.y = 0
        spin.x = 0
        autoSpin = false
      }

      function resumeSpin() {
        fly = null
        autoSpin = true
        spin.y = 0.0016
        spin.x = 0
      }

      /* 入场：每个节点从球外很远的散点飞回来，凝聚成球 */
      function startIntro() {
        // 只在本次页面加载后第一次打开时播；切走再回来不重播。
        if (createEngine._playedIntro) return
        createEngine._playedIntro = true
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i]
          n._rr0 = n.rr * (2.4 + Math.random() * 2.6)
        }
        intro.active = true
        intro.t0 = performance.now()
        introK = 0
      }

      function draw() {
        if (!alive) return
        var now = performance.now()
        var t = (now - t0) / 1000

        // 入场：光点从远处飞向球面，慢慢凝聚
        if (intro.active) {
          var ir = (now - intro.t0) / intro.dur
          if (ir >= 1) { intro.active = false; introK = 1 }
          else introK = 1 - Math.pow(1 - ir, 3)
        }

        // 聚焦飞行：转过去 + 缓缓放大
        if (fly) {
          var fk = (now - fly.t0) / fly.dur
          if (fk >= 1) {
            rot.x = fly.rx1; rot.y = fly.ry1; zoom = fly.z1; fly = null
          } else {
            var fe = fk < 0.5 ? 2 * fk * fk : 1 - Math.pow(-2 * fk + 2, 2) / 2
            rot.x = fly.rx0 + (fly.rx1 - fly.rx0) * fe
            rot.y = fly.ry0 + (fly.ry1 - fly.ry0) * fe
            zoom = fly.z0 + (fly.z1 - fly.z0) * fe
          }
        }

        // 惯性自转
        if (!drag && !fly && !hover) {
          rot.y += spin.y
          rot.x += spin.x
          spin.y *= 0.94
          spin.x *= 0.86
          if (autoSpin && Math.abs(spin.y) < 0.0006) spin.y = 0.0006
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        var g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.66)
        g.addColorStop(0, '#081120')
        g.addColorStop(0.5, '#040810')
        g.addColorStop(1, '#02040a')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // 之后统一用 CSS 像素坐标绘制，由 dpr 变换放大到物理像素，保证清晰
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        var scale = projectAll()
        var cx = w / 2, cyc = hh / 2
        var pxK = dpr

        var ga = intro.active ? 0.10 + 0.90 * introK : 1
        // 球体轮廓：一圈淡光 + 极细经纬线暗示立体
        var R = scale * 1.0
        ctx.save()
        ctx.strokeStyle = 'rgba(89,214,255,' + (0.10 * ga).toFixed(3) + ')'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cyc, R * 1.02, 0, Math.PI * 2)
        ctx.stroke()
        // 赤道线（跟随 rot.x 的椭圆）
        var eqA = R * 1.0
        var eqB = Math.max(0.06, Math.abs(Math.cos(rot.x))) * R * 1.0
        ctx.strokeStyle = 'rgba(89,214,255,' + (0.07 * ga).toFixed(3) + ')'
        ctx.beginPath()
        ctx.ellipse(cx, cyc, eqA, eqB, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()

        var focus = hover || selected
        var near = {}
        if (focus) {
          near[focus.id] = 1
          var a2 = adj[focus.id] || []
          for (var i = 0; i < a2.length; i++) near[a2[i]] = 1
        }
        var q = query.toLowerCase()

        // 连线：按平均深度淡化
        for (var e = 0; e < links.length; e++) {
          var A = proj[links[e].s], B = proj[links[e].t]
          if (!A || !B) continue
          var on = focus ? (near[A.n.id] && near[B.n.id]) : false
          var base = focus ? (on ? 0.55 : 0.05) : 0.16
          var dz = (A.z + B.z) / 2
          var alpha = base * depthAlpha(dz) * ga
          if (focusFile && A.n.file !== focusFile && B.n.file !== focusFile && A.n.kind !== 'topic' && B.n.kind !== 'topic') alpha *= 0.1
          if (alpha <= 0.004) continue
          ctx.strokeStyle = 'rgba(120,200,255,' + alpha.toFixed(3) + ')'
          ctx.lineWidth = (on ? 1.2 : 0.65) * (0.6 + A.p * 0.5)
          ctx.beginPath()
          ctx.moveTo(A.x, A.y)
          ctx.lineTo(B.x, B.y)
          ctx.stroke()
        }

        // 节点：远的先画
        var order = []
        for (var k = 0; k < nodes.length; k++) {
          var P = proj[nodes[k].id]
          if (P) order.push(P)
        }
        order.sort(function (a, b) { return b.z - a.z })

        for (var oi = 0; oi < order.length; oi++) {
          var P2 = order[oi]
          var N = P2.n
          var isFocus = focus === N
          var isNear = focus ? !!near[N.id] : false
          var match = q && N.label.toLowerCase().indexOf(q) >= 0
          var da = depthAlpha(P2.z)
          var r = (N.size || 3) * 0.42 * P2.p * zoom * (isFocus ? 1.8 : isNear ? 1.3 : 1)
          var breathe = 0.86 + 0.14 * Math.sin(t * 1.4 + (N.id.length % 7))
          var alpha2 = (focus ? (isFocus ? 1 : isNear ? 0.92 : 0.14) : breathe * da) * ga
          if (focusFile && N.file !== focusFile && N.kind !== 'topic') alpha2 *= 0.16
          if (query && !match && !isNear && !isFocus) alpha2 *= 0.3
          if (alpha2 <= 0.01) continue

          var rr = Math.max(0.6, r)
          ctx.fillStyle = N.color || '#7fd4ff'
          // 大节点 / 高亮节点先铺一层很淡的大圆当光晕：比 shadowBlur 快一个数量级
          if (N.kind === 'file' || N.kind === 'topic' || isFocus || isNear) {
            ctx.globalAlpha = Math.min(1, alpha2) * 0.2
            ctx.beginPath()
            ctx.arc(P2.x, P2.y, rr * 2.6, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.globalAlpha = Math.min(1, alpha2)
          ctx.beginPath()
          ctx.arc(P2.x, P2.y, rr, 0, Math.PI * 2)
          ctx.fill()

          // 背面节点描一圈细线，转到后面也看得见、点得到
          if (P2.z > 0.32 && !isFocus) {
            ctx.globalAlpha = Math.min(0.5, alpha2 * 0.95)
            ctx.strokeStyle = 'rgba(160,200,240,.55)'
            ctx.lineWidth = 0.8
            ctx.beginPath()
            ctx.arc(P2.x, P2.y, rr + 2.2, 0, Math.PI * 2)
            ctx.stroke()
          }

          if (match || isFocus) {
            ctx.globalAlpha = 1
            ctx.strokeStyle = 'rgba(255,255,255,.85)'
            ctx.lineWidth = 1.1
            ctx.beginPath()
            ctx.arc(P2.x, P2.y, rr + 3, 0, Math.PI * 2)
            ctx.stroke()
          }
          ctx.globalAlpha = 1
        }

        // ── 标签层：只给重要节点，重叠就跳过 ──
        var labels = []
        for (var li = 0; li < order.length; li++) {
          var L = order[li]
          var LN = L.n
          var pri = 0
          if (selected && LN.id === selected.id) pri = 100
          else if (hover && LN.id === hover.id) pri = 90
          else if (q && LN.label.toLowerCase().indexOf(q) >= 0) pri = 80
          else if (focusFile && LN.file === focusFile && LN.kind === 'file') pri = 70
          else if (LN.kind === 'file') pri = 60
          else if (LN.kind === 'topic') pri = 55
          if (!pri) continue
          if (L.z > 0.86) continue               // 太靠背面的字不显示
          if (focusFile && LN.file !== focusFile && LN.kind !== 'topic') continue
          labels.push({ p: L, pri: pri })
        }
        labels.sort(function (a, b) { return b.pri - a.pri || a.p.z - b.p.z })
        var placed = []
        for (var pi = 0; pi < labels.length; pi++) {
          var LP = labels[pi]
          var NN = LP.p.n
          var boxed = LP.pri >= 80
          var fs = boxed ? 11.5 : 10
          ctx.font = fs + 'px ui-sans-serif,system-ui,"Microsoft YaHei",sans-serif'
          var fullName = prettyName(NN.label, NN.file)
          var txt = fullName.length > 18 ? fullName.slice(0, 17) + '…' : fullName
          var tw = ctx.measureText(txt).width
          var th = fs * 1.35
          var nr = (NN.size || 3) * 0.42 * LP.p.p * zoom
          var lx = LP.p.x + Math.max(3, nr) + (boxed ? 6 : 5)
          var ly = LP.p.y - th / 2
          var rect = { x: lx - (boxed ? 3 : 0), y: ly, w: tw + (boxed ? 6 : 0), h: th }
          var overlap = false
          for (var pj = 0; pj < placed.length; pj++) {
            var R2 = placed[pj]
            if (rect.x < R2.x + R2.w && rect.x + rect.w > R2.x && rect.y < R2.y + R2.h && rect.y + rect.h > R2.y) { overlap = true; break }
          }
          if (overlap) continue
          placed.push(rect)
          if (boxed) {
            ctx.globalAlpha = 0.88
            ctx.fillStyle = 'rgba(4,8,16,.92)'
            var rr = 4
            ctx.beginPath()
            if (ctx.roundRect) ctx.roundRect(rect.x, rect.y, rect.w, rect.h, rr)
            else ctx.rect(rect.x, rect.y, rect.w, rect.h)
            ctx.fill()
          }
          ctx.globalAlpha = (boxed ? 1 : Math.min(0.72, 0.5 + LP.p.p * 0.3)) * ga
          ctx.fillStyle = boxed ? '#eaf4ff' : '#bcd0e8'
          ctx.fillText(txt, lx, LP.p.y + fs * 0.36)
          ctx.globalAlpha = 1
        }

        raf = requestAnimationFrame(draw)
      }

      function nodeAt(px, py) {
        var best = null, bd = 1e9
        for (var i = 0; i < nodes.length; i++) {
          var P = proj[nodes[i].id]
          if (!P) continue
          var r = Math.max(8, (nodes[i].size || 3) * 0.42 * P.p * zoom + 4)
          var d = Math.hypot(P.x - px, P.y - py)
          if (d < r && (d < bd || (Math.abs(d - bd) < 2 && P.z < (best ? proj[best.id].z : 9)))) {
            bd = d
            best = nodes[i]
          }
        }
        return best
      }

      function load(force) {
        return fetch(API + '/graph' + (force ? '?force=1' : ''))
          .then(function (r) { return r.json() })
          .then(function (data) {
            if (!data || !data.ok) throw new Error(data && data.error || 'graph failed')
            nodes = (data.nodes || []).map(function (n) { return Object.assign({}, n) })
            links = (data.links || []).slice()
            nodesById = {}
            for (var i = 0; i < nodes.length; i++) nodesById[nodes[i].id] = nodes[i]
            indexAdj()
            layout()
            startIntro()
            if (cb.onStats) cb.onStats(data.stats)
          })
          .catch(function (err) {
            if (cb.onError) cb.onError(String(err && err.message || err))
          })
      }

      function onDown(ev) {
        canvas.setPointerCapture(ev.pointerId)
        fly = null
        drag = { x: ev.clientX, y: ev.clientY, rx: rot.x, ry: rot.y, moved: false }
        canvas.classList.add('dragging')
      }
      function onMove(ev) {
        if (drag) {
          var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y
          if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true
          var now = performance.now()
          var dt = Math.max(1, now - (drag.t || now))
          if (drag.lx !== undefined) {
            drag.vx = (ev.clientX - drag.lx) / dt
            drag.vy = (ev.clientY - drag.ly) / dt
          }
          drag.lx = ev.clientX
          drag.ly = ev.clientY
          drag.t = now
          rot.y = drag.ry - dx * 0.007
          rot.x = (drag.rx + dy * 0.007)
          return
        }
        var rect = canvas.getBoundingClientRect()
        var n = nodeAt(ev.clientX - rect.left, ev.clientY - rect.top)
        if (n !== hover) {
          hover = n
          if (cb.onHover) cb.onHover(n ? { id: n.id, label: n.label, kind: n.kind, file: n.file } : null)
        }
        canvas.style.cursor = n ? 'pointer' : 'grab'
      }
      function onUp(ev) {
        var wasDrag = drag && drag.moved
        if (drag && wasDrag) {
          // 松手带惯性：拖得越快惯性越大，停住再松手就是 0
          var vx = drag.vx || 0, vy = drag.vy || 0
          spin.y = Math.max(-0.055, Math.min(0.055, -vx * 0.028))
          spin.x = Math.max(-0.03, Math.min(0.03, vy * 0.018))
          autoSpin = false
        }
        drag = null
        canvas.classList.remove('dragging')
        if (wasDrag) return
        var rect = canvas.getBoundingClientRect()
        var n = nodeAt(ev.clientX - rect.left, ev.clientY - rect.top)
        var same = !!(n && selected && n.id === selected.id)
        selected = n
        if (!n) resumeSpin()
        else if (!same) flyTo(n)
        if (cb.onSelect) cb.onSelect(describe(n))
      }

      /** 把节点整理成面板要的数据，顺带把相连的分支带上。 */
      function describe(n) {
        if (!n) return null
        var nb = []
        var list = adj[n.id] || []
        for (var i = 0; i < list.length && nb.length < 40; i++) {
          var m = nodesById[list[i]]
          if (m) nb.push({ id: m.id, label: m.label, kind: m.kind, file: m.file })
        }
        return {
          id: n.id, label: n.label, kind: n.kind, file: n.file,
          snippet: n.snippet, group: n.group, neighbors: nb
        }
      }
      function onDbl(ev) {
        var rect = canvas.getBoundingClientRect()
        var n = nodeAt(ev.clientX - rect.left, ev.clientY - rect.top)
        if (n && n.file && n.kind !== 'topic') {
          focusFile = focusFile === n.file ? null : n.file
        } else {
          focusFile = null
        }
        selected = null
        if (cb.onFocus) cb.onFocus(focusFile)
      }
      function onWheel(ev) {
        ev.preventDefault()
        zoom = Math.max(0.35, Math.min(4.5, zoom * Math.exp(-ev.deltaY * 0.0016)))
      }

      canvas.addEventListener('pointerdown', onDown)
      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerup', onUp)
      canvas.addEventListener('pointerleave', function () { hover = null })
      canvas.addEventListener('dblclick', onDbl)
      canvas.addEventListener('wheel', onWheel, { passive: false })
      var ro = new ResizeObserver(resize)
      ro.observe(canvas.parentElement)
      resize()
      raf = requestAnimationFrame(draw)

      return {
        load: load,
        highlight: function (s) { query = s || '' },
        pick: function (id) {
          var n = nodesById[id]
          if (!n) return
          selected = n
          flyTo(n)
          if (cb.onSelect) cb.onSelect(describe(n))
        },
        // 按文件名（相对路径）定位：给「根源追溯」联动用。
        // 命中文件节点就聚焦 + 飞过去；只给到主题名时退化成高亮搜索。
        pickFile: function (rel) {
          if (!rel) return false
          var want = String(rel).replace(/\\/g, '/')
          var hit = null
          var tail = null
          for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i]
            if (n.kind !== 'file') continue
            var f = String(n.file || '').replace(/\\/g, '/')
            var src = String(n.src || '').replace(/\\/g, '/')
            if (!f && !src) continue
            if (f === want || src === want) { hit = n; break }
            if (!tail && (f.endsWith('/' + want) || want.endsWith('/' + f) || src.endsWith('/' + want))) tail = n
          }
          if (!hit) hit = tail
          if (!hit) {
            query = want
            return false
          }
          focusFile = hit.file
          if (cb.onFocus) cb.onFocus(focusFile)
          selected = hit
          flyTo(hit)
          if (cb.onSelect) cb.onSelect(describe(hit))
          return true
        },
        // 精确定位到「文件里的某一条」：追溯那边的每个结论/理由都会带正文，
        // 先按文件聚焦，再在这个文件的条目里挑最像的那条选中。
        pickNode: function (payload) {
          if (!payload) return false
          var want = String(payload.file || '').replace(/\\/g, '/')
          var text = String(payload.text || '').replace(/\s+/g, '')
          var fileNode = null
          var tail = null
          if (want) {
            for (var i = 0; i < nodes.length; i++) {
              var n = nodes[i]
              if (n.kind !== 'file') continue
              var f = String(n.file || '').replace(/\\/g, '/')
              var src = String(n.src || '').replace(/\\/g, '/')
              if (!f && !src) continue
              if (f === want || src === want) { fileNode = n; break }
              if (!tail && (f.endsWith('/' + want) || want.endsWith('/' + f) || src.endsWith('/' + want))) tail = n
            }
            fileNode = fileNode || tail
          }
          var entry = null
          if (text) {
            // 海马体的条目会被截断成 45 字 + …，比较时两边都截到 40 字再比
            var cut = function (s) { return s.length > 40 ? s.slice(0, 40) : s }
            var key = cut(text)
            var best = -1
            for (var j = 0; j < nodes.length; j++) {
              var m = nodes[j]
              if (m.kind !== 'entry') continue
              if (fileNode && m.file !== fileNode.file) continue
              var lab = String(m.label || '').replace(/\s+/g, '')
              if (!lab) continue
              var labKey = cut(lab)
              var score = 0
              if (labKey === key) score = 1000
              else if (labKey.indexOf(key) >= 0 || key.indexOf(labKey) >= 0) score = 500 + Math.min(labKey.length, key.length)
              if (score > best) { best = score; entry = m }
            }
            if (best <= 0) entry = null
          }
          var target = entry || fileNode
          if (!target) {
            if (text || want) query = text || want
            return false
          }
          if (fileNode) {
            focusFile = fileNode.file
            if (cb.onFocus) cb.onFocus(focusFile)
          }
          selected = target
          flyTo(target)
          if (cb.onSelect) cb.onSelect(describe(target))
          return true
        },
        zoomBy: function (f) { zoom = Math.max(0.35, Math.min(4.5, zoom * f)) },
        clearFocus: function () { focusFile = null; if (cb.onFocus) cb.onFocus(null) },
        fit: function () { zoom = 1; rot = { x: -0.22, y: 0.45 }; spin = { x: 0, y: 0.0016 }; fly = null },
        reset: function () { layout(); zoom = 1 },
        destroy: function () {
          alive = false
          cancelAnimationFrame(raf)
          ro.disconnect()
          canvas.removeEventListener('pointerdown', onDown)
          canvas.removeEventListener('pointermove', onMove)
          canvas.removeEventListener('pointerup', onUp)
          canvas.removeEventListener('dblclick', onDbl)
          canvas.removeEventListener('wheel', onWheel)
        }
      }
    }

    /* ── 面板 ────────────────────────────────────────────────────────────── */
    /* 音量记在浏览器里，切走再回来、刷新页面都还是上次那个值 */
    function readVol() {
      try {
        var s = window.localStorage.getItem('dsh-hp-vol')
        if (s !== null) {
          var n = Number(s)
          if (isFinite(n) && n >= 0 && n <= 1) return n
        }
      } catch (e) { }
      return 0.22
    }
    function saveVol(v) {
      try { window.localStorage.setItem('dsh-hp-vol', String(v)) } catch (e) { }
    }

    var LEGEND = [
      ['#ff7ab8', '日记'], ['#ffd166', '笔记'], ['#c9d6ff', '想法'],
      ['#59d6ff', '记忆库'], ['#68e0a8', '同事'], ['#b78cff', '人设'],
      ['#7ee0c0', '追溯'], ['#4ad8b0', '会话'], ['#ff9d5c', '主题']
    ]

    function Panel() {
      var canvasRef = useRef(null)
      var engineRef = useRef(null)
      var [stats, setStats] = useState(null)
      var [sel, setSel] = useState(null)
      var [excerpt, setExcerpt] = useState('')
      var [q, setQ] = useState('')
      var [err, setErr] = useState('')
      var [focusFile, setFocusFile] = useState(null)
      var [muted, setMuted] = useState(false)
      var mutedRef = useRef(false)
      var [vol, setVol] = useState(readVol)
      var volRef = useRef(readVol())

      // 背景音乐 + 交互音效。浏览器要求先有用户手势才准发声，所以首次点击才真正开始。
      var audioRef = useRef(null)
      var ensureAudio = useCallback(function () {
        var cur = audioRef.current
        if (cur) {
          try { if (cur.bgm && cur.bgm.paused) cur.bgm.play().catch(function () { }) } catch (e) { }
          return cur
        }
        var a = { bgm: null, ctx: null }
        try {
          a.bgm = new window.Audio(API + '/asset?name=bgm.mp3')
          a.bgm.loop = true
          a.bgm.volume = mutedRef.current ? 0 : volRef.current
          a.bgm.play().catch(function () { })
        } catch (e) { }
        try {
          var AC = window.AudioContext || window.webkitAudioContext
          if (AC) a.ctx = new AC()
        } catch (e) { }
        audioRef.current = a
        return a
      }, [])

      var beep = useCallback(function (kind) {
        var a = audioRef.current
        if (!a || !a.ctx || mutedRef.current) return
        try {
          var c = a.ctx
          var t = c.currentTime
          var o = c.createOscillator()
          var g = c.createGain()
          o.connect(g)
          g.connect(c.destination)
          if (kind === 'open') {
            o.type = 'sine'
            o.frequency.setValueAtTime(392, t)
            o.frequency.exponentialRampToValueAtTime(784, t + 0.22)
            g.gain.setValueAtTime(0.0001, t)
            g.gain.exponentialRampToValueAtTime(0.1, t + 0.05)
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
            o.start(t); o.stop(t + 0.6)
          } else {
            o.type = 'triangle'
            o.frequency.setValueAtTime(1046, t)
            o.frequency.exponentialRampToValueAtTime(1568, t + 0.07)
            g.gain.setValueAtTime(0.0001, t)
            g.gain.exponentialRampToValueAtTime(0.12, t + 0.01)
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
            o.start(t); o.stop(t + 0.26)
          }
        } catch (e) { }
      }, [])

      useEffect(function () {
        var engine = createEngine(canvasRef.current, {
          onStats: function (s) { setStats(s) },
          onSelect: function (n) { setSel(n); if (n) beep('open') },
          onFocus: function (f) { setFocusFile(f) },
          onError: function (e) { setErr(e) }
        })
        engineRef.current = engine
        engine.load(false)
        ensureAudio()
        return function () {
          engine.destroy()
          var a = audioRef.current
          if (a && a.bgm) { try { a.bgm.pause() } catch (e) { } }
        }
      }, [beep])

      // ── 与「根源追溯」联动：接收跳转请求 ────────────────────────────────
      // 追溯端把目标写进 localStorage 并派发 window 事件。两种时序都能接住：
      //   海马体先开着 → 事件到达立刻响应
      //   海马体后打开 → 挂载时读一次残留标记（10 分钟内有效）
      // 图的加载是异步的，节点还没到就退 300ms 重试，最多 6 次。
      useEffect(function () {
        var JUMP_KEY = 'dsh-hp-jump'
        var lastTs = 0
        var applyJump = function (payload) {
          if (!payload || !payload.file) return
          var ts = Number(payload.ts) || 0
          if (ts && ts <= lastTs) return
          lastTs = ts
          var tries = 0
          var run = function () {
            var eng = engineRef.current
            // 面板刚打开时引擎还没建、图还在拉，两种空窗都要等，不能一次就放弃
            if (!eng) {
              if (tries++ < 20) setTimeout(run, 400)
              return
            }
            var ok = eng.pickNode
              ? eng.pickNode(payload)
              : eng.pickFile(payload.file)
            if (ok) {
              // 真的落到位了才清标记，没成功就留着下次打开再试
              try { localStorage.removeItem(JUMP_KEY) } catch (e) { }
              return
            }
            if (tries++ < 20) setTimeout(run, 400)
          }
          run()
        }
        var onJump = function (ev) { applyJump(ev && ev.detail) }
        window.addEventListener('dsh-hp-jump', onJump)
        try {
          var raw = localStorage.getItem(JUMP_KEY)
          if (raw) {
            var obj = JSON.parse(raw)
            var ts = Number(obj && obj.ts) || 0
            if (ts && Date.now() - ts < 10 * 60 * 1000) setTimeout(function () { applyJump(obj) }, 240)
          }
        } catch (e) { }
        return function () { window.removeEventListener('dsh-hp-jump', onJump) }
      }, [])

      // 点节点 → 拉完整内容
      useEffect(function () {
        if (!sel) { setExcerpt(''); return }
        var alive = true
        setExcerpt(sel.snippet || '')
        fetch(API + '/node?id=' + encodeURIComponent(sel.id))
          .then(function (r) { return r.json() })
          .then(function (d) {
            if (!alive) return
            if (d && d.ok && d.excerpt) setExcerpt(d.excerpt)
          })
          .catch(function () { })
        return function () { alive = false }
      }, [sel && sel.id])

      useEffect(function () {
        if (engineRef.current) engineRef.current.highlight(q)
      }, [q])

      var refresh = useCallback(function () {
        setErr('')
        if (engineRef.current) engineRef.current.load(true)
      }, [])

      var body = [
        h('div', { className: 'hp-bar', key: 'bar' },
          h('div', { className: 'hp-title' }, h('span', { className: 'hp-dot' }), '海马体'),
          stats ? h('span', { className: 'hp-stat' }, stats.nodes + ' 节点 · ' + stats.links + ' 连线 · ' + stats.files + ' 文件' + (stats.sessions ? ' · ' + stats.sessions + ' 会话' : '')) : null,
          h('div', { className: 'hp-search' },
            h('input', {
              className: 'hp-input', placeholder: '找点什么…', value: q,
              onChange: function (e) { setQ(e.target.value) }
            }),
            h('button', { className: 'hp-btn', onClick: refresh, title: '重新扫描记忆文件' }, '刷新')
          )
        ),
        h('div', { className: 'hp-stage', key: 'stage' },
          h('canvas', { className: 'hp-canvas', ref: canvasRef }),
          err ? h('div', { className: 'hp-empty' }, '读取失败：' + err) : null,
          sel ? h('div', { className: 'hp-info' },
            h('button', { className: 'hp-info-x', onClick: function () { setSel(null) } }, '×'),
            h('div', { className: 'hp-info-k' }, sel.kind === 'file' ? '记忆文件' : sel.kind === 'topic' ? '主题' : '条目'),
            h('div', { className: 'hp-info-t' }, prettyName(sel.label, sel.file)),
            sel.file ? h('div', { className: 'hp-info-f' }, sel.file) : null,
            h('div', { className: 'hp-info-p' }, excerpt || '（没有内容）'),
            sel.neighbors && sel.neighbors.length ? h('div', { className: 'hp-nb' },
              h('div', { className: 'hp-nb-h' },
                h('span', null, '相关分支'),
                h('em', null, sel.neighbors.length + ' 条')
              ),
              sel.neighbors.slice(0, 30).map(function (nb) {
                return h('button', {
                  key: nb.id,
                  className: 'hp-nb-i',
                  title: nb.label,
                  onClick: function () { if (engineRef.current) engineRef.current.pick(nb.id) }
                }, h('b', null, nb.kind === 'file' ? '文件' : nb.kind === 'topic' ? '主题' : '·'), nb.label)
              })
            ) : null
          ) : null,
          h('div', { className: 'hp-vol', key: 'vol' },
            h('input', {
              className: 'hp-vol-r', type: 'range', min: 0, max: 100, step: 1,
              value: String(Math.round(vol * 100)),
              title: '背景音乐音量',
              onChange: function (e) {
                var v = Number(e.target.value) / 100
                volRef.current = v
                setVol(v)
                saveVol(v)
                if (v > 0) { if (muted) setMuted(false); mutedRef.current = false }
                var a = ensureAudio()
                if (a && a.bgm) { try { a.bgm.volume = v } catch (e2) { } }
              }
            }),
            h('span', { className: 'hp-vol-n' }, String(Math.round(vol * 100)))
          ),
          h('div', { className: 'hp-zoom', key: 'zoom' },
            h('button', {
              className: 'hp-zbtn sm', title: muted ? '开启声音' : '静音', 'aria-label': '声音',
              onClick: function () {
                var next = !muted
                setMuted(next)
                mutedRef.current = next
                var a = ensureAudio()
                if (a && a.bgm) { try { a.bgm.volume = next ? 0 : volRef.current } catch (e) { } }
              }
            }, muted ? '🔇' : '🔊'),
            h('button', {
              className: 'hp-zbtn', title: '放大', 'aria-label': '放大',
              onClick: function () { if (engineRef.current) engineRef.current.zoomBy(1.35) }
            }, '+'),
            h('button', {
              className: 'hp-zbtn', title: '缩小', 'aria-label': '缩小',
              onClick: function () { if (engineRef.current) engineRef.current.zoomBy(1 / 1.35) }
            }, '−'),
            h('button', {
              className: 'hp-zbtn sm', title: '复位视角', 'aria-label': '复位视角',
              onClick: function () { if (engineRef.current) engineRef.current.fit() }
            }, '⟲')
          ),
          h('div', { className: 'hp-hint' }, focusFile
            ? '只看「' + focusFile + '」 · 双击空白退出'
            : '拖动旋转球体 · 点节点看完整内容 · 双击文件聚焦 · 右下角缩放')
        ),
        h('div', { className: 'hp-legend', key: 'legend' },
          LEGEND.map(function (it) {
            return h('span', { className: 'hp-lg', key: it[1] },
              h('i', { style: { background: it[0], boxShadow: '0 0 6px ' + it[0] } }), it[1])
          })
        )
      ]

      return h('div', { className: 'hp-root', onPointerDown: function () { ensureAudio() } }, body)
    }

    /* ── 注册 ────────────────────────────────────────────────────────────── */
    var PANEL_ID = 'dsh-hippocampus'

    function apply(ctx) {
      ctx.slots.inject('main', function () {
        return ctx.slots.register({
          name: 'main',
          key: PANEL_ID
        }, Panel)
      })
      ctx.slots.inject('sidebar.panellist', function () {
        return ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 30,
          label: '海马体'
        }, Icon)
      })
    }

    exports.apply = apply
    exports.inject = ['slots']
    return module.exports
  }
})
