<?php

namespace zesda\savedfilters\controllers;

use Craft;
use craft\base\ElementInterface;
use craft\elements\conditions\ElementConditionInterface;
use craft\helpers\Component;
use craft\web\Controller;
use zesda\savedfilters\FilterAccess;
use zesda\savedfilters\FilterConfig;
use zesda\savedfilters\records\SavedFilter;
use yii\base\InvalidConfigException;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;
use yii\web\Response;

class FiltersController extends Controller
{
    private const MAX_SERIALIZED_LENGTH = 65000;

    public function beforeAction($action): bool
    {
        if (!parent::beforeAction($action)) {
            return false;
        }

        $this->requireCpRequest();
        $this->requireLogin();

        return true;
    }

    public function actionList(): Response
    {
        $this->requireAcceptsJson();

        $elementType = $this->validElementType((string)$this->request->getRequiredParam('elementType'));
        $sourceKey = (string)$this->request->getRequiredParam('sourceKey');
        $user = Craft::$app->getUser()->getIdentity();

        $records = SavedFilter::find()
            ->where(['elementType' => $elementType, 'sourceKey' => $sourceKey])
            ->andWhere($this->canViewShared()
                ? ['or', ['userId' => $user->id], ['isShared' => true]]
                : ['userId' => $user->id])
            ->orderBy(['name' => SORT_ASC])
            ->all();

        return $this->asJson([
            'canShare' => $this->canShare(),
            'filters' => array_map(fn(SavedFilter $record) => [
                'id' => $record->id,
                'name' => $record->name,
                'serialized' => $record->serialized,
                'ignoredRules' => $this->countIgnoredRules($record),
                'totalRules' => FilterConfig::countRules($record->serialized),
                'shared' => (bool)$record->isShared,
                'canEdit' => $this->canEdit($record),
                'canDelete' => $this->canDelete($record),
            ], $records),
        ]);
    }

    public function actionSave(): Response
    {
        $this->requirePostRequest();
        $this->requireAcceptsJson();

        $user = Craft::$app->getUser()->getIdentity();
        $name = trim((string)$this->request->getBodyParam('name'));
        $serialized = (string)$this->request->getRequiredBodyParam('serialized');
        $shared = $this->canShare() && (bool)$this->request->getBodyParam('shared');
        $elementType = $this->validElementType((string)$this->request->getRequiredBodyParam('elementType'));
        $sourceKey = (string)$this->request->getRequiredBodyParam('sourceKey');

        if (mb_strlen($name) > 255) {
            throw new BadRequestHttpException(Craft::t('saved-filters', 'Name must be 255 characters or fewer.'));
        }

        $this->assertValidFilter($serialized);

        $existing = SavedFilter::findOne([
            'userId' => $user->id,
            'elementType' => $elementType,
            'sourceKey' => $sourceKey,
            'serialized' => $serialized,
        ]);
        if ($existing) {
            if ($shared && !$existing->isShared) {
                $existing->isShared = true;
                $existing->save();

                return $this->asJson(['id' => $existing->id, 'duplicate' => false]);
            }

            return $this->asJson(['id' => $existing->id, 'duplicate' => true]);
        }

        $record = new SavedFilter([
            'userId' => $user->id,
            'elementType' => $elementType,
            'sourceKey' => $sourceKey,
            'name' => $name !== '' ? $name : Craft::t('saved-filters', 'Filter {date}', ['date' => date('j M Y H:i')]),
            'serialized' => $serialized,
            'isShared' => $shared,
        ]);
        $record->save();

        return $this->asJson(['id' => $record->id, 'duplicate' => false]);
    }

