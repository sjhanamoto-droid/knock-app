"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type JobPin = {
  id: string;
  title: string;
  companyName: string | null;
  compensationType: string;
  compensationAmount: number | null;
  latitude: number;
  longitude: number;
};

type ContractorPin = {
  id: string;
  name: string | null;
  logo: string | null;
  prefecture: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  connectionStatus: "connected" | "pending" | "none";
  occupationNames: string[];
};

type Props = {
  jobs?: JobPin[];
  contractors?: ContractorPin[];
  onSelectJob?: (jobId: string) => void;
  onSelectContractor?: (companyId: string) => void;
  flyTo?: { lng: number; lat: number; zoom?: number } | null;
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function formatCompensation(
  type: string,
  amount: number | null
): string {
  if (amount == null) return "応相談";
  const formatted = amount.toLocaleString("ja-JP");
  if (type === "DAILY") return `日給 ¥${formatted}`;
  if (type === "LUMP_SUM") return `一式 ¥${formatted}`;
  return `¥${formatted}`;
}

export default function SearchMap({ jobs, contractors, onSelectJob, onSelectContractor, flyTo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [139.7, 35.7],
      zoom: 10,
      language: "ja",
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("load", () => setReady(true));

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Job markers
    (jobs ?? []).forEach((job) => {
      const el = document.createElement("div");
      el.style.cssText = [
        "width:32px",
        "height:32px",
        "background:#3B82F6",
        "border:2px solid #fff",
        "border-radius:50%",
        "cursor:pointer",
        "box-shadow:0 2px 6px rgba(0,0,0,0.25)",
        "display:flex",
        "align-items:center",
        "justify-content:center",
      ].join(";");

      // Pin icon SVG inside marker
      el.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';

      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

      const popupContent = `
        <div style="min-width:180px;font-family:sans-serif;">
          <p style="font-size:13px;font-weight:700;margin:0 0 4px;color:#111;">${esc(job.title)}</p>
          <p style="font-size:12px;color:#555;margin:0 0 4px;">${esc(job.companyName ?? "")}</p>
          <p style="font-size:12px;color:#3B82F6;font-weight:600;margin:0;">${esc(formatCompensation(job.compensationType, job.compensationAmount))}</p>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 20, closeButton: true }).setHTML(popupContent);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([job.longitude, job.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!);

      if (onSelectJob) {
        el.addEventListener("click", () => onSelectJob(job.id));
      }

      markersRef.current.push(marker);
    });

    // Contractor markers
    (contractors ?? []).forEach((contractor) => {
      const el = document.createElement("div");
      el.style.cssText = [
        "width:40px",
        "height:40px",
        "background:#fff",
        "border:3px solid #C8A063",
        "border-radius:50%",
        "overflow:hidden",
        "cursor:pointer",
        "box-shadow:0 2px 8px rgba(0,0,0,0.2)",
        "display:flex",
        "align-items:center",
        "justify-content:center",
      ].join(";");

      if (contractor.logo) {
        el.innerHTML = `<img src="${contractor.logo}" style="width:40px;height:40px;object-fit:cover;border-radius:50%;" />`;
      } else {
        const initial = contractor.name?.charAt(0) ?? "?";
        el.innerHTML = `<div style="width:40px;height:40px;background:#C8A063;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;">${initial}</div>`;
      }

      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

      const statusMap = {
        connected: { bg: "#D1FAE5", color: "#065F46", label: "つながり済" },
        pending: { bg: "#FEF3C7", color: "#92400E", label: "リクエスト中" },
        none: { bg: "#F3F4F6", color: "#374151", label: "未つながり" },
      };
      const { bg: statusBg, color: statusColor, label: statusLabel } = statusMap[contractor.connectionStatus];

      const popupContent = `
        <div style="min-width:180px;font-family:sans-serif;">
          <p style="font-size:14px;font-weight:700;margin:0 0 4px;color:#111;">${esc(contractor.name ?? "")}</p>
          <p style="font-size:12px;color:#555;margin:0 0 4px;">${esc(contractor.prefecture ?? "")}${esc(contractor.city ?? "")}</p>
          <p style="font-size:11px;color:#888;margin:0 0 6px;">${esc(contractor.occupationNames.join(" / "))}</p>
          <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${statusBg};color:${statusColor};">
            ${statusLabel}
          </span>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 20, closeButton: true }).setHTML(popupContent);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([contractor.longitude, contractor.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!);

      el.addEventListener("click", () => onSelectContractor?.(contractor.id));

      markersRef.current.push(marker);
    });
  }, [ready, jobs, contractors, onSelectJob, onSelectContractor]);

  // flyTo: 親から指定された座標にマップを移動
  useEffect(() => {
    if (!ready || !mapRef.current || !flyTo) return;
    mapRef.current.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? 13,
      duration: 1500,
    });
  }, [ready, flyTo]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-gray-100 p-6">
        <p className="text-[14px] text-knock-text-muted">
          地図を表示するにはMapboxトークンが必要です
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full rounded-2xl overflow-hidden" />
  );
}
