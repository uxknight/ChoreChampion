"use client";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import data from "@emoji-mart/data";

// Full searchable emoji picker (all system emojis + search), loaded client-only.
// @emoji-mart/react ships no types, so type the wrapper as accepting any props.
const Picker = dynamic(() => import("@emoji-mart/react"), { ssr: false }) as React.ComponentType<Record<string, unknown>>;

export function EmojiPickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="emoji-current" onClick={() => setOpen((o) => !o)}>
        <span className="emoji-current-glyph">{value || "🙂"}</span>
        <span className="muted">{open ? "Close" : "Tap to browse & search emojis"}</span>
      </button>
      {open && (
        <div className="emoji-picker-wrap">
          <Picker
            data={data}
            onEmojiSelect={(e: { native: string }) => {
              onChange(e.native);
              setOpen(false);
            }}
            theme="light"
            previewPosition="none"
            skinTonePosition="search"
            navPosition="top"
            dynamicWidth={true}
            autoFocus={true}
          />
        </div>
      )}
    </div>
  );
}
