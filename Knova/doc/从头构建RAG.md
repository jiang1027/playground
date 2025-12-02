# 从头构建RAG，实现自定义检索器和生成器

## 目标

本文档旨在指导用户从头构建一个RAG（Retrieval-Augmented Generation）系统，涵盖自定义检索器和生成器的实现步骤。通过本指南，用户将能够理解RAG的基本概念，并能够搭建一个功能完善的RAG系统。

## 环境简介

1. 懒猫微服，用来运行n8n和qdrant
2. 懒猫算力仓，或者自己的Ollama服务器，运行qwen-vl模型

## 步骤概述

1. 使用[pdf2img](https://github.com/shawkui/pdf2img)将PDF转换为图片，注意使用jpg格式，在n8n工作流中对这个格式有依赖。生成的图片存放在`pages`目录下。100 DPI足够，还能节省算力。
2. 在qdrant中创建一个新的collection, 用于存储向量数据和元数据。
3. 图书内容上传
   

### 图书内容上传 (Book uploading工作流)

工作流要点描述：

1. 使用Webhook节点接收上传请求。
2. "Configuration"节点设置了qdrant中collection的URL地址。
3. 启动该工作流后，使用"npm run upload"命令上传图书内容。该脚本会遍历`pages`目录下的所有图片文件，并将它们逐一发送到Webhook节点。

### 图书内容向量化 (Book vectorization工作流)

工作流要点描述：

1. 使用Qwen-VL模型对上传的图片进行向量化处理。
2. 将生成的向量存储到qdrant的collection中。
3. 使用"Configurations"节点设置了处理过程中的各种参数，包括模型URL、qdrant，提示词等。

产生的结果以一个JSON格式存储在qdrant中，包含以下字段：
```JSON
{
    "bookTitle": "书名，如果能够识别到的话",
    "bookText": "页面中的文字内容，如果有的话",
    "imageDescription": "页面中图像内容的描述，如果有的话"
}
```

### 图书内容检索与生成 (Book chat工作流)

工作流要点描述：

1. 使用Webhook节点接收用户的查询请求。
2. Configurations节点设置了模型和qdrant的URL地址。
3. 对用户提问进行向量化后，查询qdrant中的相关内容。
4. 将检索到的内容与用户问题一起发送给Qwen-VL模型，生成回答。
5. 在console上显示回答结果。

使用方法：

1. 启动该工作流后，使用"npm run chat"命令启动交互式聊天客户端。
2. 在命令行中输入问题，按回车发送请求。或者输入"exit"或"quit"退出程序。
3. 查看模型生成的回答。


## Q&A

### 为什么使用视觉模型而不是更简单的其他文本模型？

因为我懒。PDF中内容提取和数据清洗工作流巨大，也不是我能搞定的。而且视觉模型的效果也不错，并且可以直接处理书中的图片内容。

### 为什么不使用现成的RAG知识库？

如果你提出这个问题，那你可以不用看下去了，这纯粹是我个人的兴趣。




