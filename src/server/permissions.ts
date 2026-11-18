export type Actor = { id: string; role: string };
export function requireAdmin(actor: Actor) {
  if (actor.role !== 'ADMIN') throw new Error('仅管理员可执行此操作');
}
export function authorize(actor: Actor, subjectId: string) {
  if (actor.role !== 'ADMIN' && actor.id !== subjectId) throw new Error('没有权限访问该记录');
}
