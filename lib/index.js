/* ============================================================================
 * dsh-hippo — Host 半侧
 * ----------------------------------------------------------------------------
 * 把 DSH 里的记忆文件扫成一张神经元网络：文件是簇心，行是节点，
 * 关键词把不同簇连起来。只读，不改任何文件。
 *
 * 数据源默认取 DSH 自己（~/.dsh/soul-md/memory）和当前工作区；
 * 想加自己的笔记目录，在 ~/.dsh/dsh-hippo.json 里写：
 *   { "sources": [{ "dir": "D:/notes", "group": "note", "label": "笔记" }] }
 *
 * 提供：
 *   GET /dsh-hippo/graph    整张图（节点 + 连线 + 统计）
 *   GET /dsh-hippo/node?id= 单个节点的原文片段
 * ========================================================================== */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ASSET_DIR = path.join(HERE, 'assets')
const ASSET_MIME = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' }

const NS = 'dsh-hippo'
const ROUTE = '/dsh-hippo'

const HOME = os.homedir()
const CONFIG_FILE = path.join(HOME, '.dsh', 'dsh-hippo.json')
const CACHE_DIR = path.join(HOME, '.dsh', 'dsh-hippo')
const SESSION_CACHE = path.join(CACHE_DIR, 'session-cache.json')

/** 当前工作区：优先看 DSH 给的环境变量，没有就退回默认安装位置。 */
function resolveWorkspace() {
  const env = process.env.DSH_WORKSPACE || process.env.DSH_CWD || ''
  if (env) { try { if (fs.statSync(env).isDirectory()) return env } catch { } }
  const guess = path.join(HOME, 'Documents', 'deepseek-harness', 'default-workspace')
  try { return fs.statSync(guess).isDirectory() ? guess : '' } catch { return '' }
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) || {} } catch { return {} }
}

/** 扫描源：目录按后缀分组。每次启动按配置重新算一遍。 */
let SOURCES = []

function resolveSources(config) {
  const list = []
  const seen = new Set()
  const push = (dir, group, label) => {
    if (!dir || typeof dir !== 'string') return
    try { if (!fs.statSync(dir).isDirectory()) return } catch { return }
    const key = path.resolve(dir).toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    list.push({ dir, group: group || 'memory', label: label || path.basename(dir) })
  }

  // 工作区：对话、笔记、代码大多在这
  const ws = resolveWorkspace()
  if (ws) push(ws, 'workspace', '工作区')
  // DSH 数据目录整个扫一遍：不管对方把记忆放在哪个子目录，只要能扫到 markdown 就行
  push(process.env.DSH_HOME || path.join(HOME, '.dsh'), 'memory', 'DSH')
  // 用户自己塞进来的目录（日记、想法、笔记、追溯树……都在这里配）
  for (const s of (config && config.sources) || []) push(s.dir, s.group, s.label)
  return list
}

/** 主题词表：命中就越过文件连成一张网。顺序 = 靠前越重要。 */
const TOPICS = [
  ['项目', ['项目', '工程', '仓库', '代码']],
  ['记忆', ['记忆', '记住', '忘了', '上下文', '交接']],
  ['插件', ['插件', 'plugin', '扩展', '工具链']],
  ['配置', ['配置', '设置', '参数', '报错']],
  ['对话', ['对话', '聊天', '消息', '会话']],
  ['任务', ['任务', '待办', '计划', '看板']],
  ['笔记', ['笔记', '记录', '总结', '想法']],
  ['时间', ['今天', '昨天', '早上', '晚上', '日期']],
  ['情绪', ['难过', '开心', '生气', '委屈', '焦虑']],
  ['学习', ['学习', '教程', '文档', '知识']],
  ['工具', ['工具', '脚本', '命令', '终端']],
  ['文件', ['文件', '目录', '路径', '备份']],
  ['网络', ['网络', '接口', '请求', '网站']],
  ['数据', ['数据', '数据库', '统计', '参数']],
  ['设计', ['设计', '界面', '样式', '颜色']],
  ['猫', ['猫', '猫咪', '小猫']]
]

