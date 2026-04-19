import { useMemo, useState } from "react";

function EyeOpenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      class="lucide lucide-eye-icon lucide-eye"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      class="lucide lucide-eye-off-icon lucide-eye-off"
    >
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export default function FormInput({
  label,
  id,
  type = "text",
  className = "",
  inputClassName = "",
  errorMessage,
  ...rest
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const resolvedType = useMemo(() => {
    if (!isPassword) return type;
    return showPassword ? "text" : "password";
  }, [isPassword, showPassword, type]);

  return (
    <div className={`app-input-field ${className}`.trim()}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      <div className={`app-input-wrap${isPassword ? " has-toggle" : ""}`}>
        <input
          id={id}
          type={resolvedType}
          className={inputClassName}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage && id ? `${id}-error` : undefined}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            className="app-input-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
          </button>
        ) : null}
      </div>
      {errorMessage ? (
        <p id={id ? `${id}-error` : undefined} className="login-field-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
