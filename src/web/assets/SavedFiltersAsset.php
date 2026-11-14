<?php

namespace zesda\savedfilters\web\assets;

use craft\web\AssetBundle;
use craft\web\assets\cp\CpAsset;
use craft\web\View;

class SavedFiltersAsset extends AssetBundle
{
    public function init(): void
    {
        $this->sourcePath = __DIR__ . '/dist';
        $this->depends = [CpAsset::class];
        $this->js = ['savedfilters.js'];
        $this->css = ['savedfilters.css'];

        parent::init();
    }

    public function registerAssetFiles($view): void
    {
        parent::registerAssetFiles($view);

        if ($view instanceof View) {
            $view->registerTranslations('saved-filters', [
                'Saved filters',
                'Save',
                'Add a filter to save it',
                'This filter is already saved',
                'No saved filters for this section yet.',
                'Newly saved',
                'Shared with all users',
                'Shared',
                'Applied',
                'Apply',
                'Edit',
                'Delete',
                'This filter can no longer be applied: the fields it uses have been deleted.',
                '{count, plural, =1{# rule is ignored: the field no longer exists.} other{# rules are ignored: the field no longer exists.}}',
                'Add a filter before saving.',
                'Name',
                'Share with all users',
                'Cancel',
                'Save & apply',
                'This filter is already saved.',
                'Something went wrong.',
            ]);
        }
    }
}
