// Read the actual Catalog with Node's type stripping; no build or runtime writes.
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.')) {
        for (const extension of ['.ts', '.tsx', '.json']) {
          const url = new URL(specifier + extension, context.parentURL).href;
          if (existsSync(fileURLToPath(url))) return nextResolve(url, context);
        }
      }
      throw error;
    }
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.json')) {
      return { format: 'module', source: 'export default ' + readFileSync(fileURLToPath(url), 'utf8'), shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { EQUIPMENT_CATALOG } = await import(new URL('../../../src/data/equipmentCatalog.ts', import.meta.url));
const categories = ['melee', 'ranged', 'armor', 'artifact'];
const counts = Object.fromEntries(categories.map(category => {
  const items = EQUIPMENT_CATALOG.filter(item => item.category === category);
  return [category, { total: items.length, supported: items.filter(item => item.runtimeSupport !== 'unsupported').length }];
}));
const items = EQUIPMENT_CATALOG.map(({ category, id, name, runtimeSupport }) => ({ category, id, name: name.en, runtimeSupport }));
console.log(JSON.stringify({ counts, items }, null, 2));
