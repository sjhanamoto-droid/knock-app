"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getOrders } from "@/lib/actions/orders";
import { getChatRoom } from "@/lib/actions/chat";

type OrderList = Awaited<ReturnType<typeof getOrders>>;
type Order = OrderList[number];

function getStatusInfo(status: string) {
  switch (status) {
    case "PENDING":
      return { label: "発注依頼中", color: "text-blue-500", stroke: "#3B82F6" };
    case "APPROVED":
      return { label: "受注了承", color: "text-blue-600", stroke: "#2563EB" };
    case "CONFIRMED":
      return { label: "発注確定", color: "text-green-600", stroke: "#16A34A" };
    case "REJECTED":
      return { label: "辞退", color: "text-red-500", stroke: "#EF4444" };
    case "CANCELLED":
      return { label: "キャンセル", color: "text-gray-500", stroke: "#6B7280" };
    default:
      return { label: status, color: "text-gray-500", stroke: "#6B7280" };
  }
}

export default function ChatOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId");
  const roomId = params.roomId as string;

  const [orders, setOrders] = useState<OrderList>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isOrderer, setIsOrderer] = useState(true);

  useEffect(() => {
    Promise.all([getOrders(), getChatRoom(roomId)])
      .then(([orderData, chatData]) => {
        const orderer =
          chatData.myCompanyType === "ORDERER" ||
          chatData.myCompanyType === "BOTH";
        setIsOrderer(orderer);

        if (companyId) {
          const filtered = orderData.filter(
            (o: Order) =>
              o.factoryFloor.company?.id === companyId ||
              o.factoryFloor.workCompany?.id === companyId ||
              o.workCompanyId === companyId
          );
          setOrders(filtered);
        } else {
          setOrders(orderData);
        }
      })
      .finally(() => setLoading(false));
  }, [roomId, companyId]);

  const filteredOrders = search
    ? orders.filter((o) =>
        o.factoryFloor.name?.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      {/* Header — V1: ← centered title */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="relative flex items-center justify-center px-4 py-3">
          <button
            onClick={() => router.back()}
            className="absolute left-4 flex h-10 w-10 items-center justify-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 5L8 12L15 19" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-[17px] font-bold text-knock-text">
            {isOrderer ? "発注一覧" : "受注一覧"}
          </h1>
        </div>
      </header>

      {/* Search — V1: gray pill, no border */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2.5">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 text-gray-400">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="担当者氏名検索"
            className="flex-1 bg-transparent text-[14px] text-knock-text placeholder:text-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Orders list — V1: flat rows with dividers */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-gray-400">
            {search
              ? "該当する発注がありません"
              : isOrderer
                ? "発注がありません"
                : "受注がありません"}
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Top border */}
            <div className="border-t border-gray-200" />

            {filteredOrders.map((order) => {
              const status = getStatusInfo(order.status ?? "");
              return (
                <button
                  key={order.id}
                  onClick={() => router.push(`/orders/${order.id}`)}
                  className="flex items-center gap-4 border-b border-gray-200 px-5 py-4 text-left transition-all active:bg-gray-50"
                >
                  {/* Status icon — V1: circle checkmark + label below */}
                  <div className="flex w-16 flex-col items-center gap-1">
                    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                      <circle cx="15" cy="15" r="13" stroke={status.stroke} strokeWidth="1.5" fill="none" />
                      <path d="M10 15L13.5 18.5L20 12" stroke={status.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className={`text-[10px] font-bold leading-none ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Site name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-knock-text">
                      {order.factoryFloor.name ?? "無題の現場"}
                    </p>
                  </div>

                  {/* Arrow — V1: blue filled circle */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 3L9 7L5 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
