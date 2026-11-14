// Run with: npm test

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {beforeEach, test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';

const require = createRequire(import.meta.url);
const jquerySource = readFileSync(require.resolve('jquery/dist/jquery.js'), 'utf8');
const scriptPath = fileURLToPath(new URL('../../src/web/assets/dist/savedfilters.js', import.meta.url));
const script = readFileSync(scriptPath, 'utf8').replace(
  /\}\)\(jQuery\);\s*$/,
  'window.__exports = {SavedFiltersMenu};\n})(jQuery);'
);

const SERIALIZED = 'condition[class]=EntryCondition&condition[conditionRules][a][class]=SlugRule';

let dom;
let calls;
let menu;

function filter(overrides = {}) {
  return {
    id: 1,
    name: 'My filter',
    serialized: SERIALIZED,
    shared: false,
    canEdit: true,
    canDelete: true,
    ignoredRules: 0,
    totalRules: 1,
    ...overrides,
  };
}

beforeEach(() => {
  dom = new JSDOM(
    '<!doctype html><body><div id="search"><button class="filter-btn" id="filter-btn"></button></div></body>',
    {runScripts: 'outside-only', pretendToBeVisual: true}
  );
  const {window} = dom;
  calls = {notices: [], errors: [], requests: []};

  window.eval(jquerySource);
  window.jQuery.expr.pseudos.visible = () => true;
  window.Craft = {
    t: (category, message, params) => (params ? message.replace('{count', '{count') : message),
    cp: {
      displayNotice: (message) => calls.notices.push(message),
      displayError: (message) => calls.errors.push(message),
    },
    sendActionRequest: async (method, action, options) => {
      calls.requests.push({method, action, options});
      return {data: {filters: []}};
    },
  };
  window.SavedFiltersIcons = {edit: '<svg id="edit"/>', delete: '<svg id="delete"/>', shared: '<svg id="shared"/>', warning: '<svg id="warning"/>'};
  window.SavedFiltersConfig = {canShare: true};
  window.eval(script);

  const $ = window.jQuery;
  const index = {
    elementType: 'craft\\elements\\Entry',
    sourceKey: 'section:a',
    siteId: 1,
    filterHuds: {1: {}},
    $filterBtn: $('#filter-btn'),
    $searchContainer: $('#search'),
    getSourceLabel: () => 'Suppliers',
  };
  menu = new window.__exports.SavedFiltersMenu(index);
  menu.apply = (serialized) => calls.applied = serialized;
  menu.$menu = $('<div class="saved-filters-menu" tabindex="-1"/>').appendTo(window.document.body);
});

function render(filters, extra = {}) {
  menu.render({filters, ...extra});
  return menu.$menu;
}

const names = ($menu) => Array.from($menu.find('.saved-filters-menu__name'), (el) => el.textContent);
const applyButton = ($item) => $item.find('.saved-filters-menu__actions .btn').first();

test('an empty list shows the empty message', () => {
  const $menu = render([]);
  assert.match($menu.find('.saved-filters-menu__empty').text(), /No saved filters/);
  assert.equal($menu.find('.saved-filters-menu__item').length, 0);
});

test('each filter is listed by name', () => {
  const $menu = render([filter({id: 1, name: 'First'}), filter({id: 2, name: 'Second'})]);
  assert.deepEqual(names($menu), ['First', 'Second']);
  assert.equal($menu.find('.saved-filters-menu__empty').length, 0);
});

test('a filter name is rendered as text, not markup', () => {
  const $menu = render([filter({name: '<img src=x onerror=alert(1)>'})]);
  assert.equal($menu.find('img').length, 0);
  assert.equal(names($menu)[0], '<img src=x onerror=alert(1)>');
});

test('Apply applies the filter', () => {
  const $menu = render([filter()]);
  applyButton($menu.find('.saved-filters-menu__item')).trigger('click');
  assert.equal(calls.applied, SERIALIZED);
  assert.deepEqual(calls.notices, []);
});

test('the applied filter shows Applied and does not apply again', () => {
  menu.index.filterHuds[1]['section:a'] = {cleared: false, serialized: SERIALIZED};
  const $menu = render([filter()]);
  const $apply = applyButton($menu.find('.saved-filters-menu__item'));
  assert.equal($apply.text(), 'Applied');
  assert.equal($apply.attr('aria-disabled'), 'true');
  $apply.trigger('click');
  assert.equal(calls.applied, undefined);
});

test('the applied state ignores rule order and ids', () => {
  menu.index.filterHuds[1]['section:a'] = {
    cleared: false,
    serialized: 'condition[class]=EntryCondition&condition[conditionRules][zz][class]=SlugRule&condition[conditionRules][zz][uid]=x',
  };
  const $menu = render([filter()]);
  assert.equal(applyButton($menu.find('.saved-filters-menu__item')).text(), 'Applied');
});

test('a shared filter shows the shared icon with a tooltip', () => {
  const $shared = render([filter({shared: true})]).find('.saved-filters-menu__shared');
  assert.equal($shared.length, 1);
  assert.equal($shared.attr('data-tooltip'), 'Shared with all users');
  assert.equal($shared.attr('aria-label'), 'Shared with all users');
  assert.equal($shared.find('svg#shared').length, 1);
});

test('a private filter has no shared icon', () => {
  assert.equal(render([filter()]).find('.saved-filters-menu__shared').length, 0);
});

