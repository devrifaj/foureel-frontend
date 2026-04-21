export default function LoadingSpinner({ size = 18, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-loader-circle-icon lucide-loader-circle ${className}`.trim()}
      aria-hidden="true"
    >
      <g>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        <animateTransform
          attributeName="transform"
          attributeType="XML"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </g>
    </svg>
  );
}
