import { cva, type VariantProps } from "class-variance-authority";
import { Platform, Pressable } from "react-native";
import { cn } from "../../lib/utils";
import { TextClassContext } from "./text";

const buttonVariants = cva(
  cn(
    "group shrink-0 flex-row items-center justify-center gap-2 rounded-full shadow-none",
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    }),
  ),
  {
    variants: {
      variant: {
        default: cn(
          "bg-primary active:bg-primary/90",
          Platform.select({ web: "hover:bg-primary/90" }),
        ),
        destructive: cn(
          "bg-destructive active:bg-destructive/90",
          Platform.select({
            web: "hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
          }),
        ),
        outline: cn(
          "border-border-default bg-card active:bg-surface-hover border",
          Platform.select({
            web: "hover:bg-surface-hover",
          }),
        ),
        secondary: cn(
          "bg-secondary active:bg-secondary/80",
          Platform.select({ web: "hover:bg-secondary/80" }),
        ),
        // The white pill used on dark cards.
        inverse: cn(
          "bg-card active:bg-card/90",
          Platform.select({ web: "hover:bg-card/90" }),
        ),
        ghost: cn(
          "active:bg-accent",
          Platform.select({ web: "hover:bg-accent" }),
        ),
        link: "",
      },
      size: {
        default: cn(
          "h-10 px-5 py-2 sm:h-9",
          Platform.select({ web: "has-[>svg]:px-4" }),
        ),
        sm: cn(
          "h-9 gap-1.5 rounded-full px-3.5 sm:h-8",
          Platform.select({ web: "has-[>svg]:px-3" }),
        ),
        lg: cn(
          "h-11 rounded-full px-6 sm:h-10",
          Platform.select({ web: "has-[>svg]:px-5" }),
        ),
        icon: "h-10 w-10 sm:h-9 sm:w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const buttonTextVariants = cva(
  cn(
    "text-foreground text-base font-medium",
    Platform.select({ web: "pointer-events-none transition-colors" }),
  ),
  {
    variants: {
      variant: {
        default: "text-primary-foreground",
        destructive: "text-white",
        outline: cn(
          "group-active:text-accent-foreground",
          Platform.select({ web: "group-hover:text-accent-foreground" }),
        ),
        secondary: "text-secondary-foreground",
        inverse: "text-ink-900",
        ghost: "group-active:text-accent-foreground",
        link: cn(
          "text-primary group-active:underline",
          Platform.select({
            web: "underline-offset-4 hover:underline group-hover:underline",
          }),
        ),
      },
      size: {
        default: "",
        sm: "",
        lg: "",
        icon: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        className={cn(
          props.disabled && "opacity-50",
          buttonVariants({ variant, size }),
          className,
        )}
        role="button"
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export type { ButtonProps };
export { Button, buttonTextVariants, buttonVariants };
