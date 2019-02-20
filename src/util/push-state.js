/* @flow */

import { inBrowser } from './dom'
import { saveScrollPosition } from './scroll'

/**
 * 浏览器是否支持 pushState 方法
 * @type {boolean|*}
 */
export const supportsPushState = inBrowser && (function() {
  const ua = window.navigator.userAgent
  
  if (
    (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
    ua.indexOf('Mobile Safari') !== -1 &&
    ua.indexOf('Chrome') === -1 &&
    ua.indexOf('Windows Phone') === -1
  ) {
    return false
  }
  
  return window.history && 'pushState' in window.history
})()

// use User Timing api (if present) for more accurate key precision
const Time = inBrowser && window.performance && window.performance.now
  ? window.performance
  : Date

/* 当前页面的 key 值 */
let _key: string = genKey()

/**
 * 根据时间生成的唯一 key 值
 * @type {string}
 * @private
 */
function genKey(): string {
  return Time.now().toFixed(3)
}

/**
 * 获取 key
 * @returns {string}
 */
export function getStateKey() {
  return _key
}

/**
 * 设置 key
 * @param key
 */
export function setStateKey(key: string) {
  _key = key
}

/**
 * 向浏览器 pushState
 * @param url
 * @param replace
 */
export function pushState(url?: string, replace?: boolean) {
  saveScrollPosition()
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
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

/**
 * 向浏览器 replaceState
 * @param url
 */
export function replaceState(url?: string) {
  pushState(url, true)
}
