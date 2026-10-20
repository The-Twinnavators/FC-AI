/**
 * A real FlowCode screenshot (apps/ui/public/guide/<name>.jpg, from scripts/guide-shots.mjs and the sample build
 * "Studio Bookings") with what to look for: the control ringed in purple. Hidden if the picture isn't there.
 */
import { useState } from "react";

export function GuideShot({ name, lookFor, alt }: { name: string; lookFor: string; alt: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    <figure className="guide-shot">
      <img src={`${import.meta.env.BASE_URL}guide/${name}.jpg`} alt={alt} loading="lazy" width={1440} height={900} onError={() => setMissing(true)} />
      <figcaption>
        <strong>Look for</strong> {lookFor}
      </figcaption>
    </figure>
  );
}
