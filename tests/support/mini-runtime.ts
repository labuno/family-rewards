import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
export function miniPage(name: string, app: any, wx: any, options: Record<string, string> = {}) {
  let page: any;
  const context = vm.createContext({
    getApp: () => app,
    wx,
    Page: (definition: any) => {
      page = definition;
    },
  });
  const cache = new Map();
  function evaluate(path: string): any {
    if (cache.has(path)) return cache.get(path);
    const module = { exports: {} };
    const localRequire = (id: string) => evaluate(resolve(dirname(path), id) + '.js');
    const fn = vm.runInContext(
      '(function(require,module,exports){' + readFileSync(path, 'utf8') + '\n})',
      context,
      { filename: path },
    );
    fn(localRequire, module, module.exports);
    cache.set(path, module.exports);
    return module.exports;
  }
  evaluate(resolve('miniprogram/pages', name, 'index.js'));
  page.setData = (data: any) => Object.assign(page.data, data);
  page.data = structuredClone(page.data);
  page.onLoad?.(options);
  return page;
}
