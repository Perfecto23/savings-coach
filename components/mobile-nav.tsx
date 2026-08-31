"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { AppShellCopy } from "@/lib/app-shell/presentation";

export function MobileNav({
  className,
  copy,
}: {
  className?: string;
  copy: AppShellCopy;
}) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const mainTabs = [
    { href: "/", label: copy.mobile.home, icon: HomeIcon },
    { href: "/plan", label: copy.mobile.plan, icon: PlanIcon },
    { href: "/sop", label: copy.mobile.sop, icon: ChecklistIcon },
    { href: "/balances", label: copy.mobile.balances, icon: WalletIcon },
  ];
  const moreItems = [
    { href: "/income", label: copy.navigation.income },
    { href: "/milestones", label: copy.navigation.milestones },
    { href: "/impulse", label: copy.navigation.impulse },
    { href: "/settings", label: copy.navigation.settings },
  ];

  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {showMore && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setShowMore(false)}
          aria-label={copy.mobile.closeMore}
        />
      )}

      {showMore && (
        <nav id="mobile-more-menu" aria-label={copy.mobile.moreMenu} className="fixed bottom-16 left-0 right-0 z-50 mx-4 mb-2 rounded-2xl border border-orange-100 bg-white p-2 shadow-xl">
          {moreItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setShowMore(false)}
              className={`block rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-orange-100 text-orange-700"
                  : "text-stone-700 hover:bg-orange-50 hover:text-orange-950"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      <nav
        aria-label={copy.navigationLabel}
        className={`fixed bottom-0 left-0 right-0 z-50 border-t border-orange-100 bg-white/90 backdrop-blur-sm ${className ?? ""}`}
      >
        <div className="flex items-center justify-around py-2">
          {mainTabs.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
                  isActive ? "text-orange-600" : "text-gray-400"
                }`}
              >
                <item.icon className="h-6 w-6" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            aria-expanded={showMore}
            aria-controls="mobile-more-menu"
            className={`flex cursor-pointer flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
              isMoreActive ? "text-orange-600" : "text-gray-400"
            }`}
          >
            <MoreIcon className="h-6 w-6" />
            <span>{copy.mobile.more}</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function PlanIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5v-4.125m5.25 4.125v-7.875M15 19.5V8.25m5.25 11.25V4.5M3 19.5h18" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
    </svg>
  );
}
