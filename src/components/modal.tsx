"use client";
import React, { useState } from "react";

// ---- imperative confirm/prompt dialogs (window.confirm/prompt are blocked in
// the app's embedded browser, so we render our own) ----
export type Dialog =
  | { kind: "confirm"; message: string; confirmLabel: string; danger: boolean; resolve: (v: boolean) => void }
  | { kind: "prompt"; message: string; value: string; confirmLabel: string; resolve: (v: number | null) => void };

export function DialogHost({ dialog, onClose }: { dialog: Dialog; onClose: () => void }) {
  const [val, setVal] = useState(dialog.kind === "prompt" ? dialog.value : "");
  const cancel = () => {
    if (dialog.kind === "confirm") dialog.resolve(false);
    else dialog.resolve(null);
    onClose();
  };
  const ok = () => {
    if (dialog.kind === "confirm") dialog.resolve(true);
    else {
      const n = parseFloat(val);
      dialog.resolve(Number.isFinite(n) ? n : null);
    }
    onClose();
  };
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && cancel()}>
      <div className="modal">
        <h3>{dialog.kind === "confirm" ? "Please confirm" : "How many points?"}</h3>
        <div className="muted" style={{ marginBottom: 12, whiteSpace: "pre-line", fontSize: 14, lineHeight: 1.5 }}>
          {dialog.message}
        </div>
        {dialog.kind === "prompt" && (
          <div className="field">
            <input
              type="number"
              step="0.5"
              value={val}
              autoFocus
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ok()}
            />
          </div>
        )}
        <div className="row">
          <button className="btn ghost grow" onClick={cancel}>
            Cancel
          </button>
          <button className={"btn grow" + (dialog.kind === "confirm" && dialog.danger ? " red" : "")} onClick={ok}>
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type Field = {
  label: string;
  type?: "text" | "number";
  step?: string;
  value?: string | number;
  options?: { v: string; t: string }[];
};

// Bottom-sheet form modal — the React equivalent of the prototype's openForm().
export function FormModal({
  title,
  fields,
  onCancel,
  onSave,
}: {
  title: string;
  fields: Field[];
  onCancel: () => void;
  onSave: (values: (string | number)[]) => void;
}) {
  const [vals, setVals] = useState<(string | number)[]>(
    fields.map((f) => (f.value == null ? (f.options ? f.options[0].v : "") : f.value))
  );
  const set = (i: number, v: string) =>
    setVals((prev) => prev.map((x, j) => (j === i ? v : x)));

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <h3>{title}</h3>
        {fields.map((f, i) => (
          <div className="field" key={i}>
            <label>{f.label}</label>
            {f.options ? (
              <select value={String(vals[i])} onChange={(e) => set(i, e.target.value)}>
                {f.options.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.t}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type || "text"}
                step={f.step}
                value={String(vals[i])}
                onChange={(e) => set(i, e.target.value)}
              />
            )}
          </div>
        ))}
        <div className="row">
          <button className="btn ghost grow" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn grow"
            onClick={() =>
              onSave(
                fields.map((f, i) => (f.type === "number" ? parseFloat(String(vals[i])) : vals[i]))
              )
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
