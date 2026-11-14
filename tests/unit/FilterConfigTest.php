<?php

namespace zesda\savedfilters\tests\unit;

use PHPUnit\Framework\TestCase;
use zesda\savedfilters\FilterConfig;

class FilterConfigTest extends TestCase
{
    private function serialize(array $params): string
    {
        return http_build_query($params);
    }

    public function testParseReturnsTheConditionConfig(): void
    {
        $config = FilterConfig::parse($this->serialize([
            'condition' => ['class' => 'EntryCondition', 'conditionRules' => [['class' => 'SlugRule']]],
        ]));

        $this->assertSame('EntryCondition', $config['class']);
        $this->assertCount(1, $config['conditionRules']);
    }

    public function testParseReturnsNullWithoutACondition(): void
    {
        $this->assertNull(FilterConfig::parse(''));
        $this->assertNull(FilterConfig::parse('foo=bar'));
    }

    public function testParseReturnsNullWhenTheConditionIsNotAnArray(): void
    {
        $this->assertNull(FilterConfig::parse('condition=oops'));
    }

    public function testCountRulesCountsEveryRule(): void
    {
        $serialized = $this->serialize([
            'condition' => ['conditionRules' => ['a1' => ['class' => 'X'], 'b2' => ['class' => 'Y'], 'c3' => ['class' => 'Z']]],
        ]);

        $this->assertSame(3, FilterConfig::countRules($serialized));
    }

    public function testCountRulesIsZeroWithoutRules(): void
    {
        $this->assertSame(0, FilterConfig::countRules($this->serialize(['condition' => ['class' => 'EntryCondition']])));
        $this->assertSame(0, FilterConfig::countRules(''));
    }

    public function testCountRulesIsZeroWhenRulesAreNotAnArray(): void
    {
        $this->assertSame(0, FilterConfig::countRules('condition[conditionRules]=oops'));
    }

    public function testCountRulesReadsABrowserSerializedFilter(): void
    {
        $serialized = 'condition%5Bclass%5D=craft%5Celements%5Cconditions%5Centries%5CEntryCondition'
            . '&condition%5BconditionRules%5D%5B1%5D%5Buid%5D=64e50526'
            . '&condition%5BconditionRules%5D%5B1%5D%5Bclass%5D=craft%5Celements%5Cconditions%5Centries%5CAuthorConditionRule'
            . '&condition%5BconditionRules%5D%5B2%5D%5Bclass%5D=craft%5Celements%5Cconditions%5Centries%5CSlugConditionRule';

        $this->assertSame(2, FilterConfig::countRules($serialized));
    }
}
