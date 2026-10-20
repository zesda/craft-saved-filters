# Saved Filters for Craft CMS

Save and reapply element index filters in the Craft control panel.

A bookmark button sits beside the filter button on every element index page. Filters are saved per element type and source (section), so each one only appears where it was created.

## Requirements

- Craft CMS 5.0 or later
- PHP 8.2 or later

## Installation

```bash
composer require zesda/craft-saved-filters
php craft plugin/install saved-filters
```

## Usage

- Build a filter, then click **Save** next to **Apply** in the filter panel. Name it, then choose **Save** or **Save & apply**.
- Open the bookmark button to apply, edit or delete saved filters for the current source. A dot marks a filter you've just saved.
- Admins can share a filter with all users. Shared filters show a two-person icon and can be unshared from the edit modal.
- On narrow screens the saved filters dropdown becomes a centred modal, matching Craft's own filter dropdown.

Filters are private to their owner. Owners and admins can edit or delete a filter.

## Notes

The button script relies on Craft's element index JavaScript (`Craft.elementIndex`, `createFilterHud`), which isn't a public API, and may need adjusting after Craft upgrades. If those globals aren't present the plugin does nothing.
