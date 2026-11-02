# 海马体（dsh-hippo）

把工作区文件、DSH 记忆和会话记录画成一张会转的神经元网络，挂在侧栏随时翻。

文件是簇心，每一条标题/列表项是节点，共同关键词把它们连成一张网。点节点看原文，滚轮缩放，拖拽旋转，双击聚焦单簇。

## 安装

```bash
dsh plugin --profile desktop add dsh-hippo
```

装完重启 DSH，左侧栏会出现「海马体」图标。

## 它会读什么

默认三个来源：

| 来源 | 说明 |
| --- | --- |
| 当前工作区 | `DSH_WORKSPACE`，没有就用 `~/Documents/deepseek-harness/default-workspace` |
| `~/.dsh` | DSH 自己的记忆、人设、技能 |
| 会话记录 | `~/.dsh/sessions` 下所有会话，见下 |

只读 `.md` / `.markdown` / `.txt`，不碰 `node_modules`、附件、日志、缓存。

### 会话也会进球里

每次启动都会重新扫一遍 `~/.dsh/sessions/*/*/session.v4.jsonl.zstd`，把每个会话解成：

- 一个**会话节点**（标题取 DSH 记的会话名，没有就取你说的第一句话）
- 最多 8 条**条目节点**（你说过的话，去掉了系统注入的说明文字）

会话文件是追加式多帧 zstd，插件按帧切分逐个解压，解析结果按「大小 + 修改时间」缓存到 `~/.dsh/dsh-hippocampus/session-cache.json`，没变的文件不重复解。

**所以每次重启 DSH，新会话和相关文件都会自动重新整理进去，不用手动触发。**

标题一律做成中文短句：剥掉盘符路径、文件后缀、XML 标签和聊天记录时间戳；英文占比太高时按内置词表翻译；翻不出来的用「会话 · 日期」兜底。

## 配置

`~/.dsh/dsh-hippocampus.json`（可选，不存在就用默认值）：

```json
{
  "sources": [
    { "dir": "D:/notes", "group": "note", "label": "笔记" },
    { "dir": "D:/diary", "group": "diary", "label": "日记" }
  ],
  "sessions": { "enabled": true, "limit": 60 }
}
```

- `sources`：额外要扫的目录，`group` 只影响颜色分组，`label` 是分组名。
- `sessions.limit`：最多读多少个会话（按时间新→旧），设 `0` 或 `enabled: false` 关掉。

## 和「根源追溯」联动

装 [根源追溯](https://github.com/Snerou/dsh-reason-tree) 之后，在追溯面板里点「定位至海马体」，海马体会自动飞到对应的文件或那一条结论上。

联动走 `localStorage` + `window` 自定义事件，不需要两个插件互相 import。

## 数据不出本机

所有解析都在本地内存里做，不上传任何东西。插件本身不带任何用户数据，读什么完全取决于你机器上的目录。

## 许可

MIT
