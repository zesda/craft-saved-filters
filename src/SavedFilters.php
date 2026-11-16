<?php

namespace zesda\savedfilters;

use Craft;
use craft\base\Plugin;
use craft\events\CategoryGroupEvent;
use craft\events\ConfigEvent;
use craft\events\RegisterUserPermissionsEvent;
use craft\events\SectionEvent;
use craft\events\TagGroupEvent;
use craft\events\UserGroupEvent;
use craft\events\VolumeEvent;
use craft\helpers\Html;
use craft\models\Section;
use craft\services\Categories;
use craft\services\Entries;
use craft\services\ProjectConfig;
use craft\services\Tags;
use craft\services\UserGroups;
use craft\services\UserPermissions;
use craft\services\Volumes;
use craft\web\View;
use yii\base\Event;
use zesda\savedfilters\records\SavedFilter;
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
                'heading' => Craft::t('saved-filters', 'Saved Filters'),
                'permissions' => [
                    self::PERMISSION_VIEW_SHARED => [
                        'label' => Craft::t('saved-filters', 'View shared filters'),
                        'info' => Craft::t('saved-filters', 'Apply filters that other users have shared. Everyone can manage their own filters.'),
                        'nested' => [
                            self::PERMISSION_CREATE_SHARED => [
                                'label' => Craft::t('saved-filters', 'Create shared filters'),
                            ],
                            self::PERMISSION_EDIT_SHARED => [
                                'label' => Craft::t('saved-filters', 'Edit filters shared by other users'),
                            ],
                            self::PERMISSION_DELETE_SHARED => [
                                'label' => Craft::t('saved-filters', 'Delete filters shared by other users'),
                            ],
                        ],
                    ],
                ],
            ];
        });

        $this->registerSourceCleanup();

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
                    'warning' => Html::svg(Craft::getAlias('@app/icons/solid/triangle-exclamation.svg')),
                ]);
                $view->registerJsVar('SavedFiltersConfig', [
                    'canShare' => $user->checkPermission(self::PERMISSION_CREATE_SHARED),
                ]);
                $view->registerAssetBundle(SavedFiltersAsset::class);
            }
        });
    }

    private function registerSourceCleanup(): void
    {
        Event::on(Entries::class, Entries::EVENT_AFTER_DELETE_SECTION, function(SectionEvent $event) {
            if ($event->section->type !== Section::TYPE_SINGLE) {
                $this->deleteForSource('section:' . $event->section->uid);
            }
        });
        Event::on(Volumes::class, Volumes::EVENT_AFTER_DELETE_VOLUME, function(VolumeEvent $event) {
            $this->deleteForSource('volume:' . $event->volume->uid);
        });
        Event::on(Categories::class, Categories::EVENT_AFTER_DELETE_GROUP, function(CategoryGroupEvent $event) {
            $this->deleteForSource('group:' . $event->categoryGroup->uid);
        });
        Event::on(Tags::class, Tags::EVENT_AFTER_DELETE_GROUP, function(TagGroupEvent $event) {
            $this->deleteForSource('taggroup:' . $event->tagGroup->uid);
        });
        Event::on(UserGroups::class, UserGroups::EVENT_AFTER_DELETE_USER_GROUP, function(UserGroupEvent $event) {
            $this->deleteForSource('group:' . $event->userGroup->uid);
        });

        $projectConfig = Craft::$app->getProjectConfig();
        $projectConfig->onUpdate(ProjectConfig::PATH_ELEMENT_SOURCES, [$this, 'handleElementSourcesChange']);
        $projectConfig->onRemove(ProjectConfig::PATH_ELEMENT_SOURCES, [$this, 'handleElementSourcesChange']);
    }

    public function handleElementSourcesChange(ConfigEvent $event): void
    {
        $keys = fn($sources) => array_column(is_array($sources) ? $sources : [], 'key');
        $old = is_array($event->oldValue) ? $event->oldValue : [];
        $new = is_array($event->newValue) ? $event->newValue : [];

        foreach ($old as $elementType => $sources) {
            foreach (array_diff($keys($sources), $keys($new[$elementType] ?? [])) as $key) {
                if (is_string($key) && str_starts_with($key, 'custom:')) {
                    $this->deleteForSource($key);
                }
            }
        }
    }

    private function deleteForSource(string $sourceKey): void
    {
        SavedFilter::deleteAll(['or', ['sourceKey' => $sourceKey], ['like', 'sourceKey', $sourceKey . '/%', false]]);
    }
}
