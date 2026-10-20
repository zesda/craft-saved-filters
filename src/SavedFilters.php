<?php

namespace zesda\savedfilters;

use Craft;
use craft\base\Plugin;
use craft\helpers\Html;
use craft\web\View;
use yii\base\Event;
use zesda\savedfilters\web\assets\SavedFiltersAsset;

class SavedFilters extends Plugin
{
    public string $schemaVersion = '1.0.0';
    public bool $hasCpSection = false;
    public bool $hasCpSettings = false;

    public function init(): void
    {
        parent::init();

        $request = Craft::$app->getRequest();
        if ($request->getIsConsoleRequest() || !$request->getIsCpRequest()) {
            return;
        }

        Event::on(View::class, View::EVENT_BEFORE_RENDER_PAGE_TEMPLATE, function() {
            if (Craft::$app->getUser()->getIdentity()) {
                $view = Craft::$app->getView();
                $view->registerJsVar('SavedFiltersIcons', [
                    'edit' => Html::svg(Craft::getAlias('@app/icons/solid/pencil.svg')),
                    'shared' => Html::svg(Craft::getAlias('@app/icons/solid/user-group.svg')),
                    'delete' => Html::svg(Craft::getAlias('@app/icons/solid/trash.svg')),
                ]);
                $view->registerJsVar('SavedFiltersConfig', [
                    'canShare' => (bool)Craft::$app->getUser()->getIdentity()->admin,
                ]);
                $view->registerAssetBundle(SavedFiltersAsset::class);
            }
        });
    }
}
