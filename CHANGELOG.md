# Release Notes for Saved Filters

## 1.1.5 - 2026-11-14

- Fixed a filter with several rules not counting as already saved or applied when its rules were in a different order, such as after removing a rule and adding it back.

## 1.1.4 - 2026-11-14

- Moved focus into the saved filters menu when it opens and back to the bookmark button when it closes. Tab now cycles inside the menu when it shows as a modal.
- Set `aria-haspopup="dialog"` on the bookmark button.

## 1.1.3 - 2026-11-14

- Made all interface strings translatable through the `saved-filters` translation category.

## 1.1.2 - 2026-11-14

- Saved filters that use a field that has since been deleted now show a warning in the menu. Their remaining rules still apply, with a notice. A filter with no usable rules can no longer be applied, where before it applied silently and showed every entry.

## 1.1.1 - 2026-11-13

- Saved filters are now deleted when their section, volume, category group, tag group, user group or custom source is deleted.

## 1.1.0 - 2026-11-13

- Added permissions for shared filters: view, share, edit and delete. Sharing was previously admin-only. Non-admin users now need "View shared filters" to see filters shared by others.

## 1.0.0 - 2026-11-13

- Added a bookmark button beside the element index filter button.
- Added saving, applying, editing and deleting of filters per element type and source.
- Added sharing of filters with all users for admins.
- Added a blue dot on the bookmark button when the current source has saved filters.
