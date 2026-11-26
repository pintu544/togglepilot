import flagsmith from "@flagsmith/flagsmith";

export function CTA() {
  return <button onClick={() => flagsmith.trackEvent('cta_clicked')}>Learn more</button>;
}
