<?php

namespace zesda\savedfilters;

/**
 * Reads the condition config out of a serialized element index filter.
 */
final class FilterConfig
{
    /**
     * @return array<string, mixed>|null The condition config, or null when the string holds none.
     */
    public static function parse(string $serialized): ?array
    {
        parse_str($serialized, $params);
        $config = $params['condition'] ?? null;

        return is_array($config) ? $config : null;
    }

    public static function countRules(string $serialized): int
    {
        $rules = self::parse($serialized)['conditionRules'] ?? [];

        return is_array($rules) ? count($rules) : 0;
    }
}
