"use client";
import React, { useState } from "react";

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
