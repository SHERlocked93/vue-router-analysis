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
│   ├── history				// 路由类实现
│   ├── util				// 相关工具库
│   ├── create-matcher.js	// 根据传入的配置对象创建路由映射表
│   ├── create-route-map.js	// 根据routes配置对象创建路由映射表 
│   ├── index.js			// 主入口
│   └── install.js			// VueRouter装载入口
├── test					// 测试文件
└── types					// TypeScript 声明
```

## 2. 入口文件

### 2.1 rollup 出口与入口

按照惯例，首先从 `package.json` 看起，这里有两个命令值得我们关注一下：

```json
{
    "scripts": {
    	"dev:dist": "rollup -wm -c build/rollup.dev.config.js",
    	"build": "node build/build.js"
  }
}
```

`dev:dist` 是用配置文件 `rollup.dev.config.js` 生成 `dist` 目录下相关生成文件的，这里是一些简单的配置，生成的文件是方便开发调试；

`build` 是用 `node` 来运行 `build/build.js` 生成正式的文件，包括 `es6`、`commonjs`、`IIFE` 方式的导出文件和压缩之后的导出文件；

这两种方式都是使用 `build/configs.js` 这个配置文件来生成的，其中有一段语义化比较不错的代码挺有意思，跟 Vue 的配置生成文件比较类似：

```javascript
module.exports = [{ 					// 打包出口
    file: resolve('dist/vue-router.js'),
    format: 'umd',
    env: 'development'
  },{
    file: resolve('dist/vue-router.min.js'),
    format: 'umd',
    env: 'production'
  },{
    file: resolve('dist/vue-router.common.js'),
    format: 'cjs'
  },{
    file: resolve('dist/vue-router.esm.js'),
    format: 'es'
  }
].map(genConfig)

function genConfig (opts) {
  const config = {
    input: {
      input: resolve('src/index.js'), 	// 打包入口
      plugins: [...]
    },
    output: {
      file: opts.file,
      format: opts.format,
      banner,
      name: 'VueRouter'
    }
  }
  return config
}
```

可以清晰的看到 `rollup` 打包的出口和入口，入口是 `src/index.js` 文件，而出口就是上面那部分的配置，`env` 是开发/生产环境标记，`format` 为编译输出的方式：

- **es：**ES Modules，使用ES6的模板语法输出
- **cjs：**CommonJs Module，遵循CommonJs Module规范的文件输出
- **umd：**支持外链规范的文件输出，此文件可以直接使用script标签，其实也就是 IIFE 的方式

那么正式输出是使用 `build` 方式，我们可以从 `src/index.js` 看起

```javascript
// src/index.js

import { install } from './install'

export default class VueRouter { ... }

VueRouter.install = install
```

首先这个文件导出了一个类 `VueRouter`，这个就是我们在 Vue 项目中引入 vue-router 的时候 `Vue.use(VueRouter)` 所用到的，而 `Vue.use` 的主要作用就是找注册插件上的 `install` 方法并执行，往下看最后一行，从一个 `install.js` 文件中导出的 install 被赋给了 `VueRouter.install`，这就是 `Vue.use` 中执行所用到的 `install` 方法。

### 2.2 Vue.use

可以简单看一下 Vue 中 `Vue.use` 这个方法是如何实现的：

```javascript
// vue/src/core/global-api/use.js

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // ... 省略一些判重操作
    const args = toArray(arguments, 1)
    args.unshift(this)			// 注意这个this，是vue对象
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}
```

上面可以看到 `Vue.use` 这个方法就是执行待注册插件上的 `install` 方法，并将这个插件实例保存起来。值得注意的是 `install` 方法执行时的第一个参数是通过 `unshift` 推入的 `this`，因此 `install` 执行时可以拿到 Vue 对象。

## 3. 路由注册

### 3.1 install

接之前，看一下 `install.js` 里面是如何进行路由插件的注册

```javascript
// src/install.js

