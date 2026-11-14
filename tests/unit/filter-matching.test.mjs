// Run with: node --test tests/unit

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const scriptPath = fileURLToPath(new URL('../../src/web/assets/dist/savedfilters.js', import.meta.url));

let jquery = () => ({});

function loadScript() {
  const source = readFileSync(scriptPath, 'utf8').replace(
    /\}\)\(jQuery\);\s*$/,
    'globalThis.__exports = {canonicalFilter, SavedFiltersMenu};\n})(jQuery);'
  );
  const sandbox = {
    window: {},
    document: {},
    jQuery: (...args) => jquery(...args),
    URLSearchParams,
    MutationObserver: class {
      observe() {}
    },
    setTimeout: () => 0,
    Craft: {t: (category, message) => message},
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, {filename: scriptPath});
  return sandbox.__exports;
}

const {canonicalFilter, SavedFiltersMenu} = loadScript();

const entryClass = 'craft\\elements\\conditions\\entries\\EntryCondition';
const authorRule = 'craft\\elements\\conditions\\entries\\AuthorConditionRule';
const slugRule = 'craft\\elements\\conditions\\entries\\SlugConditionRule';

function filter(rules, extra = {}) {
  const params = new URLSearchParams();
  params.set('condition[class]', entryClass);
  for (const [key, fields] of Object.entries(rules)) {
    for (const [name, value] of Object.entries(fields)) {
      params.append(`condition[conditionRules][${key}][${name}]`, value);
    }
  }
  for (const [key, value] of Object.entries(extra)) {
    params.set(key, value);
  }
  return params.toString();
}

const slugFoo = {uid: 'u1', class: slugRule, operator: '=', value: 'foo'};
const slugBar = {uid: 'u2', class: slugRule, operator: '=', value: 'bar'};
const authorOne = {uid: 'u3', class: authorRule, operator: 'in', values: '1'};

test('identical filters match', () => {
  assert.equal(canonicalFilter(filter({a: slugFoo})), canonicalFilter(filter({a: slugFoo})));
});

test('rule keys and uids do not affect the match', () => {
  const first = filter({k1: {...slugFoo, uid: 'one'}});
  const second = filter({zz9: {...slugFoo, uid: 'two'}});
  assert.equal(canonicalFilter(first), canonicalFilter(second));
});

test('the rule type field does not affect the match', () => {
  const first = filter({a: {...slugFoo, type: 'x'}});
  const second = filter({a: {...slugFoo, type: 'y'}});
  assert.equal(canonicalFilter(first), canonicalFilter(second));
});

test('the order of fields within a rule does not affect the match', () => {
  const first = filter({a: {class: slugRule, operator: '=', value: 'foo'}});
  const second = filter({a: {value: 'foo', operator: '=', class: slugRule}});
  assert.equal(canonicalFilter(first), canonicalFilter(second));
});

test('the order of rules does not affect the match', () => {
  const first = filter({a: slugFoo, b: authorOne});
  const second = filter({a: authorOne, b: slugFoo});
  assert.equal(canonicalFilter(first), canonicalFilter(second));
});

test('re-adding a rule after removing it matches the original filter', () => {
  const original = filter({a: slugFoo, b: slugBar});
  const reAdded = filter({b: slugBar, c: slugFoo});
  assert.equal(canonicalFilter(original), canonicalFilter(reAdded));
});

test('the new-rule-type picker value is ignored', () => {
  const plain = filter({a: slugFoo});
  const withPicker = filter({a: slugFoo}, {'condition[new-rule-type]': authorRule});
  assert.equal(canonicalFilter(plain), canonicalFilter(withPicker));
});

test('URL-encoded and plain query strings match', () => {
  const encoded = filter({a: slugFoo});
  const plain = decodeURIComponent(encoded.replace(/\+/g, ' '));
  assert.equal(canonicalFilter(encoded), canonicalFilter(plain));
});

test('a different value does not match', () => {
  assert.notEqual(canonicalFilter(filter({a: slugFoo})), canonicalFilter(filter({a: {...slugFoo, value: 'baz'}})));
});

test('a different operator does not match', () => {
  assert.notEqual(canonicalFilter(filter({a: slugFoo})), canonicalFilter(filter({a: {...slugFoo, operator: '!='}})));
});

test('an extra rule does not match', () => {
  assert.notEqual(canonicalFilter(filter({a: slugFoo})), canonicalFilter(filter({a: slugFoo, b: authorOne})));
});

