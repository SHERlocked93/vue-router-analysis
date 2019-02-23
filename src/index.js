/* @flow */

import { install } from './install'
import { START } from './util/route'
import { assert } from './util/warn'
import { inBrowser } from './util/dom'
import { cleanPath } from './util/path'
import { createMatcher } from './create-matcher'
import { normalizeLocation } from './util/location'
import { supportsPushState } from './util/push-state'

import { HashHistory } from './history/hash'
import { HTML5History } from './history/html5'
import { AbstractHistory } from './history/abstract'

import type { Matcher } from './create-matcher'

export default class VueRouter {
  static install: () => void
  static version: string
  
  app: any
  apps: Array<any>
  ready: boolean
  readyCbs: Array<Function>
  options: RouterOptions
  mode: string
  history: HashHistory | HTML5History | AbstractHistory
  matcher: Matcher
  fallback: boolean
  beforeHooks: Array<?NavigationGuard>
  resolveHooks: Array<?NavigationGuard>
  afterHooks: Array<?AfterNavigationHook>
  
  constructor(options: RouterOptions = {}) {
    this.app = null
    this.apps = []
    this.options = options
    this.beforeHooks = []
    this.resolveHooks = []
    this.afterHooks = []
    this.matcher = createMatcher(options.routes || [], this)    // 添加路由匹配器
    
    let mode = options.mode || 'hash'       // 路由匹配方式，默认为hash
    this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false
    if (this.fallback) {                    // 如果不支持history则退化为hash
      mode = 'hash'
    }
    if (!inBrowser) {                       // 非浏览器环境强制abstract，比如node中
      mode = 'abstract'
    }
    this.mode = mode
    
    switch (mode) {         // 外观模式
      case 'history':       // history 方式
        this.history = new HTML5History(this, options.base)
        break
      case 'hash':          // hash 方式
        this.history = new HashHistory(this, options.base, this.fallback)
        break
      case 'abstract':      // abstract 方式
        this.history = new AbstractHistory(this, options.base)
        break
      default:
        if (process.env.NODE_ENV !== 'production') {
          assert(false, `invalid mode: ${ mode }`)
        }
    }
  }
  
  /**
   * createMatcher 方法返回的 match 方法
   * @param raw
   * @param current
   * @param redirectedFrom
   */
  match(
    raw: RawLocation,
    current?: Route,
    redirectedFrom?: Location
  ): Route {
    return this.matcher.match(raw, current, redirectedFrom)
  }
  
  /**
   * 当前路由对象
   * @returns {HashHistory|HTML5History|AbstractHistory}
   */
  get currentRoute(): ?Route {
    return this.history && this.history.current
  }
  
