/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { START } from '../util/route'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HTML5History extends History {
  constructor(router: Router, base: ?string) {
    super(router, base)
    
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll
    
    if (supportsScroll) {
      setupScroll()
    }
    
    const initLocation = getLocation(this.base)
    window.addEventListener('popstate', e => {
      const current = this.current
      
      // Avoiding first `popstate` event dispatched in some browsers but first
      // history route not updated since async guard at the same time.
      const location = getLocation(this.base)
      if (this.current === START && location === initLocation) {
        return
      }
      
      this.transitionTo(location, route => {
        if (supportsScroll) {
          handleScroll(router, route, current, true)
        }
      })
    })
  }
  
  go(n: number) {
    window.history.go(n)
  }
  
  push(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      pushState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }
  
  replace(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      replaceState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }
  
  ensureURL(push?: boolean) {
    if (getLocation(this.base) !== this.current.fullPath) {
      const current = cleanPath(this.base + this.current.fullPath)
      push ? pushState(current) : replaceState(current)
    }
  }
  
  getCurrentLocation(): string {
    return getLocation(this.base)
  }
}

/**
 * 根据 base 获取浏览器 window 地址
 * @param base
 * @returns {string} pathname + search + hash
 */
export function getLocation(base: string): string {
  let path = decodeURI(window.location.pathname)
  if (base && path.indexOf(base) === 0) {
    path = path.slice(base.length)          // path为去除前面base部分的location.pathname
  }
  console.table({ base, path })
  return (path || '/') + window.location.search + window.location.hash
}
