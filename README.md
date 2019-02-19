# vue-router-analysis
[TOC]

前端路由是我们前端开发日常开发中经常碰到的概念，作为自己思考的输出，本人水平有限，欢迎留言讨论~

目标 vue-rouer 版本：`3.0.2`

vue-router源码注释：[vue\-router\-analysis](https://github.com/SHERlocked93/vue-router-analysis)

声明：文章中源码的语法都使用 Flow，并且源码根据需要都有删节(为了不被迷糊 @_@)，如果要看完整版的请进入上面的 [github地址](https://github.com/SHERlocked93/vue-router-analysis) ~

## 0. 前备知识

- Flow
- ES6语法
- 设计模式 - 外观模式
- HTML5 History Api

如果你还没有了解的话，可以看一下文章末尾的推介阅读。

## 1. 文件结构

首先我们来看看文件结构：

```bash
.
├── build					// 打包相关配置
├── scripts					// 构建相关
├── dist					// 构建后文件目录
├── docs					// 项目文档
├── docs-gitbook			// gitbook配置
├── examples				// 示例代码，调试的时候使用
├── flow					// Flow 声明
├── src						// 源码目录
│   ├── components
│   ├── history
│   ├── util
│   ├── create-matcher.js
│   ├── create-route-map.js
│   ├── index.js			// 主入口
│   └── install.js			// VueRouter装载入口
├── test					// 测试文件
├── types					// TypeScript 声明
├── README.md
└── package.json
```



按照惯例，首先从 `package.json` 看起，这里有两个命令值得我们关注一下

```json
{
    "scripts": {
    	"dev:dist": "rollup -wm -c build/rollup.dev.config.js",
    	"build": "node build/build.js"
  }
}
```

`dev:dist` 命令是使用 `rollup` 用后面的配置文件 `rollup.dev.config.js` 生成 `dist` 目录的；

`build` 命令是用 `node` 来运行 `build/build.js`，用来生成



---



网上的帖子大多深浅不一，甚至有些前后矛盾，在下的文章都是学习过程中的总结，如果发现错误，欢迎留言指出~

>推介阅读：
>
>1. [H5 History Api - MDN](https://developer.mozilla.org/zh-CN/docs/Mozilla/Add-ons/WebExtensions/API/history)
>2. [ECMAScript 6 入门 \- 阮一峰](http://es6.ruanyifeng.com/)
>3. [JS 静态类型检查工具 Flow \- SegmentFault 思否](https://segmentfault.com/a/1190000014367450)
>4. [JS 外观模式 \- SegmentFault 思否](https://segmentfault.com/a/1190000012431621)
>
>参考：
>
>1. 