const GROUP_COLOR = {
  memory: '#59d6ff',
  workspace: '#8fb4e8',
  note: '#ffd166',
  diary: '#ff7ab8',
  idea: '#c9d6ff',
  people: '#68e0a8',
  soul: '#b78cff',
  trace: '#7ee0c0',
  session: '#4ad8b0',
  topic: '#ff9d5c'
}

/** 扫目录时这些不进：插件包、会话二进制、附件、日志都不是记忆。 */
const SKIP_DIRS = new Set(['node_modules', 'sessions', 'attachments', 'logs', 'cache', 'profiles', 'fish-memory', 'knowledge', 'dist', 'build', 'subs', 'subtitles', 'frames', 'asr', 'transcripts', 'tmp', 'temp', 'output', 'out', 'vendor', '.git'])

function walk(dir, out = [], depth = 0) {
  if (depth > 4) return out
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out, depth + 1)
    else if (e.isFile() && /\.(md|markdown|txt)$/i.test(e.name)) out.push(full)
  }
  return out
}

function groupOf(file, fallback) {
  const p = file.replace(/\\/g, '/').toLowerCase()
  if (p.includes('/日记/')) return 'diary'
  if (p.includes('/笔记/')) return 'note'
  if (p.includes('/想法/')) return 'idea'
  if (p.includes('/colleagues/')) return 'people'
  if (p.includes('/追溯/')) return 'trace'
  return fallback
}

/* 文件节点的显示名：把路径翻成人话。只影响图上怎么叫，不动真实路径。 */
const FILE_WORDS = {
  readme: '说明', agents: '工作区说明', skill: '技能', skills: '技能',
  work: '工作', job: '工作', persona: '人设', memory: '记忆', memories: '记忆',
  notes: '笔记', note: '笔记', diary: '日记', idea: '想法', ideas: '想法',
  index: '索引', config: '配置', changelog: '更新记录', license: '许可',
  tasks: '任务', task: '任务', log: '日志', logs: '日志', plan: '计划', todo: '待办',
  handoff: '交接', sample: '样例', architecture: '架构', visibility: '可见性',
  chat: '聊天', group: '群聊', history: '记录', main: '主程序', server: '服务'

}
const DIR_WORDS = {
  colleagues: '同事', memory: '记忆', memories: '记忆', notes: '笔记',
  diary: '日记', ideas: '想法', docs: '文档', doc: '文档', knowledge: '资料',
  workspace: '工作区', projects: '项目', project: '项目', tools: '工具',
  soul: '人设', persona: '人设', config: '配置', src: '源码', lib: '库'
}
const EXTRA_WORDS = {
  target: '对象', session: '会话', init: '初始化', selfloader: '自加载',
  visibility: '可见性', architecture: '架构', history: '记录', group: '群聊',
  c2c: '私聊', utils: '工具', core: '核心', api: '接口', test: '测试',
  draft: '草稿', temp: '临时', backup: '备份', export: '导出', import: '导入',
  scan: '扫描', digest: '摘要', summary: '摘要', probe: '探测',
  research: '调研', analysis: '分析', debrief: '复盘', example: '示例',
  reference: '参考', references: '参考', prompt: '提示词', prompts: '提示词',
  website: '网站', web: '网页', python: 'Python', docker: 'Docker',
  quick: '快速', guide: '指南', tutorial: '教程', review: '复盘', report: '报告'
}
function prettyWord(w) {
  const s = String(w || '')
  const k = s.toLowerCase()
  if (FILE_WORDS[k]) return FILE_WORDS[k]
  if (DIR_WORDS[k]) return DIR_WORDS[k]
  if (EXTRA_WORDS[k]) return EXTRA_WORDS[k]
  const segs = s.split(/[_-]+/).filter(Boolean)
  if (segs.length > 1) {
    let changed = false
    const out = segs.map(function (x) {
      const kk = x.toLowerCase()
      const v = FILE_WORDS[kk] || DIR_WORDS[kk] || EXTRA_WORDS[kk]
      if (v) changed = true
      return v || x
    })
    if (changed) return out.join(' ')
  }
  return s.replace(/_/g, ' ')
}
function prettyLabel(rel) {
  const noExt = rel.replace(/\.(md|markdown|txt)$/i, '')
  const parts = noExt.split('/').filter(Boolean)
  if (!parts.length) return rel
  const raw = parts[parts.length - 1]
  let base = prettyWord(raw)
  const dm = /^([A-Za-z_-]+?)[-_](\d{4}-\d{2}-\d{2})/.exec(raw)
  if (dm) base = prettyWord(dm[1]) + ' ' + dm[2]
  if (parts.length === 1) return base
  const parent = prettyWord(parts[parts.length - 2])
  if (base.indexOf(parent) === 0) return base
  return parent + ' · ' + base
}