test('values swapped between two rules do not match', () => {
  const first = filter({a: {...slugFoo, operator: '='}, b: {...slugBar, operator: '!='}});
  const second = filter({a: {...slugFoo, operator: '!='}, b: {...slugBar, operator: '='}});
  assert.notEqual(canonicalFilter(first), canonicalFilter(second));
});

test('a different base condition does not match', () => {
  const first = filter({a: slugFoo});
  const second = filter({a: slugFoo}, {'condition[class]': 'craft\\elements\\conditions\\assets\\AssetCondition'});
  assert.notEqual(canonicalFilter(first), canonicalFilter(second));
});

test('an empty filter matches another empty filter', () => {
  assert.equal(canonicalFilter(''), canonicalFilter(''));
});

function menu({hud, savedKeys = [], savedKeysSource = 'section:a', sourceKey = 'section:a'}) {
  const instance = Object.create(SavedFiltersMenu.prototype);
  instance.index = {siteId: 1, sourceKey, filterHuds: {1: {[sourceKey]: hud}}};
  instance.savedKeys = new Set(savedKeys.map(canonicalFilter));
  instance.savedKeysSource = savedKeysSource;
  return instance;
}

function loadedHud(serialized, extra = {}) {
  return {cleared: false, loading: false, serialized, $body: {length: 1}, serialize: () => serialized, ...extra};
}

test('appliedFilter is the canonical form of the applied hud', () => {
  const serialized = filter({a: slugFoo});
  assert.equal(menu({hud: loadedHud(serialized)}).appliedFilter, canonicalFilter(serialized));
});

test('appliedFilter is null when the hud is cleared, empty or missing', () => {
  const serialized = filter({a: slugFoo});
  assert.equal(menu({hud: loadedHud(serialized, {cleared: true})}).appliedFilter, null);
  assert.equal(menu({hud: loadedHud('')}).appliedFilter, null);
  assert.equal(menu({hud: undefined}).appliedFilter, null);
});

test('currentFilter serializes a loaded hud', () => {
  const serialized = filter({a: slugFoo});
  assert.equal(menu({hud: loadedHud(serialized)}).currentFilter, serialized);
});

test('currentFilter falls back to the stored value while the hud is loading', () => {
  const stored = filter({a: slugFoo});
  const hud = {cleared: false, loading: true, serialized: stored, $body: {length: 0}, serialize: () => 'unused'};
  assert.equal(menu({hud}).currentFilter, stored);
});

test('currentFilter is null when the hud is cleared or missing', () => {
  assert.equal(menu({hud: loadedHud('x', {cleared: true})}).currentFilter, null);
  assert.equal(menu({hud: undefined}).currentFilter, null);
});

function saveButtonState(instance) {
  const calls = {};
  const chain = {
    toggleClass: (name, on) => ((calls.disabled = on), chain),
    attr: (name, value) => ((calls[name] = value), chain),
  };
  jquery = () => chain;
  instance.updateSaveButtons();
  return calls;
}

test('Save is disabled when there is no filter to save', () => {
  const calls = saveButtonState(menu({hud: undefined}));
  assert.equal(calls.disabled, true);
  assert.equal(calls['aria-disabled'], 'true');
  assert.equal(calls['data-tooltip'], 'Add a filter to save it');
});

test('Save is disabled when the current filter is already saved', () => {
  const current = filter({a: slugFoo});
  const reordered = filter({z: {...slugFoo, uid: 'other'}});
  const calls = saveButtonState(menu({hud: loadedHud(current), savedKeys: [reordered]}));
  assert.equal(calls.disabled, true);
  assert.equal(calls['data-tooltip'], 'This filter is already saved');
});

test('Save is enabled for a filter that is not saved', () => {
  const calls = saveButtonState(menu({hud: loadedHud(filter({a: slugFoo})), savedKeys: [filter({a: slugBar})]}));
  assert.equal(calls.disabled, false);
  assert.equal(calls['aria-disabled'], null);
  assert.equal(calls['data-tooltip'], null);
});

test('Save ignores saved filters loaded for a different source', () => {
  const serialized = filter({a: slugFoo});
  const calls = saveButtonState(
    menu({hud: loadedHud(serialized), savedKeys: [serialized], savedKeysSource: 'section:other'})
  );
  assert.equal(calls.disabled, false);
});

test('a filter is unusable only when every rule is ignored', () => {
  const instance = menu({hud: undefined});
  assert.equal(instance.isUnusable({totalRules: 2, ignoredRules: 2}), true);
  assert.equal(instance.isUnusable({totalRules: 2, ignoredRules: 1}), false);
  assert.equal(instance.isUnusable({totalRules: 0, ignoredRules: 0}), false);
});
