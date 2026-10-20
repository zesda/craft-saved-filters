<?php

namespace zesda\savedfilters\records;

use craft\db\ActiveRecord;

/**
 * @property int    $id
 * @property int    $userId
 * @property string $elementType
 * @property string $sourceKey
 * @property string $name
 * @property string $serialized
 * @property bool   $isShared
 */
class SavedFilter extends ActiveRecord
{
    public static function tableName(): string
    {
        return '{{%savedfilters}}';
    }
}
