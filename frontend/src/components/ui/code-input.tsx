import { cn } from "@/lib/utils"

type CodeInputProps = {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  length?: number
  invalid?: boolean
  autoFocus?: boolean
  className?: string
}

function CodeInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  length = 6,
  invalid,
  autoFocus,
  className,
}: CodeInputProps) {
  const active = Math.min(value.length, length - 1)

  return (
    <div
      className={cn(
        "group/code relative flex w-fit gap-2",
        className,
      )}
    >
      {Array.from({ length }, (_, index) => (
        <div
          key={index}
          aria-hidden
          className={cn(
            "flex size-11 items-center justify-center border border-input bg-transparent text-lg font-semibold dark:bg-input/30",
            invalid && "border-destructive",
            index === active &&
              "group-focus-within/code:border-primary group-focus-within/code:ring-3 group-focus-within/code:ring-ring/50",
          )}
        >
          {value[index] ?? ""}
        </div>
      ))}
      <input
        id={id}
        name={name}
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, length))
        }
        onBlur={onBlur}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        aria-invalid={invalid}
        className="absolute inset-0 size-full cursor-text opacity-0"
      />
    </div>
  )
}

export { CodeInput }
