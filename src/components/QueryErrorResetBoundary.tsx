import { Component, PropsWithChildren, ReactNode } from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorFallbackProps {
  error: Error;
  onRetry: () => void;
}

export function QueryErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="flex flex-col items-center gap-4 py-8 sm:py-12">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div className="text-center space-y-1">
          <h3 className="font-semibold text-base sm:text-lg">Failed to load data</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {error.message || "Something went wrong while fetching data. Please try again."}
          </p>
        </div>
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

interface Props extends PropsWithChildren {
  fallback?: (props: ErrorFallbackProps) => ReactNode;
}

interface State {
  error: Error | null;
}

export class QueryErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      const Fallback = this.props.fallback ?? QueryErrorFallback;
      return <Fallback error={error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
