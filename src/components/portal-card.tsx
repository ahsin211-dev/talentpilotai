import Link from "next/link";

type PortalCardProps = {
  href: string;
  title: string;
  description: string;
  audience: string;
};

export const PortalCard = ({ href, title, description, audience }: PortalCardProps) => (
  <Link
    href={href}
    className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow md:p-6 dark:border-zinc-800 dark:bg-zinc-900"
  >
    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{audience}</p>
    <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
  </Link>
);
