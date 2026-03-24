type PhSignLogoProps = {
  className?: string;
  markClassName?: string;
  mode?: "full" | "mark";
  alt?: string;
};

export default function PhSignLogo({
  className,
  markClassName,
  mode = "full",
  alt = "Uptech Sign",
}: PhSignLogoProps) {
  if (mode === "mark") {
    return <img src="/phsign-mark.svg" alt={alt} className={markClassName ?? className} />;
  }

  return <img src="/phsign-logo.svg" alt={alt} className={className} />;
}
