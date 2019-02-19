/* @flow */

import type VueRouter from '../index'
import { stringifyQuery } from './query'

const trailingSlashRE = /\/?$/

/**
 * 创建路由 url.parse 对象：
 * 一、location 地址的 query 参数的克隆
 * 二、配置 route 对象：根据参数组装成 url.parse 对象
 * 三、存在 redirectedFrom 参数：添加至 route 对象
 * @param record
 * @param location
 * @param redirectedFrom 从哪里跳转过来的，参数值与 location 类似
 * @param router VueRouter 实例 this
 */
export function createRoute(
  record: ?RouteRecord,
  location: Location,
  redirectedFrom?: ?Location,
  router?: VueRouter
): Route {
  // 用户定义的查询字符串的解析/反解析函数
  const stringifyQuery = router && router.options.stringifyQuery
  
  let query: any = location.query || {}
  try {
    query = clone(query)          // location 地址的 query 参数的克隆
  } catch (e) {}
  
  const route: Route = {          // 配置 route 对象：根据参数组装成 url.parse 对象
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query,
    params: location.params || {},
    fullPath: getFullPath(location, stringifyQuery),
    matched: record ? formatMatch(record) : []
  }
  if (redirectedFrom) {
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
  }
  return Object.freeze(route)
}

function clone(value) {
  if (Array.isArray(value)) {
    return value.map(clone)
  } else if (value && typeof value === 'object') {
    const res = {}
    for (const key in value) {
      res[key] = clone(value[key])
    }
    return res
  } else {
    return value
  }
}

// the starting route that represents the initial state
export const START = createRoute(null, {
  path: '/'
})

/**
 * 格式化 match：不断找 record 的 parent 属性
 * @param record
 * @returns {Array}
 */
function formatMatch(record: ?RouteRecord): Array<RouteRecord> {
  const res = []
  while (record) {
    res.unshift(record)
    record = record.parent
  }
  return res
}

/**
 * 获取序列化的 location 路径：包含 query 参数的 stringifyQuery
 * 例：query = { foo: [1, 2], bar: { a: 1, b: 2 }, test: 2 };
 * stringify(query) => "?foo=1&foo=2&bar=%5Bobject%20Object%5D&test=2"
 * @param path
 * @param query
 * @param hash
 * @param _stringifyQuery
 * @returns {string}
 */
function getFullPath(
  { path, query = {}, hash = '' },
  _stringifyQuery
): string {
  const stringify = _stringifyQuery || stringifyQuery
  return (path || '/') + stringify(query) + hash
}

/**
 * 判断路由 a 和路由 b 是否相同
 * @param a
 * @param b
 * @returns {boolean}
 */
export function isSameRoute(a: Route, b: ?Route): boolean {
  if (b === START) {
    return a === b
  } else if (!b) {
    return false
  } else if (a.path && b.path) {
    return (
      a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query)
    )
  } else if (a.name && b.name) {
    return (
      a.name === b.name &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query) &&
      isObjectEqual(a.params, b.params)
    )
  } else {
    return false
  }
}

/**
 * 判断 a 和 b 是否是相等的对象
 * @param a
 * @param b
 * @returns {boolean}
 */
function isObjectEqual(a = {}, b = {}): boolean {
  // handle null value #1566
  if (!a || !b) return a === b
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every(key => {
    const aVal = a[key]
    const bVal = b[key]
    // check nested equality
    if (typeof aVal === 'object' && typeof bVal === 'object') {
      return isObjectEqual(aVal, bVal)
    }
    return String(aVal) === String(bVal)
  })
}

/**
 * 当前路由 current 是否包含 目标路由 target
 * @param current
 * @param target
 * @returns {boolean}
 */
export function isIncludedRoute(current: Route, target: Route): boolean {
  return (
    current.path.replace(trailingSlashRE, '/').indexOf(
      target.path.replace(trailingSlashRE, '/')
    ) === 0 &&
    (!target.hash || current.hash === target.hash) &&
    queryIncludes(current.query, target.query)
  )
}

function queryIncludes(current: Dictionary<string>, target: Dictionary<string>): boolean {
  for (const key in target) {
    if (!(key in current)) {
      return false
    }
  }
  return true
}
