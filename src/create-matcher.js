/* @flow */

import type VueRouter from './index'
import { resolvePath } from './util/path'
import { assert, warn } from './util/warn'
import { createRoute } from './util/route'
import { fillParams } from './util/params'
import { createRouteMap } from './create-route-map'
import { normalizeLocation } from './util/location'

export type Matcher = {
    match: (raw: RawLocation, current?: Route, redirectedFrom?: Location) => Route;
    addRoutes: (routes: Array<RouteConfig>) => void;
};

/**
 * 根据传入的配置对象 创建路由映射表
 * @param routes 传入的配置数组
 * @param router VueRouter实例
 * @returns {{match: match, addRoutes: addRoutes}}
 */
export function createMatcher(
  routes: Array<RouteConfig>,
  router: VueRouter
): Matcher {
    const { pathList, pathMap, nameMap } = createRouteMap(routes)   // 根据传入的配置对象创建路由map
    
    /**
     * 动态添加路由
     * @param routes 路由配置，
     */
    function addRoutes(routes) {
        createRouteMap(routes, pathList, pathMap, nameMap)
    }
    
    /**
     * 添加路由匹配（ ./history/base.js 文件 transitionTo 方法调用）
     * @param raw
     * @param currentRoute
     * @param redirectedFrom
     */
    function match(
      raw: RawLocation,
      currentRoute?: Route,
      redirectedFrom?: Location
    ): Route {
        const location = normalizeLocation(raw, currentRoute, false, router)
        const { name } = location
        
        if (name) {
            const record = nameMap[name]
            if (process.env.NODE_ENV !== 'production') {
                warn(record, `Route with name '${ name }' does not exist`)
            }
            if (!record) return _createRoute(null, location)
            const paramNames = record.regex.keys
              .filter(key => !key.optional)
              .map(key => key.name)
            
            if (typeof location.params !== 'object') {
                location.params = {}
            }
            
            if (currentRoute && typeof currentRoute.params === 'object') {
                for (const key in currentRoute.params) {
                    if (!(key in location.params) && paramNames.indexOf(key) > -1) {
                        location.params[key] = currentRoute.params[key]
                    }
                }
            }
            
            if (record) {
                location.path = fillParams(record.path, location.params, `named route "${ name }"`)
                return _createRoute(record, location, redirectedFrom)
            }
        } else if (location.path) {
            location.params = {}
            for (let i = 0; i < pathList.length; i++) {
                const path = pathList[i]
                const record = pathMap[path]
                if (matchRoute(record.regex, location.path, location.params)) {
                    return _createRoute(record, location, redirectedFrom)
                }
            }
        }
        // no match
        return _createRoute(null, location)
    }
    
    /**
     * 路由映射表存在 redirect：重定向
     */
    function redirect(
      record: RouteRecord,      // 路由映射表
      location: Location
    ): Route {
        const originalRedirect = record.redirect      // 路由映射表中最初的 redirect 重定向地址
        // 如果 originalRedirect 为 function 则创建路由对象
        let redirect = typeof originalRedirect === 'function'
          ? originalRedirect(createRoute(record, location, null, router))
          : originalRedirect
        
        if (typeof redirect === 'string') {
            redirect = { path: redirect }
        }
        
        if (!redirect || typeof redirect !== 'object') {
            if (process.env.NODE_ENV !== 'production') {
                warn(
                  false, `invalid redirect option: ${ JSON.stringify(redirect) }`
                )
            }
            return _createRoute(null, location)
        }
        
        const re: Object = redirect
        const { name, path } = re
        let { query, hash, params } = location
        query = re.hasOwnProperty('query') ? re.query : query
        hash = re.hasOwnProperty('hash') ? re.hash : hash
        params = re.hasOwnProperty('params') ? re.params : params
        
        if (name) {         // 路由 url.parse 对象中含有 name
            // resolved named direct
            const targetRecord = nameMap[name]
            if (process.env.NODE_ENV !== 'production') {
                assert(targetRecord, `redirect failed: named route "${ name }" not found.`)
            }
            return match({
                _normalized: true,
                name,
                query,
                hash,
                params
            }, undefined, location)
        } else if (path) {  // 路由 url.parse 对象中不含有 name，但是 path 存在
            // 1. resolve relative redirect
            const rawPath = resolveRecordPath(path, record)
            // 2. resolve params
            const resolvedPath = fillParams(rawPath, params, `redirect route with path "${ rawPath }"`)
            // 3. rematch with existing query and hash
            return match({
                _normalized: true,
                path: resolvedPath,
                query,
                hash
            }, undefined, location)
        } else {
            if (process.env.NODE_ENV !== 'production') {
                warn(false, `invalid redirect option: ${ JSON.stringify(redirect) }`)
            }
            return _createRoute(null, location)
        }
    }
    
    /**
     * 路由映射表存在 matchAs：动态路由
     */
    function alias(
      record: RouteRecord,
      location: Location,
      matchAs: string
    ): Route {
        const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${ matchAs }"`)
        const aliasedMatch = match({
            _normalized: true,
            path: aliasedPath
        })
        if (aliasedMatch) {
            const matched = aliasedMatch.matched
            const aliasedRecord = matched[matched.length - 1]
            location.params = aliasedMatch.params
            return _createRoute(aliasedRecord, location)
        }
        return _createRoute(null, location)
    }
    
    /**
     * 创建路由
     * @param record 路由映射表
     * @param location
     * @param redirectedFrom
     * @returns {*}
     */
    function _createRoute(
      record: ?RouteRecord,
      location: Location,
      redirectedFrom?: Location
    ): Route {
        if (record && record.redirect) {        // 存在重定向 redirect
            return redirect(record, redirectedFrom || location)
        }
        if (record && record.matchAs) {         // 存在 matchAs 动态路由
            return alias(record, location, record.matchAs)
        }
        return createRoute(record, location, redirectedFrom, router)
    }
    
    return {
        match,
        addRoutes
    }
}

/**
 * 是否与指定的路由匹配
 * @param regex
 * @param path
 * @param params
 * @returns {boolean} 是否匹配
 */
function matchRoute(
  regex: RouteRegExp,
  path: string,
  params: Object
): boolean {
    const m = path.match(regex)
    
    if (!m) {
        return false
    } else if (!params) {
        return true
    }
    
    for (let i = 1, len = m.length; i < len; ++i) {
        const key = regex.keys[i - 1]
        const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
        if (key) {
            // Fix #1994: using * with props: true generates a param named 0
            params[key.name || 'pathMatch'] = val
        }
    }
    
    return true
}

/**
 * 处理当前 redirect 的 path 相对 路由映射表 record 的路径
 * @param path
 * @param record
 * @returns {string}
 */
function resolveRecordPath(path: string, record: RouteRecord): string {
    return resolvePath(path, record.parent ? record.parent.path : '/', true)
}
