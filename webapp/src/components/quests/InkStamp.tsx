export default function InkStamp({
  rank,
  cleared,
}: {
  rank: string;
  cleared: boolean;
}) {
  return (
    <span
      className={`ink-stamp absolute right-[14px] bottom-[19px] w-[89px] opacity-[0.86] [transform:rotate(var(--stamp-tilt))] mix-blend-multiply${cleared ? " is-cleared" : ""}`}
      aria-hidden="true"
    >
      <svg className="block w-full" viewBox="0 0 110 110" fill="none">
        <circle
          cx="55"
          cy="55"
          r="47"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray="89 2 40 3 70 1 88 3"
        />
        <circle cx="55" cy="55" r="41" stroke="currentColor" strokeWidth=".9" />
        <path d="M22 39h66M22 73h66" stroke="currentColor" strokeWidth=".7" />
        <text
          x="55"
          y="30"
          textAnchor="middle"
          fill="currentColor"
          fontSize="9"
          letterSpacing="2"
        >
          GUILD SEAL
        </text>
        <text
          x="55"
          y="70"
          textAnchor="middle"
          fill="currentColor"
          fontFamily="Georgia, Yu Mincho, serif"
          fontWeight="bold"
          fontSize={cleared ? "35" : "44"}
        >
          {cleared ? "済" : rank}
        </text>
        <text
          x="55"
          y="87"
          textAnchor="middle"
          fill="currentColor"
          fontSize="8"
          letterSpacing="2"
        >
          {cleared ? "COMPLETE" : "PRIORITY"}
        </text>
        <path d="m14 54 3-3 3 3-3 3ZM90 54l3-3 3 3-3 3Z" fill="currentColor" />
      </svg>
    </span>
  );
}
