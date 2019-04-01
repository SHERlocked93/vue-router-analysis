/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

/**
 * 根据 routes 配置对象创建路由表
 * @param routes 配置对象
 * @param oldPathList 存储所有路由配置的 path
 * @param oldPathMap path <=> 路由记录 映射表
 * @param oldNameMap name <=> 路由记录 映射表
 */
export function createRouteMap(
    routes: Array<RouteConfig>,
    oldPathList?: Array<string>,
    oldPathMap?: Dictionary<RouteRecord>,
    oldNameMap?: Dictionary<RouteRecord>
): {
    pathList: Array<string>;
    pathMap: Dictionary<RouteRecord>;
    nameMap: Dictionary<RouteRecord>;
} {
    // the path list is used to control path matching priority  创建映射表
    const pathList: Array<string> = oldPathList || []
    const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
    const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)
    
    // 遍历配置对象的 routes 配置，为每个路由配置添加路由记录
    routes.forEach(route => {
        addRouteRecord(pathList, pathMap, nameMap, route)
    })
    
    // 确保通配符在 pathList 数组中最后一项
    for (let i = 0, l = pathList.length; i < l; i++) {
        if (pathList[i] === '*') {
            pathList.push(pathList.splice(i, 1)[0])
            l--
            i--
        }
    }
    
    return {
        pathList,
        pathMap,
        nameMap
    }
}

/**
 * 遍历配置对象的 routes 配置，为每个路由配置添加路由记录
 * @param pathList 已解析的path的列表
 * @param pathMap 用 path 作为key保存路由记录项
 * @param nameMap 用 name 作为key保存路由记录项
 * @param route 单个路由配置项
 * @param parent 父级路由配置
 * @param matchAs 路由配置的 children 项的某一项路由配置的 path（层级子级）：初始不传
 */
function addRouteRecord(
    pathList: Array<string>,
    pathMap: Dictionary<RouteRecord>,
    nameMap: Dictionary<RouteRecord>,
    route: RouteConfig,
    parent?: RouteRecord,
    matchAs?: string
) {
    const { path, name } = route
    if (process.env.NODE_ENV !== 'production') {            // path 不能为空，component 不能为字符串
        assert(path != null, `"path" is required in a route configuration.`)
        assert(
            typeof route.component !== 'string',
            `route config "component" for path: ${ String(path || name) } cannot be a ` +
            `string id. Use an actual component instead.`
        )
    }
    
    // path-to-regexp 配置项
    const pathToRegexpOptions: PathToRegexpOptions = route.pathToRegexpOptions || {}
    const normalizedPath = normalizePath(     // 规范化路由配置的 path 项
        path,
        parent,
        pathToRegexpOptions.strict              // path-to-regexp 配置项
    )
    
    if (typeof route.caseSensitive === 'boolean') {   // 是否区分大小写
        pathToRegexpOptions.sensitive = route.caseSensitive
    }
    
    const record: RouteRecord = {             // 创建路由记录对象
        path: normalizedPath,
        regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),  // 对path解析（存在动态路由）
        components: route.components || { default: route.component },   // 路由解析的component项
        instances: {},
        name,                             // name项
        parent,                           // 路径规范化的时候用到
        matchAs,                          // alias 项，方便路由匹配
        redirect: route.redirect,         // redirect 项
        beforeEnter: route.beforeEnter,   // beforeEnter 项
        meta: route.meta || {},           // meta 项
        props: route.props == null        // props 项
            ? {}
            : route.components
                ? route.props
                : { default: route.props }
    }
    
    // 如果路由配置含有 children 配置项，则循环添加路由记录
    if (route.children) {
        // Warn if route is named, does not redirect and has a default child route.
        // If users navigate to this route by name, the default child will
        // not be rendered (GH Issue #629)
        if (process.env.NODE_ENV !== 'production') {
            // 如果路由配置存在 name，不存在 redirect，child.path 为 '/' 或者 ''
            if (route.name && !route.redirect && route.children.some(child => /^\/?$/.test(child.path))) {
                warn(
                    false,
                    `Named Route '${ route.name }' has a default child route. ` +
                    `When navigating to this named route (:to="{name: '${ route.name }'"), ` +
                    `the default child route will not be rendered. Remove the name from ` +
                    `this route and use the name of the default child route for named ` +
                    `links instead.`
                )
            }
        }
        route.children.forEach(child => {         // 遍历children，同样添加路由记录
            const childMatchAs = matchAs
                ? cleanPath(`${ matchAs }/${ child.path }`)
                : undefined
            addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
        })
    }
    
    // 路由配置中有alias的情况
    if (route.alias !== undefined) {
        const aliases = Array.isArray(route.alias)    // 转化为数组
            ? route.alias
            : [route.alias]
        
        aliases.forEach(alias => {       // 多个alias相当于同样的path，但是matchas不一样
            const aliasRoute = {           // 不需要其他信息，因为直接访问被alias的path路由记录
                path: alias,
                children: route.children
            }
            addRouteRecord(
                pathList,
                pathMap,
                nameMap,
                aliasRoute,
                parent,
                record.path || '/' // matchAs
            )
        })
    }
    
    // 用 path 作为key保存路由记录项，保存到pathMap
    if (!pathMap[record.path]) {
        pathList.push(record.path)
        pathMap[record.path] = record
    }
    
    // 用 name 作为key保存路由记录项，保存到nameMap
    if (name) {
        if (!nameMap[name]) {
            nameMap[name] = record
        } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
            warn(
                false,
                `Duplicate named routes definition: ` +
                `{ name: "${ name }", path: "${ record.path }" }`
            )
        }
    }
}

/**
 * 对路由配置的 path 项编译解析（存在动态路由）
 * @param path
 * @param pathToRegexpOptions
 */
function compileRouteRegex(path: string, pathToRegexpOptions: PathToRegexpOptions): RouteRegExp {
    const regex = Regexp(path, [], pathToRegexpOptions)     // 用path-to-regexp
    if (process.env.NODE_ENV !== 'production') {
        const keys: any = Object.create(null)
        regex.keys.forEach(key => {       // key.name 不可重复
            warn(!keys[key.name], `Duplicate param keys in route with path: "${ path }"`)
            keys[key.name] = true
        })
    }
    return regex        // 返回规则
}

/**
 * 规范化路由配置的 path 项
 * @param path 当前path
 * @param parent 父级路由配置
 * @param strict 路由配置 route.pathToRegexpOptions.strict
 * @returns {*}
 */
function normalizePath(path: string, parent?: RouteRecord, strict?: boolean): string {
    if (!strict) path = path.replace(/\/$/, '')   // 没有strict配置则把结尾/去掉
    if (path[0] === '/') return path        // 为/则直接返回
    if (parent == null) return path         // 不存在父级路由
    return cleanPath(`${ parent.path }/${ path }`)    // 双斜杠换成单斜杠
}
