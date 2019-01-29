/* @flow */

/**
 * 处理路径拼接
 *   一、resolvePath('/aaa', '/bbb', false)  ->   "/aaa"
 *   二、resolvePath('?aaa', '/bbb', false)  ->   "/bbb?aaa"
 *   三、resolvePath('aaa', '/bbb', true)    ->   "/bbb/aaa"
 *   四、resolvePath('aaa', '/bbb', false)   ->   "/aaa"
 */
export function resolvePath(
  relative: string,
  base: string,
  append?: boolean
): string {
  const firstChar = relative.charAt(0)
  if (firstChar === '/') {
    return relative
  }
  
  if (firstChar === '?' || firstChar === '#') {
    return base + relative
  }
  
  const stack = base.split('/')
  
  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  if (!append || !stack[stack.length - 1]) {
    stack.pop()
  }
  
  // resolve relative path
  const segments = relative.replace(/^\//, '').split('/')
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (segment === '..') {
      stack.pop()
    } else if (segment !== '.') {
      stack.push(segment)
    }
  }
  
  // ensure leading slash
  if (stack[0] !== '') {
    stack.unshift('')
  }
  
  return stack.join('/')
}

/**
 * 解析 path 路径：返回 url 的 Path 中解析出的 path、query、hash
 * 例：'http://10.13.69.104:8287/dpgtool/?a=1#/cameraMap'
 * 解析结果：
 * {
 *      hash: "#/cameraMap"
 *      path: "http://10.13.69.104:8287/dpgtool/"
 *      query: "a=1"
 * }
 * @param path
 */
export function parsePath(path: string): {
  path: string;
  query: string;
  hash: string;
} {
  let hash = ''
  let query = ''
  
  const hashIndex = path.indexOf('#')
  if (hashIndex >= 0) {
    hash = path.slice(hashIndex)
    path = path.slice(0, hashIndex)
  }
  
  const queryIndex = path.indexOf('?')
  if (queryIndex >= 0) {
    query = path.slice(queryIndex + 1)
    path = path.slice(0, queryIndex)
  }
  
  return {
    path,
    query,
    hash
  }
}

/**
 * 双斜杠换为单斜杠
 * @param path 路径
 * @returns {string}
 */
export function cleanPath(path: string): string {
  return path.replace(/\/\//g, '/')
}
