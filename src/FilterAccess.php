<?php

namespace zesda\savedfilters;

use Closure;

/**
 * Decides what a user may do with saved filters. Everyone manages their own
 * filters; permissions only govern filters that other users have shared.
 */
final class FilterAccess
{
    /**
     * @param Closure(string): bool $can Whether the user holds a permission.
     */
    public function __construct(
        private readonly int $userId,
        private readonly Closure $can,
    ) {
    }

    public function canViewShared(): bool
    {
        return ($this->can)(SavedFilters::PERMISSION_VIEW_SHARED);
    }

    public function canShare(): bool
    {
        return ($this->can)(SavedFilters::PERMISSION_CREATE_SHARED);
    }

    public function isOwner(int $ownerId): bool
    {
        return $ownerId === $this->userId;
    }

    public function canEdit(int $ownerId, bool $isShared): bool
    {
        return $this->isOwner($ownerId) || ($isShared && ($this->can)(SavedFilters::PERMISSION_EDIT_SHARED));
    }

    public function canDelete(int $ownerId, bool $isShared): bool
    {
        return $this->isOwner($ownerId) || ($isShared && ($this->can)(SavedFilters::PERMISSION_DELETE_SHARED));
    }
}