    public function actionUpdate(): Response
    {
        $this->requirePostRequest();
        $this->requireAcceptsJson();

        $record = SavedFilter::findOne((int)$this->request->getRequiredBodyParam('id'));
        if (!$record) {
            throw new NotFoundHttpException(Craft::t('saved-filters', 'Saved filter not found.'));
        }
        if (!$this->canEdit($record)) {
            throw new ForbiddenHttpException(Craft::t('saved-filters', 'Not allowed to edit this filter.'));
        }

        $name = trim((string)$this->request->getRequiredBodyParam('name'));
        if ($name === '' || mb_strlen($name) > 255) {
            throw new BadRequestHttpException(Craft::t('saved-filters', 'Name must be between 1 and 255 characters.'));
        }

        $record->name = $name;
        $sharedParam = $this->request->getBodyParam('shared');
        if ($sharedParam !== null && $this->canShare()) {
            $record->isShared = (bool)$sharedParam;
        }
        $record->save();

        return $this->asSuccess(Craft::t('saved-filters', 'Filter updated.'));
    }

    public function actionDelete(): Response
    {
        $this->requirePostRequest();
        $this->requireAcceptsJson();

        $record = SavedFilter::findOne((int)$this->request->getRequiredBodyParam('id'));
        if (!$record) {
            throw new NotFoundHttpException(Craft::t('saved-filters', 'Saved filter not found.'));
        }
        if (!$this->canDelete($record)) {
            throw new ForbiddenHttpException(Craft::t('saved-filters', 'Not allowed to delete this filter.'));
        }

        $record->delete();

        return $this->asSuccess(Craft::t('saved-filters', 'Filter deleted.'));
    }

    private function access(): FilterAccess
    {
        $user = Craft::$app->getUser();

        return new FilterAccess((int)$user->getId(), fn(string $permission) => $user->checkPermission($permission));
    }

    private function canShare(): bool
    {
        return $this->access()->canShare();
    }

    private function canViewShared(): bool
    {
        return $this->access()->canViewShared();
    }

    private function canEdit(SavedFilter $record): bool
    {
        return $this->access()->canEdit((int)$record->userId, (bool)$record->isShared);
    }

    private function canDelete(SavedFilter $record): bool
    {
        return $this->access()->canDelete((int)$record->userId, (bool)$record->isShared);
    }

    private function validElementType(string $elementType): string
    {
        if (!is_subclass_of($elementType, ElementInterface::class)) {
            throw new BadRequestHttpException(Craft::t('saved-filters', 'Invalid element type.'));
        }

        return $elementType;
    }

    private function countIgnoredRules(SavedFilter $record): int
    {
        $config = FilterConfig::parse($record->serialized);
        if ($config === null) {
            return 0;
        }

        $total = FilterConfig::countRules($record->serialized);

        try {
            $condition = Craft::$app->getConditions()->createCondition(Component::cleanseConfig($config));
        } catch (\Throwable) {
            return $total;
        }

        if (!$condition instanceof ElementConditionInterface || !is_subclass_of($record->elementType, ElementInterface::class)) {
            return 0;
        }

        $rules = $condition->getConditionRules();
        $ignored = max(0, $total - count($rules));

        foreach ($rules as $rule) {
            try {
                $rule->modifyQuery($record->elementType::find());
            } catch (InvalidConfigException) {
                $ignored++;
            }
        }

        return $ignored;
    }

    private function assertValidFilter(string $serialized): void
    {
        if ($serialized === '' || strlen($serialized) > self::MAX_SERIALIZED_LENGTH) {
            throw new BadRequestHttpException(Craft::t('saved-filters', 'Invalid filter.'));
        }

        $config = FilterConfig::parse($serialized);
        if ($config === null) {
            throw new BadRequestHttpException(Craft::t('saved-filters', 'Invalid filter.'));
        }

        try {
            $condition = Craft::$app->getConditions()->createCondition(Component::cleanseConfig($config));
        } catch (\Throwable) {
            throw new BadRequestHttpException(Craft::t('saved-filters', 'Invalid filter.'));
        }

        if (!$condition instanceof ElementConditionInterface) {
            throw new BadRequestHttpException(Craft::t('saved-filters', 'Invalid filter.'));
        }
    }
}
