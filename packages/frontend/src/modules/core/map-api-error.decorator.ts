import { type ErrorDefinition, toAppError } from './errors';

/**
 * Marks a repository method as an API call, mapping anything it throws into an
 * {@link AppError} built from `fallback`.
 *
 * The method body stays a plain call — no closure to wrap it in — and the
 * failure it reports is declared next to its signature:
 *
 * ```ts
 * @injectable()
 * export class UsersRepository {
 *   @MapApiError(UsersErrors.FETCH_FAILED)
 *   async me(): Promise<UserEntity> {
 *     const data = await UsersApi.me();
 *     if (!data) throw new AppError(UsersErrors.FETCH_FAILED);
 *     return toEntity(data);
 *   }
 * }
 * ```
 *
 * An `AppError` thrown by the method itself passes through untouched, so a
 * handler that already knows what went wrong keeps its own diagnosis.
 */
export function MapApiError(fallback: ErrorDefinition) {
  return <TArgs extends unknown[], TResult>(
    _target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: TArgs) => Promise<TResult>>,
  ): void => {
    const method = descriptor.value;

    if (typeof method !== 'function') {
      throw new TypeError(
        `@MapApiError can only decorate methods; "${String(propertyKey)}" is not one.`,
      );
    }

    descriptor.value = async function mapApiError(this: unknown, ...args: TArgs): Promise<TResult> {
      try {
        return await method.apply(this, args);
      } catch (error) {
        throw toAppError(error, fallback);
      }
    };
  };
}
