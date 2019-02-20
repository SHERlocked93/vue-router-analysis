/* @flow */

import type Router from '../index'
import { assert } from './warn'
import { getStateKey, setStateKey } from './push-state'

const positionStore = Object.create(null)

/**
 * 设置滚动条定位
 */
export function setupScroll() {
  // Fix for #1585 for Firefox
  // Fix for #2195 Add optional third attribute to workaround a bug in safari https://bugs.webkit.org/show_bug.cgi?id=182678
  window.history.replaceState({ key: getStateKey() }, '', window.location.href.replace(window.location.origin, ''))
  window.addEventListener('popstate', e => {
    saveScrollPosition()
    if (e.state && e.state.key) {
      setStateKey(e.state.key)
    }
  })
}

/**
 * 处理滚动条定位
 * @param router
 * @param to
 * @param from
 * @param isPop
 */
export function handleScroll(
  router: Router,
  to: Route,
  from: Route,
  isPop: boolean
) {
  if (!router.app) {
    return
  }
  
  const behavior = router.options.scrollBehavior
  if (!behavior) {
    return
  }
  
  if (process.env.NODE_ENV !== 'production') {
    assert(typeof behavior === 'function', `scrollBehavior must be a function`)
  }
  
  // wait until re-render finishes before scrolling
  router.app.$nextTick(() => {
    const position = getScrollPosition()            // 获取当前页面滚动条的位置
    const shouldScroll = behavior.call(router, to, from, isPop ? position : null)
    
    if (!shouldScroll) {
      return
    }
    
    if (typeof shouldScroll.then === 'function') {
      shouldScroll.then(shouldScroll => {
        scrollToPosition((shouldScroll: any), position)
      }).catch(err => {
        if (process.env.NODE_ENV !== 'production') {
          assert(false, err.toString())
        }
      })
    } else {
      scrollToPosition(shouldScroll, position)
    }
  })
}

/**
 * 记录当前 key 对应的滚动条位置
 */
export function saveScrollPosition() {
  const key = getStateKey()
  if (key) {
    positionStore[key] = {
      x: window.pageXOffset,
      y: window.pageYOffset
    }
  }
}

/**
 * 获取当前 key 对应的滚动位置
 * @returns {*}
 */
function getScrollPosition(): ?Object {
  const key = getStateKey()
  if (key) {
    return positionStore[key]
  }
}

/**
 * 获取元素的 position
 * @param el
 * @param offset
 * @returns {{x: number, y: number}}
 */
function getElementPosition(el: Element, offset: Object): Object {
  const docEl: any = document.documentElement
  const docRect = docEl.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  return {
    x: elRect.left - docRect.left - offset.x,
    y: elRect.top - docRect.top - offset.y
  }
}

/**
 * 滚动条位置是否是正确的
 * @param obj
 * @returns {boolean}
 */
function isValidPosition(obj: Object): boolean {
  return isNumber(obj.x) || isNumber(obj.y)
}

/**
 * 规范化偏移量
 * @param obj
 * @returns {{x: *, y: *}}
 */
function normalizePosition(obj: Object): Object {
  return {
    x: isNumber(obj.x) ? obj.x : window.pageXOffset,
    y: isNumber(obj.y) ? obj.y : window.pageYOffset
  }
}

/**
 * 规范化滚动偏移量
 * @param obj
 * @returns {{x: number, y: number}}
 */
function normalizeOffset(obj: Object): Object {
  return {
    x: isNumber(obj.x) ? obj.x : 0,
    y: isNumber(obj.y) ? obj.y : 0
  }
}

/**
 * 是否是 number 类型
 * @param v
 * @returns {boolean}
 */
function isNumber(v: any): boolean {
  return typeof v === 'number'
}

/**
 * 滚动条滚动到指定位置
 * @param shouldScroll
 * @param position
 */
function scrollToPosition(shouldScroll, position) {
  const isObject = typeof shouldScroll === 'object'
  if (isObject && typeof shouldScroll.selector === 'string') {
    const el = document.querySelector(shouldScroll.selector)
    if (el) {
      let offset = shouldScroll.offset && typeof shouldScroll.offset === 'object' ? shouldScroll.offset : {}
      offset = normalizeOffset(offset)
      position = getElementPosition(el, offset)
    } else if (isValidPosition(shouldScroll)) {
      position = normalizePosition(shouldScroll)
    }
  } else if (isObject && isValidPosition(shouldScroll)) {
    position = normalizePosition(shouldScroll)
  }
  
  if (position) {
    window.scrollTo(position.x, position.y)
  }
}
