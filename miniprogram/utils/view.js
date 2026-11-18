const labels = { PENDING: '待确认', CONFIRMED: '已确认', DISPUTED: '待沟通', REVERSED: '已抵销' };
const money = (value) => '¥' + (value / 100).toFixed(2);
function localTime(value) {
  return new Date(new Date(value).getTime() + 8 * 3600000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');
}
function eventView(event, asset) {
  return {
    ...event,
    statusText: labels[event.status],
    timeText: localTime(event.occurredAt),
    moneyText: money(event.impact.money),
    showMoney: asset !== 'POINTS',
    showPoints: asset !== 'MONEY',
  };
}
function summaryView(item) {
  return { ...item, statusText: item.postedAt ? '已入账' : '待核对' };
}
function typeDescription(code, rules) {
  const custom = rules.custom[code];
  if (custom) return money(custom.money) + ' / ' + custom.points + ' 积分 / 次';
  const descriptions = {
    SCHOOL:
      'A+ 奖励 ' +
      money(rules.school['A+']) +
      '，A 奖励 ' +
      money(rules.school.A) +
      '，B ' +
      money(rules.school.B) +
      '，C ' +
      money(rules.school.C),
    BASIC: rules.basic.high + ' 分起奖励；低于 ' + rules.basic.low + ' 分扣减',
    ADVANCED: rules.advanced.high + ' 分起奖励；低于 ' + rules.advanced.low + ' 分扣减',
    SHOUT: money(rules.shout) + ' / 次，需选择对象',
    CRY: money(rules.cry) + ' / 次，影响无哭泣奖励',
    DICTATION: '+' + rules.dictation + ' 积分 / 次',
    CHORE: '+' + rules.chore + ' 积分，每天最多一次',
    SKIP: rules.skip + ' 积分，自然月一次，须有足够已结算积分',
  };
  return descriptions[code];
}
module.exports = { money, localTime, eventView, summaryView, typeDescription };
