<?php

namespace zesda\savedfilters\migrations;

use craft\db\Migration;
use craft\db\Table;

class Install extends Migration
{
    public function safeUp(): bool
    {
        $this->createTable('{{%savedfilters}}', [
            'id' => $this->primaryKey(),
            'userId' => $this->integer()->notNull(),
            'elementType' => $this->string()->notNull(),
            'sourceKey' => $this->string()->notNull(),
            'name' => $this->string()->notNull(),
            'serialized' => $this->text()->notNull(),
            'isShared' => $this->boolean()->notNull()->defaultValue(false),
            'dateCreated' => $this->dateTime()->notNull(),
            'dateUpdated' => $this->dateTime()->notNull(),
            'uid' => $this->uid(),
        ]);

        $this->createIndex(null, '{{%savedfilters}}', ['elementType', 'sourceKey'], false);
        $this->addForeignKey(null, '{{%savedfilters}}', ['userId'], Table::USERS, ['id'], 'CASCADE');

        return true;
    }

    public function safeDown(): bool
    {
        $this->dropTableIfExists('{{%savedfilters}}');

        return true;
    }
}
