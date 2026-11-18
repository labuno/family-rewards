import { database } from '../../../server/db';
import { createMiniHandler } from '../../../server/mini-api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  return createMiniHandler(database())(request);
}
export function POST(request: Request) {
  return createMiniHandler(database())(request);
}
