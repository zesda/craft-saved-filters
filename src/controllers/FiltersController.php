<?php

namespace zesda\savedfilters\controllers;

use Craft;
use craft\base\ElementInterface;
use craft\elements\conditions\ElementConditionInterface;
use craft\helpers\Component;
use craft\web\Controller;
use zesda\savedfilters\records\SavedFilter;
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
            ->andWhere(['or', ['userId' => $user->id], ['isShared' => true]])
            ->orderBy(['name' => SORT_ASC])
            ->all();

        return $this->asJson([
            'canShare' => $user->admin,
            'filters' => array_map(fn(SavedFilter $record) => [
                'id' => $record->id,
                'name' => $record->name,
                'serialized' => $record->serialized,
                'shared' => (bool)$record->isShared,
                'canEdit' => $this->canModify($record),
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
        $shared = $user->admin && (bool)$this->request->getBodyParam('shared');
        $elementType = $this->validElementType((string)$this->request->getRequiredBodyParam('elementType'));
        $sourceKey = (string)$this->request->getRequiredBodyParam('sourceKey');

        if (mb_strlen($name) > 255) {
            throw new BadRequestHttpException('Name must be 255 characters or fewer.');
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
            'name' => $name !== '' ? $name : 'Filter ' . date('j M Y H:i'),
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
            throw new NotFoundHttpException('Saved filter not found.');
        }
        if (!$this->canModify($record)) {
            throw new ForbiddenHttpException('Not allowed to edit this filter.');
        }

        $name = trim((string)$this->request->getRequiredBodyParam('name'));
        if ($name === '' || mb_strlen($name) > 255) {
            throw new BadRequestHttpException('Name must be between 1 and 255 characters.');
        }

        $record->name = $name;
        if (Craft::$app->getUser()->getIdentity()->admin) {
            $record->isShared = (bool)$this->request->getBodyParam('shared');
        }
        $record->save();

        return $this->asSuccess('Filter updated.');
    }

    public function actionDelete(): Response
    {
        $this->requirePostRequest();
        $this->requireAcceptsJson();

        $record = SavedFilter::findOne((int)$this->request->getRequiredBodyParam('id'));
        if (!$record) {
            throw new NotFoundHttpException('Saved filter not found.');
        }
        if (!$this->canModify($record)) {
            throw new ForbiddenHttpException('Not allowed to delete this filter.');
        }

        $record->delete();

        return $this->asSuccess('Filter deleted.');
    }

    private function canModify(SavedFilter $record): bool
    {
        $user = Craft::$app->getUser()->getIdentity();

        return $user->admin || (int)$record->userId === (int)$user->id;
    }

    private function validElementType(string $elementType): string
    {
        if (!is_subclass_of($elementType, ElementInterface::class)) {
            throw new BadRequestHttpException('Invalid element type.');
        }

        return $elementType;
    }

    private function assertValidFilter(string $serialized): void
    {
        if ($serialized === '' || strlen($serialized) > self::MAX_SERIALIZED_LENGTH) {
            throw new BadRequestHttpException('Invalid filter.');
        }

        parse_str($serialized, $params);
        $config = $params['condition'] ?? null;
        if (!is_array($config)) {
            throw new BadRequestHttpException('Invalid filter.');
        }

        try {
            $condition = Craft::$app->getConditions()->createCondition(Component::cleanseConfig($config));
        } catch (\Throwable) {
            throw new BadRequestHttpException('Invalid filter.');
        }

        if (!$condition instanceof ElementConditionInterface) {
            throw new BadRequestHttpException('Invalid filter.');
        }
    }
}
