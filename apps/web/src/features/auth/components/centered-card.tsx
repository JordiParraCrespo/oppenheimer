import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';

/** A card alone in the middle of the page, with its actions in the footer. */
export function CenteredCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardFooter>{children}</CardFooter>
      </Card>
    </div>
  );
}
