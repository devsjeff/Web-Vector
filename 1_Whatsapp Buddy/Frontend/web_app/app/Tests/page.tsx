"use client";

import { Services } from "./config";
import { useState, useEffect, useRef } from "react";

export default function Page() {
  const [popup_status, set_popup_status] = useState(true);
  const [now, set_now] = useState<(typeof Services)[number] | null>(null);

  const parentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ClickManager = (event: MouseEvent) => {
      if (
        popup_status &&
        parentRef.current &&
        !parentRef.current.contains(event.target as Node)
      ) {
        set_popup_status(false);
      }
    };

    document.addEventListener("mousedown", ClickManager);

    return () => {
      document.removeEventListener("mousedown", ClickManager);
    };
  }, [popup_status]);

  const handleServiceClick = (item: (typeof Services)[number]) => {
    if (item === now) {
      set_popup_status((prev) => !prev);
    } else {
      set_now(item);
      set_popup_status(true);
    }
  };

  return (
    <div
      ref={parentRef}
      style={{
        display: "flex",
        flexDirection: "row",
        cursor: "pointer",
        border: "solid 1px yellow",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          border: "solid 1px yellow",
        }}
      >
        {Services.map((item) => (
          <span
            key={item.name}
            onClick={() => handleServiceClick(item)}
          >
            {item.name}
          </span>
        ))}
      </div>

      <div
        style={{
          marginLeft: "20%",
          border: "solid 1px yellow",
        }}
      >
        {popup_status && now && <now.Component />}
      </div>
    </div>
  );
}