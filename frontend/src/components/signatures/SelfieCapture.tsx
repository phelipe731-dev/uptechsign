import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCcw, Trash2 } from "lucide-react";

interface SelfieCaptureProps {
  value: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}

export default function SelfieCapture({
  value,
  onChange,
  disabled = false,
}: SelfieCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const hasCameraSupport = useMemo(
    () =>
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function",
    []
  );

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    if (disabled || !hasCameraSupport) return;

    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      stopCamera();
      streamRef.current = stream;
      setCameraOpen(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError(
        "Nao foi possivel acessar a camera. Voce pode enviar uma selfie da galeria como alternativa."
      );
      setCameraOpen(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  function triggerFilePicker() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function captureSelfie() {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 720;
    const height = video.videoHeight || 540;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    onChange(dataUrl);
    stopCamera();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  return (
    <div className="rounded-[10px] border border-[#E6EAF0] bg-[#FBFCFE] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#111827]">
            Selfie de confirmacao
          </div>
          <p className="mt-1 text-sm leading-6 text-[#4A5568]">
            Opcional. Registrar a selfie reforca a trilha de evidencias da assinatura.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startCamera}
            disabled={disabled || !hasCameraSupport}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-white px-3 py-2 text-sm font-medium text-[#4A5568] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera size={15} />
            Abrir camera
          </button>
          <button
            type="button"
            onClick={triggerFilePicker}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-white px-3 py-2 text-sm font-medium text-[#4A5568] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus size={15} />
            Enviar imagem
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {cameraError && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-[#FFF7ED] px-4 py-3 text-sm text-[#D97706]">
          {cameraError}
        </div>
      )}

      {cameraOpen && (
        <div className="mt-4 rounded-xl border border-[#E6EAF0] bg-white p-4">
          <div className="overflow-hidden rounded-xl border border-[#E6EAF0] bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={captureSelfie}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-lg bg-[#F59E0B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D97706] disabled:opacity-50"
            >
              <Camera size={15} />
              Capturar selfie
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-white px-4 py-2.5 text-sm font-medium text-[#4A5568] transition-colors hover:bg-[#F9FAFB]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {value && (
        <div className="mt-4 rounded-xl border border-[#E6EAF0] bg-white p-4">
          <div className="overflow-hidden rounded-xl border border-[#E6EAF0] bg-[#F7F9FC]">
            <img
              src={value}
              alt="Selfie de confirmacao"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startCamera}
              disabled={disabled || !hasCameraSupport}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-white px-3 py-2 text-sm font-medium text-[#4A5568] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50"
            >
              <RefreshCcw size={15} />
              Tirar novamente
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-white px-3 py-2 text-sm font-medium text-[#4A5568] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50"
            >
              <Trash2 size={15} />
              Remover selfie
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
