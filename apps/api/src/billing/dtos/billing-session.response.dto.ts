import { ApiProperty } from '@nestjs/swagger';

/** A Stripe-hosted URL (Checkout or Customer Portal) for the browser to open. */
export class BillingSessionResponseDto {
  @ApiProperty({ description: 'Stripe-hosted URL to redirect the browser to.' })
  url!: string;
}
