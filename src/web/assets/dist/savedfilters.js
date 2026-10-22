(function ($) {
  const ACTION_PREFIX = 'saved-filters/filters/';
  const MAX_WAIT_ATTEMPTS = 150;
  const WAIT_INTERVAL_MS = 100;
  const MODAL_BREAKPOINT = 450;

  function whenIndexReady(callback, attempt = 0) {
    const index = window.Craft && Craft.elementIndex;
    if (index && index.initialized && index.settings.context === 'index' && index.$filterBtn.length) {
      callback(index);
    } else if (attempt < MAX_WAIT_ATTEMPTS) {
      setTimeout(() => whenIndexReady(callback, attempt + 1), WAIT_INTERVAL_MS);
    }
  }

  const SAVED_TITLE = 'This filter is already saved';
  const EMPTY_TITLE = 'Add a filter to save it';

  function canonicalFilter(serialized) {
    const base = [];
    const rules = new Map();
    new URLSearchParams(serialized).forEach((value, key) => {
      const match = key.match(/^condition\[conditionRules\]\[([^\]]*)\](.*)$/);
      if (!match) {
        if (key !== 'condition[new-rule-type]') {
          base.push([key, value]);
        }
        return;
      }
      if (/^\[(uid|type)\]/.test(match[2])) {
        return;
      }
      if (!rules.has(match[1])) {
        rules.set(match[1], []);
      }
      rules.get(match[1]).push([match[2], value]);
    });
    return JSON.stringify([base.sort(), [...rules.values()].map((rule) => rule.sort())]);
  }

  class SavedFiltersMenu {
    constructor(index) {
      this.index = index;
      this.$menu = null;
      this.savedKeys = new Set();
      this.savedKeysSource = null;
      this.newFilterId = null;

      this.$btn = $('<button/>', {
        type: 'button',
        class: 'saved-filters-btn',
        title: 'Saved filters',
        'aria-label': 'Saved filters',
        'aria-haspopup': 'true',
        'aria-expanded': 'false',
      }).insertAfter(index.$filterBtn);
      this.$dot = $('<span/>', {class: 'saved-filters-btn__dot', 'aria-hidden': 'true'}).appendTo(this.$btn);
      index.$searchContainer.addClass('has-saved-filters');
      this.observeFilterHuds();

      this.$btn.on('click', () => (this.$menu ? this.close() : this.open()));
      this.onDocumentPointer = (event) => {
        if (!$(event.target).closest(this.$menu).length && !$(event.target).closest(this.$btn).length) {
          this.close();
        }
      };
      this.onResize = () => this.positionMenu();
      this.onScroll = (event) => {
        if (this.$menu && !this.$menu[0].contains(event.target)) {
          cancelAnimationFrame(this.scrollFrame);
          this.scrollFrame = requestAnimationFrame(() => this.$menu && this.positionMenu());
        }
      };
      this.onKeydown = (event) => {
        if (event.key === 'Escape') {
          this.close();
          this.$btn.trigger('focus');
        }
      };
    }

    observeFilterHuds() {
      const sync = () => {
        $('.element-filter-hud').each((_, hudEl) => {
          const $submit = $(hudEl).find('button[type="submit"]');
          if ($submit.length && !$(hudEl).find('.saved-filters-save').length) {
            $('<button/>', {type: 'button', class: 'btn saved-filters-save saved-filters-tip', text: 'Save'})
              .on('click', (event) => {
                if ($(event.currentTarget).attr('aria-disabled') !== 'true') {
                  this.openSaveModal();
                }
              })
              .insertBefore($submit);
          }
        });
        this.ensureSavedKeys();
        this.updateSaveButtons();
      };
      new MutationObserver(sync).observe(document.body, {childList: true, subtree: true});
      $(document).on('input change', '.element-filter-hud', () => this.updateSaveButtons());
      sync();
    }

    ensureSavedKeys() {
      const source = this.index.sourceKey;
      if (source && this.savedKeysSource !== source && this.loadingSavedKeysFor !== source) {
        this.$btn.removeClass('saved-filters-btn--has-filters');
        this.loadSavedKeys();
      }
    }

    async loadSavedKeys() {
      const source = this.index.sourceKey;
      this.loadingSavedKeysFor = source;
      try {
        const response = await Craft.sendActionRequest('GET', ACTION_PREFIX + 'list', {
          params: {elementType: this.index.elementType, sourceKey: source},
        });
        this.setSavedKeys(response.data.filters, source);
      } catch (error) {
        this.savedKeysSource = null;
      } finally {
        this.loadingSavedKeysFor = null;
      }
    }

    setSavedKeys(filters, source = this.index.sourceKey) {
      this.savedKeys = new Set(filters.map((filter) => canonicalFilter(filter.serialized)));
      this.savedKeysSource = source;
      this.$btn.toggleClass('saved-filters-btn--has-filters', filters.length > 0);
      this.updateSaveButtons();
    }

    updateSaveButtons() {
      const current = this.currentFilter;
      let disabled = false;
      let title = '';
      if (!current) {
        disabled = true;
        title = EMPTY_TITLE;
      } else if (this.savedKeysSource === this.index.sourceKey && this.savedKeys.has(canonicalFilter(current))) {
        disabled = true;
        title = SAVED_TITLE;
      }

      $('.saved-filters-save')
        .toggleClass('disabled', disabled)
        .attr('aria-disabled', disabled ? 'true' : null)
        .attr('data-tooltip', disabled ? title : null);
    }

    get hud() {
      const huds = this.index.filterHuds[this.index.siteId];
      return huds && huds[this.index.sourceKey];
    }

    get appliedFilter() {
      const hud = this.hud;
      return hud && !hud.cleared && hud.serialized ? canonicalFilter(hud.serialized) : null;
    }

    get currentFilter() {
      const hud = this.hud;
      if (!hud || hud.cleared) {
        return null;
      }
      if (hud.loading || !hud.$body || !hud.$body.length) {
        return hud.serialized || null;
      }
      return hud.serialize();
    }

    positionMenu() {
      const searchContainer = this.index.$searchContainer;
      const asModal = searchContainer.outerWidth() - 2 < MODAL_BREAKPOINT;
      this.$menu.toggleClass('is-modal', asModal);

      if (asModal) {
        this.$menu.css({top: '', right: ''});
        this.showShade();
        return;
      }

      this.hideShade();
      const rect = searchContainer[0].getBoundingClientRect();
      this.$menu.css({
        top: rect.bottom,
        right: Math.max(8, document.documentElement.clientWidth - rect.right + 1),
      });
    }

    showShade() {
      if (!this.$shade) {
        this.$shade = $('<div/>', {class: 'saved-filters-shade'}).insertBefore(this.$menu);
      }
    }

    hideShade() {
      if (this.$shade) {
        this.$shade.remove();
        this.$shade = null;
      }
    }

    async open() {
      this.$dot.removeClass('is-popping');
      this.$menu = $('<div/>', {class: 'saved-filters-menu', role: 'dialog', 'aria-label': 'Saved filters'})
        .appendTo(document.body);
      this.positionMenu();
      this.$btn.attr('aria-expanded', 'true');
      $(document).on('mousedown', this.onDocumentPointer).on('keydown', this.onKeydown);
      $(window).on('resize', this.onResize);
      window.addEventListener('scroll', this.onScroll, true);

      await this.refresh();
    }

    close() {
      if (!this.$menu) {
        return;
      }
      this.$menu.remove();
      this.$menu = null;
      this.hideShade();
      this.newFilterId = null;
      this.$btn.attr('aria-expanded', 'false');
      $(document).off('mousedown', this.onDocumentPointer).off('keydown', this.onKeydown);
      $(window).off('resize', this.onResize);
      window.removeEventListener('scroll', this.onScroll, true);
      cancelAnimationFrame(this.scrollFrame);
    }

    async refresh() {
      const $menu = this.$menu;
      let data;
      try {
        const response = await Craft.sendActionRequest('GET', ACTION_PREFIX + 'list', {
          params: {elementType: this.index.elementType, sourceKey: this.index.sourceKey},
        });
        data = response.data;
      } catch (error) {
        Craft.cp.displayError(this.errorMessage(error));
        this.close();
        return;
      }
      this.setSavedKeys(data.filters);
      if (!$menu || $menu !== this.$menu) {
        return;
      }
      this.render(data);
    }

    render(data) {
      this.$menu.empty();
      $('<div/>', {class: 'saved-filters-menu__heading', text: 'Saved filters'}).appendTo(this.$menu);

      if (!data.filters.length) {
        $('<div/>', {class: 'saved-filters-menu__empty', text: 'No saved filters for this section yet.'}).appendTo(this.$menu);
      }

      data.filters.forEach((filter) => this.renderItem(filter).appendTo(this.$menu));
    }

    renderItem(filter) {
      const $item = $('<div/>', {class: 'saved-filters-menu__item'});
      $('<span/>', {class: 'saved-filters-menu__name', text: filter.name}).appendTo($item);
      if (filter.id === this.newFilterId) {
        $('<span/>', {class: 'saved-filters-menu__new-dot', title: '', 'aria-label': 'Newly saved'}).appendTo($item);
      }
      if (filter.shared) {
        $('<span/>', {
          class: 'saved-filters-menu__shared saved-filters-tip',
          'aria-label': 'Shared with all users',
          'data-tooltip': 'Shared with all users',
          html: (window.SavedFiltersIcons && window.SavedFiltersIcons.shared) || 'Shared',
        }).appendTo($item);
      }
      const $actions = $('<div/>', {class: 'saved-filters-menu__actions'}).appendTo($item);

      const applied = this.appliedFilter === canonicalFilter(filter.serialized);
      $('<button/>', {
        type: 'button',
        class: 'btn small secondary' + (applied ? ' disabled' : ''),
        text: applied ? 'Applied' : 'Apply',
        'aria-disabled': applied ? 'true' : null,
      })
        .on('click', () => {
          if (!applied) {
            this.apply(filter.serialized);
          }
        })
        .appendTo($actions);

      if (filter.canEdit) {
        this.iconButton('edit', 'Edit')
          .on('click', () => this.openEditModal(filter))
          .appendTo($actions);
        this.iconButton('delete', 'Delete')
          .addClass('saved-filters-menu__delete')
          .on('click', () => this.remove(filter.id))
          .appendTo($actions);
      }

      return $item;
    }

    iconButton(icon, label) {
      return $('<button/>', {
        type: 'button',
        class: 'btn small saved-filters-menu__icon-btn',
        'aria-label': label,
        html: (window.SavedFiltersIcons && window.SavedFiltersIcons[icon]) || label,
      });
    }

    openSaveModal() {
      const serialized = this.currentFilter;
      if (!serialized) {
        Craft.cp.displayNotice('Add a filter before saving.');
        return;
      }

      this.showFilterModal({
        name: this.defaultName(),
        shared: false,
        allowApply: true,
        submit: async (name, shared, applyAfter) => {
          const saved = await this.save(serialized, name, shared);
          if (saved && applyAfter) {
            this.applyFromHud(serialized);
          }
          return saved;
        },
      });
    }

    openEditModal(filter) {
      this.close();
      this.showFilterModal({
        name: filter.name,
        shared: filter.shared,
        allowApply: false,
        submit: (name, shared) => this.update(filter.id, name, shared),
        onClosed: () => this.open(),
      });
    }

    showFilterModal({name, shared, allowApply, submit, onClosed}) {
      const inputId = 'saved-filters-name-' + Math.floor(Math.random() * 1e9);
      const $form = $('<form/>', {class: 'modal fitted saved-filters-modal'});
      const $body = $('<div/>', {class: 'body'}).appendTo($form);
      const $field = $('<div/>', {class: 'field'}).appendTo($body);
      $('<div/>', {class: 'heading'}).append($('<label/>', {for: inputId, text: 'Name'})).appendTo($field);
      const $name = $('<input/>', {
        type: 'text',
        id: inputId,
        class: 'text fullwidth',
        maxlength: 255,
        autocomplete: 'off',
        value: name,
      });
      $('<div/>', {class: 'input ltr'}).append($name).appendTo($field);

      let $share = null;
      if (window.SavedFiltersConfig && window.SavedFiltersConfig.canShare) {
        const shareId = inputId + '-share';
        $share = $('<input/>', {type: 'checkbox', id: shareId, class: 'checkbox', checked: !!shared});
        $('<div/>', {class: 'field checkboxfield'})
          .append($('<div/>', {class: 'input ltr'}).append($share).append($('<label/>', {for: shareId, text: 'Share with all users'})))
          .appendTo($body);
      }

      const $buttons = $('<div/>', {class: 'saved-filters-modal__buttons'}).appendTo($body);
      const $cancel = $('<button/>', {type: 'button', class: 'btn', text: 'Cancel'}).appendTo($buttons);
      const $save = $('<button/>', {type: 'submit', class: 'btn' + (allowApply ? '' : ' secondary'), text: 'Save'}).appendTo($buttons);
      const $saveApply = allowApply
        ? $('<button/>', {type: 'button', class: 'btn secondary', text: 'Save & apply'}).appendTo($buttons)
        : null;

      const modal = new Garnish.Modal($form, {
        onFadeOut: () => {
          modal.destroy();
          $form.remove();
          if (onClosed) {
            onClosed();
          }
        },
      });

      const run = async (applyAfter) => {
        $buttons.find('button').prop('disabled', true);
        const ok = await submit($name.val().trim(), $share ? $share.prop('checked') : false, applyAfter);
        if (ok) {
          modal.hide();
        } else {
          $buttons.find('button').prop('disabled', false);
        }
      };

      $cancel.on('click', () => modal.hide());
      if ($saveApply) {
        $saveApply.on('click', () => run(true));
      }
      $form.on('submit', (event) => {
        event.preventDefault();
        run(false);
      });

      setTimeout(() => $name.trigger('focus').trigger('select'), 50);
    }

    async update(id, name, shared) {
      try {
        await Craft.sendActionRequest('POST', ACTION_PREFIX + 'update', {data: {id, name, shared: shared ? 1 : 0}});
      } catch (error) {
        Craft.cp.displayError(this.errorMessage(error));
        return false;
      }
      await this.loadSavedKeys();
      return true;
    }

    defaultName() {
      const sourceLabel = this.index.getSourceLabel ? this.index.getSourceLabel() : null;
      const date = new Date().toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'});
      return (sourceLabel ? sourceLabel + ' – ' : '') + date;
    }

    async save(serialized, name, shared) {
      let result;
      try {
        const response = await Craft.sendActionRequest('POST', ACTION_PREFIX + 'save', {
          data: {
            elementType: this.index.elementType,
            sourceKey: this.index.sourceKey,
            name,
            serialized,
            shared: shared ? 1 : 0,
          },
        });
        result = response.data;
      } catch (error) {
        Craft.cp.displayError(this.errorMessage(error));
        return false;
      }

      if (result.duplicate) {
        Craft.cp.displayNotice('This filter is already saved.');
      } else {
        this.newFilterId = result.id;
        this.popDot();
      }
      await this.loadSavedKeys();
      return true;
    }

    applyFromHud(serialized) {
      const hud = this.hud;
      if (hud && hud.showing && hud.serialize() === serialized) {
        hud.hide();
      } else {
        this.apply(serialized);
      }
    }

    popDot() {
      this.$dot.removeClass('is-popping');
      void this.$dot[0].offsetWidth;
      this.$dot.addClass('is-popping');
    }

    async remove(id) {
      try {
        await Craft.sendActionRequest('POST', ACTION_PREFIX + 'delete', {data: {id}});
      } catch (error) {
        Craft.cp.displayError(this.errorMessage(error));
        return;
      }
      await this.refresh();
    }

    apply(serialized) {
      const existing = this.hud;
      if (existing) {
        existing.destroy();
      }
      this.index.createFilterHud({showOnInit: false, serialized});
      this.index.updateElements();
      this.close();
    }

    errorMessage(error) {
      return (error && error.response && error.response.data && error.response.data.message) || 'Something went wrong.';
    }
  }

  $(function () {
    whenIndexReady((index) => new SavedFiltersMenu(index));
  });
})(jQuery);