test('edit and delete buttons follow canEdit and canDelete independently', () => {
  const both = render([filter()]);
  assert.equal(both.find('[aria-label="Edit"]').length, 1);
  assert.equal(both.find('[aria-label="Delete"]').length, 1);

  const editOnly = render([filter({canDelete: false})]);
  assert.equal(editOnly.find('[aria-label="Edit"]').length, 1);
  assert.equal(editOnly.find('[aria-label="Delete"]').length, 0);

  const deleteOnly = render([filter({canEdit: false})]);
  assert.equal(deleteOnly.find('[aria-label="Edit"]').length, 0);
  assert.equal(deleteOnly.find('[aria-label="Delete"]').length, 1);

  const neither = render([filter({canEdit: false, canDelete: false})]);
  assert.equal(neither.find('.saved-filters-menu__icon-btn').length, 0);
});

test('Delete removes the filter by id', async () => {
  const $menu = render([filter({id: 7})]);
  menu.refresh = async () => {};
  $menu.find('.saved-filters-menu__delete').trigger('click');
  await new Promise((resolve) => setTimeout(resolve, 0));
  const request = calls.requests.find((r) => r.action.endsWith('/delete'));
  assert.equal(request.method, 'POST');
  assert.equal(JSON.stringify(request.options.data), '{"id":7}');
});

test('a filter with no ignored rules has no warning', () => {
  assert.equal(render([filter()]).find('.saved-filters-menu__stale').length, 0);
});

test('a partly stale filter shows a warning and still applies, with a notice', () => {
  const $menu = render([filter({ignoredRules: 1, totalRules: 2})]);
  const $stale = $menu.find('.saved-filters-menu__stale');
  assert.equal($stale.length, 1);
  assert.equal($stale.find('svg#warning').length, 1);
  assert.ok($stale.attr('data-tooltip'));

  applyButton($menu.find('.saved-filters-menu__item')).trigger('click');
  assert.equal(calls.applied, SERIALIZED);
  assert.equal(calls.notices.length, 1);
});

test('a filter with every rule ignored cannot be applied', () => {
  const $menu = render([filter({ignoredRules: 2, totalRules: 2})]);
  const $apply = applyButton($menu.find('.saved-filters-menu__item'));
  assert.equal($apply.attr('aria-disabled'), 'true');
  assert.match($menu.find('.saved-filters-menu__stale').attr('data-tooltip'), /can no longer be applied/);

  $apply.trigger('click');
  assert.equal(calls.applied, undefined);
  assert.deepEqual(calls.notices, []);
});

test('only the newly saved filter shows the new dot', () => {
  menu.newFilterId = 2;
  const $menu = render([filter({id: 1, name: 'Old'}), filter({id: 2, name: 'New'})]);
  const $items = $menu.find('.saved-filters-menu__item');
  assert.equal($items.eq(0).find('.saved-filters-menu__new-dot').length, 0);
  assert.equal($items.eq(1).find('.saved-filters-menu__new-dot').length, 1);
});

test('rendering focuses the first usable Apply button', () => {
  menu.focusOnRender = true;
  const $menu = render([
    filter({id: 1, name: 'Unusable', ignoredRules: 1, totalRules: 1, canEdit: false, canDelete: false}),
    filter({id: 2, name: 'Usable'}),
  ]);
  const focused = dom.window.document.activeElement;
  assert.equal(focused, $menu.find('.saved-filters-menu__item').eq(1).find('.btn')[0]);
});

test('rendering focuses the menu when nothing in it can be focused', () => {
  menu.focusOnRender = true;
  const $menu = render([]);
  assert.equal(dom.window.document.activeElement, $menu[0]);
});

test('rendering leaves focus alone when it is elsewhere and no focus was requested', () => {
  const outside = dom.window.document.createElement('input');
  dom.window.document.body.append(outside);
  outside.focus();
  render([filter()]);
  assert.equal(dom.window.document.activeElement, outside);
});

test('closing returns focus to the bookmark when it was inside the menu', () => {
  render([filter()]);
  menu.$menu.find('.btn').first()[0].focus();
  menu.close();
  assert.equal(dom.window.document.activeElement, menu.$btn[0]);
});

test('closing leaves focus alone when it was elsewhere', () => {
  render([filter()]);
  const outside = dom.window.document.createElement('input');
  dom.window.document.body.append(outside);
  outside.focus();
  menu.close();
  assert.equal(dom.window.document.activeElement, outside);
});

test('Escape closes the menu and focuses the bookmark', () => {
  render([filter()]);
  menu.onKeydown({key: 'Escape'});
  assert.equal(menu.$menu, null);
  assert.equal(dom.window.document.activeElement, menu.$btn[0]);
});

function tab(shiftKey = false) {
  let prevented = false;
  menu.onKeydown({key: 'Tab', shiftKey, preventDefault: () => (prevented = true)});
  return prevented;
}

test('Tab wraps inside the menu when it is a modal', () => {
  const $menu = render([filter()]);
  $menu.addClass('is-modal');
  const buttons = Array.from($menu.find('button'));

  buttons.at(-1).focus();
  assert.equal(tab(), true);
  assert.equal(dom.window.document.activeElement, buttons[0]);

  assert.equal(tab(true), true);
  assert.equal(dom.window.document.activeElement, buttons.at(-1));
});

test('Tab is left alone in the middle of a modal and in the dropdown', () => {
  const $menu = render([filter()]);
  $menu.addClass('is-modal');
  const buttons = Array.from($menu.find('button'));
  buttons[0].focus();
  assert.equal(tab(), false);

  $menu.removeClass('is-modal');
  buttons.at(-1).focus();
  assert.equal(tab(), false);
});
