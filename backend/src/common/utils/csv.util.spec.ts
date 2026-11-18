import { describe, expect, it } from 'vitest';
import { toCsv } from './csv.util.js';

describe('toCsv', () => {
  it('should generate CSV headers and rows', () => {
    expect(toCsv(['Name', 'Price'], [['Mouse', 549]])).toBe(
      'Name,Price\r\nMouse,549',
    );
  });

  it('should escape commas, quotes, and line breaks', () => {
    expect(toCsv(['Name'], [['Mouse, Wireless "Pro"\nEdition']])).toBe(
      'Name\r\n"Mouse, Wireless ""Pro""\nEdition"',
    );
  });

  it.each(['=1+1', '+SUM(A1:A2)', '-1+2', '@SUM(A1:A2)'])(
    'should neutralize formula-like text: %s',
    (value) => {
      expect(toCsv(['Name'], [[value]])).toBe(`Name\r\n'${value}`);
    },
  );

  it('should neutralize formula markers preceded by whitespace', () => {
    expect(toCsv(['Name'], [['  =1+1']])).toBe("Name\r\n'  =1+1");
  });

  it('should preserve numeric values, including negative numbers', () => {
    expect(toCsv(['Quantity', 'Adjustment'], [[10, -5]])).toBe(
      'Quantity,Adjustment\r\n10,-5',
    );
  });

  it('should convert null and undefined values to empty cells', () => {
    expect(toCsv(['Name', 'Description'], [[null, undefined]])).toBe(
      'Name,Description\r\n,',
    );
  });

  it('should escape formula-like headers too', () => {
    expect(toCsv(['=HYPERLINK("example.com")'], [])).toBe(
      `"'=HYPERLINK(""example.com"")"`,
    );
  });
});
