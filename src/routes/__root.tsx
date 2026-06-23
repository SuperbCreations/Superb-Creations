import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useLocation,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { WhatsappFab } from "@/components/site/WhatsappFab";
import { CartSheet } from "@/components/site/CartSheet";
import { CartProvider } from "@/lib/cart";
import { AuthProvider, useAuth } from "@/lib/auth";
import {
  BusinessSettingsProvider,
  settingBool,
  useBusinessSettings,
} from "@/lib/business-settings";
import { usePageAnalytics } from "@/lib/analytics";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Superb Creations — Quietly Elegant Women's Wear" },
      {
        name: "description",
        content:
          "Superb Creations is a women's clothing and beauty boutique — handcrafted kurta sets, dresses, sarees and cosmetics. Order on WhatsApp.",
      },
      { name: "author", content: "Superb Creations" },
      { property: "og:title", content: "Superb Creations — Women's Boutique" },
      {
        property: "og:description",
        content: "Quietly elegant clothing and beauty essentials for the everyday woman.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Superb Creations" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BusinessSettingsProvider>
          <CartProvider>
            <SiteFrame />
            <Toaster position="top-center" />
          </CartProvider>
        </BusinessSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function SiteFrame() {
  const { isAdmin, user } = useAuth();
  const location = useLocation();
  const { settings } = useBusinessSettings();
  const maintenance = settingBool(settings, "maintenance_mode") && !isAdmin;
  usePageAnalytics(user?.id, location.pathname);

  if (maintenance) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div className="max-w-md">
          <p className="eyebrow">{settings.store_name}</p>
          <h1 className="mt-3 font-display text-4xl">Store is temporarily paused</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {settings.maintenance_message}
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <WhatsappFab />
      <CartSheet />
    </>
  );
}
