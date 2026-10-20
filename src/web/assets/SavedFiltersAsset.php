<?php

namespace zesda\savedfilters\web\assets;

use craft\web\AssetBundle;
use craft\web\assets\cp\CpAsset;

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
}
