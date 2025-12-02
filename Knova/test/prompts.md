```markdown
这是一本图书的内页。请注意，本页的起始内容可能不是一个完整的句子。你的核心任务是：**完整提取图片中的文字**，不依赖于前一页的上下文。

1. **文字内容提取**: 提取图片中所有的中文文本，不做任何修改和删减。将结果作为`bookText`字段的值。如果图片中没有文字内容，请将此字段留空。

2. **图片内容描述**: 详细描述图片中除文本外的所有图形元素（如图表、插图等）的功能和内容。将结果作为 `imageDescription` 字段的值。如果图片没有图形，请将此字段留空。

3. **图书名称识别：** 如果图片是图书封面，请提取其完整名称。如果不是封面，请将此字段留空。将结果作为 `bookTitle` 字段的值。

4. 最终输出必须是以下严格的 **JSON** 格式：

{
  "bookTitle": "(此处填写图书名称，如果没有内容，则留空)",
  "bookText": "(此处填写提取的中文文本内容，如果没有内容，则留空)",
  "imageDescription": "(此处填写图片描述，如果没有内容，则留空)"
}
```

```JSON
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "http://example.com/schemas/book-page-analysis.json",
  "title": "Book Page Analysis Result",
  "description": "JSON schema for analyzing a single page of a book, extracting text, image description, and book title.",
  "type": "object",
  
  "properties": {
    "bookTitle": {
      "type": "string",
      "description": "完整提取的图书封面名称。如果图片不是封面，则留空。",
      "default": ""
    },
    "bookText": {
      "type": "string",
      "description": "完整提取的图片中的所有中文文本内容，不做任何修改和删减。如果图片中没有文本，则留空。",
      "default": ""
    },
    "imageDescription": {
      "type": "string",
      "description": "对图片中除文本外的所有图形元素（如图表、插图等）的功能和内容的详细描述。如果图片没有图形元素，则留空。",
      "default": ""
    }
  },
  
  "required": [
    "bookTitle",
    "bookText",
    "imageDescription"
  ],
  
  "additionalProperties": false
}
```


"model": $('Configurations').item.json.modelName,
"max_tokens": 16384,
"messages": [ 
  { 
    "role": "user", 
    "content": [
      { "type": "image_url", "image_url": { "url": $json.llmInput.image  } },
      { "type": "text", "text":  $json.llmInput.prompt }
    ],
  },  

```JSON
{ 
    "response_format": {
        "type": "json_schema",
        "json_schema": {
        "name": "book_page_analysis", 
        "strict": true,
        "schema": {
            "type": "object",
            "properties": {
            "bookTitle": {
                "type": "string",
                "description": "完整提取的图书封面名称。如果留空则为 ''。"
            },
            "bookText": {
                "type": "string",
                "description": "完整提取的图片中的所有中文文本内容。如果留空则为 ''。"
            },
            "imageDescription": {
                "type": "string",
                "description": "对图片中除文本外的所有图形元素的功能和内容的详细描述。如果留空则为 ''。"
            }
            },
            "required": [
            "bookTitle",
            "bookText",
            "imageDescription"
            ]
        }
        }
    }
}
```
