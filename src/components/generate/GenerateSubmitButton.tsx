import { Button } from "@/components/ui/button";

interface GenerateSubmitButtonProps {
  disabled: boolean;
  loading: boolean;
  label?: string;
}

export function GenerateSubmitButton({ disabled, loading, label = "Generuj" }: GenerateSubmitButtonProps) {
  return (
    <Button type="submit" disabled={disabled} aria-busy={loading}>
      {loading ? "Generuję..." : label}
    </Button>
  );
}
