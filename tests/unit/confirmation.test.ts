import { describe, expect, it } from 'vitest';
import { confirmationState } from '../../src/domain/confirmation';
const base = { subjectId: 'ellie', creatorId: 'dad', adminIds: ['dad', 'mom'] };
describe('本人和任一管理员确认，创建即确认', () => {
  it('管理员创建仅等待本人，另一管理员不能代替本人', () => {
    expect(confirmationState(base, []).status).toBe('PENDING');
    expect(confirmationState(base, [{ actorId: 'mom', decision: 'CONFIRM' }]).status).toBe(
      'PENDING',
    );
    expect(confirmationState(base, [{ actorId: 'ellie', decision: 'CONFIRM' }])).toMatchObject({
      status: 'CONFIRMED',
      approvedIds: ['dad', 'ellie'],
    });
  });
  it('本人创建后任意一个管理员即可，其他普通用户无效', () => {
    const input = { ...base, creatorId: 'ellie' };
    expect(confirmationState(input, []).status).toBe('PENDING');
    expect(confirmationState(input, [{ actorId: 'other', decision: 'CONFIRM' }]).status).toBe(
      'PENDING',
    );
    for (const actorId of base.adminIds)
      expect(confirmationState(input, [{ actorId, decision: 'CONFIRM' }]).status).toBe('CONFIRMED');
  });
  it('追加异议覆盖创建时确认，只有原提出人后续确认才解除', () => {
    const decisions = [
      { actorId: 'ellie', decision: 'CONFIRM' },
      { actorId: 'dad', decision: 'DISPUTE' },
    ];
    expect(confirmationState(base, decisions).status).toBe('DISPUTED');
    expect(
      confirmationState(base, [...decisions, { actorId: 'mom', decision: 'CONFIRM' }]).status,
    ).toBe('DISPUTED');
    expect(
      confirmationState(base, [...decisions, { actorId: 'dad', decision: 'CONFIRM' }]).status,
    ).toBe('CONFIRMED');
  });
});
