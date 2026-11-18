type ConfirmationParties = {
  subjectId: string;
  creatorId: string;
  adminIds: string[];
};
type Decision = { actorId: string; decision: string };
export function confirmationState(parties: ConfirmationParties, decisions: Decision[]) {
  const latest = new Map([[parties.creatorId, 'CONFIRM']]);
  for (const decision of decisions) latest.set(decision.actorId, decision.decision);
  const approvedIds = [...latest].filter(([, value]) => value === 'CONFIRM').map(([id]) => id);
  const status = [...latest.values()].includes('DISPUTE')
    ? 'DISPUTED'
    : approvedIds.includes(parties.subjectId) &&
        parties.adminIds.some((id) => approvedIds.includes(id))
      ? 'CONFIRMED'
      : 'PENDING';
  return { status, approvedIds };
}
