import {
  type BusinessSettings,
  settingBool,
  settingNumber,
} from "@/lib/business-settings";

export type ShippingMode = "standard" | "express";

export type ShippingOption = {
  key: ShippingMode;
  label: string;
  fee: number;
  estimate: string;
};

export function getShippingOptions(settings: BusinessSettings): ShippingOption[] {
  const options: ShippingOption[] = [];
  if (settingBool(settings, "standard_shipping_enabled")) {
    options.push({
      key: "standard",
      label: "Standard shipping",
      fee: settingNumber(settings, "flat_shipping"),
      estimate: settings.standard_delivery_estimate || settings.estimated_delivery || "3-7 business days",
    });
  }
  if (settingBool(settings, "express_shipping")) {
    options.push({
      key: "express",
      label: "Express shipping",
      fee: settingNumber(settings, "express_shipping_fee"),
      estimate: settings.express_delivery_estimate || "1-3 business days",
    });
  }
  return options;
}

export function getShippingOption(settings: BusinessSettings, mode?: string) {
  const options = getShippingOptions(settings);
  return options.find((option) => option.key === mode) ?? options[0] ?? null;
}

