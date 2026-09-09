#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const yuque_client_js_1 = require("./yuque-client.js");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
let yuqueClient = null;
function getClient() {
    if (!yuqueClient) {
        yuqueClient = new yuque_client_js_1.YuqueClient();
    }
    return yuqueClient;
}
const tools = [
    {
        name: 'check_auth_status',
        description: '检查语雀认证状态（Cookie 是否有效、剩余有效期等）',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'refresh_cookie',
        description: '刷新语雀 Cookie（会打开浏览器让你重新登录）',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'get_user_info',
        description: '获取当前语雀用户信息',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'list_repos',
        description: '列出当前用户的所有知识库',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'get_repo',
        description: '获取知识库详情',
        inputSchema: {
            type: 'object',
            properties: {
                book_id: {
                    type: 'number',
                    description: '知识库 ID（可通过 list_repos 获取）'
                }
            },
            required: ['book_id']
        }
    },
    {
        name: 'get_repo_toc',
        description: '获取知识库的目录结构（文档树）',
        inputSchema: {
            type: 'object',
            properties: {
                book_id: {
                    type: 'number',
                    description: '知识库 ID'
                }
            },
            required: ['book_id']
        }
    },
    {
        name: 'list_docs',
        description: '列出知识库中的所有文档（不含内容）',
        inputSchema: {
            type: 'object',
            properties: {
                book_id: {
                    type: 'number',
                    description: '知识库 ID'
                }
            },
            required: ['book_id']
        }
    },
    {
        name: 'get_doc',
        description: '获取文档的完整内容',
        inputSchema: {
            type: 'object',
            properties: {
                book_id: {
                    type: 'number',
                    description: '知识库 ID'
                },
                slug: {
                    type: 'string',
                    description: '文档 slug（可通过 list_docs 或 get_repo_toc 获取）'
                }
            },
            required: ['book_id', 'slug']
        }
    },
    {
        name: 'create_doc',
        description: '在知识库中创建新文档',
        inputSchema: {
            type: 'object',
            properties: {
                book_id: {
                    type: 'number',
                    description: '知识库 ID'
                },
                title: {
                    type: 'string',
                    description: '文档标题'
                },
                body: {
                    type: 'string',
                    description: '文档内容（Markdown 格式）'
                },
                slug: {
                    type: 'string',
                    description: '文档 slug（可选，不填则自动生成）'
                }
            },
            required: ['book_id', 'title', 'body']
        }
    },
    {
        name: 'update_doc',
        description: '更新文档标题，或显式确认后整篇覆盖正文。含公式/卡片的文档优先使用 patch_doc_section_by_url',
        inputSchema: {
            type: 'object',
            properties: {
                book_id: {
                    type: 'number',
                    description: '知识库 ID'
                },
                doc_id: {
                    type: 'number',
                    description: '文档 ID（可通过 list_docs 或 get_doc 获取）'
                },
                title: {
                    type: 'string',
                    description: '新标题（可选）'
                },
                body: {
                    type: 'string',
                    description: '整篇新内容（可选，高风险）'
                },
                confirm_full_replace: {
                    type: 'boolean',
                    description: '正文整篇覆盖时必须为 true；仅更新标题时不需要'
                }
            },
            required: ['book_id', 'doc_id']
        }
    },
    {
        name: 'delete_doc',
        description: '删除文档（谨慎操作）',
        inputSchema: {
            type: 'object',
            properties: {
                book_id: {
                    type: 'number',
                    description: '知识库 ID'
                },
                doc_id: {
                    type: 'number',
                    description: '文档 ID'
                }
            },
            required: ['book_id', 'doc_id']
        }
    },
    {
        name: 'search_docs',
        description: '在语雀中搜索文档',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: '搜索关键词'
                }
            },
            required: ['query']
        }
    },
    // ========== 公司空间工具 ==========
    {
        name: 'list_org_repos',
        description: '列出公司空间（产品技术中心）的所有知识库',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'list_org_docs',
        description: '列出公司空间知识库中的所有文档',
        inputSchema: {
            type: 'object',
            properties: {
                book_id: {
                    type: 'number',
                    description: '知识库 ID（可通过 list_org_repos 获取）'
                }
            },
            required: ['book_id']
        }
    },
    {
        name: 'get_org_doc',
        description: '获取公司空间文档的完整内容',
        inputSchema: {
            type: 'object',
            properties: {
                book_id: {
                    type: 'number',
                    description: '知识库 ID'
                },
                slug: {
                    type: 'string',
                    description: '文档 slug'
                }
            },
            required: ['book_id', 'slug']
        }
    },
    {
        name: 'create_org_doc',
        description: '在公司空间知识库中创建新文档',
        inputSchema: {
            type: 'object',
            properties: {
                book_id: {
                    type: 'number',
                    description: '知识库 ID'
                },
                title: {
                    type: 'string',
                    description: '文档标题'
                },
                body: {
                    type: 'string',
                    description: '文档内容（Markdown 格式）'
                }
            },
            required: ['book_id', 'title', 'body']
        }
    },
    {
        name: 'update_org_doc',
        description: '更新公司空间的文档',
        inputSchema: {
            type: 'object',
            properties: {
                doc_id: {
                    type: 'number',
                    description: '文档 ID'
                },
                title: {
                    type: 'string',
                    description: '新标题（可选）'
                },
                body: {
                    type: 'string',
                    description: '新内容（可选）'
                }
            },
            required: ['doc_id']
        }
    },
    // ========== 知识库管理（创建/删除）==========
    {
        name: 'create_repo',
        description: '创建新知识库（通过 Cookie 模拟网页操作，非官方 API）',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: '知识库名称'
                },
                description: {
                    type: 'string',
                    description: '知识库描述（可选）'
                },
                public: {
                    type: 'integer',
                    description: '是否公开：0 私密，1 公开（默认 0）'
                },
                type: {
                    type: 'string',
                    description: '知识库类型：Book（默认）、Note、Design'
                }
            },
            required: ['name']
        }
    },
    {
        name: 'delete_repo',
        description: '删除知识库（谨慎操作）',
        inputSchema: {
            type: 'object',
            properties: {
                book_id: {
                    type: 'number',
                    description: '知识库 ID'
                }
            },
            required: ['book_id']
        }
    },
    // ========== 小记管理 ==========
    {
        name: 'list_notes',
        description: '列出所有小记（最新在前）',
        inputSchema: {
            type: 'object',
            properties: {
                limit: {
                    type: 'number',
                    description: '返回数量（默认 10）'
                },
                offset: {
                    type: 'number',
                    description: '偏移量（分页用）'
                }
            },
            required: []
        }
    },
    {
        name: 'get_note',
        description: '获取单篇小记的完整内容',
        inputSchema: {
            type: 'object',
            properties: {
                note_id: {
                    type: 'number',
                    description: '小记 ID（可通过 list_notes 获取）'
                }
            },
            required: ['note_id']
        }
    },
    {
        name: 'create_note',
        description: '创建一篇小记',
        inputSchema: {
            type: 'object',
            properties: {
                html: {
                    type: 'string',
                    description: 'HTML 内容（lake 格式）'
                },
                source: {
                    type: 'string',
                    description: '原始内容（lake source 格式）'
                },
                abstract: {
                    type: 'string',
                    description: '摘要文本（纯文本，用于列表预览）'
                }
            },
            required: ['html', 'source', 'abstract']
        }
    },
    {
        name: 'update_note',
        description: '更新一篇小记',
        inputSchema: {
            type: 'object',
            properties: {
                note_id: {
                    type: 'number',
                    description: '小记 ID'
                },
                html: {
                    type: 'string',
                    description: 'HTML 内容'
                },
                source: {
                    type: 'string',
                    description: '原始内容'
                },
                abstract: {
                    type: 'string',
                    description: '摘要文本'
                }
            },
            required: ['note_id', 'html', 'source', 'abstract']
        }
    },
    // ========== URL 直接访问 ==========
    {
        name: 'patch_doc_section_by_url',
        description: '按标题替换语雀 Lake 文档中的一个章节。正文使用 Markdown，块公式用 $$...$$，会转为原生 math 节点；章节外公式、图片和其他卡片原样保留，并执行写前并发检查和写后校验',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: '语雀个人空间文档链接'
                },
                heading: {
                    type: 'string',
                    description: '要替换正文的现有标题文本，不要包含 #'
                },
                heading_level: {
                    type: 'number',
                    minimum: 1,
                    maximum: 6,
                    description: '标题层级（可选；同名标题出现多次时必须指定）'
                },
                body_markdown: {
                    type: 'string',
                    description: '该标题下的新正文，不含目标标题本身。子标题层级必须更低；块公式使用 $$...$$'
                },
                dry_run: {
                    type: 'boolean',
                    description: '为 true 时仅转换和校验，不写入语雀'
                }
            },
            required: ['url', 'heading', 'body_markdown']
        }
    },
    {
        name: 'get_doc_by_url',
        description: '通过语雀文档链接获取公式感知的 Markdown 内容、标题结构和卡片统计。原生 math 节点会还原为 $$...$$',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: '语雀个人空间文档链接，如 https://www.yuque.com/user/book/doc'
                }
            },
            required: ['url']
        }
    }
];
// Personal-space hardened profile. Destructive and organization-specific tools
// stay unavailable unless this local installation is explicitly reviewed again.
const disabledToolNames = new Set([
    'delete_doc',
    'delete_repo',
    'list_org_repos',
    'list_org_docs',
    'get_org_doc',
    'create_org_doc',
    'update_org_doc',
]);
const server = new index_js_1.Server({
    name: 'yuque-mcp',
    version: '1.2.0',
}, {
    capabilities: {
        tools: {},
    },
    instructions: '读取语雀文档时保留公式语义。修改含公式或卡片的 Lake 文档时，优先使用 patch_doc_section_by_url；块公式必须写成 $$...$$。先 dry_run，再正式写入。不要用 update_doc 整篇覆盖此类文档，除非用户明确要求并设置 confirm_full_replace=true。',
});
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return { tools: tools.filter(tool => !disabledToolNames.has(tool.name)) };
});
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        if (disabledToolNames.has(name)) {
            throw new Error(`Tool disabled by local security policy: ${name}`);
        }
        let result;
        switch (name) {
            case 'check_auth_status': {
                try {
                    const client = getClient();
                    const status = client.getCookieStatus();
                    const authType = client.getAuthType();
                    result = {
                        authType,
                        ...status,
                        hint: status.valid
                            ? '认证正常，可以使用语雀功能'
                            : '请运行: cd ~/myCode/mcp/yuque-mcp && npm run login'
                    };
                }
                catch (error) {
                    result = {
                        valid: false,
                        message: error instanceof Error ? error.message : '未知错误',
                        hint: '请运行: cd ~/myCode/mcp/yuque-mcp && npm run login'
                    };
                }
                break;
            }
            case 'refresh_cookie': {
                const projectDir = path.resolve(__dirname, '..');
                const loginScript = path.join(projectDir, 'dist', 'login.js');
                const child = (0, child_process_1.spawn)('node', [loginScript], {
                    detached: true,
                    stdio: 'ignore'
                });
                child.unref();
                result = {
                    success: true,
                    message: '已打开浏览器窗口，请在浏览器中完成语雀登录。\n登录成功后 Cookie 会自动保存。',
                    hint: '如果浏览器没有打开，请手动运行: cd ~/myCode/mcp/yuque-mcp && npm run login'
                };
                yuqueClient = null;
                break;
            }
            case 'get_user_info': {
                result = await getClient().getUserInfo();
                break;
            }
            case 'list_repos': {
                const repos = await getClient().listRepos();
                result = repos.map(repo => ({
                    id: repo.id,
                    slug: repo.slug,
                    name: repo.name,
                    description: repo.description,
                    items_count: repo.items_count,
                    updated_at: repo.updated_at
                }));
                break;
            }
            case 'get_repo': {
                const { book_id } = args;
                result = await getClient().getRepo(book_id);
                break;
            }
            case 'get_repo_toc': {
                const { book_id } = args;
                const toc = await getClient().getRepoToc(book_id);
                const formatTocTree = (items) => {
                    return items.map(item => {
                        const indent = '  '.repeat(item.level || 0);
                        const hasChildren = item.child_uuid;
                        const icon = hasChildren ? '📁' : '📄';
                        const hidden = item.visible === 0 ? ' (隐藏)' : '';
                        const slug = item.slug || item.url || '';
                        return `${indent}${icon} ${item.title}${hidden}\n${indent}   slug: ${slug}`;
                    }).join('\n');
                };
                result = {
                    total: toc.length,
                    toc: toc.map(item => ({
                        title: item.title,
                        slug: item.slug || item.url,
                        level: item.level || 0,
                        type: item.type,
                        doc_id: item.doc_id,
                        has_children: !!item.child_uuid
                    })),
                    formatted: formatTocTree(toc)
                };
                break;
            }
            case 'list_docs': {
                const { book_id } = args;
                const docs = await getClient().listDocs(book_id);
                result = docs.map(doc => ({
                    id: doc.id,
                    slug: doc.slug,
                    title: doc.title,
                    description: doc.description,
                    word_count: doc.word_count,
                    updated_at: doc.updated_at
                }));
                break;
            }
            case 'get_doc': {
                const { book_id, slug } = args;
                result = await getClient().getDoc(book_id, slug);
                break;
            }
            case 'create_doc': {
                const { book_id, title, body, slug } = args;
                result = await getClient().createDoc(book_id, title, body, 'markdown', slug);
                break;
            }
            case 'update_doc': {
                const { book_id, doc_id, title, body, confirm_full_replace } = args;
                if (body !== undefined && confirm_full_replace !== true) {
                    throw new Error('整篇覆盖正文需要 confirm_full_replace=true；含公式/卡片的文档请改用 patch_doc_section_by_url');
                }
                result = await getClient().updateDoc(book_id, doc_id, { title, body });
                break;
            }
            case 'delete_doc': {
                const { book_id, doc_id } = args;
                await getClient().deleteDoc(book_id, doc_id);
                result = { success: true, message: `文档 ${doc_id} 已删除` };
                break;
            }
            case 'search_docs': {
                const { query } = args;
                result = await getClient().searchDocs(query);
                break;
            }
            // ========== 公司空间工具 ==========
            case 'list_org_repos': {
                const repos = await getClient().listOrgRepos();
                result = repos.map(repo => ({
                    id: repo.id,
                    slug: repo.slug,
                    name: repo.name,
                    description: repo.description,
                    items_count: repo.items_count,
                    group: repo.user?.name || '未知',
                    updated_at: repo.updated_at
                }));
                break;
            }
            case 'list_org_docs': {
                const { book_id } = args;
                const docs = await getClient().listOrgDocs(book_id);
                result = docs.map(doc => ({
                    id: doc.id,
                    slug: doc.slug,
                    title: doc.title,
                    description: doc.description,
                    word_count: doc.word_count,
                    updated_at: doc.updated_at
                }));
                break;
            }
            case 'get_org_doc': {
                const { book_id, slug } = args;
                result = await getClient().getOrgDoc(book_id, slug);
                break;
            }
            case 'create_org_doc': {
                const { book_id, title, body } = args;
                result = await getClient().createOrgDoc(book_id, title, body);
                break;
            }
            case 'update_org_doc': {
                const { doc_id, title, body } = args;
                result = await getClient().updateOrgDoc(doc_id, { title, body });
                break;
            }
            // ========== 知识库管理（创建/删除）==========
            case 'create_repo': {
                const { name: repoName, description, public: isPublic, type: repoType } = args;
                result = await getClient().createRepo(repoName, description, isPublic, repoType);
                break;
            }
            case 'delete_repo': {
                const { book_id } = args;
                await getClient().deleteRepo(book_id);
                result = { success: true, message: `知识库 ${book_id} 已删除` };
                break;
            }
            // ========== 小记管理 ==========
            case 'list_notes': {
                const { limit, offset } = args;
                result = await getClient().listNotes(limit, offset);
                break;
            }
            case 'get_note': {
                const { note_id } = args;
                result = await getClient().getNote(note_id);
                break;
            }
            case 'create_note': {
                const { html, source, abstract } = args;
                result = await getClient().createNote(html, source, abstract);
                break;
            }
            case 'update_note': {
                const { note_id, html, source, abstract } = args;
                result = await getClient().updateNote(note_id, html, source, abstract);
                break;
            }
            // ========== URL 直接访问 ==========
            case 'patch_doc_section_by_url': {
                const { url, heading, heading_level, body_markdown, dry_run } = args;
                result = await getClient().patchDocSectionByUrl(url, heading, body_markdown, heading_level, dry_run === true);
                break;
            }
            case 'get_doc_by_url': {
                const { url } = args;
                const data = await getClient().getDocByUrl(url);
                result = {
                    title: data.doc.title,
                    book_name: data.book.name,
                    book_id: data.book.id,
                    doc_id: data.doc.id,
                    slug: data.doc.slug,
                    word_count: data.doc.word_count,
                    updated_at: data.doc.updated_at,
                    body: data.doc.body,
                    headings: data.doc.headings,
                    card_stats: data.doc.card_stats,
                    url: data.url
                };
                break;
            }
            default:
                throw new Error(`未知工具: ${name}`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `错误: ${message}`
                }
            ],
            isError: true
        };
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('语雀 MCP 服务器已启动');
}
main().catch((error) => {
    console.error('启动失败:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
