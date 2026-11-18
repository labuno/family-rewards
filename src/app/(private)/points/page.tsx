import { WalletPage } from '../../../components/wallet-page';
import type { Search } from '../../../server/view';
export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return <WalletPage asset="POINTS" search={await searchParams} />;
}
