<?php

namespace zesda\savedfilters\tests\unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use zesda\savedfilters\FilterAccess;
use zesda\savedfilters\SavedFilters;

class FilterAccessTest extends TestCase
{
    private const ME = 1;
    private const OTHER = 2;

    /**
     * @param string[] $permissions
     */
    private function access(array $permissions = []): FilterAccess
    {
        return new FilterAccess(self::ME, fn(string $permission) => in_array($permission, $permissions, true));
    }

    public function testViewingSharedFiltersNeedsThePermission(): void
    {
        $this->assertFalse($this->access()->canViewShared());
        $this->assertTrue($this->access([SavedFilters::PERMISSION_VIEW_SHARED])->canViewShared());
    }

    public function testSharingNeedsThePermission(): void
    {
        $this->assertFalse($this->access()->canShare());
        $this->assertFalse($this->access([SavedFilters::PERMISSION_VIEW_SHARED])->canShare());
        $this->assertTrue($this->access([SavedFilters::PERMISSION_CREATE_SHARED])->canShare());
    }

    public function testOwnersManageTheirOwnFiltersWithoutPermissions(): void
    {
        foreach ([true, false] as $isShared) {
            $this->assertTrue($this->access()->isOwner(self::ME));
            $this->assertTrue($this->access()->canEdit(self::ME, $isShared));
            $this->assertTrue($this->access()->canDelete(self::ME, $isShared));
        }
    }

    public function testOthersCannotTouchAnotherUsersFilterWithoutPermissions(): void
    {
        $this->assertFalse($this->access()->isOwner(self::OTHER));
        $this->assertFalse($this->access()->canEdit(self::OTHER, true));
        $this->assertFalse($this->access()->canDelete(self::OTHER, true));
    }

    public function testViewingSharedFiltersDoesNotAllowEditingOrDeleting(): void
    {
        $access = $this->access([SavedFilters::PERMISSION_VIEW_SHARED]);

        $this->assertFalse($access->canEdit(self::OTHER, true));
        $this->assertFalse($access->canDelete(self::OTHER, true));
    }

    public function testEditAndDeleteArePermissionedSeparately(): void
    {
        $editOnly = $this->access([SavedFilters::PERMISSION_EDIT_SHARED]);
        $this->assertTrue($editOnly->canEdit(self::OTHER, true));
        $this->assertFalse($editOnly->canDelete(self::OTHER, true));

        $deleteOnly = $this->access([SavedFilters::PERMISSION_DELETE_SHARED]);
        $this->assertFalse($deleteOnly->canEdit(self::OTHER, true));
        $this->assertTrue($deleteOnly->canDelete(self::OTHER, true));
    }

    #[DataProvider('everyPermission')]
    public function testPermissionsNeverReachAnotherUsersPrivateFilter(string $permission): void
    {
        $access = $this->access([$permission]);

        $this->assertFalse($access->canEdit(self::OTHER, false));
        $this->assertFalse($access->canDelete(self::OTHER, false));
    }

    public function testAllPermissionsTogetherStillExcludePrivateFilters(): void
    {
        $access = $this->access([
            SavedFilters::PERMISSION_VIEW_SHARED,
            SavedFilters::PERMISSION_CREATE_SHARED,
            SavedFilters::PERMISSION_EDIT_SHARED,
            SavedFilters::PERMISSION_DELETE_SHARED,
        ]);

        $this->assertTrue($access->canEdit(self::OTHER, true));
        $this->assertTrue($access->canDelete(self::OTHER, true));
        $this->assertFalse($access->canEdit(self::OTHER, false));
        $this->assertFalse($access->canDelete(self::OTHER, false));
    }

    /**
     * @return array<string, array{string}>
     */
    public static function everyPermission(): array
    {
        return [
            'view' => [SavedFilters::PERMISSION_VIEW_SHARED],
            'create' => [SavedFilters::PERMISSION_CREATE_SHARED],
            'edit' => [SavedFilters::PERMISSION_EDIT_SHARED],
            'delete' => [SavedFilters::PERMISSION_DELETE_SHARED],
        ];
    }
}
