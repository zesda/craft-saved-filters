#!/usr/bin/env node
// Checks that the Craft control panel internals used by src/web/assets/dist/savedfilters.js
// exist in a given craftcms/cms checkout.
//
// Usage: node tests/smoke/craft-internals.mjs [path-to-craftcms/cms]
//
// The path defaults to vendor/craftcms/cms (run composer install first). It must contain the
// src/web/assets/cp/dist and src/web/assets/garnish/dist source maps.

import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const craftDir = resolve(process.argv[2] || 'vendor/craftcms/cms');
const cpMapPath = join(craftDir, 'src/web/assets/cp/dist/cp.js.map');
const garnishMapPath = join(craftDir, 'src/web/assets/garnish/dist/garnish.js.map');
const indexTemplatePath = join(craftDir, 'src/templates/_layouts/elementindex.twig');

for (const path of [cpMapPath, garnishMapPath, indexTemplatePath]) {
  if (!existsSync(path)) {
    console.error(`Not found: ${path}`);
    process.exit(2);
  }
}

function loadSources(mapPath) {
  const map = JSON.parse(readFileSync(mapPath, 'utf8'));
  return (name) => {
    const index = map.sources.findIndex((source) => source.endsWith('/' + name));
    return index === -1 ? null : map.sourcesContent[index];
  };
}

const cp = loadSources(cpMapPath);
const garnish = loadSources(garnishMapPath);

const baseElementIndex = cp('js/BaseElementIndex.js');
const filterHud = baseElementIndex && baseElementIndex.slice(baseElementIndex.indexOf('const FilterHud = '));

const checks = [
  ['Craft.elementIndex is assigned on index pages', readFileSync(indexTemplatePath, 'utf8'), /Craft\.elementIndex = Craft\.createElementIndex\(/],

  ['index.initialized', baseElementIndex, /^\s+initialized: false,/m],
  ['index.elementType', baseElementIndex, /^\s+elementType: null,/m],
  ['index.sourceKey', baseElementIndex, /^\s+sourceKey: null,/m],
  ['index.siteId', baseElementIndex, /^\s+siteId: null,/m],
  ['index.filterHuds', baseElementIndex, /^\s+filterHuds: null,/m],
  ['index.$filterBtn', baseElementIndex, /^\s+\$filterBtn: null,/m],
  ['index.$searchContainer', baseElementIndex, /^\s+\$searchContainer: null,/m],
  ['index.settings.context "index"', baseElementIndex, /settings\.context === 'index'/],
  ['index.$filterBtn is the .filter-btn child of the search container', baseElementIndex, /\$searchContainer\.children\('\.filter-btn:first'\)/],
  ['index.createFilterHud()', baseElementIndex, /^\s+createFilterHud: function/m],
  ['createFilterHud accepts showOnInit and serialized', baseElementIndex, /showOnInit: false,\s+serialized: /],
  ['index.updateElements()', baseElementIndex, /^\s+updateElements: (async )?function/m],
  ['index.getSourceLabel()', baseElementIndex, /^\s+getSourceLabel: function/m],

  ['FilterHud class exists', baseElementIndex, /const FilterHud = Garnish\.HUD\.extend\(/],
  ['hud.serialized', filterHud, /^\s+serialized: null,/m],
  ['hud.cleared', filterHud, /^\s+cleared: false,/m],
  ['hud.loading', filterHud, /^\s+loading: true,/m],
  ['hud.serialize()', filterHud, /^\s+serialize: function/m],
  ['hud.destroy()', filterHud, /^\s+destroy: function/m],
  ['hud element has the element-filter-hud class', filterHud, /hudClass: 'hud element-filter-hud/],
  ['hud.$body is set by Garnish.HUD', garnish('HUD.js'), /this\.\$body = /],
  ['hud.showing is set by Garnish.HUD', garnish('HUD.js'), /this\.showing = /],
  ['hud.hide()', garnish('HUD.js'), /^\s+hide: function/m],

  ['Craft.sendActionRequest()', cp('js/Craft.js'), /^\s+sendActionRequest: function/m],
  ['Craft.cp.displayNotice()', cp('js/CP.js'), /^\s+displayNotice: function/m],
  ['Craft.cp.displayError()', cp('js/CP.js'), /^\s+displayError: function/m],

  ['Garnish.Modal onFadeOut setting', garnish('Modal.js'), /onFadeOut: \$\.noop,/],
  ['Garnish.Modal.hide()', garnish('Modal.js'), /^\s+hide: function/m],
  ['Garnish.Modal.destroy()', garnish('Modal.js'), /^\s+destroy: function/m],
];

let failed = 0;
for (const [label, source, pattern] of checks) {
  const ok = typeof source === 'string' && pattern.test(source);
  if (!ok) {
    failed++;
  }
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed against ${craftDir}`);
process.exit(failed ? 1 : 0);
