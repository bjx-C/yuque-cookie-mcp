# 语雀 MCP 服务器 (Enhanced)

通过 MCP 协议让 AI 助手管理你的语雀文档。**支持 Cookie 自动化登录，无需超级会员**。

> **Enhanced fork** based on [xiaocong/yuque-cookie-mcp](https://github.com/xiaocong/yuque-cookie-mcp) v1.0.2 (original repo unavailable as of 2026-07)

## 此 Fork 新增功能

| 工具 | 分类 | 说明 |
|------|------|------|
| `create_repo` | 知识库管理 | 创建新知识库（Cookie 模拟网页操作） |
| `delete_repo` | 知识库管理 | 删除知识库 |
| `list_notes` | 小记管理 | 列出所有小记（分页支持） |
| `get_note` | 小记管理 | 获取单篇小记完整内容 |
| `create_note` | 小记管理 | 创建小记（lake 格式） |
| `update_note` | 小记管理 | 更新小记内容 |
| `patch_doc_section_by_url` | 文档编辑 | 按标题局部替换章节，保留其他 Lake 卡片并支持原生公式节点 |

> 小记功能通过语雀网页内部 API (`/api/modules/note/notes/NoteController`) 实现，官方 OpenAPI 不覆盖小记，仅 Cookie 模式下可用。

## 功能

### 通用工具

| 工具 | 说明 |
|------|------|
| `check_auth_status` | 检查认证状态和 Cookie 有效期 |
| `refresh_cookie` | 刷新 Cookie（自动打开浏览器登录） |
| `get_user_info` | 获取当前用户信息 |
| `get_doc_by_url` | **通过语雀链接直接获取文档**（支持个人/公司空间） |

### 知识库管理

| 工具 | 说明 |
|------|------|
| `list_repos` | 列出所有知识库 |
| `get_repo` | 获取知识库详情 |
| `create_repo` | 创建新知识库 |
| `delete_repo` | 删除知识库 |
| `get_repo_toc` | 获取知识库目录结构 |

### 文档操作

| 工具 | 说明 |
|------|------|
| `list_docs` | 列出知识库文档 |
| `get_doc` | 获取文档内容 |
| `create_doc` | 创建文档 |
| `update_doc` | 更新文档 |
| `patch_doc_section_by_url` | **通过链接和标题安全更新单个章节**（支持语雀原生公式节点） |
| `delete_doc` | 删除文档 |
| `search_docs` | 搜索文档 |

### 公式与章节级更新

更新 Lake 文档时，优先使用 `patch_doc_section_by_url`。工具会先通过语雀官方转换接口把 Markdown 转成 Lake，再只替换指定标题下的内容，并在写入前后校验目标章节之外的卡片节点。

语雀公式使用标准 LaTeX Markdown 语法：

```markdown
行内公式：$C = \frac{m}{V}$

块级公式：
$$
C = \frac{m}{V}
$$
```

建议先令 `dry_run=true` 查看标题层级、公式数量和受保护卡片数量，再执行正式写入。`update_doc` 的正文更新是整篇替换，必须显式传入 `confirm_full_replace=true`。

### 小记管理（新增）

| 工具 | 说明 |
|------|------|
| `list_notes` | 列出所有小记（支持分页） |
| `get_note` | 获取单篇小记完整内容 |
| `create_note` | 创建小记（lake 格式） |
| `update_note` | 更新小记 |

### 公司空间

| 工具 | 说明 |
|------|------|
| `list_org_repos` | 列出公司空间的知识库 |
| `list_org_docs` | 列出公司空间知识库的文档 |
| `get_org_doc` | 获取公司空间文档内容 |
| `create_org_doc` | 在公司空间创建文档 |
| `update_org_doc` | 更新公司空间文档 |

## 安装

```bash
npm install -g github:bjx-C/yuque-cookie-mcp
```

## 首次登录

运行以下命令，会自动打开浏览器让你登录语雀：

```bash
cd ~/myCode/mcp/yuque-mcp
npm run login
```

登录成功后，Cookie 会自动保存到 `~/.yuque-mcp/cookies.json`，有效期约 2 周。

## 配置 Cursor

编辑 `~/.cursor/mcp.json`，添加：

```json
{
  "mcpServers": {
    "yuque": {
      "command": "node",
      "args": ["/Users/xiaocong/myCode/mcp/yuque-mcp/dist/index.js"]
    }
  }
}
```

**注意**：使用 Cookie 方式不需要配置环境变量。

## 认证方式

### 方式一：Cookie 自动登录（推荐，免费）

1. 运行 `npm run login`
2. 在打开的浏览器中登录语雀
3. 登录成功后自动保存 Cookie

Cookie 过期后，在对话中说"刷新语雀 Cookie"即可重新登录。

### 方式二：Token（需要超级会员）

如果你有语雀超级会员，可以使用 Token：

```json
{
  "mcpServers": {
    "yuque": {
      "command": "node",
      "args": ["/Users/xiaocong/myCode/mcp/yuque-mcp/dist/index.js"],
      "env": {
        "YUQUE_TOKEN": "你的语雀Token"
      }
    }
  }
}
```

## 使用示例

配置完成后，在 Cursor 中可以这样对话：

- "检查语雀认证状态"
- "帮我看看我有哪些知识库"
- **"帮我建一个叫 agent 的知识库"** ← 新增
- "列出 xxx 知识库的目录结构"
- "帮我在 xxx 知识库创建一篇文档，记录今天的会议纪要"
- "更新 xxx 文档，把刚才讨论的内容加进去"
- "搜索关于 xxx 的文档"
- **"查看 https://www.yuque.com/xxx/xxx/xxx 这个文档"** ← 直接通过链接获取
- "查看公司空间的知识库"
- "查看后端专区这个知识库的文档目录"
- **"帮我看看昨天写了哪些小记"** ← 新增
- **"创建一篇小记记录今天的想法"** ← 新增

## Cookie 说明

- Cookie 保存位置：`~/.yuque-mcp/cookies.json`
- 默认有效期：14 天
- 如果经常使用语雀网页版，Cookie 会自动续期
- 过期后说"刷新语雀 Cookie"即可重新登录

## 开发

```bash
# 克隆仓库
git clone https://github.com/bjx-C/yuque-cookie-mcp.git
cd yuque-cookie-mcp

# 手动登录获取 Cookie
node login.js

# 启动服务器
node index.js
```

## License

MIT — forked from [xiaocong/yuque-cookie-mcp](https://github.com/xiaocong/yuque-cookie-mcp)
