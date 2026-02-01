import { Button } from "@/components/ui/button";

interface ContinueAsDemoButtonProps {
  isSubmitting?: boolean;
  onClick?: () => void;
}

export function ContinueAsDemoButton({ isSubmitting = false, onClick }: ContinueAsDemoButtonProps) {
  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full" onClick={onClick} disabled={isSubmitting}>
        {isSubmitting ? "Uruchamiam demo..." : "Kontynuuj jako demo"}
      </Button>
      <p className="text-xs text-neutral-500">
        Utworzymy tymczasową sesję bez hasła. Możesz później przejść na konto pełne.
      </p>
    </div>
  );
}
