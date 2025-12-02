# Knova - 基于RAG的图书问答系统

一个从头构建的RAG（Retrieval-Augmented Generation）系统，用于实现图书内容的上传、向量化和智能问答。

## 项目简介

Knova 是一个完整的图书知识库解决方案，通过将PDF图书转换为图片，使用视觉模型（Qwen-VL）进行内容理解和向量化，存储到Qdrant向量数据库，最终实现基于RAG的智能问答功能。

## 功能特性

- 📚 **图书内容上传**：将PDF转换后的图片页面上传到n8n工作流
- 🔍 **图书内容向量化**：使用Qwen-VL视觉模型对图片进行理解和向量化处理
- 💬 **智能问答**：基于向量检索的RAG问答系统，支持命令行交互

## 技术架构

- **后端框架**：Express.js
- **向量数据库**：Qdrant
- **工作流引擎**：n8n
- **视觉模型**：Qwen-VL
- **图床服务**：本地Express静态文件服务

## 项目结构

```
Knova/
├── server.js          # 图床服务，提供简单的图片静态访问
├── book_upload.js     # 图书上传脚本
├── book_chat.js       # 交互式问答客户端
├── package.json       # 项目依赖配置
├── pages/             # 图书页面图片目录
├── doc/               # 文档目录
│   └── 从头构建RAG.md  # 详细构建指南
├── n8n/               # n8n工作流配置
│   ├── Book uploading.json      # 图书上传工作流
│   ├── Book vectorization.json  # 图书向量化工作流
│   └── Chat with book.json      # 图书问答工作流
└── test/              # 测试相关文件
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动图床服务

```bash
npm start
```

服务启动后会在 `http://localhost:3000` 提供图片访问服务。

### 上传图书内容

1. 将PDF转换为图片（推荐使用 [pdf2img](https://github.com/shawkui/pdf2img)，100 DPI，JPG格式）
2. 将图片放入 `pages/` 目录
3. 确保n8n的Book uploading工作流已启动
4. 运行上传脚本：

```bash
npm run upload
```

测试模式（仅上传1页）：

```bash
npm run upload test
```

### 向量化图书内容

在n8n中启动Book vectorization工作流，系统会自动处理上传的图片并将向量存储到Qdrant。该过程耗时较长，请耐心等待。

### 与图书对话

确保n8n的Chat with book工作流已启动，然后运行：

```bash
npm run chat
```

在命令行中输入问题进行交互，输入 `exit` 或 `quit` 退出。

## n8n工作流说明

### Book uploading（图书上传）
- 接收上传请求并将图片URL和元数据传递给向量化工作流

### Book vectorization（图书向量化）
- 使用Qwen-VL模型分析图片内容
- 提取文本和图像描述
- 生成向量并存储到Qdrant

### Chat with book（图书问答）
- 接收用户问题
- 向量化查询并检索相关内容
- 结合检索结果生成回答

## 配置说明

在 `book_upload.js` 中可配置：
- `imageBaseURL`：图床服务的基础URL
- `BOOK_NAME`：图书名称
- `BOOK_NAMESPACE`：用于生成稳定bookId的UUID命名空间

## 更多信息

详细的RAG构建指南请参阅 [从头构建RAG.md](./doc/从头构建RAG.md)

## 许可证

随便用。

