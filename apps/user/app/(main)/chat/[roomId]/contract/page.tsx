import Link from "next/link";
import { getContractParties } from "@/lib/actions/chat";
import { SubcontractAgreementView } from "@/components/subcontract-agreement";
import { ContractDownloadButton } from "@/components/contract-download-button";

export default async function SubcontractContractPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const { ordererName, contractorName, matchedAt } = await getContractParties(roomId);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#F5F5F5]">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href={`/chat/${roomId}`}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="text-[16px] font-bold tracking-wide text-knock-text">工事下請基本契約書</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* 本文 */}
      <div className="px-4 pt-4 pb-10">
        <p className="text-[12px] text-center mb-4" style={{ color: "#9CA3AF" }}>
          マッチングした発注者・受注者間で取り交わす基本契約書です
        </p>
        <SubcontractAgreementView
          ordererName={ordererName}
          contractorName={contractorName}
          matchedAt={matchedAt}
        />

        {/* 最下部: PDFダウンロード */}
        <div className="mt-5">
          <ContractDownloadButton roomId={roomId} />
        </div>
      </div>
    </div>
  );
}
