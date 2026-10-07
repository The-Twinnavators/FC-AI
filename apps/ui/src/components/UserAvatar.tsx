/**
 * The user's picture: their uploaded image in a circle, or by default a circle with a pyramid.
 */
export function UserAvatar({ src, size = 40, label }: { src?: string; size?: number; label?: string }) {
  const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };
  if (src) {
    return <img className="user-avatar" src={src} width={size} height={size} alt={label ?? ""} {...(label ? {} : { "aria-hidden": true })} />;
  }
  return (
    <span className="user-avatar user-avatar--default" style={{ width: size, height: size }} {...a11y}>
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="ua-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3d6ff0" />
            <stop offset="1" stopColor="#2a3b5f" />
          </linearGradient>
          <linearGradient id="ua-lit" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c7d6ff" />
            <stop offset="1" stopColor="#7d98e6" />
          </linearGradient>
          <linearGradient id="ua-shade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5b74c4" />
            <stop offset="1" stopColor="#33467f" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="20" fill="url(#ua-sky)" />
        {/* The pyramid: a lit face and a shaded face meeting at the apex. */}
        <path d="M20 9 L8.5 29 H20 Z" fill="url(#ua-lit)" />
        <path d="M20 9 L31.5 29 H20 Z" fill="url(#ua-shade)" />
        <path d="M20 9 L20 29" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
      </svg>
    </span>
  );
}

/** Reads an image file and returns a 160px square (centre-cropped) WebP data URL. */
export async function avatarFromFile(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("Choose a PNG, JPEG or WebP picture");
  if (file.size > 15_000_000) throw new Error("That picture is too large (over 15 MB)");
  // Read as a data: URL. blob: images are blocked by the app's security policy.
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("That picture couldn't be read"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("That picture couldn't be opened"));
    i.src = url;
  });
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't resize pictures");
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 160, 160);
  const webp = canvas.toDataURL("image/webp", 0.86);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.86);
}
