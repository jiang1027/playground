# README for NHK news scraper

第一个Playwright测试项目，用来抓取NHK news网页上的新闻。

## 使用

```
npm run nhk-news
```

结果会输出在console上。

## 几个注意点

1. 程序会打开一个新的chrome浏览器窗口，使用本地"chrome-user-data"目录作为用户数据目录。
2. 所有操作都是headed模式，用户可以直观得看到操作效果。
3. 目前只能抓取`article.module--detail--v3`内容的新闻，其他类型的新闻还没有处理。

