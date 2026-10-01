import { Compass, X } from "lucide-react";

/** Inline help stays dismissible and never interrupts a server workflow. */
export function WelcomeGuide({ onDismiss }: { onDismiss(): void }) {
  return (
    <section className="welcome-guide" aria-label="Docker quick start">
      <Compass size={20} aria-hidden="true" />
      <div>
        <strong>Your containers, in one workspace</strong>
        <p>
          Select a container to inspect its health, follow logs or open a shell.
          Use the checkboxes to manage several containers together.
        </p>
      </div>
      <button aria-label="Dismiss quick start" onClick={onDismiss}>
        <X size={15} />
      </button>
    </section>
  );
}
