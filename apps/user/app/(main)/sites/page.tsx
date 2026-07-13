import { getServerMode } from "@/lib/mode-server";
import {
  getProjectSites,
  getChildSites,
  getContractorSites,
  getSiteName,
} from "@/lib/actions/sites";
import { SitesClient } from "./sites-client";

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ parentId?: string }>;
}) {
  const { parentId } = await searchParams;
  const modeData = await getServerMode();

  // 受注者: 従来どおり自社が受注する工事のフラット一覧（ステータス別）
  if (!modeData.isOrderer) {
    const sites = await getContractorSites();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <SitesClient key="contractor" viewMode="child" initialSites={sites as any} />;
  }

  // 発注者 + 親を選択済み: その親配下の子工事一覧（ステータス別）
  if (parentId) {
    const [sites, parent] = await Promise.all([
      getChildSites(parentId),
      getSiteName(parentId),
    ]);
    return (
      <SitesClient
        // 画面ごとに key を変え、親↔子の遷移で必ず再マウント（タブ/一覧の状態をリセット）
        key={`child-${parentId}`}
        viewMode="child"
        parentId={parentId}
        parentInfo={parent}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialSites={sites as any}
      />
    );
  }

  // 発注者 + トップ: 親プロジェクト一覧（完了前/完了後）
  const projects = await getProjectSites("before");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <SitesClient key="project" viewMode="project" initialSites={projects as any} />;
}
