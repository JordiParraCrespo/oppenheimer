import { useEffect, useState } from 'react';
import { rememberModelFavourites, storedModelFavourites } from '../lib/model-favourites';

/**
 * The engine picker's starred models, and the setter the stars call.
 * localStorage: the stars outlive the page on this device.
 */
export function useModelFavourites(): [string[], (favourites: string[]) => void] {
  const [favourites, setFavourites] = useState<string[]>(storedModelFavourites);

  useEffect(() => rememberModelFavourites(favourites), [favourites]);

  return [favourites, setFavourites];
}
