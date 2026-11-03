// 解像度に依存しない、酒場の「星と軌道」の紋章。
export default function GuildEmblem({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth=".7" />
      <circle
        cx="40"
        cy="40"
        r="26"
        stroke="currentColor"
        strokeWidth=".5"
        strokeDasharray="1 5"
      />
      <ellipse
        cx="40"
        cy="40"
        rx="36"
        ry="12"
        transform="rotate(-35 40 40)"
        stroke="currentColor"
      />
      <path
        d="m40 10 6 23 22 7-22 6-6 24-6-24-22-6 22-7Z"
        fill="currentColor"
        fillOpacity=".16"
        stroke="currentColor"
      />
      <path
        d="m40 24 3 13 13 3-13 3-3 13-3-13-13-3 13-3Z"
        fill="currentColor"
      />
      <circle cx="68" cy="20" r="2.5" fill="currentColor" />
    </svg>
  );
}
