// Maps a Cluster.colorTag to Tailwind classes. Keeping this as a static
// lookup (not string interpolation) so Tailwind's compiler can see every
// class name literally and doesn't purge them.
export const CLUSTER_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  violet: { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  sky: { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  teal: { bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500" },
  fuchsia: { bg: "bg-fuchsia-50", text: "text-fuchsia-700", dot: "bg-fuchsia-500" },
};

export function clusterColor(tag: string) {
  return CLUSTER_COLORS[tag] ?? CLUSTER_COLORS.indigo;
}
