/**
 * @btc/shared - Money Precision Handling
 * 
 * Unified money handling across frontend and backend using BigNumber.js
 * to avoid floating point precision issues in crypto/financial calculations
 */

import BigNumber from 'bignumber.js';

// Configure BigNumber globally for crypto precision
BigNumber.config({
    DECIMAL_PLACES: 18,
    ROUNDING_MODE: BigNumber.ROUND_DOWN,
    EXPONENTIAL_AT: [-18, 20],
    FORMAT: {
        decimalSeparator: '.',
        groupSeparator: ',',
        groupSize: 3,
    }
});

export class Money {
    private value: BigNumber;

    constructor(value: string | number | BigNumber) {
        this.value = new BigNumber(value);
        if (!this.value.isFinite()) {
            throw new Error(`Invalid money value: ${value}`);
        }
    }

    /**
     * Add two Money values
     */
    add(other: Money): Money {
        return new Money(this.value.plus(other.value));
    }

    /**
     * Subtract two Money values
     */
    subtract(other: Money): Money {
        return new Money(this.value.minus(other.value));
    }

    /**
     * Multiply by a number (for fee calculations, etc)
     */
    multiply(multiplier: string | number): Money {
        return new Money(this.value.multipliedBy(multiplier));
    }

    /**
     * Divide by a number
     */
    divide(divisor: string | number): Money {
        return new Money(this.value.dividedBy(divisor));
    }

    /**
     * Check if value is greater than another
     */
    isGreaterThan(other: Money): boolean {
        return this.value.isGreaterThan(other.value);
    }

    /**
     * Check if value is less than another
     */
    isLessThan(other: Money): boolean {
        return this.value.isLessThan(other.value);
    }

    /**
     * Check if value equals another
     */
    equals(other: Money): boolean {
        return this.value.isEqualTo(other.value);
    }

    /**
     * Check if value is greater than or equal to another
     */
    isGreaterThanOrEqual(other: Money): boolean {
        return this.value.isGreaterThanOrEqualTo(other.value);
    }

    /**
     * Check if value is zero
     */
    isZero(): boolean {
        return this.value.isZero();
    }

    /**
     * Check if value is positive
     */
    isPositive(): boolean {
        return this.value.isPositive();
    }

    /**
     * Check if value is negative
     */
    isNegative(): boolean {
        return this.value.isNegative();
    }

    /**
     * Get absolute value
     */
    abs(): Money {
        return new Money(this.value.abs());
    }

    /**
     * Format as string with specified decimal places
     */
    toFixed(decimals: number = 8): string {
        return this.value.toFixed(decimals);
    }

    /**
     * Format for display (with thousand separators)
     */
    toFormat(decimals: number = 8): string {
        return this.value.toFormat(decimals);
    }

    /**
     * Get raw string value (full precision)
     */
    toString(): string {
        return this.value.toString();
    }

    /**
     * Get numeric value (warning: may lose precision for large numbers)
     */
    toNumber(): number {
        return this.value.toNumber();
    }

    /**
     * Get BigNumber value (for advanced operations)
     */
    toBigNumber(): BigNumber {
        return this.value;
    }

    /**
     * Create Money from database string
     */
    static fromDB(dbValue: string | null | undefined): Money {
        return new Money(dbValue || '0');
    }

    /**
     * Format for database storage
     */
    toDB(): string {
        return this.toFixed(8);
    }

    /**
     * Create zero value
     */
    static zero(): Money {
        return new Money(0);
    }

    /**
     * Sum an array of Money values
     */
    static sum(values: Money[]): Money {
        return values.reduce((acc, val) => acc.add(val), Money.zero());
    }
}

/**
 * Format money for display in UI
 */
export function formatMoney(
    value: Money | string | number,
    options: {
        decimals?: number;
        symbol?: string;
        compact?: boolean;
    } = {}
): string {
    const { decimals = 8, symbol = '', compact = false } = options;
    const money = value instanceof Money ? value : new Money(value);

    if (compact) {
        const num = money.toNumber();
        if (num >= 1e9) return `${symbol}${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `${symbol}${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `${symbol}${(num / 1e3).toFixed(2)}K`;
    }

    return `${symbol}${money.toFormat(decimals)}`;
}

/**
 * Calculate percentage change
 */
export function calculatePercentChange(
    oldValue: Money | string | number,
    newValue: Money | string | number
): string {
    const old = oldValue instanceof Money ? oldValue : new Money(oldValue);
    const current = newValue instanceof Money ? newValue : new Money(newValue);

    if (old.isZero()) return '0.00';

    const change = current.subtract(old).divide(old.toString()).multiply('100');
    return change.toFixed(2);
}
