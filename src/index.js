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
    this.matcher = createMatcher(options.routes || [], this)    // 添加路由匹配
    
    let mode = options.mode || 'hash'       // 路由匹配方式，默认为hash
    this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false
    if (this.fallback) {                    // 如果不支持history则退化为hash
      mode = 'hash'
    }
    if (!inBrowser) {                       // 非浏览器环境强制abstract，比如node中
      mode = 'abstract'
    }
    this.mode = mode

    switch (mode) {
      case 'history':
        this.history = new HTML5History(this, options.base)
        break
      case 'hash':
        this.history = new HashHistory(this, options.base, this.fallback)
        break
      case 'abstract':
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
  
  get currentRoute(): ?Route {
    return this.history && this.history.current
  }
  
  init(app: any /* Vue根实例 */) {      // 在install时调用
    process.env.NODE_ENV !== 'production' && assert(
      install.installed,                // 如果已经install了则报错
      `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
      `before creating root instance.`
    )
    
    this.apps.push(app)
    
    // main app already initialized. app如果已经初始化，则返回
    if (this.app) {
      return
    }
    
    this.app = app                        // 实例
    
    const history = this.history
    
    if (history instanceof HTML5History) {
      history.transitionTo(history.getCurrentLocation())
    } else if (history instanceof HashHistory) {    //
      const setupHashListener = () => {
        history.setupListeners()
      }
      history.transitionTo(
        history.getCurrentLocation(),
        setupHashListener,
        setupHashListener
      )
    }
    
    history.listen(route => {
      this.apps.forEach((app) => {
        app._route = route
      })
    })
  }
  
  beforeEach(fn: Function): Function {
    return registerHook(this.beforeHooks, fn)
  }
  
  beforeResolve(fn: Function): Function {
    return registerHook(this.resolveHooks, fn)
  }
  
  afterEach(fn: Function): Function {
    return registerHook(this.afterHooks, fn)
  }
  
  onReady(cb: Function, errorCb?: Function) {
    this.history.onReady(cb, errorCb)
  }
  
  onError(errorCb: Function) {
    this.history.onError(errorCb)
  }
  
  push(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.history.push(location, onComplete, onAbort)
  }
  
  replace(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.history.replace(location, onComplete, onAbort)
  }
  
  go(n: number) {
    this.history.go(n)
  }
  
  back() {
    this.go(-1)
  }
  
  forward() {
    this.go(1)
  }
  
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
  
  resolve(
    to: RawLocation,
    current?: Route,
    append?: boolean
  ): {
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
    const route = this.match(location, current)
    const fullPath = route.redirectedFrom || route.fullPath
    const base = this.history.base
    const href = createHref(base, fullPath, this.mode)
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

function registerHook(list: Array<any>, fn: Function): Function {
  list.push(fn)
  return () => {
    const i = list.indexOf(fn)
    if (i > -1) list.splice(i, 1)
  }
}

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
