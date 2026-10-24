"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  createContext,
  useContext,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

const FeedbackContext = createContext<(message: string) => void>(() => {});

export function InteractionProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  return (
    <TooltipPrimitive.Provider delayDuration={350}>
      <FeedbackContext.Provider value={setMessage}>
        {children}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {message}
        </div>
      </FeedbackContext.Provider>
    </TooltipPrimitive.Provider>
  );
}

export const useActionFeedback = () => useContext(FeedbackContext);

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          className="tooltip"
          sideOffset={6}
          collisionPadding={12}
        >
          {label}
          <TooltipPrimitive.Arrow className="tooltip-arrow" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
