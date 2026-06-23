import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { settingBool, useBusinessSettings } from "@/lib/business-settings";
import { useTrendingProducts } from "@/lib/growth";

export function SocialProof() {
  const { settings } = useBusinessSettings();
  const enabled = settingBool(settings, "enable_social_proof");
  const { data: products = [] } = useTrendingProducts(3);
  const [visible, setVisible] = useState(false);
  const product = products[0];

  useEffect(() => {
    if (!enabled || !product) return;
    const show = window.setTimeout(() => setVisible(true), 5000);
    const hide = window.setTimeout(() => setVisible(false), 13000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [enabled, product]);

  if (!enabled || !product || !visible) return null;

  return (
    <div className="fixed bottom-5 left-5 z-40 hidden max-w-xs items-center gap-3 rounded-sm border border-border bg-background p-3 shadow-soft md:flex">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush">
        <TrendingUp size={15} />
      </span>
      <p className="text-xs leading-5">
        <span className="font-medium">{product.name}</span>
        <span className="text-muted-foreground"> is trending right now.</span>
      </p>
    </div>
  );
}
