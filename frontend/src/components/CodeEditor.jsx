import "../lib/vendorCodeMirror.js";
import { useEffect, useRef } from "react";

export default function CodeEditor({ value, language, onChange }) {
  const containerRef = useRef(null);
  const cmRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const suppressChangeRef = useRef(false);

  onChangeRef.current = onChange;

  // Create CodeMirror once.
  useEffect(() => {
    if (!containerRef.current || !window.CodeMirror) return;

    const cm = window.CodeMirror(containerRef.current, {
      value: value || "",
      mode: language === "javascript" ? "javascript" : "python",
      theme: "dracula",
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      viewportMargin: Infinity,
    });

    cm.on("change", (instance) => {
      if (suppressChangeRef.current) return;

      onChangeRef.current?.(instance.getValue());
    });

    cmRef.current = cm;

    requestAnimationFrame(() => {
      cm.refresh();
    });

    return () => {
      cmRef.current = null;
    };
  }, []);

  // Keep CodeMirror synchronized with incoming React value.
  useEffect(() => {
    const cm = cmRef.current;

    if (!cm) return;

    const nextValue = value || "";

    if (cm.getValue() === nextValue) return;

    const cursor = cm.getCursor();

    suppressChangeRef.current = true;

    cm.setValue(nextValue);

    cm.setCursor(cursor);

    suppressChangeRef.current = false;

    requestAnimationFrame(() => {
      cm.refresh();
    });
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="cm-host rounded-xl overflow-hidden border border-border"
    />
  );
}