import View from './components/view'
import Link from './components/link'

export let _Vue

/**
 * vue-router 的注册过程 Vue.use(VueRouter)
 * @param Vue
 * @returns {*}
 */
export function install(Vue) {
    if (install.installed && _Vue === Vue) return   // 避免重复装载
    install.installed = true      // 装载标志位
    
    _Vue = Vue    // 这样拿到 Vue 不会因为 import 带来的打包体积增加
    
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
            console.log('----- in beforeCreate -----\n      instance: ', this)
            if (isDef(this.$options.router)) {  // 组件是否存在$options.router，该对象只在根组件上有
                this._routerRoot = this         // 这里的this是根vue实例
                this._router = this.$options.router
                this._router.init(this)         // 根vue实例的别名
                Vue.util.defineReactive(this, '_route', this._router.history.current)  // 使用vue 提供的响应式API，将_route响应式化，作为其他组件的this.$route
            } else {                            // 组件实例才会进入，通过$parent一级级获取_routerRoot
                this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
            }
            registerInstance(this, this)
        },
        destroyed() {
            console.log('----- in destroyed -----\n      instance: ', this)
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
    // use the same hook merging strategy for route hooks
    strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
