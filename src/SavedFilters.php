<?php

namespace zesda\savedfilters;

use Craft;
use craft\base\Plugin;
use craft\events\RegisterUserPermissionsEvent;
use craft\helpers\Html;
use craft\services\UserPermissions;
use craft\web\View;
use yii\base\Event;
use zesda\savedfilters\web\assets\SavedFiltersAsset;

class SavedFilters extends Plugin
{
    public string $schemaVersion = '1.0.0';
    public bool $hasCpSection = false;
    public bool $hasCpSettings = false;

    public const PERMISSION_VIEW_SHARED = 'savedFilters:viewShared';
    public const PERMISSION_CREATE_SHARED = 'savedFilters:createShared';
    public const PERMISSION_EDIT_SHARED = 'savedFilters:editShared';
    public const PERMISSION_DELETE_SHARED = 'savedFilters:deleteShared';

    public function init(): void
    {
        parent::init();

        Event::on(UserPermissions::class, UserPermissions::EVENT_REGISTER_PERMISSIONS, function(RegisterUserPermissionsEvent $event) {
            $event->permissions[] = [
                'heading' => 'Saved Filters',
                'permissions' => [
                    self::PERMISSION_VIEW_SHARED => [
                        'label' => 'View shared filters',
                        'info' => 'Apply filters that other users have shared. Everyone can manage their own filters.',
                        'nested' => [
                            self::PERMISSION_CREATE_SHARED => [
                                'label' => 'Create shared filters',
                            ],
                            self::PERMISSION_EDIT_SHARED => [
                                'label' => 'Edit filters shared by other users',
                            ],
                            self::PERMISSION_DELETE_SHARED => [
                                'label' => 'Delete filters shared by other users',
                            ],
                        ],
                    ],
                ],
            ];
        });

        $request = Craft::$app->getRequest();
        if ($request->getIsConsoleRequest() || !$request->getIsCpRequest()) {
            return;
        }

        Event::on(View::class, View::EVENT_BEFORE_RENDER_PAGE_TEMPLATE, function() {
            $user = Craft::$app->getUser();
            if ($user->getIdentity()) {
                $view = Craft::$app->getView();
                $view->registerJsVar('SavedFiltersIcons', [
                    'edit' => Html::svg(Craft::getAlias('@app/icons/solid/pencil.svg')),
                    'shared' => Html::svg(Craft::getAlias('@app/icons/solid/user-group.svg')),
                    'delete' => Html::svg(Craft::getAlias('@app/icons/solid/trash.svg')),
                ]);
                $view->registerJsVar('SavedFiltersConfig', [
                    'canShare' => $user->checkPermission(self::PERMISSION_CREATE_SHARED),
                ]);
                $view->registerAssetBundle(SavedFiltersAsset::class);
            }
        });
    }
}
