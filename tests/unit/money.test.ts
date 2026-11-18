import { expect, it } from 'vitest';
import { parseMoney, formatMoney } from '../../src/domain/money';
it('金额显示可供表单与服务端共用，保留负号和两位小数', () => {
  expect(formatMoney(-30000)).toBe('-¥300.00');
  expect(formatMoney(125050)).toBe('¥1,250.50');
  expect(formatMoney(0)).toBe('¥0.00');
});
it.each([
  ['12.50', 1250],
  ['-0.01', -1],
  ['0', 0],
  ['100', 10000],
])('金额 %s 按整数分解析', (input, value) => expect(parseMoney(input)).toBe(value));
it.each(['', 'abc', '1.001', '1e3', 'NaN'])('拒绝非法金额 %s', (input) =>
  expect(() => parseMoney(input)).toThrow(),
);
