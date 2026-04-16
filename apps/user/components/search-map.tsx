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

type Props = {
  jobs: JobPin[];
  onSelectJob?: (jobId: string) => void;
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

export default function SearchMap({ jobs, onSelectJob }: Props) {
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
      center: [138.2, 36.2],
      zoom: 5,
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

    jobs.forEach((job) => {
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
  }, [ready, jobs, onSelectJob]);

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