/* vue-router 的注册过程 Vue.use(VueRouter) */
export function install(Vue) {
  _Vue = Vue	// 这样拿到 Vue 不会因为 import 带来的打包体积增加
  
  const isDef = v => v !== undefined
  
  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode // 至少存在一个 VueComponent 时, _parentVnode 属性才存在
    // registerRouteInstance 在 src/components/view.js
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }
  
  // new Vue 时或者创建新组件时，在 beforeCreate 钩子中调用
  Vue.mixin({
    beforeCreate() {
      if (isDef(this.$options.router)) {  // 组件是否存在$options.router，该对象只在根组件上有
        this._routerRoot = this           // 这里的this是根vue实例
        this._router = this.$options.router
        this._router.init(this)
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {                            // 组件实例才会进入，通过$parent一级级获取_routerRoot
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      registerInstance(this, this)
    },
    destroyed() {
      registerInstance(this)
    }
  })
  
  // 所有实例中 this.$router 等同于访问 this._routerRoot._router
  Object.defineProperty(Vue.prototype, '$router', {
    get() { return this._routerRoot._router }
  })
  
  // 所有实例中 this.$route 等同于访问 this._routerRoot._route
  Object.defineProperty(Vue.prototype, '$route', {
    get() { return this._routerRoot._route }
  })
  
  Vue.component('RouterView', View)     // 注册公共组件 router-view
  Vue.component('RouterLink', Link)     // 注册公共组件 router-link
  
  const strats = Vue.config.optionMergeStrategies
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
```

`install` 方法主要分为几个部分：

1. 通过 `Vue.mixin` 在 `beforeCreate`、 `destroyed` 的时候将一些路由方法挂载到每个 vue 实例中
2. 给每个 vue 实例中挂载路由对象以保证在 `methods` 等地方可以通过 `this.$router`、`this.$route` 访问到相关信息
3. 注册公共组件 `router-view`、`router-link`
4. 注册路由的声明周期函数

`Vue.mixin` 将定义的两个钩子在组件 `extend` 的时候合并到该组件的 `options` 中，从而注册到每个组件实例。看看 `beforeCreate`，这里一顿眼花缭乱的操作，是为了实现在每个 Vue 组件实例中都可以荣国 `_routerRoot` 根 Vue 实例，其上的 `_route`、`_router` 赋到 Vue 的原型上，这样每个 Vue 的实例中都可以通过 `this.$route`、`this.$router` 访问到挂载在根实例 `_routerRoot` 上的 `_route`、`_router`，并用了 Vue 上的响应式化方法 `defineReactive` 来将 `_route` 响应式化，另外在根组件上用 `this._router.init()` 进行了初始化操作。

随便找个 Vue 组件，打印一下其上的 `_routerRoot`：

![](https://i.loli.net/2019/02/21/5c6e1f71ccb33.png)

可以看到这是 Vue 的根组件。

### 3.2 VueRouter
















我们看看主要操作方法 `pushState` 与 `replaceState` 是如何被封装的：  

```javascript
// vue-router/src/util/push-state.js

/* 当前页面的 key 值 */
let _key: string = genKey()

/* 根据时间戳生成的唯一 key 值 */
function genKey(): string {
  return Time.now().toFixed(3)
}

export function pushState(url?: string, replace?: boolean) {
  saveScrollPosition()
  const history = window.history
  try {
    if (replace) {
      history.replaceState({ key: _key }, '', url)
    } else {
      _key = genKey()
      history.pushState({ key: _key }, '', url)
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url)
  }
}

export function replaceState(url?: string) {
  pushState(url, true)
}
```

首先将当前页面的滚动位置记录下来，以便在下次跳转回来的时候直接滚动到指定位置，如果配置了 vue-router 的[滚动行为](https://router.vuejs.org/zh/guide/advanced/scroll-behavior.html#%E6%BB%9A%E5%8A%A8%E8%A1%8C%E4%B8%BA)的话，然后分别调用 `window.history` 上的 `replaceState` 与 `pushState` 来完成路由记录的操作，并且这里做了个 `try...catch` 的操作，如果刚刚的方法抛错，则使用 `window.location` 上的方法 `replace` 与 `assign` 来进行操作，它的弊端在于会直接刷新页面，比较暴力。

那么 `window.location` 上的方法 `replace` 和 `assign` 有什么区别呢：

- `replace` 方法：通过加载指定链接文档替换当前文档，不能通过浏览器后退到原文档；
- `assign` 方法：加载指定链接的文档，相当于链接跳转，还可以通过浏览器后退回到原文档；

 



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