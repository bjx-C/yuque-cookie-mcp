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
exports.YuqueClient = void 0;
const axios_1 = __importStar(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const lake_utils_1 = require("./lake-utils.js");
const YUQUE_BASE_URL = 'https://www.yuque.com';
const ORG_BASE_URL = process.env.YUQUE_ORG_BASE_URL || '';
const CONFIG_DIR = path.join(process.env.HOME || '', '.yuque-mcp');
const COOKIE_FILE = path.join(CONFIG_DIR, 'cookies.json');
class YuqueClient {
    client;
    authType;
    userLogin = '';
    ctoken = '';
    constructor(tokenOrCookie) {
        const token = tokenOrCookie || process.env.YUQUE_TOKEN;
        const { cookie, ctoken } = this.loadCookie();
        if (token) {
            this.authType = 'token';
            this.client = axios_1.default.create({
                baseURL: `${YUQUE_BASE_URL}/api/v2`,
                headers: {
                    'X-Auth-Token': token,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Yuque-MCP/1.0'
                }
            });
        }
        else if (cookie) {
            this.authType = 'cookie';
            this.ctoken = ctoken;
            this.client = axios_1.default.create({
                baseURL: YUQUE_BASE_URL,
                headers: {
                    'Cookie': cookie,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': 'https://www.yuque.com/',
                    'x-csrf-token': ctoken
                }
            });
        }
        else {
            throw new Error('未配置语雀认证信息。\n\n' +
                '请运行登录命令: cd ~/myCode/mcp/yuque-mcp && npm run login');
        }
    }
    loadCookie() {
        try {
            if (!fs.existsSync(COOKIE_FILE)) {
                return { cookie: null, ctoken: '' };
            }
            const data = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));
            fs.chmodSync(COOKIE_FILE, 0o600);
            if (new Date(data.expiresAt) < new Date()) {
                console.error('Cookie 已过期，请重新登录');
                return { cookie: null, ctoken: '' };
            }
            const cookie = data.cookies.map(c => `${c.name}=${c.value}`).join('; ');
            const ctokenCookie = data.cookies.find(c => c.name === 'yuque_ctoken');
            const ctoken = ctokenCookie?.value || '';
            return { cookie, ctoken };
        }
        catch {
            return { cookie: null, ctoken: '' };
        }
    }
    getAuthType() {
        return this.authType;
    }
    getCookieStatus() {
        try {
            if (!fs.existsSync(COOKIE_FILE)) {
                return { valid: false, message: '未找到 Cookie 文件，请运行: npm run login' };
            }
            const data = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));
            const expiresAt = new Date(data.expiresAt);
            const now = new Date();
            if (expiresAt < now) {
                return { valid: false, expiresAt: data.expiresAt, message: 'Cookie 已过期，请重新登录' };
            }
            const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            return {
                valid: true,
                expiresAt: data.expiresAt,
                message: `Cookie 有效，剩余 ${daysLeft} 天`
            };
        }
        catch {
            return { valid: false, message: '读取 Cookie 文件失败' };
        }
    }
    handleError(error) {
        if (error instanceof axios_1.AxiosError) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            if (status === 401) {
                throw new Error('Cookie 已失效，请重新登录：\n' +
                    'cd ~/myCode/mcp/yuque-mcp && npm run login');
            }
            else if (status === 404) {
                throw new Error(`资源不存在: ${message}`);
            }
            else if (status === 403) {
                throw new Error(`权限不足: ${message}`);
            }
            throw new Error(`语雀 API 错误 (${status}): ${message}`);
        }
        throw error;
    }
    async getUserInfo() {
        try {
            if (this.authType === 'token') {
                const response = await this.client.get('/user');
                return response.data.data;
            }
            else {
                const response = await this.client.get('/api/mine');
                const data = response.data.data;
                this.userLogin = data.login;
                return {
                    id: data.id,
                    login: data.login,
                    name: data.name,
                    avatar_url: data.avatar_url,
                    description: data.description || '',
                    books_count: data.books_count
                };
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async listRepos() {
        try {
            if (this.authType === 'token') {
                const user = await this.getUserInfo();
                const response = await this.client.get(`/users/${user.login}/repos`);
                return response.data.data;
            }
            else {
                const response = await this.client.get('/api/mine/book_stacks');
                const stacks = response.data.data;
                const books = [];
                for (const stack of stacks) {
                    for (const book of stack.books || []) {
                        books.push({
                            id: book.id,
                            slug: book.slug,
                            name: book.name,
                            description: book.description || '',
                            items_count: book.items_count,
                            public: book.public,
                            user: {
                                id: book.user.id,
                                login: book.user.login,
                                name: book.user.name
                            },
                            created_at: book.created_at,
                            updated_at: book.updated_at
                        });
                    }
                }
                return books;
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getRepo(bookId) {
        try {
            if (this.authType === 'token') {
                const response = await this.client.get(`/repos/${bookId}`);
                return response.data.data;
            }
            else {
                const response = await this.client.get(`/api/books/${bookId}`);
                const book = response.data.data;
                return {
                    id: book.id,
                    slug: book.slug,
                    name: book.name,
                    description: book.description || '',
                    items_count: book.items_count,
                    public: book.public,
                    user: {
                        id: book.user.id,
                        login: book.user.login,
                        name: book.user.name
                    },
                    created_at: book.created_at,
                    updated_at: book.updated_at
                };
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getRepoToc(bookId) {
        try {
            if (this.authType === 'token') {
                const response = await this.client.get(`/repos/${bookId}/toc`);
                return response.data.data;
            }
            else {
                const response = await this.client.get(`/api/books/${bookId}/toc`);
                const tocData = response.data.data;
                // 内部 API 返回格式是 { toc: [...] }
                return tocData.toc || tocData || [];
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async listDocs(bookId) {
        try {
            if (this.authType === 'token') {
                const response = await this.client.get(`/repos/${bookId}/docs`);
                return response.data.data;
            }
            else {
                const response = await this.client.get(`/api/books/${bookId}/docs`);
                const docs = response.data.data || [];
                return docs.map((doc) => ({
                    id: doc.id,
                    slug: doc.slug,
                    title: doc.title,
                    description: doc.description || '',
                    format: doc.format,
                    public: doc.public,
                    status: doc.status,
                    word_count: doc.word_count,
                    created_at: doc.created_at,
                    updated_at: doc.updated_at
                }));
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getDoc(bookId, slug) {
        try {
            if (this.authType === 'token') {
                const response = await this.client.get(`/repos/${bookId}/docs/${slug}?raw=1`);
                return response.data.data;
            }
            else {
                // 内部 API 需要先获取用户 login
                if (!this.userLogin) {
                    await this.getUserInfo();
                }
                const response = await this.client.get(`/api/docs/${slug}`, {
                    params: { book_id: bookId }
                });
                const doc = response.data.data;
                return {
                    id: doc.id,
                    slug: doc.slug,
                    title: doc.title,
                    description: doc.description || '',
                    format: doc.format,
                    public: doc.public,
                    status: doc.status,
                    word_count: doc.word_count,
                    created_at: doc.created_at,
                    updated_at: doc.updated_at,
                    body: doc.body,
                    body_html: doc.body_html
                };
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async createDoc(bookId, title, body, format = 'markdown', slug) {
        try {
            if (this.authType === 'token') {
                const data = { title, body, format };
                if (slug)
                    data.slug = slug;
                const response = await this.client.post(`/repos/${bookId}/docs`, data);
                return response.data.data;
            }
            else {
                const data = {
                    title,
                    body,
                    format,
                    type: 'Doc',
                    book_id: bookId,
                    insert_to_catalog: true
                };
                if (slug)
                    data.slug = slug;
                const response = await this.client.post('/api/docs', data);
                const doc = response.data.data;
                return {
                    id: doc.id,
                    slug: doc.slug,
                    title: doc.title,
                    description: doc.description || '',
                    format: doc.format,
                    public: doc.public,
                    status: doc.status,
                    word_count: doc.word_count || 0,
                    created_at: doc.created_at,
                    updated_at: doc.updated_at
                };
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async updateDoc(bookId, docId, options) {
        try {
            const data = {};
            if (options.title)
                data.title = options.title;
            if (options.body) {
                data.body = options.body;
                data.format = 'markdown';
                data._lake_is_asl = false;
            }
            if (this.authType === 'token') {
                const response = await this.client.put(`/repos/${bookId}/docs/${docId}`, data);
                return response.data.data;
            }
            else {
                const response = await this.client.put(`/api/docs/${docId}`, data);
                const doc = response.data.data;
                return {
                    id: doc.id,
                    slug: doc.slug,
                    title: doc.title,
                    description: doc.description || '',
                    format: doc.format,
                    public: doc.public,
                    status: doc.status,
                    word_count: doc.word_count || 0,
                    created_at: doc.created_at,
                    updated_at: doc.updated_at
                };
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async deleteDoc(bookId, docId) {
        try {
            if (this.authType === 'token') {
                await this.client.delete(`/repos/${bookId}/docs/${docId}`);
            }
            else {
                await this.client.delete(`/api/docs/${docId}`);
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // ========== 知识库管理 ==========
    async createRepo(name, description, isPublic, repoType) {
        try {
            if (this.authType === 'token') {
                const data = { name, description: description || '', public: isPublic ? 1 : 0, type: repoType || 'Book' };
                const response = await this.client.post('/user/repos', data);
                return response.data.data;
            }
            else {
                const data = { name, description: description || '', public: isPublic ? 1 : 0, type: repoType || 'Book' };
                const response = await this.client.post('/api/books', data);
                const book = response.data.data;
                return {
                    id: book.id,
                    slug: book.slug,
                    name: book.name,
                    description: book.description || '',
                    items_count: book.items_count,
                    public: book.public,
                    user: book.user ? {
                        id: book.user.id,
                        login: book.user.login,
                        name: book.user.name
                    } : null,
                    created_at: book.created_at,
                    updated_at: book.updated_at
                };
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async deleteRepo(bookId) {
        try {
            if (this.authType === 'token') {
                await this.client.delete(`/repos/${bookId}`);
            }
            else {
                await this.client.delete(`/api/books/${bookId}`);
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // ========== 小记管理 ==========
    async listNotes(limit, offset) {
        try {
            const params = {};
            if (limit) params.limit = limit;
            if (offset) params.offset = offset;
            const response = await this.client.get('/api/modules/note/notes/NoteController/index', { params });
            const data = response.data;
            const notes = (data.notes || []).map(note => ({
                id: note.id,
                slug: note.slug,
                abstract: note.content?.abstract || '',
                word_count: note.word_count,
                has_image: note.has_image,
                has_attachment: note.has_attachment,
                has_bookmark: note.has_bookmark,
                tags: note.tags || [],
                published_at: note.published_at,
                created_at: note.created_at,
                updated_at: note.updated_at,
                save_from: note.save_from || ''
            }));
            return {
                notes,
                pin_notes: (data.pin_notes || []).map(n => n.id),
                has_more: data.has_more || false
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getNote(noteId) {
        try {
            const response = await this.client.get('/api/modules/note/notes/NoteController/show', {
                params: { id: noteId }
            });
            const note = response.data;
            return {
                id: note.id,
                slug: note.slug,
                abstract: note.content?.abstract || '',
                source: note.content?.source || '',
                html: note.content?.html || '',
                format: note.content?.format || 'lake',
                word_count: note.word_count,
                has_image: note.has_image,
                has_attachment: note.has_attachment,
                has_bookmark: note.has_bookmark,
                tags: note.tags || [],
                published_at: note.published_at,
                created_at: note.created_at,
                updated_at: note.updated_at,
                save_from: note.save_from || ''
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async createNote(html, source, abstract) {
        try {
            const data = { html, source, abstract };
            const response = await this.client.post('/api/modules/note/notes/NoteController/create', data);
            const note = response.data;
            return {
                id: note.id,
                slug: note.slug,
                abstract: note.content?.abstract || '',
                word_count: note.word_count,
                has_image: note.has_image,
                tags: note.tags || [],
                published_at: note.published_at,
                created_at: note.created_at,
                updated_at: note.updated_at
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async updateNote(noteId, html, source, abstract) {
        try {
            const data = { html, source, abstract };
            const response = await this.client.put('/api/modules/note/notes/NoteController/update', data, {
                params: { id: noteId }
            });
            const result = response.data;
            const note = result.data || result;
            return {
                id: note.id,
                slug: note.slug,
                abstract: note.content?.abstract || '',
                word_count: note.word_count,
                has_image: note.has_image,
                tags: note.tags || [],
                published_at: note.published_at,
                created_at: note.created_at,
                updated_at: note.updated_at
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async searchDocs(query) {
        try {
            if (this.authType === 'token') {
                const response = await this.client.get('/search', { params: { q: query, type: 'doc' } });
                return response.data.data;
            }
            else {
                const response = await this.client.get('/api/zsearch', {
                    params: { q: query, type: 'content', scope: 'own', p: 1 }
                });
                const hits = response.data.data?.hits || [];
                return hits.map((hit) => {
                    const record = hit.record || {};
                    const book = record.book || {};
                    const highlight = hit.highlight || {};
                    return {
                        id: record.id,
                        title: record.title,
                        slug: record.slug,
                        book_id: book.id,
                        book_name: book.name,
                        summary: highlight.abstract?.[0] || record.description || ''
                    };
                });
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // ========== 公司空间 API ==========
    async listOrgRepos() {
        try {
            const { cookie } = this.loadCookie();
            if (!cookie) {
                throw new Error('请先登录');
            }
            const response = await axios_1.default.get(`${ORG_BASE_URL}/api/books?limit=100&offset=0`, {
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': `${ORG_BASE_URL}/`
                }
            });
            const books = response.data.data || [];
            return books.map((book) => {
                const user = book.user || {};
                return {
                    id: book.id,
                    slug: book.slug,
                    name: book.name,
                    description: book.description || '',
                    items_count: book.items_count,
                    public: book.public,
                    user: {
                        id: user.id,
                        login: user.login,
                        name: user.name
                    },
                    created_at: book.created_at,
                    updated_at: book.updated_at
                };
            });
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getOrgDoc(bookId, slug) {
        try {
            const { cookie } = this.loadCookie();
            if (!cookie) {
                throw new Error('请先登录');
            }
            const response = await axios_1.default.get(`${ORG_BASE_URL}/api/docs/${slug}`, {
                params: { book_id: bookId },
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': `${ORG_BASE_URL}/`
                }
            });
            const doc = response.data.data;
            return {
                id: doc.id,
                slug: doc.slug,
                title: doc.title,
                description: doc.description || '',
                format: doc.format,
                public: doc.public,
                status: doc.status,
                word_count: doc.word_count,
                created_at: doc.created_at,
                updated_at: doc.updated_at,
                body: doc.body,
                body_html: doc.body_html
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async listOrgDocs(bookId) {
        try {
            const { cookie } = this.loadCookie();
            if (!cookie) {
                throw new Error('请先登录');
            }
            const response = await axios_1.default.get(`${ORG_BASE_URL}/api/books/${bookId}/docs`, {
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': `${ORG_BASE_URL}/`
                }
            });
            const docs = response.data.data || [];
            return docs.map((doc) => ({
                id: doc.id,
                slug: doc.slug,
                title: doc.title,
                description: doc.description || '',
                format: doc.format,
                public: doc.public,
                status: doc.status,
                word_count: doc.word_count,
                created_at: doc.created_at,
                updated_at: doc.updated_at
            }));
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async createOrgDoc(bookId, title, body, format = 'markdown') {
        try {
            const { cookie, ctoken } = this.loadCookie();
            if (!cookie) {
                throw new Error('请先登录');
            }
            const response = await axios_1.default.post(`${ORG_BASE_URL}/api/books/${bookId}/docs`, { title, body, format, type: 'Doc' }, {
                headers: {
                    'Cookie': cookie,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': `${ORG_BASE_URL}/`,
                    'x-csrf-token': ctoken
                }
            });
            const doc = response.data.data;
            return {
                id: doc.id,
                slug: doc.slug,
                title: doc.title,
                description: doc.description || '',
                format: doc.format,
                public: doc.public,
                status: doc.status,
                word_count: doc.word_count || 0,
                created_at: doc.created_at,
                updated_at: doc.updated_at
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async updateOrgDoc(docId, options) {
        try {
            const { cookie, ctoken } = this.loadCookie();
            if (!cookie) {
                throw new Error('请先登录');
            }
            const data = {};
            if (options.title)
                data.title = options.title;
            if (options.body) {
                data.body = options.body;
                data.format = 'markdown';
                data._lake_is_asl = false;
            }
            const response = await axios_1.default.put(`${ORG_BASE_URL}/api/docs/${docId}`, data, {
                headers: {
                    'Cookie': cookie,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': `${ORG_BASE_URL}/`,
                    'x-csrf-token': ctoken
                }
            });
            const doc = response.data.data;
            return {
                id: doc.id,
                slug: doc.slug,
                title: doc.title,
                description: doc.description || '',
                format: doc.format,
                public: doc.public,
                status: doc.status,
                word_count: doc.word_count || 0,
                created_at: doc.created_at,
                updated_at: doc.updated_at
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // ========== URL 解析获取文档 ==========
    extractTextFromLake(lakeContent) {
        return (0, lake_utils_1.lakeToMarkdown)(lakeContent);
    }
    async convertMarkdownToLake(markdown) {
        if (this.authType !== 'cookie') {
            throw new Error('公式安全转换目前仅支持 Cookie 认证');
        }
        const response = await this.client.post('/api/docs/convert', {
            from: 'markdown',
            to: 'lake',
            content: markdown
        });
        const lakeContent = response.data?.data?.content || response.data?.content || '';
        if (!lakeContent.startsWith('<!doctype lake>')) {
            throw new Error('语雀 Markdown→Lake 转换未返回有效 Lake 文档');
        }
        const expectedFormulaBlocks = (0, lake_utils_1.countMarkdownFormulaBlocks)(markdown);
        const stats = (0, lake_utils_1.getCardStats)(lakeContent);
        if (stats.native_math < expectedFormulaBlocks) {
            throw new Error(`公式转换不完整：输入 ${expectedFormulaBlocks} 个公式块，仅生成 ${stats.native_math} 个 math 节点`);
        }
        return lakeContent;
    }
    async updateDocLake(docId, lakeContent, draftVersion = 0) {
        if (this.authType !== 'cookie') {
            throw new Error('Lake 原文更新目前仅支持 Cookie 认证');
        }
        if (!lakeContent.startsWith('<!doctype lake>')) {
            throw new Error('拒绝写入：内容不是有效的 Lake 文档');
        }
        // Match the payload used by Yuque's current Lake editor. Lake XML is
        // submitted through body_asl; sending it through body/body_draft_asl
        // causes Yuque to accept the request but save an empty document.
        const data = {
            id: docId,
            format: 'lake',
            body_asl: lakeContent,
            draft_version: draftVersion || 0,
            sync_dynamic_data: false,
            save_type: 'user',
            edit_type: 'lake'
        };
        if (!draftVersion) {
            data._without_draft_version = 1;
        }
        const response = await this.client.put(`/api/docs/${docId}`, data);
        return response.data.data;
    }
    async patchDocSectionByUrl(url, heading, bodyMarkdown, headingLevel, dryRun = false) {
        const initial = await this.getDocByUrl(url);
        const initialLake = initial.doc.body_html;
        if (!initialLake.startsWith('<!doctype lake>')) {
            throw new Error('目标文档不是 Lake 格式，已拒绝局部更新');
        }
        const converted = await this.convertMarkdownToLake(bodyMarkdown);
        const patch = (0, lake_utils_1.patchLakeSection)(initialLake, heading, converted, headingLevel);
        const convertedStats = (0, lake_utils_1.getCardStats)(patch.fragment);
        const beforeStats = (0, lake_utils_1.getCardStats)(initialLake);
        if (dryRun) {
            return {
                success: true,
                dry_run: true,
                doc_id: initial.doc.id,
                book_id: initial.book.id,
                heading: patch.location.heading.text,
                heading_level: patch.location.heading.level,
                replacement_bytes: patch.fragment.length,
                formulas_to_write: convertedStats.native_math,
                protected_cards: patch.protectedCardFingerprints.length,
                before_card_stats: beforeStats
            };
        }
        // Optimistic concurrency: do not overwrite edits made after the first read.
        const latest = await this.getDocByUrl(url);
        if ((0, lake_utils_1.canonicalizeLake)(latest.doc.body_html) !==
            (0, lake_utils_1.canonicalizeLake)(initialLake)) {
            throw new Error('文档在准备更新期间发生了变化，已中止写入；请重新读取后重试');
        }
        await this.updateDocLake(initial.doc.id, patch.updated, latest.doc.draft_version);
        const verified = await this.getDocByUrl(url);
        const verifiedLake = verified.doc.body_html;
        const verifiedLocation = (0, lake_utils_1.locateSection)(verifiedLake, heading, headingLevel);
        const protectedLake = verifiedLake.slice(0, verifiedLocation.contentStart) +
            verifiedLake.slice(verifiedLocation.contentEnd);
        const protectedAfter = (0, lake_utils_1.cardFingerprints)(protectedLake);
        if (JSON.stringify(protectedAfter) !== JSON.stringify(patch.protectedCardFingerprints)) {
            throw new Error('写后校验失败：目标章节之外的卡片节点发生变化，请立即检查语雀历史版本');
        }
        const sectionLake = verifiedLake.slice(verifiedLocation.contentStart, verifiedLocation.contentEnd);
        const sectionStats = (0, lake_utils_1.getCardStats)(sectionLake);
        if (sectionStats.native_math < convertedStats.native_math) {
            throw new Error(`写后校验失败：应有 ${convertedStats.native_math} 个公式节点，实际为 ${sectionStats.native_math}`);
        }
        return {
            success: true,
            dry_run: false,
            doc_id: verified.doc.id,
            book_id: verified.book.id,
            heading: verifiedLocation.heading.text,
            heading_level: verifiedLocation.heading.level,
            formulas_written: convertedStats.native_math,
            formulas_verified: sectionStats.native_math,
            protected_cards_verified: protectedAfter.length,
            before_card_stats: beforeStats,
            after_card_stats: (0, lake_utils_1.getCardStats)(verifiedLake),
            updated_at: verified.doc.updated_at,
            url
        };
    }
    parseYuqueUrl(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            if (urlObj.protocol !== 'https:') {
                return null;
            }
            const allowedHosts = new Set(['www.yuque.com']);
            if (ORG_BASE_URL) {
                const orgUrl = new URL(ORG_BASE_URL);
                if (orgUrl.protocol !== 'https:' || !orgUrl.hostname.endsWith('.yuque.com')) {
                    return null;
                }
                allowedHosts.add(orgUrl.hostname);
            }
            if (!allowedHosts.has(hostname)) {
                return null;
            }
            // 路径格式: /{group_or_user}/{book_slug}/{doc_slug}
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            if (pathParts.length < 3) {
                return null;
            }
            const isOrg = hostname !== 'www.yuque.com' && hostname.endsWith('.yuque.com');
            const namespace = `${pathParts[0]}/${pathParts[1]}`;
            const docSlug = pathParts[2];
            return {
                domain: `https://${hostname}`,
                isOrg,
                namespace,
                docSlug
            };
        }
        catch {
            return null;
        }
    }
    async getDocByUrl(url) {
        const parsed = this.parseYuqueUrl(url);
        if (!parsed) {
            throw new Error(`无效的语雀链接: ${url}\n支持的格式: https://www.yuque.com/{user}/{book}/{doc} 或 https://{org}.yuque.com/{group}/{book}/{doc}`);
        }
        const { domain, namespace, docSlug } = parsed;
        const { cookie, ctoken } = this.loadCookie();
        if (!cookie) {
            throw new Error('请先登录: cd ~/myCode/mcp/yuque-mcp && npm run login');
        }
        try {
            // 访问页面获取 appData（包含 book_id 和 doc_id）
            const pageResponse = await axios_1.default.get(`${domain}/${namespace}/${docSlug}`, {
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'text/html'
                }
            });
            // 从页面中解析 appData
            const html = pageResponse.data;
            const match = html.match(/decodeURIComponent\("([^"]+)"\)/);
            if (!match) {
                throw new Error('无法解析页面数据');
            }
            const decoded = decodeURIComponent(match[1]);
            const appData = JSON.parse(decoded);
            const bookInfo = appData.book || {};
            const docInfo = appData.doc || {};
            // 使用 API 获取文档完整内容
            const docResponse = await axios_1.default.get(`${domain}/api/docs/${docInfo.slug}`, {
                params: { book_id: bookInfo.id },
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0',
                    'x-csrf-token': ctoken
                }
            });
            const doc = docResponse.data.data;
            // 从 lake 格式提取纯文本内容
            const lakeContent = doc.content || '';
            const plainText = this.extractTextFromLake(lakeContent);
            return {
                doc: {
                    id: doc.id,
                    slug: doc.slug,
                    title: doc.title,
                    description: doc.description || '',
                    format: doc.format,
                    public: doc.public,
                    status: doc.status,
                    draft_version: doc.draft_version || 0,
                    content_updated_at: doc.content_updated_at,
                    word_count: doc.word_count,
                    created_at: doc.created_at,
                    updated_at: doc.updated_at,
                    body: plainText,
                    body_html: lakeContent,
                    card_stats: (0, lake_utils_1.getCardStats)(lakeContent),
                    headings: (0, lake_utils_1.listHeadings)(lakeContent).map(heading => ({
                        level: heading.level,
                        text: heading.text
                    }))
                },
                book: {
                    id: bookInfo.id,
                    name: bookInfo.name,
                    slug: bookInfo.slug
                },
                url
            };
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                if (error.response?.status === 401) {
                    throw new Error('Cookie 已失效，请重新登录: cd ~/myCode/mcp/yuque-mcp && npm run login');
                }
                else if (error.response?.status === 404) {
                    throw new Error(`文档不存在或无权访问: ${url}`);
                }
            }
            this.handleError(error);
        }
    }
}
exports.YuqueClient = YuqueClient;
//# sourceMappingURL=yuque-client.js.map