  /**
   * install 方法会调用此 init 初始化方法
   * @param app
   */
  init(app: any /* Vue组件实例 */) {      // 在install时调用
    process.env.NODE_ENV !== 'production' && assert(
      install.installed,                // 如果已经install了则报错
      `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
      `before creating root instance.`
    )
    
    this.apps.push(app)
    
    // app如果已经初始化，则返回
    if (this.app) {
      return
    }
    
    this.app = app                        // 实例
    
    const history = this.history
    
    if (history instanceof HTML5History) {
      history.transitionTo(history.getCurrentLocation())
    } else if (history instanceof HashHistory) {
      const setupHashListener = () => {
        history.setupListeners()           // 设置 popstate、hashchange 事件监听
      }
      history.transitionTo(
        history.getCurrentLocation(),      // 浏览器 window 地址的 hash 值
        setupHashListener,                 // 成功回调
        setupHashListener                  // 失败回调
      )
    }
    
    history.listen(route => {
      this.apps.forEach((app) => {
        app._route = route
      })
    })
  }
  
  /**
   * 注册 beforeHooks 事件
   * @param fn
   * @returns {Function}
   */
  beforeEach(fn: Function): Function {
    return registerHook(this.beforeHooks, fn)
  }
  
  /**
   * 注册 resolveHooks 事件
   * @param fn
   * @returns {Function}
   */
  beforeResolve(fn: Function): Function {
    return registerHook(this.resolveHooks, fn)
  }
  
  /**
   * 注册 afterHooks 事件
   * @param fn
   * @returns {Function}
   */
  afterEach(fn: Function): Function {
    return registerHook(this.afterHooks, fn)
  }
  
  /**
   * onReady 事件
   * @param cb
   * @param errorCb
   */
  onReady(cb: Function, errorCb?: Function) {
    this.history.onReady(cb, errorCb)
  }
  
  /**
   * onError 事件
   * @param errorCb
   */
  onError(errorCb: Function) {
    this.history.onError(errorCb)
  }
  
  /**
   * 调用 transitionTo 跳转路由
   * @param location
   * @param onComplete
   * @param onAbort
   */
  push(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.history.push(location, onComplete, onAbort)
  }
  
  /**
   * 调用 transitionTo 跳转路由
   * @param location
   * @param onComplete
   * @param onAbort
   */
  replace(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.history.replace(location, onComplete, onAbort)
  }
  
  /**
   * 跳转到指定历史记录
   * @param n 跳几个
   */
  go(n: number) {
    this.history.go(n)
  }
  
  /**
   * 后退
   */
  back() {
    this.go(-1)
  }
  
  /**
   * 前进
   */
  forward() {
    this.go(1)
  }
  
  /**
   * 获取路由匹配的组件
   * @param to
   * @returns {*}
   */
  getMatchedComponents(to?: RawLocation | Route): Array<any> {
    const route: any = to
      ? to.matched
        ? to
        : this.resolve(to).route
      : this.currentRoute
    if (!route) {
      return []
    }
    return [].concat.apply([], route.matched.map(m => {
      return Object.keys(m.components).map(key => {
        return m.components[key]
      })
    }))
  }
  
  /**
   * 根据路由对象返回浏览器路径等信息
   * @param to 要跳转的路由
   * @param current 当前路由
   * @param append
   * @returns {{route: Route, location: {path, query, _normalized, hash}, href: *, normalizedTo: {path, query, _normalized, hash}, resolved: Route}}
   */
  resolve(to: RawLocation, current?: Route, append?: boolean): {
    location: Location,
    route: Route,
    href: string,
    // for backwards compat
    normalizedTo: Location,
    resolved: Route
  } {
    const location = normalizeLocation(
      to,
      current || this.history.current,
      append,
      this
    )
    const route = this.match(location, current)     // 获取 location 匹配的路由对象
    const fullPath = route.redirectedFrom || route.fullPath  // 匹配路由的fullpath
    const base = this.history.base                           // base
    const href = createHref(base, fullPath, this.mode)       // 创建页面的href链接
    return {
      location,
      route,
      href,
      // for backwards compat
      normalizedTo: location,
      resolved: route
    }
  }
  
  /**
   * 动态添加路由
   * @param routes 路由配置
   */
  addRoutes(routes: Array<RouteConfig>) {
    this.matcher.addRoutes(routes)
    if (this.history.current !== START) {
      this.history.transitionTo(this.history.getCurrentLocation())
    }
  }
}

/**
 * 注册指定钩子函数
 * @param list
 * @param fn
 * @returns {Function}
 */
function registerHook(list: Array<any>, fn: Function): Function {
  list.push(fn)
  return () => {
    const i = list.indexOf(fn)
    if (i > -1) list.splice(i, 1)
  }
}

/**
 * 创建页面 href 链接
 * @param base
 * @param fullPath
 * @param mode
 * @returns {string}
 */
function createHref(base: string, fullPath: string, mode) {
  // noinspection ES6ConvertVarToLetConst
  var path = mode === 'hash' ? '#' + fullPath : fullPath
  return base ? cleanPath(base + '/' + path) : path
}

VueRouter.install = install
VueRouter.version = '__VERSION__'

if (inBrowser && window.Vue) {
  window.Vue.use(VueRouter)
}
