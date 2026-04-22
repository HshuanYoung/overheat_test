import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../types/game';

const CARD_CATALOG_STORAGE_KEY = 'card_catalog_v1';
let cachedCards: Card[] | null = null;
let cachedLookup: Map<string, Card> | null = null;
let inFlightRequest: Promise<Card[]> | null = null;

function buildLookup(cards: Card[]) {
  const lookup = new Map<string, Card>();

  for (const card of cards) {
    lookup.set(card.uniqueId, card);

    if (!lookup.has(card.id)) {
      lookup.set(card.id, card);
    }
  }

  return lookup;
}

async function fetchCardCatalog() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
  const res = await fetch(`${BACKEND_URL}/api/cards/meta`);

  if (!res.ok) {
    throw new Error(`Failed to fetch card catalog: ${res.status}`);
  }

  const data = await res.json();
  const cards = (data.cards || []) as Card[];

  cachedCards = cards;
  cachedLookup = buildLookup(cards);

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(CARD_CATALOG_STORAGE_KEY, JSON.stringify(cards));
    } catch {
      // Ignore storage quota / privacy mode failures.
    }
  }

  return cards;
}

function hydrateCardCatalogFromStorage() {
  if (cachedCards || typeof window === 'undefined') {
    return;
  }

  try {
    const stored = window.sessionStorage.getItem(CARD_CATALOG_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const cards = JSON.parse(stored) as Card[];
    cachedCards = cards;
    cachedLookup = buildLookup(cards);
  } catch {
    window.sessionStorage.removeItem(CARD_CATALOG_STORAGE_KEY);
  }
}

export async function prefetchCardCatalog() {
  hydrateCardCatalogFromStorage();

  if (cachedCards) {
    return cachedCards;
  }

  if (!inFlightRequest) {
    inFlightRequest = fetchCardCatalog().finally(() => {
      inFlightRequest = null;
    });
  }

  return inFlightRequest;
}

export function useCardCatalog() {
  hydrateCardCatalogFromStorage();

  const [cards, setCards] = useState<Card[]>(cachedCards || []);
  const [loading, setLoading] = useState(!cachedCards);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedCards) {
      return;
    }

    let active = true;

    prefetchCardCatalog()
      .then(nextCards => {
        if (!active) {
          return;
        }

        setCards(nextCards);
        setLoading(false);
      })
      .catch(err => {
        if (!active) {
          return;
        }

        console.error('Failed to load card catalog:', err);
        setError(err instanceof Error ? err.message : 'Failed to load card catalog');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const cardByReference = useMemo(
    () => cachedLookup || buildLookup(cards),
    [cards]
  );

  const getCardByReference = useCallback(
    (cardId?: string | null) => {
      if (!cardId) {
        return undefined;
      }

      return cardByReference.get(cardId);
    },
    [cardByReference]
  );

  return {
    cards,
    cardByReference,
    getCardByReference,
    loading,
    error
  };
}
