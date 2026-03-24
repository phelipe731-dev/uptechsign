import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { RotateCcw } from "lucide-react";

interface SignaturePadProps {
  onSignature: (dataUrl: string) => void;
  disabled?: boolean;
  initialValue?: string;
}

const CANVAS_HEIGHT = 200;

export default function SignaturePad({
  onSignature,
  disabled = false,
  initialValue = "",
}: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastLoadedValueRef = useRef<string>("");
  const [isEmpty, setIsEmpty] = useState(true);

  // Sync canvas internal resolution with actual rendered size to avoid distortion
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncSize = () => {
      const canvas = sigRef.current?.getCanvas();
      if (!canvas) return;
      const { width } = container.getBoundingClientRect();
      if (width === 0) return;
      const dpr = window.devicePixelRatio || 1;
      // Set internal resolution matching physical pixels
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(CANVAS_HEIGHT * dpr);
      // Scale context so drawing coordinates match CSS pixels
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };

    const observer = new ResizeObserver(syncSize);
    observer.observe(container);
    syncSize();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = sigRef.current;
    if (!canvas) return;

    if (initialValue === lastLoadedValueRef.current) return;

    if (!initialValue) {
      canvas.clear();
      setIsEmpty(true);
      lastLoadedValueRef.current = "";
      return;
    }

    try {
      canvas.clear();
      canvas.fromDataURL(initialValue, { ratio: 1 });
      setIsEmpty(false);
      lastLoadedValueRef.current = initialValue;
    } catch {
      canvas.clear();
      setIsEmpty(true);
      lastLoadedValueRef.current = "";
    }
  }, [initialValue]);

  function handleEnd() {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      setIsEmpty(false);
      const dataUrl = sigRef.current.toDataURL("image/png");
      lastLoadedValueRef.current = dataUrl;
      onSignature(dataUrl);
    }
  }

  function handleClear() {
    sigRef.current?.clear();
    setIsEmpty(true);
    lastLoadedValueRef.current = "";
    onSignature("");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">
          Desenhe sua assinatura
        </label>
        {!isEmpty && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RotateCcw size={12} />
            Limpar
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className={`border rounded-lg overflow-hidden ${
          disabled
            ? "border-gray-200 opacity-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <SignatureCanvas
          ref={sigRef}
          penColor="#1e40af"
          backgroundColor="#ffffff"
          minWidth={1.5}
          maxWidth={3}
          velocityFilterWeight={0.7}
          canvasProps={{
            style: {
              width: "100%",
              height: `${CANVAS_HEIGHT}px`,
              display: "block",
              pointerEvents: disabled ? "none" : "auto",
            },
          }}
          onEnd={handleEnd}
        />
      </div>
      {isEmpty && (
        <p className="text-xs text-gray-400 mt-1.5">
          Use o mouse ou o dedo para desenhar sua assinatura acima.
        </p>
      )}
    </div>
  );
}