/** 从一段文本里抽条目：标题行和列表项，去掉太短的。 */
function entriesOf(text, limit) {
  const out = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line) continue
    let label = null
    const h = /^#{1,4}\s+(.+)$/.exec(line)
    if (h) label = h[1].replace(/^结论[：:]\s*/, '')
    else if (/^[-*]\s+/.test(line)) label = line.replace(/^[-*]\s+/, '')
    if (!label) continue
    label = label
      .replace(/^\[[+\-?]\]\s*/, '')
      .replace(/\s*(?:→|->|>)\s*(?:记忆|文件|memory|file)\s*[:：]\s*\S+\s*$/, '')
      .replace(/[*`_>[\]]/g, '').replace(/\s+/g, ' ').trim()
    if (label.length < 4) continue
    if (label.length > 46) label = label.slice(0, 45) + '…'
    out.push({ label, line: i })
    if (out.length >= limit) break
  }
  return out
}

function topicsOf(text) {
  const hit = []
  for (const [name, keys] of TOPICS) {
    if (keys.some((k) => text.includes(k))) hit.push(name)
  }
  return hit
}

/* ---------------------------------------------------------------------------
 * 会话：把 ~/.dsh/sessions 下的会话记录也读进来
 * ---------------------------------------------------------------------------
 * 会话文件是「追加式多帧 zstd」，一帧一次写入。node 的 zstdDecompressSync
 * 只解第一帧，所以按 magic 切帧逐段解。
 * ------------------------------------------------------------------------ */

const SESSION_ROOT = path.join(HOME, '.dsh', 'sessions')

/** 多帧 zstd → 文本。单帧文件也走这条路。 */
function unzstdFrames(buf) {
  const idx = []
  for (let i = 0; i < buf.length - 3; i++) {
    if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) idx.push(i)
  }
  if (!idx.length) {
    try { return zlib.zstdDecompressSync(buf).toString('utf8') } catch { return '' }
  }
  const parts = []
  for (let k = 0; k < idx.length; k++) {
    const s = idx[k]
    const e = k + 1 < idx.length ? idx[k + 1] : buf.length
    try { parts.push(zlib.zstdDecompressSync(buf.subarray(s, e))) } catch { }
  }
  return Buffer.concat(parts).toString('utf8')
}

/** DSH 会话里混着一堆系统注入的说明文字，这些不算「人说过的话」。 */
const NOISE = [
  'Current runtime context',
  'Your parent agent id',
  'Time sampled while preparing',
  'Browser time zone for this request',
  'Elapsed since the preceding',
  '<system-reminder>',
  '<available_skills>',
  'Tokens prefixed with @ are paths',
  'Possibly relevant memory',
  'approval policy changed',
  'sandbox mode',
  'permission preset',
  'conversation compressed',
  'Attachment(s) from tool result'
]

/** 剥掉桥接层塞进来的 XML 标签和「[最近群聊…]」这类前缀，只留人话。 */
function stripNoise(s) {
  let t = String(s || '')
  t = t.replace(/<[^<>]{1,300}>/g, ' ')
  t = t.replace(/^\[最近群聊[^\]]*\]\s*/, '')
  t = t.replace(/^\[[^\]]{0,90}\]\s*(?=[\u4e00-\u9fa5])/, '')
  return t.replace(/\s+/g, ' ').trim()
}

function cleanMessage(t) {
  const s = stripNoise(t)
  if (!s) return ''
  for (const n of NOISE) if (s.includes(n)) return ''
  // 一句中文都没有、又长又像操作系统的广播，基本不是人说的话
  if (s.length > 80 && !/[\u4e00-\u9fa5]/.test(s)) return ''
  return s
}

function textOf(content) {
  if (typeof content === 'string') return content
  const parts = (content && content.content) || []
  const out = []
  for (const p of parts) {
    if (p && p.type === 'text' && typeof p.text === 'string') out.push(p.text)
  }
  return out.join('\n').trim()
}

/** 把标题洗成便于理解的中文：去掉盘符路径，英文占比太高就按词表翻。 */
function humanizeTitle(raw) {
  let t = stripNoise(raw)
  if (!t) return ''
  t = t.replace(/[A-Za-z]:\\[^\s，。；、]*/g, '')
  t = t.replace(/\.(md|markdown|txt|json|js|py|ps1)\b/gi, '')
  // 「…… [13:50 某某(123)」这种是聊天记录粘进来的，标题到正文为止就够
  t = t.split(/\[\d{1,2}:\d{2}/)[0]
  t = t.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const cjk = (t.match(/[\u4e00-\u9fa5]/g) || []).length
  const ascii = (t.match(/[A-Za-z0-9_\-]/g) || []).length
  if (cjk === 0 || ascii / (cjk + ascii) > 0.75) {
    const p = prettyLabel(t.replace(/[\\/]/g, '/'))
    if (p && /[\u4e00-\u9fa5]/.test(p)) t = p
  }
  if (t.length > 46) t = t.slice(0, 45) + '…'
  return t
}

/** 读一个会话文件，抽出标题、时间、用户说过的话。 */
function parseSession(file) {
  let text = ''
  try { text = unzstdFrames(fs.readFileSync(file)) } catch { return null }
  if (!text) return null
  const data = { id: '', title: '', cwd: '', createdAt: 0, origin: '', parent: '', label: '', messages: [] }
  let firstUser = ''
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let o
    try { o = JSON.parse(line) } catch { continue }
    if (o.type === 'session') {
      data.id = o.id || ''
      data.cwd = o.cwd || ''
      data.createdAt = o.createdAt || 0
      data.origin = o.origin || ''
      data.parent = o.parentSession || ''
    } else if (o.type === 'session/title') {
      const t = o.data && o.data.title
      if (t && !data.title) data.title = String(t)
    } else if (o.type === 'subagent/descriptor') {
      const l = o.data && o.data.label
      if (l && !data.label) data.label = String(l)
    } else if (o.type === 'user/message') {
      const t = cleanMessage(textOf(o.data))
      if (t) {
        if (!firstUser) firstUser = t
        if (data.messages.length < 40) data.messages.push(t)
      }
    }
  }
  if (!data.title) data.title = firstUser
  data.title = humanizeTitle(data.title || data.label || data.id || '')
  if (!data.title) return null
  // 只剩一串 uuid 兜底、又没有一句人话的会话，没有信息量，不进图
  if (/^会话\s+[0-9a-f][0-9a-f\s-]{6,}$/i.test(data.title) && !data.messages.length) return null
  // 一个汉字都没有的标题（命令、英文提问、纯 hash）不适合当记忆标签，用日期兜底
  if (!/[\u4e00-\u9fa5]/.test(data.title)) {
    const d = data.createdAt ? new Date(data.createdAt) : new Date()
    data.title = '会话 · ' + d.toISOString().slice(0, 10)
  }
  return data
}

/** 会话解析结果按 (路径, 大小, 修改时间) 缓存，没变就不重解。 */
let SESSION_MEMO = null

function loadSessionMemo() {
  if (SESSION_MEMO) return SESSION_MEMO
  try { SESSION_MEMO = JSON.parse(fs.readFileSync(SESSION_CACHE, 'utf8')) || {} } catch { SESSION_MEMO = {} }
  return SESSION_MEMO
}

function saveSessionMemo() {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    fs.writeFileSync(SESSION_CACHE, JSON.stringify(SESSION_MEMO || {}), 'utf8')
  } catch { }
}

/** 扫一遍所有会话，返回 [{ id, title, file, createdAt, messages }]（按时间新→旧）。 */
function listSessions(limit) {
  const memo = loadSessionMemo()
  const out = []
  let dirs = []
  try { dirs = fs.readdirSync(SESSION_ROOT, { withFileTypes: true }).filter((e) => e.isDirectory()) } catch { return out }
  for (const wsDir of dirs) {
    const wsPath = path.join(SESSION_ROOT, wsDir.name)
    let subs = []
    try { subs = fs.readdirSync(wsPath, { withFileTypes: true }).filter((e) => e.isDirectory()) } catch { continue }
    for (const s of subs) {
      const file = path.join(wsPath, s.name, 'session.v4.jsonl.zstd')
      let st
      try { st = fs.statSync(file) } catch { continue }
      const key = file.toLowerCase()
      let rec = memo[key]
      if (!rec || rec.size !== st.size || rec.mtime !== st.mtimeMs) {
        const parsed = parseSession(file)
        if (!parsed) continue
        rec = { size: st.size, mtime: st.mtimeMs, data: parsed }
        memo[key] = rec
      }
      out.push({ ...rec.data, file, mtime: st.mtimeMs })
    }
  }
  saveSessionMemo()
  out.sort((a, b) => (b.createdAt || b.mtime) - (a.createdAt || a.mtime))
  return typeof limit === 'number' && limit > 0 ? out.slice(0, limit) : out
}

function buildGraph() {
  const nodes = []
  const links = []
  const seenTopic = new Map()
  const seenEntry = new Set()
  const files = []

  for (const src of SOURCES) {
    const list = fs.existsSync(src.dir) && fs.statSync(src.dir).isDirectory()
      ? walk(src.dir)
      : (fs.existsSync(src.dir) ? [src.dir] : [])
    for (const file of list) {
      let text = ''
      let size = 0
      try {
        size = fs.statSync(file).size
        text = fs.readFileSync(file, 'utf8')
      } catch { continue }
      if (!text.trim()) continue
      const rel = path.relative(src.dir, file).replace(/\\/g, '/')
      const group = groupOf(file, src.group)
      const fileId = 'f:' + file
      files.push({ id: fileId, name: rel, size })
      nodes.push({
        id: fileId,
        label: prettyLabel(rel),
        group,
        kind: 'file',
        size: 5 + Math.min(10, Math.round(Math.sqrt(size) / 12)),
        color: GROUP_COLOR[group] || '#9fb4d0',
        file: rel,
        src: file,
        snippet: text.slice(0, 400)
      })

      // 追溯树是「思考骨架」，每个节点都要能对上，不能像普通笔记那样截断
      const limit = group === 'trace' ? 60 : size > 12000 ? 34 : size > 4000 ? 22 : 12
      const entries = entriesOf(text, limit)
      entries.forEach((e, i) => {
        const label = e.label
        // 同一句话在 SKILL.md / work.md / persona.md 里会各出现一次，只留第一次
        if (seenEntry.has(label)) return
        seenEntry.add(label)
        const id = fileId + '#' + i
        nodes.push({
          id, label, group, kind: 'entry', size: 2.2, color: GROUP_COLOR[group] || '#9fb4d0',
          file: rel, line: e.line, src: file, snippet: label
        })
        links.push({ s: fileId, t: id })
        for (const topic of topicsOf(label)) {
          const tid = 't:' + topic
          if (!seenTopic.has(topic)) {
            seenTopic.set(topic, true)
            nodes.push({ id: tid, label: topic, group: 'topic', kind: 'topic', size: 7, color: GROUP_COLOR.topic, file: '', snippet: '主题：' + topic })
          }
          links.push({ s: id, t: tid })
        }
      })
    }
  }

  // ---- 会话：每次重启都重新读一遍工作区会话，塞进球里 ----
  const cfg = readConfig()
  const sessionCfg = cfg.sessions || {}
  const sessionLimit = sessionCfg.enabled === false ? 0 : (Number(sessionCfg.limit) || 60)
  let sessionCount = 0
  if (sessionLimit > 0) {
    let sessions = []
    try { sessions = listSessions(sessionLimit) } catch { }
    // 同一件事的父子会话会撞标题，只留时间新的那个（列表已按时间新→旧排）
    const seenSession = new Set()
    for (const s of sessions) {
      const sid = 's:' + s.file
      const title = s.title || '未命名会话'
      const tk = title.toLowerCase()
      if (seenSession.has(tk)) continue
      seenSession.add(tk)
      const when = s.createdAt ? new Date(s.createdAt) : new Date(s.mtime || Date.now())
      const stamp = when.toISOString().slice(0, 10)
      sessionCount++
      files.push({ id: sid, name: title, size: 0 })
      nodes.push({
        id: sid,
        label: title,
        group: 'session',
        kind: 'session',
        size: 6,
        color: GROUP_COLOR.session,
        file: '',
        src: s.file,
        snippet: (s.messages || []).slice(0, 3).join(' / ') || title,
        time: stamp
      })
      const msgs = (s.messages || []).slice(0, 8)
      msgs.forEach((m, i) => {
        const label = m.length > 46 ? m.slice(0, 45) + '…' : m
        if (label.length < 4) return
        if (seenEntry.has(label)) return
        seenEntry.add(label)
        const id = sid + '#' + i
        nodes.push({
          id, label, group: 'session', kind: 'entry', size: 2.2,
          color: GROUP_COLOR.session, file: '', line: i, src: s.file, snippet: m
        })
        links.push({ s: sid, t: id })
        for (const topic of topicsOf(label)) {
          const tid = 't:' + topic
          if (!seenTopic.has(topic)) {
            seenTopic.set(topic, true)
            nodes.push({ id: tid, label: topic, group: 'topic', kind: 'topic', size: 7, color: GROUP_COLOR.topic, file: '', snippet: '主题：' + topic })
          }
          links.push({ s: id, t: tid })
        }
      })
    }
  }

  const stats = {
    nodes: nodes.length,
    links: links.length,
    files: files.length,
    sessions: sessionCount,
    topics: seenTopic.size,
    scannedAt: new Date().toISOString()
  }
  return { nodes, links, stats, files }
}

let cache = null
let cacheAt = 0
const TTL = 30 * 1000

function graph(force) {
  if (!force && cache && Date.now() - cacheAt < TTL) return cache
  cache = buildGraph()
  cacheAt = Date.now()
  return cache
}

function rejected(ctx, req, res) {
  try {
    const conn = (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) || ctx.connection
    if (!conn || typeof conn.requestRejection !== 'function') return false
    const code = conn.requestRejection(req)
    if (code === undefined || code === null || code === false) return false
    res.statusCode = typeof code === 'number' ? code : 403
    res.end()
    return true
  } catch { return false }
}

function sendJson(res, code, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': String(body.length)
  })
  res.end(body)
}

export const name = NS
export const inject = ['webServer', 'connection']

/** 调试用：不经 HTTP 直接拿一张图。 */
export function __buildGraph() {
  if (!SOURCES.length) SOURCES = resolveSources(readConfig())
  return buildGraph()
}

export function apply(ctx, config) {
  SOURCES = resolveSources(config || readConfig())

  let webServer
  try { webServer = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined } catch { }
  webServer = webServer || ctx.webServer
  if (!webServer || typeof webServer.register !== 'function') {
    ctx.logger?.warn?.('[' + NS + '] 没有可用的 webServer，海马体面板不可用')
    return
  }

  const disposers = []
  const wrap = (route) => Object.assign({}, route, {
    handler: async (req, res) => {
      if (rejected(ctx, req, res)) return
      try { return route.handler(req, res) } catch (err) {
        sendJson(res, 500, { ok: false, error: String(err && err.message || err) })
      }
    }
  })

  disposers.push(webServer.register(wrap({
    kind: 'exact',
    path: ROUTE + '/graph',
    handler: (req, res) => {
      const force = (req.url || '').includes('force=1')
      sendJson(res, 200, { ok: true, ...graph(force) })
    }
  })))

  disposers.push(webServer.register(wrap({
    kind: 'exact',
    path: ROUTE + '/node',
    handler: (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const id = url.searchParams.get('id') || ''
      const g = graph(false)
      const node = g.nodes.find((n) => n.id === id)
      if (!node) { sendJson(res, 404, { ok: false, error: 'not found' }); return }
      // 点节点要能看到完整内容，不只是标题。
      let excerpt = node.snippet || ''
      if (node.kind === 'session' || /\.zstd$/i.test(node.src || '')) {
        // 会话原文是压缩二进制，从缓存里取解出来的消息
        const memo = loadSessionMemo()
        const rec = memo[String(node.src || '').toLowerCase()]
        const msgs = (rec && rec.data && rec.data.messages) || []
        excerpt = msgs.length ? msgs.join('\n\n') : (node.snippet || '')
      } else if (node.src && typeof node.line === 'number') {
        try {
          const all = fs.readFileSync(node.src, 'utf8').split(/\r?\n/)
          const from = Math.max(0, node.line - 3)
          const to = Math.min(all.length, node.line + 26)
          excerpt = all.slice(from, to).join('\n')
        } catch { }
      }
      sendJson(res, 200, { ok: true, node, excerpt })
    }
  })))

  disposers.push(webServer.register(wrap({
    kind: 'exact',
    path: ROUTE + '/asset',
    handler: (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const name = path.basename(url.searchParams.get('name') || '')
      if (!/^[a-z0-9._-]+\.(mp3|ogg|wav)$/i.test(name)) { res.statusCode = 400; res.end(); return }
      let buf
      try { buf = fs.readFileSync(path.join(ASSET_DIR, name)) } catch { res.statusCode = 404; res.end(); return }
      res.writeHead(200, {
        'Content-Type': ASSET_MIME[path.extname(name).toLowerCase()] || 'application/octet-stream',
        'Content-Length': String(buf.length),
        'Cache-Control': 'public, max-age=86400'
      })
      res.end(buf)
    }
  })))

  // 启动时重建一次，之后每 60 秒后台刷新，打开面板就是最新的。
  let refreshTimer = null
  try {
    graph(true)
    refreshTimer = setInterval(() => {
      try { graph(true) } catch (err) { ctx.logger?.warn?.('[' + NS + '] 海马体自动刷新失败: ' + err) }
    }, 60 * 1000)
    if (refreshTimer && typeof refreshTimer.unref === 'function') refreshTimer.unref()
  } catch (err) {
    ctx.logger?.warn?.('[' + NS + '] 海马体启动预热失败: ' + err)
  }

  ctx.effect(() => () => {
    for (const d of disposers) { try { d() } catch { } }
    if (refreshTimer) { try { clearInterval(refreshTimer) } catch { } }
  })
}
